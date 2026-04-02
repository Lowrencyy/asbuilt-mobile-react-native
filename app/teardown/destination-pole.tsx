import api from "@/lib/api";
import { cacheGet, cacheSet } from "@/lib/cache";
import {
  gpsQueueFlush,
  gpsQueueGet,
  gpsQueueHasPole,
  gpsQueuePush,
} from "@/lib/gps-queue";
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
  return (s ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "_");
}

function StatusChip({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "success" | "warning";
}) {
  return (
    <View
      style={[
        styles.chip,
        tone === "success" && styles.chipSuccess,
        tone === "warning" && styles.chipWarning,
      ]}
    >
      <Text
        style={[
          styles.chipText,
          tone === "success" && styles.chipTextSuccess,
          tone === "warning" && styles.chipTextWarning,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function PhotoCard({
  label,
  subtitle,
  photo,
  onPress,
  accentColor,
  required,
  compact = false,
}: {
  label: string;
  subtitle: string;
  photo: PhotoField;
  onPress: () => void;
  accentColor: string;
  required?: boolean;
  compact?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.photoCard,
        compact && styles.photoCardCompact,
        photo && { borderColor: `${accentColor}55` },
      ]}
    >
      <View style={styles.photoCardHead}>
        <View
          style={[
            styles.photoIconWrap,
            photo && { backgroundColor: `${accentColor}10` },
          ]}
        >
          <Text style={styles.photoIcon}>
            {label === "Before" ? "🧰" : label === "After" ? "✅" : "🏷️"}
          </Text>
        </View>

        <View style={styles.photoMeta}>
          <Text style={styles.photoLabel}>
            {label}
            {required ? " *" : ""}
          </Text>
          <Text style={styles.photoSub}>{subtitle}</Text>
        </View>
      </View>

      <View style={[styles.photoMedia, compact && styles.photoMediaCompact]}>
        {photo ? (
          <Image
            source={{ uri: photo.uri }}
            style={styles.photoImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.photoEmpty}>
            <Text style={styles.photoEmptyIcon}>📷</Text>
            <Text style={styles.photoEmptyText}>Tap to capture</Text>
          </View>
        )}
      </View>

      <View style={styles.photoFooter}>
        <StatusChip
          label={photo ? "Captured" : "Required"}
          tone={photo ? "success" : "neutral"}
        />
        <View style={[styles.photoAction, { borderColor: accentColor }]}>
          <Text style={[styles.photoActionText, { color: accentColor }]}>
            {photo ? "Retake" : "Capture"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function PoleTagRow({
  photo,
  onPress,
  accentColor,
}: {
  photo: PhotoField;
  onPress: () => void;
  accentColor: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tagRowCard, photo && { borderColor: `${accentColor}55` }]}
    >
      <View style={styles.tagRowLeft}>
        <View
          style={[
            styles.photoIconWrap,
            photo && { backgroundColor: `${accentColor}10` },
          ]}
        >
          <Text style={styles.photoIcon}>🏷️</Text>
        </View>

        <View style={styles.tagRowMeta}>
          <Text style={styles.photoLabel}>Pole Tag *</Text>
          <Text style={styles.photoSub}>Pole identification</Text>
          <View style={{ marginTop: 10 }}>
            <StatusChip
              label={photo ? "Captured" : "Required"}
              tone={photo ? "success" : "neutral"}
            />
          </View>
        </View>
      </View>

      <View style={styles.tagRowRight}>
        <View style={styles.tagThumb}>
          {photo ? (
            <Image
              source={{ uri: photo.uri }}
              style={styles.tagThumbImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.tagThumbEmpty}>
              <Text style={styles.tagThumbEmptyText}>No photo</Text>
            </View>
          )}
        </View>

        <View
          style={[
            styles.photoAction,
            { borderColor: accentColor, marginTop: 10, alignSelf: "flex-end" },
          ]}
        >
          <Text style={[styles.photoActionText, { color: accentColor }]}>
            {photo ? "Retake" : "Capture"}
          </Text>
        </View>
      </View>
    </Pressable>
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
    from_pole_latitude: string;
    from_pole_longitude: string;
    from_pole_gps_captured_at: string;
    from_pole_id: string;
  }>();

  const accentColor = params.accent || "#0F766E";
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

  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [capturedGps, setCapturedGps] = useState<GpsData | null>(null);
  const [gpsCapturing, setGpsCapturing] = useState(false);
  const [gpsQueued, setGpsQueued] = useState(false);

  const toPoleGpsRef = useRef<GpsData | null>(null);
  const locationWatcher = useRef<Location.LocationSubscription | null>(null);

  const fromCode = sanitize(params.pole_code);

  const hasGps = !!capturedGps;
  const canProceed =
    hasGps &&
    !!photoBefore &&
    !!photoAfter &&
    !!photoTag &&
    !!slot &&
    !!landmark.trim();

  const progress = useMemo(() => {
    const completed = [
      hasGps,
      !!photoBefore,
      !!photoAfter,
      !!photoTag,
      !!slot,
      !!landmark.trim(),
    ].filter(Boolean).length;
    return { completed, total: 6, percent: Math.round((completed / 6) * 100) };
  }, [hasGps, photoBefore, photoAfter, photoTag, slot, landmark]);

  useEffect(() => {
    if (slot) cacheSet(`draft_slot_${params.to_pole_id}`, slot).catch(() => {});
  }, [slot]);

  useEffect(() => {
    if (landmark.trim())
      cacheSet(`draft_landmark_${params.to_pole_id}`, landmark).catch(() => {});
  }, [landmark]);

  useEffect(() => {
    gpsQueueFlush().catch(() => {});
    gpsQueueHasPole(params.to_pole_id)
      .then((has) => {
        if (has) setGpsQueued(true);
      })
      .catch(() => {});

    cacheGet<{ lat: number; lng: number }>(`pole_gps_${params.to_pole_id}`)
      .then(async (g) => {
        if (g?.lat && g?.lng) {
          setCapturedGps({
            latitude: g.lat,
            longitude: g.lng,
            accuracy: null,
            captured_at: new Date().toISOString(),
          });
        } else {
          const q = await gpsQueueGet(params.to_pole_id);
          if (q?.lat && q?.lng) {
            setCapturedGps({
              latitude: q.lat,
              longitude: q.lng,
              accuracy: null,
              captured_at: new Date().toISOString(),
            });
          }
        }
      })
      .catch(() => {});

    api
      .get(`/poles/${params.to_pole_id}`)
      .then(({ data }) => {
        const d = data?.data ?? data;
        if (d?.map_latitude && d?.map_longitude) {
          const lat = Number(d.map_latitude);
          const lng = Number(d.map_longitude);
          if (lat && lng) {
            setCapturedGps(
              (prev) =>
                prev ?? {
                  latitude: lat,
                  longitude: lng,
                  accuracy: null,
                  captured_at: new Date().toISOString(),
                },
            );
            cacheSet(`pole_gps_${params.to_pole_id}`, { lat, lng }).catch(
              () => {},
            );
          }
        }
      })
      .catch(() => {});

    cacheGet<string>(`draft_slot_${params.to_pole_id}`)
      .then((v) => {
        if (v) setSlot(v);
      })
      .catch(() => {});
    cacheGet<string>(`draft_landmark_${params.to_pole_id}`)
      .then((v) => {
        if (v) setLandmark(v);
      })
      .catch(() => {});

    const srcDir = `${FileSystem.documentDirectory}pole_drafts/${projFolder}/${params.node_id}/${params.pole_code}/`;
    const copyDir = `${FileSystem.documentDirectory}teardown_drafts/${projFolder}/${params.node_id}/${params.pole_code}/`;

    FileSystem.makeDirectoryAsync(copyDir, { intermediates: true })
      .then(async () => {
        const files = [
          {
            src: `pole_${params.pole_code}_before.jpg`,
            dest: `${fromCode}_before.jpg`,
          },
          {
            src: `pole_${params.pole_code}_after.jpg`,
            dest: `${fromCode}_after.jpg`,
          },
          {
            src: `pole_${params.pole_code}_poletag.jpg`,
            dest: `${fromCode}_poletag.jpg`,
          },
        ];

        for (const f of files) {
          const srcPath = srcDir + f.src;
          const destPath = copyDir + f.dest;
          const [srcInfo, destInfo] = await Promise.all([
            FileSystem.getInfoAsync(srcPath),
            FileSystem.getInfoAsync(destPath),
          ]);
          if (srcInfo.exists && !destInfo.exists) {
            FileSystem.copyAsync({ from: srcPath, to: destPath }).catch(
              () => {},
            );
          }
        }
      })
      .catch(() => {});

    (async () => {
      await FileSystem.makeDirectoryAsync(draftDir, { intermediates: true });

      const toPoleRawCode = params.to_pole_code;
      const toPoleSrcDir = `${FileSystem.documentDirectory}pole_drafts/${projFolder}/${params.node_id}/${toPoleRawCode}/`;

      await Promise.all(
        [
          { src: `pole_${toPoleRawCode}_before.jpg`, dest: F.before },
          { src: `pole_${toPoleRawCode}_after.jpg`, dest: F.after },
          { src: `pole_${toPoleRawCode}_poletag.jpg`, dest: F.tag },
        ].map(async (f) => {
          const srcPath = toPoleSrcDir + f.src;
          const destPath = draftDir + f.dest;
          const [srcInfo, destInfo] = await Promise.all([
            FileSystem.getInfoAsync(srcPath),
            FileSystem.getInfoAsync(destPath),
          ]);
          if (srcInfo.exists && !destInfo.exists) {
            await FileSystem.copyAsync({ from: srcPath, to: destPath }).catch(
              () => {},
            );
          }
        }),
      );

      const load = async (file: string): Promise<PhotoField | null> => {
        const path = draftDir + file;
        const info = await FileSystem.getInfoAsync(path);
        if (!info.exists) return null;
        return { uri: info.uri, name: file, type: "image/jpeg" };
      };

      const [b, a, t] = await Promise.all([
        load(F.before),
        load(F.after),
        load(F.tag),
      ]);
      if (b) setPhotoBefore(b);
      if (a) setPhotoAfter(a);
      if (t) setPhotoTag(t);
    })();
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Highest,
          distanceInterval: 1,
          timeInterval: 2000,
        },
        (loc) => {
          if (!mounted) return;
          toPoleGpsRef.current = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            accuracy: loc.coords.accuracy,
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
    if (!coords) {
      Alert.alert("GPS not ready", "Still acquiring signal. Please wait.");
      return;
    }

    setGpsCapturing(true);
    try {
      setCapturedGps({ ...coords });
      cacheSet(`pole_gps_${params.to_pole_id}`, {
        lat: coords.latitude,
        lng: coords.longitude,
      }).catch(() => {});

      try {
        await api.post(`/poles/${params.to_pole_id}/gps`, {
          map_latitude: coords.latitude,
          map_longitude: coords.longitude,
        });
        setGpsQueued(false);
      } catch {
        await gpsQueuePush(
          params.to_pole_id,
          coords.latitude,
          coords.longitude,
        );
        setGpsQueued(true);
      }
    } finally {
      setGpsCapturing(false);
    }
  }

  async function compressPhoto(uri: string): Promise<string> {
    try {
      const ctx = ImageManipulator.manipulate(uri);
      ctx.resize({ width: 900 });
      const img = await ctx.renderAsync();
      const result = await img.saveAsync({
        compress: 0.45,
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

    if (fileName === F.before || fileName === F.tag) {
      const suffix = fileName === F.before ? "_before.jpg" : "_poletag.jpg";
      const poleDir = `${FileSystem.documentDirectory}pole_drafts/${projFolder}/${params.node_id}/${params.to_pole_code}/`;
      const poleDest = `${poleDir}pole_${params.to_pole_code}${suffix}`;

      FileSystem.makeDirectoryAsync(poleDir, { intermediates: true })
        .then(() => FileSystem.copyAsync({ from: compressed, to: poleDest }))
        .catch(() => {});
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
          if (s === "granted")
            MediaLibrary.saveToLibraryAsync(uri).catch(() => {});
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
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backIcon}>‹</Text>
            </Pressable>

            <View style={styles.topBarText}>
              <Text style={styles.screenTitle}>Destination Pole</Text>
              <Text style={styles.screenSubtitle} numberOfLines={1}>
                {params.to_pole_code || "—"} •{" "}
                {params.to_pole_name || "Unnamed pole"}
              </Text>
            </View>

            <View style={styles.progressMini}>
              <Text style={styles.progressMiniValue}>{progress.percent}%</Text>
            </View>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryBlock}>
                <Text style={styles.summaryLabel}>From</Text>
                <Text style={styles.summaryValue} numberOfLines={1}>
                  {params.pole_code || "—"}
                </Text>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryBlock}>
                <Text style={styles.summaryLabel}>To</Text>
                <Text style={styles.summaryValue} numberOfLines={1}>
                  {params.to_pole_code || "—"}
                </Text>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryBlock}>
                <Text style={styles.summaryLabel}>Span</Text>
                <Text style={styles.summaryValue} numberOfLines={1}>
                  {params.expected_cable || params.length_meters || "—"}m
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>GPS Location</Text>
              <StatusChip
                label={hasGps ? "Captured" : "Required"}
                tone={hasGps ? "success" : "warning"}
              />
            </View>

            <Pressable
              onPress={captureGps}
              disabled={gpsCapturing}
              style={[styles.gpsButton, hasGps && styles.gpsButtonSuccess]}
            >
              <View style={styles.gpsMain}>
                <View
                  style={[
                    styles.gpsIconWrap,
                    hasGps && styles.gpsIconWrapSuccess,
                  ]}
                >
                  {gpsCapturing ? (
                    <ActivityIndicator color={accentColor} size="small" />
                  ) : (
                    <Text style={styles.gpsIcon}>📍</Text>
                  )}
                </View>

                <View style={styles.gpsMeta}>
                  <Text style={styles.gpsTitle}>
                    {hasGps
                      ? "GPS captured successfully"
                      : "Capture current location"}
                  </Text>

                  <Text style={styles.gpsDesc}>
                    {hasGps
                      ? `${capturedGps!.latitude.toFixed(6)}, ${capturedGps!.longitude.toFixed(6)}`
                      : gpsAccuracy === null
                        ? "Acquiring signal…"
                        : gpsAccuracy <= 5
                          ? `Accuracy ${gpsAccuracy}m • Ready`
                          : gpsAccuracy <= 15
                            ? `Accuracy ${gpsAccuracy}m • Improving`
                            : `Accuracy ${gpsAccuracy}m • Weak signal`}
                  </Text>

                  {gpsQueued && (
                    <Text style={styles.pendingText}>
                      Pending upload. Will sync when online.
                    </Text>
                  )}
                </View>
              </View>

              <View
                style={[styles.gpsPillAction, { borderColor: accentColor }]}
              >
                <Text
                  style={[styles.gpsPillActionText, { color: accentColor }]}
                >
                  {hasGps ? "Recapture" : "Capture"}
                </Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Photo Documentation</Text>
              <StatusChip label="3 Required" />
            </View>

            <View style={styles.beforeAfterRow}>
              <PhotoCard
                label="Before"
                subtitle="Before teardown"
                photo={photoBefore}
                onPress={() => openCamera(setPhotoBefore, F.before)}
                required
                accentColor={accentColor}
                compact
              />
              <PhotoCard
                label="After"
                subtitle="After teardown"
                photo={photoAfter}
                onPress={() => openCamera(setPhotoAfter, F.after)}
                required
                accentColor={accentColor}
                compact
              />
            </View>

            <View style={{ marginTop: 12 }}>
              <PoleTagRow
                photo={photoTag}
                onPress={() => openCamera(setPhotoTag, F.tag)}
                accentColor={accentColor}
              />
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Select Slot</Text>
              <StatusChip
                label={slot ? slot : "Required"}
                tone={slot ? "success" : "warning"}
              />
            </View>

            <View style={styles.slotRow}>
              {SLOTS.map((s) => {
                const active = slot === s;
                return (
                  <Pressable
                    key={s}
                    onPress={() => setSlot(s)}
                    style={[
                      styles.slotBtn,
                      active && {
                        backgroundColor: accentColor,
                        borderColor: accentColor,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.slotText, active && { color: "#FFFFFF" }]}
                    >
                      {s}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Landmark / Reference</Text>
              <StatusChip
                label={landmark.trim() ? "Filled" : "Required"}
                tone={landmark.trim() ? "success" : "warning"}
              />
            </View>

            <TextInput
              style={styles.textArea}
              placeholder="e.g. Beside blue gate, near convenience store"
              placeholderTextColor="#9CA3AF"
              value={landmark}
              onChangeText={setLandmark}
              multiline
              numberOfLines={3}
            />
          </View>
        </ScrollView>

        <View style={styles.ctaWrap}>
          {!canProceed && (
            <View style={styles.inlineRequirements}>
              {!hasGps && <Text style={styles.reqText}>GPS</Text>}
              {!photoBefore && <Text style={styles.reqText}>Before</Text>}
              {!photoAfter && <Text style={styles.reqText}>After</Text>}
              {!photoTag && <Text style={styles.reqText}>Pole Tag</Text>}
              {!slot && <Text style={styles.reqText}>Slot</Text>}
              {!landmark.trim() && <Text style={styles.reqText}>Landmark</Text>}
            </View>
          )}

          <Pressable
            onPress={canProceed ? goToComponents : undefined}
            disabled={!canProceed}
            style={[
              styles.ctaBtn,
              { backgroundColor: canProceed ? accentColor : "#D1D5DB" },
            ]}
          >
            <Text
              style={[
                styles.ctaText,
                { color: canProceed ? "#FFFFFF" : "#6B7280" },
              ]}
            >
              {canProceed ? "Select Pair  →" : "Complete required fields"}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F4F7F8",
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 150,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },

  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E7EAEE",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  backIcon: {
    fontSize: 28,
    color: "#111827",
    fontWeight: "600",
    marginTop: -3,
  },

  topBarText: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },

  screenTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.6,
  },

  screenSubtitle: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
    marginTop: 2,
  },

  progressMini: {
    minWidth: 58,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E7EAEE",
  },

  progressMiniValue: {
    fontSize: 13,
    fontWeight: "900",
    color: "#0F172A",
  },

  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E8EDF2",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  summaryBlock: {
    flex: 1,
  },

  summaryLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "700",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  summaryValue: {
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "800",
  },

  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 10,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E8EDF2",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.2,
  },

  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
  },

  chipSuccess: {
    backgroundColor: "#DCFCE7",
  },

  chipWarning: {
    backgroundColor: "#FEF3C7",
  },

  chipText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
  },

  chipTextSuccess: {
    color: "#166534",
  },

  chipTextWarning: {
    color: "#92400E",
  },

  gpsButton: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E7EAEE",
    backgroundColor: "#FBFCFC",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  gpsButtonSuccess: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
  },

  gpsMain: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },

  gpsIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  gpsIconWrapSuccess: {
    backgroundColor: "#D1FAE5",
  },

  gpsIcon: {
    fontSize: 22,
  },

  gpsMeta: {
    flex: 1,
  },

  gpsTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },

  gpsDesc: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },

  pendingText: {
    fontSize: 11,
    color: "#B45309",
    fontWeight: "700",
    marginTop: 5,
  },

  gpsPillAction: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: "#FFFFFF",
  },

  gpsPillActionText: {
    fontSize: 12,
    fontWeight: "800",
  },

  beforeAfterRow: {
    flexDirection: "row",
    gap: 10,
  },

  photoCard: {
    backgroundColor: "#FCFCFD",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E7EAEE",
    padding: 12,
  },

  photoCardCompact: {
    flex: 1,
  },

  photoCardHead: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  photoIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  photoIcon: {
    fontSize: 18,
  },

  photoMeta: {
    flex: 1,
  },

  photoLabel: {
    fontSize: 13,
    fontWeight: "900",
    color: "#111827",
  },

  photoSub: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "600",
    marginTop: 2,
  },

  photoMedia: {
    height: 150,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#EEF2F7",
  },

  photoMediaCompact: {
    height: 112,
  },

  photoImage: {
    width: "100%",
    height: "100%",
  },

  photoEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  photoEmptyIcon: {
    fontSize: 24,
    marginBottom: 6,
  },

  photoEmptyText: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "700",
  },

  photoFooter: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  photoAction: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: "#FFFFFF",
  },

  photoActionText: {
    fontSize: 12,
    fontWeight: "800",
  },

  tagRowCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E7EAEE",
    backgroundColor: "#FCFCFD",
    padding: 12,
    flexDirection: "row",
    alignItems: "stretch",
  },

  tagRowLeft: {
    flexDirection: "row",
    flex: 1,
    paddingRight: 10,
  },

  tagRowMeta: {
    flex: 1,
  },

  tagRowRight: {
    width: 132,
    justifyContent: "space-between",
  },

  tagThumb: {
    height: 86,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#EEF2F7",
  },

  tagThumbImage: {
    width: "100%",
    height: "100%",
  },

  tagThumbEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  tagThumbEmptyText: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "700",
  },

  slotRow: {
    flexDirection: "row",
    gap: 8,
  },

  slotBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#F8FAFC",
  },

  slotText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#334155",
  },

  textArea: {
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    backgroundColor: "#FBFCFD",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: "500",
    color: "#0F172A",
    textAlignVertical: "top",
    minHeight: 88,
  },

  ctaWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },

  inlineRequirements: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },

  reqText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#B91C1C",
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },

  ctaBtn: {
    borderRadius: 18,
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  ctaText: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
});
