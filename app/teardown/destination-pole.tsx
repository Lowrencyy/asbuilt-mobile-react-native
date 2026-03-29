import api from "@/lib/api";
import { cacheGet, cacheSet } from "@/lib/cache";
import { gpsQueueFlush, gpsQueueGet, gpsQueueHasPole, gpsQueuePush } from "@/lib/gps-queue";
import * as FileSystem from "expo-file-system/legacy";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as MediaLibrary from "expo-media-library";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const SLOTS = ["DA", "C1", "C2", "C3", "C4", "C5"] as const;

type PhotoField = { uri: string; name: string; type: string } | null;

type GpsData = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  captured_at: string;
};

function sanitize(s?: string) {
  return (s ?? "").toLowerCase().trim().replace(/[^a-z0-9_-]/g, "_");
}

function StepBadge({ done, label }: { done: boolean; label: string }) {
  return (
    <View style={[styles.stepBadge, done && styles.stepBadgeDone]}>
      <Text style={[styles.stepBadgeText, done && styles.stepBadgeTextDone]}>
        {done ? "✓" : "•"} {label}
      </Text>
    </View>
  );
}

function PhotoCard({
  label,
  photo,
  onPress,
  required,
  accentColor,
  subtitle,
}: {
  label: string;
  photo: PhotoField;
  onPress: () => void;
  required?: boolean;
  accentColor: string;
  subtitle?: string;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.photoCard,
        photo ? { borderColor: accentColor, backgroundColor: "#FFFFFF" } : {},
      ]}
      activeOpacity={0.88}
      onPress={onPress}
    >
      <View style={[styles.photoCardGlow, photo ? { backgroundColor: `${accentColor}12` } : undefined]} />
      <View style={styles.photoHeader}>
        <View style={[styles.photoHeaderIconWrap, photo ? { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}28` } : undefined]}>
          <Text style={styles.photoHeaderIcon}>
            {label === "Before" ? "🧰" : label === "After" ? "✅" : "🏷️"}
          </Text>
        </View>
        <View style={styles.photoHeaderTextWrap}>
          <Text style={styles.photoTitle}>{label}{required ? " *" : ""}</Text>
          <Text style={styles.photoSubtitle}>{subtitle ?? "Tap to capture image"}</Text>
        </View>
      </View>
      <View style={styles.photoBody}>
        {photo ? (
          <Image source={{ uri: photo.uri }} style={styles.photoPreview} resizeMode="cover" />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoPlaceholderIcon}>📷</Text>
            <Text style={styles.photoPlaceholderText}>Tap to capture</Text>
          </View>
        )}
      </View>
      <View style={styles.photoFooter}>
        <View style={[styles.photoStatePill, photo ? { backgroundColor: "#DCFCE7" } : { backgroundColor: "#F1F5F9" }]}>
          <Text style={[styles.photoStateText, photo ? { color: "#166534" } : { color: "#64748B" }]}>
            {photo ? "Captured" : "Not yet captured"}
          </Text>
        </View>
        <View style={[styles.photoActionBtn, { backgroundColor: accentColor }]}>
          <Text style={styles.photoActionText}>{photo ? "Retake" : "Capture"}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function DestinationPoleScreen() {
  const params = useLocalSearchParams<{
    pole_code: string;
    pole_name: string;
    node_id: string;
    project_id: string;
    project_name: string;
    accent: string;
    span_id: string;
    span_code: string;
    to_pole_id: string;
    to_pole_code: string;
    to_pole_name: string;
    expected_cable: string;
    length_meters: string;
    declared_runs: string;
    expected_node: string;
    expected_amplifier: string;
    expected_extender: string;
    expected_tsc: string;
    expected_powersupply: string;
    expected_powersupply_housing: string;
  }>();

  const accentColor = params.accent || "#334155";
  const projFolder  = sanitize(params.project_name);
  const toPoleCode  = sanitize(params.to_pole_code);
  const draftDir    = `${FileSystem.documentDirectory}teardown_drafts/${projFolder}/${params.node_id}/${params.pole_code}/`;

  const F = {
    before: `${toPoleCode}_before.jpg`,
    after:  `${toPoleCode}_after.jpg`,
    tag:    `${toPoleCode}_poletag.jpg`,
  };

  const [photoBefore, setPhotoBefore] = useState<PhotoField>(null);
  const [photoAfter,  setPhotoAfter]  = useState<PhotoField>(null);
  const [photoTag,    setPhotoTag]    = useState<PhotoField>(null);
  const [slot,        setSlot]        = useState("");
  const [landmark,    setLandmark]    = useState("");

  const [gpsAccuracy,  setGpsAccuracy]  = useState<number | null>(null);
  const [capturedGps,  setCapturedGps]  = useState<GpsData | null>(null);
  const [gpsCapturing, setGpsCapturing] = useState(false);
  const [gpsQueued,    setGpsQueued]    = useState(false);

  const toPoleGpsRef    = useRef<GpsData | null>(null);
  const locationWatcher = useRef<Location.LocationSubscription | null>(null);

  const hasGps    = !!capturedGps;
  const canProceed = hasGps && !!photoBefore && !!photoAfter && !!photoTag && !!slot && !!landmark.trim();

  const progress = useMemo(() => {
    const completed = [hasGps, !!photoBefore, !!photoAfter, !!photoTag, !!slot].filter(Boolean).length;
    return { completed, total: 5, percent: Math.round((completed / 5) * 100) };
  }, [hasGps, photoBefore, photoAfter, photoTag, slot]);

  // Persist slot/landmark so back navigation restores them
  useEffect(() => { cacheSet(`draft_slot_${params.to_pole_id}`, slot).catch(() => {}); }, [slot]);
  useEffect(() => { cacheSet(`draft_landmark_${params.to_pole_id}`, landmark).catch(() => {}); }, [landmark]);

  // Mount: flush GPS queue, restore drafts + cached slot/landmark
  useEffect(() => {
    gpsQueueFlush().catch(() => {});
    gpsQueueHasPole(params.to_pole_id).then((has) => { if (has) setGpsQueued(true); }).catch(() => {});

    // Pre-load GPS: cache → queue → API (user doesn't re-capture if already done)
    cacheGet<{ lat: number; lng: number }>(`pole_gps_${params.to_pole_id}`).then(async (g) => {
      if (g?.lat && g?.lng) {
        setCapturedGps({ latitude: g.lat, longitude: g.lng, accuracy: null, captured_at: new Date().toISOString() });
      } else {
        const q = await gpsQueueGet(params.to_pole_id);
        if (q?.lat && q?.lng) {
          setCapturedGps({ latitude: q.lat, longitude: q.lng, accuracy: null, captured_at: new Date().toISOString() });
        }
      }
    }).catch(() => {});

    api.get(`/poles/${params.to_pole_id}`).then(({ data }) => {
      const d = data?.data ?? data;
      if (d?.map_latitude && d?.map_longitude) {
        const lat = Number(d.map_latitude);
        const lng = Number(d.map_longitude);
        if (lat && lng) {
          setCapturedGps((prev) => prev ?? { latitude: lat, longitude: lng, accuracy: null, captured_at: new Date().toISOString() });
          cacheSet(`pole_gps_${params.to_pole_id}`, { lat, lng }).catch(() => {});
        }
      }
    }).catch(() => {});

    cacheGet<string>(`draft_slot_${params.to_pole_id}`).then((v) => { if (v) setSlot(v); }).catch(() => {});
    cacheGet<string>(`draft_landmark_${params.to_pole_id}`).then((v) => { if (v) setLandmark(v); }).catch(() => {});

    // Copy from-pole photos from pole_drafts → teardown_drafts (may already exist if select-pair ran)
    const fromCode    = sanitize(params.pole_code);
    const srcDir  = `${FileSystem.documentDirectory}pole_drafts/${projFolder}/${params.node_id}/${params.pole_code}/`;
    const copyDir = `${FileSystem.documentDirectory}teardown_drafts/${projFolder}/${params.node_id}/${params.pole_code}/`;
    FileSystem.makeDirectoryAsync(copyDir, { intermediates: true }).then(() => {
      const files = [
        { src: `pole_${params.pole_code}_before.jpg`,   dest: `${fromCode}_before.jpg`   },
        { src: `pole_${params.pole_code}_after.jpg`,    dest: `${fromCode}_after.jpg`    },
        { src: `pole_${params.pole_code}_poletag.jpg`,  dest: `${fromCode}_poletag.jpg`  },
      ];
      files.forEach(async (f) => {
        const srcPath  = srcDir  + f.src;
        const destPath = copyDir + f.dest;
        const [srcInfo, destInfo] = await Promise.all([
          FileSystem.getInfoAsync(srcPath),
          FileSystem.getInfoAsync(destPath),
        ]);
        if (srcInfo.exists && !destInfo.exists) {
          FileSystem.copyAsync({ from: srcPath, to: destPath }).catch(() => {});
        }
      });
    }).catch(() => {});

    (async () => {
      await FileSystem.makeDirectoryAsync(draftDir, { intermediates: true });
      const load = async (file: string): Promise<PhotoField | null> => {
        const path = draftDir + file;
        const info = await FileSystem.getInfoAsync(path);
        if (!info.exists) return null;
        return { uri: info.uri, name: file, type: "image/jpeg" };
      };
      const [b, a, t] = await Promise.all([load(F.before), load(F.after), load(F.tag)]);
      if (b) setPhotoBefore(b);
      if (a) setPhotoAfter(a);
      if (t) setPhotoTag(t);
    })();
  }, []);

  // Live GPS watcher
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Highest, distanceInterval: 1, timeInterval: 2000 },
        (loc) => {
          if (!mounted) return;
          toPoleGpsRef.current = {
            latitude:    loc.coords.latitude,
            longitude:   loc.coords.longitude,
            accuracy:    loc.coords.accuracy,
            captured_at: new Date(loc.timestamp).toISOString(),
          };
          setGpsAccuracy(Math.round(loc.coords.accuracy ?? 999));
        },
      );
      if (mounted) locationWatcher.current = sub;
      else sub.remove();
    })();
    return () => {
      mounted = false;
      locationWatcher.current?.remove();
      locationWatcher.current = null;
    };
  }, []);

  async function captureGps() {
    const coords = toPoleGpsRef.current;
    if (!coords) { Alert.alert("GPS not ready", "Still acquiring signal. Please wait."); return; }
    setGpsCapturing(true);
    try {
      setCapturedGps({ ...coords });
      // Cache immediately so pole-detail shows GPS instantly when this pole becomes the next FROM
      cacheSet(`pole_gps_${params.to_pole_id}`, { lat: coords.latitude, lng: coords.longitude }).catch(() => {});
      try {
        await api.post(`/poles/${params.to_pole_id}/gps`, {
          map_latitude:  coords.latitude,
          map_longitude: coords.longitude,
        });
        setGpsQueued(false);
      } catch {
        await gpsQueuePush(params.to_pole_id, coords.latitude, coords.longitude);
        setGpsQueued(true);
      }
    } finally {
      setGpsCapturing(false);
    }
  }

  async function compressPhoto(uri: string): Promise<string> {
    try {
      const ctx = ImageManipulator.manipulate(uri);
      ctx.resize({ width: 800 });
      const img = await ctx.renderAsync();
      const result = await img.saveAsync({ compress: 0.4, format: SaveFormat.JPEG });
      return result.uri;
    } catch {
      return uri;
    }
  }

  async function savePhotoDraft(fileName: string, uri: string): Promise<PhotoField> {
    await FileSystem.makeDirectoryAsync(draftDir, { intermediates: true });
    const compressed = await compressPhoto(uri);
    const dest = draftDir + fileName;
    try {
      await FileSystem.copyAsync({ from: compressed, to: dest });
    } catch {
      return { uri: compressed, name: fileName, type: "image/jpeg" };
    }
    return { uri: dest, name: fileName, type: "image/jpeg" };
  }

  async function openCamera(setter: (p: PhotoField) => void, fileName: string) {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Please allow camera access.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.5,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setter({ uri, name: fileName, type: "image/jpeg" });
      savePhotoDraft(fileName, uri).then((saved) => setter(saved)).catch(() => {});
      MediaLibrary.requestPermissionsAsync()
        .then(({ status: s }) => {
          if (s === "granted") MediaLibrary.saveToLibraryAsync(uri).catch(() => {});
        })
        .catch(() => {});
    }
  }

  function goToComponents() {
    const gps = capturedGps ?? toPoleGpsRef.current;
    router.push({
      pathname: "/teardown/components" as any,
      params: {
        ...params,
        to_pole_latitude:        gps ? String(gps.latitude)  : "",
        to_pole_longitude:       gps ? String(gps.longitude) : "",
        to_pole_gps_captured_at: gps?.captured_at ?? "",
        to_pole_gps_accuracy:    gps?.accuracy != null ? String(gps.accuracy) : "",
        destination_slot:        slot,
        destination_landmark:    landmark,
      },
    });
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.root} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          <Pressable onPress={() => router.back()} style={styles.floatingBackBtn}>
            <Text style={styles.floatingBackIcon}>‹</Text>
          </Pressable>

          {/* Hero card */}
          <View style={styles.heroCard}>
            <View style={[styles.heroBg, { backgroundColor: accentColor }]} />
            <View style={[styles.heroOverlay, { backgroundColor: accentColor }]} />
            <View style={styles.heroGridOverlay}>
              {Array.from({ length: 40 }).map((_, i) => (
                <View key={i} style={styles.heroGridDot} />
              ))}
            </View>
            <View style={styles.heroCurveTopRight} />
            <View style={styles.heroCurveBottomLeft} />

            <View style={styles.heroContent}>
              <View style={styles.heroIconWrap}>
                <Text style={styles.heroIcon}>🔌</Text>
              </View>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {params.to_pole_name || params.to_pole_code}
              </Text>
              <Text style={styles.heroSubtitle}>Destination Pole</Text>

              {/* Span info strip */}
              <View style={styles.spanRow}>
                <Text style={styles.spanFrom} numberOfLines={1}>{params.pole_name || params.pole_code}</Text>
                <Text style={styles.spanArrow}>→</Text>
                <Text style={styles.spanTo} numberOfLines={1}>{params.to_pole_code}</Text>
                {!!params.expected_cable && (
                  <Text style={styles.spanCable}>{params.expected_cable}m</Text>
                )}
              </View>

              <View style={styles.heroSeparator} />

              <View style={styles.heroStatsRow}>
                <View style={styles.heroStatBox}>
                  <Text style={styles.heroStatLabel}>PROJECT</Text>
                  <Text style={styles.heroStatValue} numberOfLines={1}>{params.project_name || "—"}</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStatBox}>
                  <Text style={styles.heroStatLabel}>POLE ID</Text>
                  <Text style={styles.heroStatValue} numberOfLines={1}>{params.to_pole_id || "—"}</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStatBox}>
                  <Text style={styles.heroStatLabel}>PROGRESS</Text>
                  <Text style={styles.heroStatValue}>{progress.percent}%</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Progress tracker */}
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Completion Tracker</Text>
              <Text style={styles.progressCount}>{progress.completed}/{progress.total}</Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${progress.percent}%`, backgroundColor: accentColor }]} />
            </View>
            <View style={styles.stepRow}>
              <StepBadge done={hasGps}        label="GPS"      />
              <StepBadge done={!!photoBefore} label="Before"   />
              <StepBadge done={!!photoAfter}  label="After"    />
              <StepBadge done={!!photoTag}    label="Pole Tag" />
              <StepBadge done={!!slot}        label="Slot"     />
            </View>
          </View>

          {/* GPS Section */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>GPS Location</Text>
              <View style={[styles.sectionPill, hasGps ? styles.sectionPillSuccess : styles.sectionPillMuted]}>
                <Text style={[styles.sectionPillText, hasGps ? styles.sectionPillTextSuccess : styles.sectionPillTextMuted]}>
                  {hasGps ? "Captured" : "Required"}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.gpsCardButton,
                hasGps ? styles.gpsCardButtonSuccess : { borderColor: accentColor, backgroundColor: "#FFFFFF" },
              ]}
              activeOpacity={0.85}
              onPress={captureGps}
              disabled={gpsCapturing}
            >
              <View style={[styles.gpsIconWrap, hasGps ? { backgroundColor: "#A7F3D0" } : { backgroundColor: `${accentColor}18` }]}>
                {gpsCapturing
                  ? <ActivityIndicator color={accentColor} size="small" />
                  : <Text style={styles.gpsIcon}>📍</Text>}
              </View>
              <View style={styles.gpsTextWrap}>
                <Text style={[styles.gpsTitle, hasGps ? { color: "#065F46" } : { color: "#111827" }]}>
                  {hasGps ? "GPS Captured Successfully" : "Capture Current GPS"}
                </Text>
                <Text style={styles.gpsSubtitle}>
                  {hasGps
                    ? `${capturedGps!.latitude.toFixed(6)}, ${capturedGps!.longitude.toFixed(6)}`
                    : gpsAccuracy === null
                      ? "Acquiring signal…"
                      : gpsAccuracy <= 5
                        ? `✅ Accuracy: ${gpsAccuracy}m — Ready`
                        : gpsAccuracy <= 15
                          ? `📡 Accuracy: ${gpsAccuracy}m — Improving…`
                          : `📡 Accuracy: ${gpsAccuracy}m — Weak signal`}
                </Text>
                {hasGps && capturedGps!.accuracy != null && (
                  <Text style={styles.gpsAccuracyLabel}>Accuracy: {Math.round(capturedGps!.accuracy)}m</Text>
                )}
                {gpsQueued && (
                  <Text style={styles.gpsPendingLabel}>⏳ Pending upload — will sync when online</Text>
                )}
              </View>
              <View style={styles.gpsArrowWrap}>
                <Text style={styles.gpsArrow}>{hasGps ? "✓" : "›"}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Photo Documentation */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Photo Documentation</Text>
              <View style={[styles.sectionPill, styles.sectionPillMuted]}>
                <Text style={[styles.sectionPillText, styles.sectionPillTextMuted]}>3 Required</Text>
              </View>
            </View>
            <View style={styles.photoStack}>
              <PhotoCard
                label="Before"
                subtitle="Capture pole condition before teardown"
                photo={photoBefore}
                onPress={() => openCamera(setPhotoBefore, F.before)}
                required
                accentColor={accentColor}
              />
              <PhotoCard
                label="After"
                subtitle="Capture completed teardown output"
                photo={photoAfter}
                onPress={() => openCamera(setPhotoAfter, F.after)}
                required
                accentColor={accentColor}
              />
              <PhotoCard
                label="Pole Tag"
                subtitle="Capture visible pole identification tag"
                photo={photoTag}
                onPress={() => openCamera(setPhotoTag, F.tag)}
                required
                accentColor={accentColor}
              />
            </View>
          </View>

          {/* Slot Selection */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Slot Selection</Text>
              <View style={[styles.sectionPill, slot ? styles.sectionPillSuccess : styles.sectionPillMuted]}>
                <Text style={[styles.sectionPillText, slot ? styles.sectionPillTextSuccess : styles.sectionPillTextMuted]}>
                  {slot ? `Selected: ${slot}` : "Required"}
                </Text>
              </View>
            </View>
            <View style={styles.slotGrid}>
              {SLOTS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.slotBtn, slot === s && { backgroundColor: accentColor, borderColor: accentColor }]}
                  activeOpacity={0.85}
                  onPress={() => setSlot(s)}
                >
                  <Text style={[styles.slotText, slot === s && { color: "#FFFFFF" }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Landmark */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Landmark / Remarks</Text>
              <View style={[styles.sectionPill, landmark.trim() ? styles.sectionPillSuccess : styles.sectionPillMuted]}>
                <Text style={[styles.sectionPillText, landmark.trim() ? styles.sectionPillTextSuccess : styles.sectionPillTextMuted]}>
                  {landmark.trim() ? "Filled" : "Required"}
                </Text>
              </View>
            </View>
            <TextInput
              style={styles.textArea}
              placeholder="e.g. Near school gate, beside blue house…"
              placeholderTextColor="#9CA3AF"
              value={landmark}
              onChangeText={setLandmark}
              multiline
              numberOfLines={4}
            />
          </View>

        </ScrollView>

        {/* Fixed bottom CTA */}
        <View style={styles.ctaBar}>
          {!canProceed && (
            <View style={styles.requirementsList}>
              {!hasGps     && <Text style={styles.reqItem}>• GPS location required</Text>}
              {!photoBefore && <Text style={styles.reqItem}>• Before photo required</Text>}
              {!photoAfter  && <Text style={styles.reqItem}>• After photo required</Text>}
              {!photoTag    && <Text style={styles.reqItem}>• Pole tag photo required</Text>}
              {!slot        && <Text style={styles.reqItem}>• Slot selection required</Text>}
              {!landmark.trim() && <Text style={styles.reqItem}>• Landmark required</Text>}
            </View>
          )}
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: canProceed ? accentColor : "#D1D5DB" }]}
            activeOpacity={canProceed ? 0.85 : 1}
            onPress={canProceed ? goToComponents : undefined}
            disabled={!canProceed}
          >
            <Text style={[styles.submitText, { color: canProceed ? "#fff" : "#9CA3AF" }]}>
              {canProceed ? "Next: Cable & Components  →" : "Complete required fields first"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: "#F6F8FB" },
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 140 },

  floatingBackBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center", marginBottom: 14,
    borderWidth: 1, borderColor: "#E5E7EB",
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  floatingBackIcon: { fontSize: 28, color: "#111827", fontWeight: "600", marginTop: -2 },

  // Hero card
  heroCard: {
    borderRadius: 24, overflow: "hidden", marginBottom: 16, minHeight: 200,
    shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  heroBg:      { ...StyleSheet.absoluteFillObject },
  heroOverlay: { ...StyleSheet.absoluteFillObject, opacity: 0.92 },
  heroGridOverlay: {
    ...StyleSheet.absoluteFillObject, flexDirection: "row", flexWrap: "wrap",
    opacity: 0.08, padding: 8, gap: 12,
  },
  heroGridDot:        { width: 4, height: 4, borderRadius: 2, backgroundColor: "#fff" },
  heroCurveTopRight:  { position: "absolute", top: -40, right: -40, width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.07)" },
  heroCurveBottomLeft:{ position: "absolute", bottom: -30, left: -30, width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.05)" },
  heroContent: { padding: 24, paddingTop: 28 },
  heroIconWrap: {
    width: 52, height: 52, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center", marginBottom: 14,
  },
  heroIcon:     { fontSize: 26 },
  heroTitle:    { fontSize: 26, fontWeight: "900", color: "#fff", marginBottom: 4, letterSpacing: -0.5 },
  heroSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.72)", fontWeight: "600", marginBottom: 12 },

  spanRow:   { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" },
  spanFrom:  { fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: "700", maxWidth: 90 },
  spanArrow: { fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: "700" },
  spanTo:    { fontSize: 11, color: "rgba(255,255,255,0.9)", fontWeight: "800", maxWidth: 90 },
  spanCable: { fontSize: 10, color: "rgba(255,255,255,0.55)", fontWeight: "600", marginLeft: 4 },

  heroSeparator: { height: 1, backgroundColor: "rgba(255,255,255,0.15)", marginBottom: 16 },
  heroStatsRow:  { flexDirection: "row", alignItems: "center" },
  heroStatBox:   { flex: 1, alignItems: "center" },
  heroStatLabel: { fontSize: 8, fontWeight: "800", color: "rgba(255,255,255,0.55)", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 },
  heroStatValue: { fontSize: 13, fontWeight: "900", color: "#fff" },
  heroStatDivider:{ width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.2)" },

  // Progress
  progressCard: {
    backgroundColor: "#fff", borderRadius: 20, padding: 18, marginBottom: 14,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  progressTitle:  { fontSize: 14, fontWeight: "800", color: "#111827" },
  progressCount:  { fontSize: 13, fontWeight: "700", color: "#6B7280" },
  progressBarTrack: { height: 6, backgroundColor: "#F1F5F9", borderRadius: 3, marginBottom: 14, overflow: "hidden" },
  progressBarFill:  { height: 6, borderRadius: 3 },
  stepRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  stepBadge: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "#F1F5F9" },
  stepBadgeDone: { backgroundColor: "#DCFCE7" },
  stepBadgeText: { fontSize: 10, fontWeight: "700", color: "#64748B" },
  stepBadgeTextDone: { color: "#166534" },

  // Sections
  sectionCard: {
    backgroundColor: "#fff", borderRadius: 20, padding: 18, marginBottom: 14,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  sectionTitle:  { fontSize: 15, fontWeight: "900", color: "#111827" },
  sectionPill:   { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  sectionPillMuted:   { backgroundColor: "#F1F5F9" },
  sectionPillSuccess: { backgroundColor: "#DCFCE7" },
  sectionPillText:    { fontSize: 11, fontWeight: "700" },
  sectionPillTextMuted:   { color: "#64748B" },
  sectionPillTextSuccess: { color: "#166534" },

  // GPS card
  gpsCardButton: {
    flexDirection: "row", alignItems: "center", gap: 14,
    borderWidth: 1.5, borderRadius: 16, padding: 14,
  },
  gpsCardButtonSuccess: { borderColor: "#A7F3D0", backgroundColor: "#F0FDF4" },
  gpsIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  gpsIcon:     { fontSize: 22 },
  gpsTextWrap: { flex: 1 },
  gpsTitle:    { fontSize: 13, fontWeight: "800", marginBottom: 3 },
  gpsSubtitle: { fontSize: 11, color: "#6B7280", fontWeight: "500" },
  gpsAccuracyLabel: { fontSize: 10, color: "#6B7280", marginTop: 2 },
  gpsPendingLabel:  { fontSize: 10, color: "#92400e", fontWeight: "600", marginTop: 3 },
  gpsArrowWrap: { width: 24, alignItems: "center" },
  gpsArrow:     { fontSize: 18, color: "#9CA3AF", fontWeight: "700" },

  // Photos
  photoStack: { gap: 12 },
  photoCard: {
    borderRadius: 20, borderWidth: 1.5, borderColor: "#E5E7EB",
    backgroundColor: "#FAFAFA", overflow: "hidden",
  },
  photoCardGlow: { ...StyleSheet.absoluteFillObject, borderRadius: 20 },
  photoHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, paddingBottom: 0 },
  photoHeaderIconWrap: {
    width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center",
    backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E5E7EB",
  },
  photoHeaderTextWrap: { flex: 1 },
  photoHeaderIcon: { fontSize: 18 },
  photoTitle:      { fontSize: 13, fontWeight: "800", color: "#111827" },
  photoSubtitle:   { fontSize: 11, color: "#9CA3AF", marginTop: 1 },
  photoBody:       { margin: 14, borderRadius: 14, overflow: "hidden", backgroundColor: "#F1F5F9", height: 160 },
  photoPreview:    { width: "100%", height: "100%" },
  photoPlaceholder:     { flex: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  photoPlaceholderIcon: { fontSize: 28 },
  photoPlaceholderText: { fontSize: 11, color: "#9CA3AF", fontWeight: "600" },
  photoFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, paddingTop: 0 },
  photoStatePill: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  photoStateText: { fontSize: 10, fontWeight: "700" },
  photoActionBtn: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  photoActionText:{ fontSize: 11, fontWeight: "800", color: "#fff" },

  // Slot
  slotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  slotBtn: {
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14,
    borderWidth: 1.5, borderColor: "#E5E7EB", backgroundColor: "#F9FAFB",
  },
  slotText: { fontSize: 13, fontWeight: "800", color: "#374151" },

  // Landmark
  textArea: {
    borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 14,
    backgroundColor: "#F9FAFB", paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 13, fontWeight: "500", color: "#111827",
    textAlignVertical: "top", minHeight: 90,
  },

  // CTA
  ctaBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff", paddingHorizontal: 20, paddingTop: 14, paddingBottom: 28,
    shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 }, elevation: 12,
  },
  requirementsList: { marginBottom: 10 },
  reqItem:    { fontSize: 11, color: "#EF4444", fontWeight: "600", marginBottom: 2 },
  submitBtn:  { borderRadius: 18, paddingVertical: 16, alignItems: "center" },
  submitText: { fontSize: 15, fontWeight: "800" },
});
