import * as FileSystem from "expo-file-system/legacy";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as MediaLibrary from "expo-media-library";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
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

function PhotoBox({
  label,
  required,
  photo,
  onPick,
  accentColor,
}: {
  label: string;
  required?: boolean;
  photo: PhotoField;
  onPick: () => void;
  accentColor: string;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPick}
      style={[
        styles.photoBox,
        photo ? { borderColor: accentColor, borderStyle: "solid" } : {},
      ]}
    >
      {photo ? (
        <Image source={{ uri: photo.uri }} style={styles.photoPreview} resizeMode="cover" />
      ) : (
        <View style={styles.photoPlaceholder}>
          <Text style={styles.photoIcon}>📷</Text>
          <Text style={styles.photoLabel}>{label}{required ? " *" : ""}</Text>
        </View>
      )}

      <View style={[styles.photoBadge, photo ? styles.photoBadgeDone : styles.photoBadgePending]}>
        <Text style={[styles.photoBadgeText, photo ? styles.photoBadgeTextDone : {}]}>
          {photo ? "✓ Captured" : "Tap to capture"}
        </Text>
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
  const projFolder = sanitize(params.project_name);
  const toPoleCode = sanitize(params.to_pole_code);
  const draftDir = `${FileSystem.documentDirectory}teardown_drafts/${projFolder}/${params.node_id}/${params.pole_code}/`;

  const F = {
    before: `${toPoleCode}_before.jpg`,
    after: `${toPoleCode}_after.jpg`,
    tag: `${toPoleCode}_poletag.jpg`,
  };

  const [photoBefore, setPhotoBefore] = useState<PhotoField>(null);
  const [photoAfter, setPhotoAfter] = useState<PhotoField>(null);
  const [photoTag, setPhotoTag] = useState<PhotoField>(null);
  const [slot, setSlot] = useState("");
  const [landmark, setLandmark] = useState("");
  const [gpsCapturing, setGpsCapturing] = useState(false);
  const toPoleGpsRef = useRef<GpsData | null>(null);
  const firstPhotoTapped = useRef(false);

  // Load saved drafts on mount
  useEffect(() => {
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

  // Capture GPS in background on first photo tap
  async function captureGpsOnce() {
    if (firstPhotoTapped.current) return;
    firstPhotoTapped.current = true;
    setGpsCapturing(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const last = await Location.getLastKnownPositionAsync({ maxAge: 30000 }).catch(() => null);
      if (last && last.coords.accuracy != null && last.coords.accuracy <= 50) {
        toPoleGpsRef.current = {
          latitude: last.coords.latitude,
          longitude: last.coords.longitude,
          accuracy: last.coords.accuracy,
          captured_at: new Date(last.timestamp).toISOString(),
        };
        return;
      }
      const loc = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest }),
        new Promise<null>((res) => setTimeout(() => res(null), 60000)),
      ]);
      if (loc) {
        toPoleGpsRef.current = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy,
          captured_at: new Date(loc.timestamp).toISOString(),
        };
      }
    } catch {
      // GPS failure — not a blocker
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
    captureGpsOnce();
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

  const canProceed = !!photoBefore && !!photoAfter && !!photoTag && !!slot && !!landmark.trim();

  function goToComponents() {
    const gps = toPoleGpsRef.current;
    router.push({
      pathname: "/teardown/components" as any,
      params: {
        ...params,
        to_pole_latitude: gps ? String(gps.latitude) : "",
        to_pole_longitude: gps ? String(gps.longitude) : "",
        to_pole_gps_captured_at: gps?.captured_at ?? "",
        to_pole_gps_accuracy: gps?.accuracy != null ? String(gps.accuracy) : "",
        destination_slot: slot,
        destination_landmark: landmark,
      },
    });
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.root} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backIcon}>‹</Text>
            </Pressable>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Destination Pole</Text>
              <Text style={styles.headerSub} numberOfLines={1}>
                {params.to_pole_name || params.to_pole_code}
              </Text>
            </View>
            {gpsCapturing && (
              <View style={styles.gpsBadge}>
                <ActivityIndicator size="small" color="#0d47c9" />
                <Text style={styles.gpsBadgeText}>GPS…</Text>
              </View>
            )}
          </View>

          {/* Span strip */}
          <View style={styles.spanStrip}>
            <Text style={styles.spanFrom} numberOfLines={1}>
              {params.pole_name || params.pole_code}
            </Text>
            <View style={[styles.spanLine, { backgroundColor: accentColor }]} />
            <Text style={styles.spanCable}>{params.expected_cable}m</Text>
            <View style={[styles.spanLine, { backgroundColor: accentColor }]} />
            <Text style={styles.spanTo} numberOfLines={1}>
              {params.to_pole_code}
            </Text>
          </View>

          {/* Photo card */}
          <View style={styles.card}>
            <View style={[styles.cardAccent, { backgroundColor: "#6366f1" }]} />
            <View style={styles.cardInner}>
              <Text style={styles.cardTitle}>Destination Pole Photos</Text>
              <Text style={styles.cardSub}>{params.to_pole_name || params.to_pole_code}</Text>

              <View style={styles.photoRow}>
                <View style={styles.photoCol}>
                  <Text style={styles.photoColLabel}>BEFORE</Text>
                  <PhotoBox
                    label="Before"
                    required
                    photo={photoBefore}
                    onPick={() => openCamera(setPhotoBefore, F.before)}
                    accentColor="#6366f1"
                  />
                </View>
                <View style={styles.photoCol}>
                  <Text style={styles.photoColLabel}>AFTER</Text>
                  <PhotoBox
                    label="After"
                    required
                    photo={photoAfter}
                    onPick={() => {
                      if (!photoBefore) {
                        Alert.alert("Before photo required", "Please capture the Before photo first.");
                        return;
                      }
                      openCamera(setPhotoAfter, F.after);
                    }}
                    accentColor="#6366f1"
                  />
                </View>
              </View>

              <Text style={[styles.photoColLabel, { marginTop: 12, marginBottom: 6 }]}>POLE TAG</Text>
              <PhotoBox
                label="Pole Tag"
                required
                photo={photoTag}
                onPick={() => openCamera(setPhotoTag, F.tag)}
                accentColor="#6366f1"
              />
            </View>
          </View>

          {/* Slot selector */}
          <View style={styles.card}>
            <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />
            <View style={styles.cardInner}>
              <Text style={styles.cardTitle}>Slot</Text>
              <Text style={styles.cardSub}>Select the slot this pole occupies</Text>
              <View style={styles.slotGrid}>
                {SLOTS.map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setSlot(s)}
                    style={[
                      styles.slotBtn,
                      slot === s && { backgroundColor: accentColor, borderColor: accentColor },
                    ]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.slotBtnText, slot === s && { color: "#fff" }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.cardTitle, { marginTop: 16 }]}>Landmark <Text style={{ color: "#dc2626" }}>*</Text></Text>
              <Text style={styles.cardSub}>Required — nearby landmark or location notes</Text>
              <TextInput
                style={styles.landmarkInput}
                placeholder="e.g. Near school gate, beside blue house…"
                placeholderTextColor="#9CA3AF"
                value={landmark}
                onChangeText={setLandmark}
                multiline
                numberOfLines={2}
              />
            </View>
          </View>

          {/* Progress badges */}
          <View style={styles.badgeRow}>
            {[
              { label: "Before",   done: !!photoBefore },
              { label: "After",    done: !!photoAfter  },
              { label: "Pole Tag", done: !!photoTag    },
              { label: "Slot",     done: !!slot        },
              { label: "Landmark", done: !!landmark.trim() },
            ].map((b) => (
              <View
                key={b.label}
                style={[styles.badge, b.done ? styles.badgeDone : styles.badgePending]}
              >
                <Text style={[styles.badgeText, b.done ? styles.badgeTextDone : {}]}>
                  {b.done ? "✓" : "•"} {b.label}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Bottom CTA */}
        <View style={styles.cta}>
          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: canProceed ? accentColor : "#D1D5DB" }]}
            activeOpacity={canProceed ? 0.85 : 1}
            disabled={!canProceed}
            onPress={goToComponents}
          >
            <Text style={[styles.ctaBtnText, { color: canProceed ? "#fff" : "#9CA3AF" }]}>
              {canProceed
              ? "Mark as Teardown"
              : !photoBefore || !photoAfter || !photoTag
              ? "Capture all 3 photos first"
              : !slot
              ? "Select a slot first"
              : "Enter a landmark first"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F6F8FB" },
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 120 },

  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 12 },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#E5E7EB",
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  backIcon: { fontSize: 28, color: "#111827", fontWeight: "600", marginTop: -2 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#111827" },
  headerSub: { fontSize: 12, color: "#6B7280", fontWeight: "500", marginTop: 2 },
  gpsBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#EFF6FF", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5,
  },
  gpsBadgeText: { fontSize: 10, color: "#0d47c9", fontWeight: "700" },

  spanStrip: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 16,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 2,
    gap: 8,
  },
  spanFrom: { fontSize: 12, fontWeight: "800", color: "#0d47c9", flex: 1, textAlign: "center" },
  spanLine: { height: 2, flex: 1, borderRadius: 1 },
  spanCable: { fontSize: 11, fontWeight: "700", color: "#374151", paddingHorizontal: 4 },
  spanTo: { fontSize: 12, fontWeight: "800", color: "#111827", flex: 1, textAlign: "center" },

  card: {
    backgroundColor: "#fff", borderRadius: 24, overflow: "hidden", marginBottom: 14,
    shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  cardAccent: { height: 4 },
  cardInner: { padding: 18 },
  cardTitle: { fontSize: 15, fontWeight: "900", color: "#111827", marginBottom: 2 },
  cardSub: { fontSize: 12, color: "#6B7280", marginBottom: 16 },

  photoRow: { flexDirection: "row", gap: 10, marginBottom: 0 },
  photoCol: { flex: 1 },
  photoColLabel: {
    fontSize: 9, fontWeight: "800", color: "#9CA3AF",
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6,
  },

  photoBox: {
    borderRadius: 16, overflow: "hidden", borderWidth: 2,
    borderColor: "#E5E7EB", borderStyle: "dashed",
    backgroundColor: "#F9FAFB", aspectRatio: 3 / 4,
  },
  photoPreview: { width: "100%", height: "100%" },
  photoPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  photoIcon: { fontSize: 26 },
  photoLabel: { fontSize: 10, fontWeight: "600", color: "#9CA3AF", textAlign: "center" },
  photoBadge: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingVertical: 5, alignItems: "center",
  },
  photoBadgeDone: { backgroundColor: "rgba(22,101,52,0.85)" },
  photoBadgePending: { backgroundColor: "rgba(100,116,139,0.5)" },
  photoBadgeText: { fontSize: 9, fontWeight: "800", color: "rgba(255,255,255,0.8)" },
  photoBadgeTextDone: { color: "#fff" },

  slotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  slotBtn: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: "#E5E7EB", backgroundColor: "#F9FAFB",
  },
  slotBtnText: { fontSize: 13, fontWeight: "800", color: "#374151" },
  landmarkInput: {
    borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 12,
    backgroundColor: "#F9FAFB", paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 13, fontWeight: "500", color: "#111827",
    textAlignVertical: "top", marginTop: 6,
  },

  badgeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  badge: { borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 },
  badgeDone: { backgroundColor: "#DCFCE7" },
  badgePending: { backgroundColor: "#F1F5F9" },
  badgeText: { fontSize: 11, fontWeight: "700", color: "#64748B" },
  badgeTextDone: { color: "#166534" },

  cta: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff", paddingHorizontal: 20, paddingTop: 14, paddingBottom: 28,
    shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 }, elevation: 12,
  },
  ctaBtn: { borderRadius: 18, paddingVertical: 16, alignItems: "center" },
  ctaBtnText: { fontSize: 15, fontWeight: "800" },
});
