import api from "@/lib/api";
import * as FileSystem from "expo-file-system/legacy";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as MediaLibrary from "expo-media-library";
import { Stack, router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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

type PhotoField = { uri: string; name: string; type: string } | null;

const SLOTS = ["DA", "C1", "C2", "C3", "C4", "C5"] as const;

function sanitize(s?: string) {
  return (s ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "_");
}

function getCompletionState({
  hasGps,
  photoBefore,
  photoAfter,
  photoTag,
  slot,
}: {
  hasGps: boolean;
  photoBefore: PhotoField;
  photoAfter: PhotoField;
  photoTag: PhotoField;
  slot: string;
}) {
  const completed = [
    hasGps,
    !!photoBefore,
    !!photoAfter,
    !!photoTag,
    !!slot,
  ].filter(Boolean).length;

  return {
    completed,
    total: 5,
    percent: Math.round((completed / 5) * 100),
  };
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
        photo
          ? {
              borderColor: accentColor,
              backgroundColor: "#FFFFFF",
            }
          : {},
      ]}
      activeOpacity={0.88}
      onPress={onPress}
    >
      <View
        style={[
          styles.photoCardGlow,
          photo ? { backgroundColor: `${accentColor}12` } : undefined,
        ]}
      />

      <View style={styles.photoHeader}>
        <View
          style={[
            styles.photoHeaderIconWrap,
            photo
              ? {
                  backgroundColor: `${accentColor}18`,
                  borderColor: `${accentColor}28`,
                }
              : undefined,
          ]}
        >
          <Text style={styles.photoHeaderIcon}>
            {label === "Before" ? "🧰" : label === "After" ? "✅" : "🏷️"}
          </Text>
        </View>

        <View style={styles.photoHeaderTextWrap}>
          <Text style={styles.photoTitle}>
            {label}
            {required ? " *" : ""}
          </Text>
          <Text style={styles.photoSubtitle}>
            {subtitle ?? "Tap to capture image"}
          </Text>
        </View>
      </View>

      <View style={styles.photoBody}>
        {photo ? (
          <Image
            source={{ uri: photo.uri }}
            style={styles.photoPreview}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoPlaceholderIcon}>📷</Text>
            <Text style={styles.photoPlaceholderText}>Tap to capture</Text>
          </View>
        )}
      </View>

      <View style={styles.photoFooter}>
        <View
          style={[
            styles.photoStatePill,
            photo
              ? { backgroundColor: "#DCFCE7" }
              : { backgroundColor: "#F1F5F9" },
          ]}
        >
          <Text
            style={[
              styles.photoStateText,
              photo ? { color: "#166534" } : { color: "#64748B" },
            ]}
          >
            {photo ? "Captured" : "Not yet captured"}
          </Text>
        </View>

        <View style={[styles.photoActionBtn, { backgroundColor: accentColor }]}>
          <Text style={styles.photoActionText}>
            {photo ? "Retake" : "Capture"}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function PoleDetailScreen() {
  const { pole_code: pole_id, pole_name, node_id, project_id, project_name, accent } =
    useLocalSearchParams<{
      pole_code: string;
      pole_name: string;
      node_id: string;
      project_id: string;
      project_name: string;
      accent: string;
    }>();

  const accentColor = accent || "#334155";

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [gpsCapturing, setGpsCapturing] = useState(false);
  const [street, setStreet] = useState("");

  const [photoBefore, setPhotoBefore] = useState<PhotoField>(null);
  const [photoAfter, setPhotoAfter] = useState<PhotoField>(null);
  const [photoTag, setPhotoTag] = useState<PhotoField>(null);

  const [slot, setSlot] = useState("");
  const [landmark, setLandmark] = useState("");


  const projFolder = sanitize(project_name);
  const draftDir = `${FileSystem.documentDirectory}pole_drafts/${projFolder}/${node_id ?? "node"}/${pole_id}/`;
  const F = {
    before: `pole_${pole_id}_before.jpg`,
    after: `pole_${pole_id}_after.jpg`,
    tag: `pole_${pole_id}_poletag.jpg`,
  };

  useEffect(() => {
    api
      .get(`/poles/${pole_id}`)
      .then(({ data }) => {
        const d = data?.data ?? data;
        if (d?.slot) setSlot(d.slot);
        if (d?.remarks) setLandmark(d.remarks);
        if (d?.map_latitude && d?.map_longitude) {
          setLat(Number(d.map_latitude));
          setLng(Number(d.map_longitude));
        }
      })
      .catch(() => {});

    (async () => {
      const dirInfo = await FileSystem.getInfoAsync(draftDir);
      if (!dirInfo.exists) return;

      const load = async (file: string): Promise<PhotoField | null> => {
        const path = draftDir + file;
        const info = await FileSystem.getInfoAsync(path);
        if (!info.exists) return null;
        return { uri: info.uri, name: file, type: "image/jpeg" };
      };

      const [pb, pa, pt] = await Promise.all([
        load(F.before),
        load(F.after),
        load(F.tag),
      ]);

      if (pb) setPhotoBefore(pb);
      if (pa) setPhotoAfter(pa);
      if (pt) setPhotoTag(pt);
    })();
  }, [pole_id]);

  useEffect(() => {
    if (!lat || !lng) return;

    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      {
        headers: { "Accept-Language": "en", "User-Agent": "TelcoVantage/1.0" },
      },
    )
      .then((r) => r.json())
      .then((data) => {
        const a = data?.address;
        if (!a) return;
        const s =
          a.road ?? a.pedestrian ?? a.footway ?? a.street ?? a.path ?? null;
        setStreet(s ?? "");
      })
      .catch(() => {});
  }, [lat, lng]);

  async function compressPhoto(uri: string): Promise<string> {
    try {
      const ctx = ImageManipulator.manipulate(uri);
      ctx.resize({ width: 800 });
      const img = await ctx.renderAsync();
      const result = await img.saveAsync({
        compress: 0.4,
        format: SaveFormat.JPEG,
      });
      return result.uri;
    } catch {
      return uri;
    }
  }

  async function savePhotoDraft(
    fileName: string,
    uri: string,
  ): Promise<PhotoField> {
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

      savePhotoDraft(fileName, uri)
        .then((saved) => setter(saved))
        .catch(() => {});

      MediaLibrary.requestPermissionsAsync()
        .then(({ status: s }) => {
          if (s === "granted") {
            MediaLibrary.saveToLibraryAsync(uri).catch(() => {});
          }
        })
        .catch(() => {});
    }
  }

  async function captureGps() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Please allow location access.");
      return;
    }

    setGpsCapturing(true);

    try {
      const loc = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<null>((res) => setTimeout(() => res(null), 20000)),
      ]);

      if (!loc) {
        Alert.alert("GPS timeout", "Could not get location. Try again.");
        return;
      }

      setLat(loc.coords.latitude);
      setLng(loc.coords.longitude);

      await api.post(`/poles/${pole_id}/gps`, {
        map_latitude: loc.coords.latitude,
        map_longitude: loc.coords.longitude,
      });
    } catch (e: any) {
      Alert.alert(
        "Error",
        e?.response?.data?.message ?? e?.message ?? "Failed to save GPS.",
      );
    } finally {
      setGpsCapturing(false);
    }
  }

  const hasGps = !!(lat && lng);
  // "Select Pair" only needs GPS + before + pole_tag (after is optional)
  const canSelectPair = hasGps && !!photoBefore && !!photoTag;

  const progress = useMemo(
    () =>
      getCompletionState({
        hasGps,
        photoBefore,
        photoAfter,
        photoTag,
        slot,
      }),
    [hasGps, photoBefore, photoAfter, photoTag, slot],
  );


  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.root} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => router.back()}
            style={styles.floatingBackBtn}
          >
            <Text style={styles.floatingBackIcon}>‹</Text>
          </Pressable>

          <View style={styles.heroCard}>
            <View style={[styles.heroBg, { backgroundColor: accentColor }]} />
            <View
              style={[styles.heroOverlay, { backgroundColor: accentColor }]}
            />
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
                {pole_name || "Pole"}
              </Text>
              <Text style={styles.heroSubtitle}>Pole Teardown</Text>

              <View style={styles.heroSeparator} />

              <View style={styles.heroStatsRow}>
                <View style={styles.heroStatBox}>
                  <Text style={styles.heroStatLabel}>PROJECT</Text>
                  <Text style={styles.heroStatValue} numberOfLines={1}>
                    {project_name || "—"}
                  </Text>
                </View>

                <View style={styles.heroStatDivider} />

                <View style={styles.heroStatBox}>
                  <Text style={styles.heroStatLabel}>POLE ID</Text>
                  <Text style={styles.heroStatValue} numberOfLines={1}>
                    {pole_id || "—"}
                  </Text>
                </View>

                <View style={styles.heroStatDivider} />

                <View style={styles.heroStatBox}>
                  <Text style={styles.heroStatLabel}>PROGRESS</Text>
                  <Text style={styles.heroStatValue}>{progress.percent}%</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Completion Tracker</Text>
              <Text style={styles.progressCount}>
                {progress.completed}/{progress.total}
              </Text>
            </View>

            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${progress.percent}%`,
                    backgroundColor: accentColor,
                  },
                ]}
              />
            </View>

            <View style={styles.stepRow}>
              <StepBadge done={hasGps} label="GPS" />
              <StepBadge done={!!photoBefore} label="Before" />
              <StepBadge done={!!photoAfter} label="After" />
              <StepBadge done={!!photoTag} label="Pole Tag" />
              <StepBadge done={!!slot} label="Slot" />
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>GPS Location</Text>
              <View
                style={[
                  styles.sectionPill,
                  hasGps ? styles.sectionPillSuccess : styles.sectionPillMuted,
                ]}
              >
                <Text
                  style={[
                    styles.sectionPillText,
                    hasGps
                      ? styles.sectionPillTextSuccess
                      : styles.sectionPillTextMuted,
                  ]}
                >
                  {hasGps ? "Captured" : "Required"}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.gpsCardButton,
                hasGps
                  ? styles.gpsCardButtonSuccess
                  : { borderColor: accentColor, backgroundColor: "#FFFFFF" },
              ]}
              activeOpacity={0.85}
              onPress={captureGps}
              disabled={gpsCapturing}
            >
              <View
                style={[
                  styles.gpsIconWrap,
                  hasGps
                    ? { backgroundColor: "#A7F3D0" }
                    : { backgroundColor: `${accentColor}18` },
                ]}
              >
                {gpsCapturing ? (
                  <ActivityIndicator color={accentColor} size="small" />
                ) : (
                  <Text style={styles.gpsIcon}>📍</Text>
                )}
              </View>

              <View style={styles.gpsTextWrap}>
                <Text
                  style={[
                    styles.gpsTitle,
                    hasGps ? { color: "#065F46" } : { color: "#111827" },
                  ]}
                >
                  {hasGps ? "GPS Captured Successfully" : "Capture Current GPS"}
                </Text>
                <Text style={styles.gpsSubtitle}>
                  {hasGps
                    ? street || `${lat?.toFixed(6)}, ${lng?.toFixed(6)}`
                    : "Get your exact field location before submitting"}
                </Text>
              </View>

              <View style={styles.gpsArrowWrap}>
                <Text style={styles.gpsArrow}>{hasGps ? "✓" : "›"}</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Photo Documentation</Text>
              <View style={[styles.sectionPill, styles.sectionPillMuted]}>
                <Text
                  style={[styles.sectionPillText, styles.sectionPillTextMuted]}
                >
                  3 Required
                </Text>
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

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Slot Selection</Text>
              <View
                style={[
                  styles.sectionPill,
                  slot ? styles.sectionPillSuccess : styles.sectionPillMuted,
                ]}
              >
                <Text
                  style={[
                    styles.sectionPillText,
                    slot
                      ? styles.sectionPillTextSuccess
                      : styles.sectionPillTextMuted,
                  ]}
                >
                  {slot ? `Selected: ${slot}` : "Required"}
                </Text>
              </View>
            </View>

            <View style={styles.slotGrid}>
              {SLOTS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.slotBtn,
                    slot === s && {
                      backgroundColor: accentColor,
                      borderColor: accentColor,
                    },
                  ]}
                  activeOpacity={0.85}
                  onPress={() => setSlot(s)}
                >
                  <Text
                    style={[
                      styles.slotText,
                      slot === s && { color: "#FFFFFF" },
                    ]}
                  >
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Landmark / Remarks</Text>
              <View style={[styles.sectionPill, styles.sectionPillMuted]}>
                <Text
                  style={[styles.sectionPillText, styles.sectionPillTextMuted]}
                >
                  Optional
                </Text>
              </View>
            </View>

            <TextInput
              style={styles.textArea}
              placeholder="e.g. Near Jollibee corner, 3rd pole from left..."
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
          {!canSelectPair && (
            <View style={styles.requirementsList}>
              {!hasGps && <Text style={styles.reqItem}>• GPS location required</Text>}
              {!photoBefore && <Text style={styles.reqItem}>• Before photo required</Text>}
              {!photoTag && <Text style={styles.reqItem}>• Pole tag photo required</Text>}
            </View>
          )}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              { backgroundColor: canSelectPair ? accentColor : "#D1D5DB" },
            ]}
            activeOpacity={canSelectPair ? 0.85 : 1}
            onPress={() => {
              if (!canSelectPair) return;
              router.push({
                pathname: "/teardown/select-pair" as any,
                params: {
                  pole_code: pole_id,
                  pole_name: pole_name,
                  node_id: node_id,
                  project_id: project_id,
                  project_name: project_name,
                  accent: accentColor,
                },
              });
            }}
            disabled={!canSelectPair}
          >
            <Text style={styles.submitText}>
              {canSelectPair ? "Select Pair  →" : "Complete required fields first"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F6F8FB",
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 140,
  },

  floatingBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  floatingBackIcon: {
    fontSize: 28,
    color: "#111827",
    fontWeight: "600",
    marginTop: -2,
  },

  heroCard: {
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 18,
    minHeight: 260,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    position: "relative",
  },

  heroBg: {
    ...StyleSheet.absoluteFillObject,
  },

  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
    transform: [{ skewY: "-6deg" }, { translateY: -20 }],
  },

  heroGridOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    flexWrap: "wrap",
    opacity: 0.08,
    padding: 4,
  },

  heroGridDot: {
    width: "10%",
    height: "20%",
    borderWidth: 0.5,
    borderColor: "#FFFFFF",
  },

  heroCurveTopRight: {
    position: "absolute",
    top: -40,
    right: -30,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  heroCurveBottomLeft: {
    position: "absolute",
    bottom: -36,
    left: -24,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(255,255,255,0.07)",
  },

  heroContent: {
    position: "relative",
    zIndex: 10,
    alignItems: "center",
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 20,
  },

  heroIconWrap: {
    width: 92,
    height: 92,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.22)",
  },

  heroIcon: {
    fontSize: 42,
  },

  heroTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 4,
  },

  heroSubtitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 20,
  },

  heroSeparator: {
    width: "80%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginBottom: 20,
  },

  heroStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    justifyContent: "space-around",
  },

  heroStatBox: {
    alignItems: "center",
    flex: 1,
  },

  heroStatDivider: {
    width: 1,
    height: 34,
    backgroundColor: "rgba(255,255,255,0.18)",
  },

  heroStatLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 5,
  },

  heroStatValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  progressCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#EEF2F7",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },

  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  progressTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },

  progressCount: {
    fontSize: 13,
    fontWeight: "800",
    color: "#64748B",
  },

  progressBarTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
    marginBottom: 14,
  },

  progressBarFill: {
    height: "100%",
    borderRadius: 999,
  },

  stepRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  stepBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
  },

  stepBadgeDone: {
    backgroundColor: "#DCFCE7",
  },

  stepBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
  },

  stepBadgeTextDone: {
    color: "#166534",
  },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#EEF2F7",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 10,
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
    flex: 1,
  },

  sectionPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  sectionPillSuccess: {
    backgroundColor: "#DCFCE7",
  },

  sectionPillMuted: {
    backgroundColor: "#F1F5F9",
  },

  sectionPillText: {
    fontSize: 11,
    fontWeight: "800",
  },

  sectionPillTextSuccess: {
    color: "#166534",
  },

  sectionPillTextMuted: {
    color: "#64748B",
  },

  gpsCardButton: {
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  gpsCardButtonSuccess: {
    backgroundColor: "#ECFDF5",
    borderColor: "#10B981",
  },

  gpsIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  gpsIcon: {
    fontSize: 24,
  },

  gpsTextWrap: {
    flex: 1,
    paddingRight: 10,
  },

  gpsTitle: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
  },

  gpsSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: "#6B7280",
    fontWeight: "500",
  },

  gpsArrowWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },

  gpsArrow: {
    fontSize: 18,
    fontWeight: "800",
    color: "#64748B",
  },

  photoStack: {
    gap: 14,
  },

  photoCard: {
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    overflow: "hidden",
    backgroundColor: "#F9FAFB",
    position: "relative",
  },

  photoCardGlow: {
    position: "absolute",
    top: -24,
    right: -18,
    width: 110,
    height: 110,
    borderRadius: 55,
  },

  photoHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    paddingBottom: 10,
  },

  photoHeaderIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  photoHeaderIcon: {
    fontSize: 24,
  },

  photoHeaderTextWrap: {
    flex: 1,
    paddingRight: 8,
  },

  photoTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },

  photoSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6B7280",
    lineHeight: 17,
  },

  photoBody: {
    paddingHorizontal: 14,
    paddingBottom: 12,
  },

  photoPreview: {
    width: "100%",
    height: 210,
    borderRadius: 18,
    backgroundColor: "#E5E7EB",
  },

  photoPlaceholder: {
    width: "100%",
    height: 170,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    borderStyle: "dashed",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },

  photoPlaceholderIcon: {
    fontSize: 28,
    marginBottom: 8,
  },

  photoPlaceholderText: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
    fontWeight: "700",
  },

  photoFooter: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  photoStatePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexShrink: 1,
  },

  photoStateText: {
    fontSize: 11,
    fontWeight: "800",
  },

  photoActionBtn: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  photoActionText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },

  slotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  slotBtn: {
    minWidth: 72,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },

  slotText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#374151",
  },

  textArea: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    padding: 14,
    fontSize: 14,
    color: "#111827",
    minHeight: 110,
    textAlignVertical: "top",
    lineHeight: 20,
  },

  ctaBar: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 }, elevation: 12,
    gap: 8,
  },

  submitBtn: {
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  submitText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },

  requirementsList: {
    backgroundColor: "#FEF3C7",
    borderRadius: 16,
    padding: 14,
    gap: 5,
  },

  reqTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#92400E",
    marginBottom: 4,
  },

  reqItem: {
    fontSize: 12,
    color: "#B45309",
    fontWeight: "600",
  },
});
