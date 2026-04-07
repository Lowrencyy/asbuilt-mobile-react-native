import api from "@/lib/api";
import { cacheGet, cacheSet } from "@/lib/cache";
import {
  gpsQueueFlush,
  gpsQueueGet,
  gpsQueueHasPole,
  gpsQueuePush,
} from "@/lib/gps-queue";
import * as FileSystem from "expo-file-system/legacy";
import { Image as ExpoImage } from "expo-image";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as MediaLibrary from "expo-media-library";
import { Stack, router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

const SLOTS = ["DA", "C1", "C2", "C3", "C4", "C5"] as const;
const REQUIRED_GPS_ACCURACY_METERS = 10;

type PhotoField = {
  uri: string;
  name: string;
  type: string;
  fileUri?: string;
  version?: number;
} | null;

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

function createPhotoField(
  fileUri: string,
  name: string,
): NonNullable<PhotoField> {
  const version = Date.now();
  return {
    uri: `${fileUri}?v=${version}`,
    fileUri,
    name,
    type: "image/jpeg",
    version,
  };
}

function getCompletionState({
  hasGps,
  photoBefore,
  photoAfter,
  photoTag,
  slot,
  landmark,
}: {
  hasGps: boolean;
  photoBefore: PhotoField;
  photoAfter: PhotoField;
  photoTag: PhotoField;
  slot: string;
  landmark: string;
}) {
  const completed = [
    hasGps,
    !!photoBefore,
    !!photoAfter,
    !!photoTag,
    !!slot,
    !!landmark.trim(),
  ].filter(Boolean).length;

  return {
    completed,
    total: 6,
    percent: Math.round((completed / 6) * 100),
  };
}

function buildPoleMapHtml(lat: number, lng: number, accentColor: string) {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html,body,#map{width:100%;height:100%;background:#f0f4f8;}
.leaflet-div-icon{background:none!important;border:none!important;}
.pin-pulse{
  width:20px;height:20px;border-radius:50%;
  background:${accentColor};
  box-shadow:0 0 0 0 ${accentColor}66;
  animation:pulse 1.8s infinite;
}
@keyframes pulse{
  0%{box-shadow:0 0 0 0 ${accentColor}66;}
  70%{box-shadow:0 0 0 14px ${accentColor}00;}
  100%{box-shadow:0 0 0 0 ${accentColor}00;}
}
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map=L.map('map',{
  zoomControl:true,
  scrollWheelZoom:false,
  dragging:true,
  doubleClickZoom:false,
  touchZoom:true
}).setView([${lat},${lng}],17);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{
  subdomains:'abcd',
  maxZoom:20
}).addTo(map);

var icon=L.divIcon({
  className:'',
  html:'<div class="pin-pulse"></div>',
  iconSize:[20,20],
  iconAnchor:[10,10]
});

L.marker([${lat},${lng}],{icon:icon}).addTo(map);

setTimeout(function(){map.invalidateSize();},100);
</script>
</body>
</html>`;
}

function TrackerMini({ done, label }: { done: boolean; label: string }) {
  return (
    <View style={styles.trackerMini}>
      <View style={[styles.trackerMiniDot, done && styles.trackerMiniDotDone]}>
        <Text
          style={[
            styles.trackerMiniDotText,
            done && styles.trackerMiniDotTextDone,
          ]}
        >
          {done ? "✓" : "•"}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        style={[styles.trackerMiniLabel, done && styles.trackerMiniLabelDone]}
      >
        {label}
      </Text>
    </View>
  );
}

function ProgressWaveBar({
  progress,
  accentColor,
}: {
  progress: number;
  accentColor: string;
}) {
  const waveAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 2200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [waveAnim]);

  const shimmerTranslate = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-160, 260],
  });

  const bobTranslate = waveAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, -1.5, 0, 1.5, 0],
  });

  return (
    <View style={styles.progressBarTrack}>
      <View
        style={[
          styles.progressBarFill,
          { width: `${progress}%`, backgroundColor: accentColor },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.progressWave,
            {
              transform: [
                { translateX: shimmerTranslate },
                { translateY: bobTranslate },
                { rotate: "12deg" },
              ],
            },
          ]}
        />
      </View>
    </View>
  );
}

function SectionHeading({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderTextWrap}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

function PhotoTile({
  label,
  photo,
  accentColor,
  onCapture,
  compact = false,
}: {
  label: string;
  photo: PhotoField;
  accentColor: string;
  onCapture: () => void;
  compact?: boolean;
}) {
  return (
    <View style={[styles.photoTile, compact && styles.photoTileCompact]}>
      <Text
        style={[
          styles.photoTileEyebrow,
          { textAlign: "center" },
          photo ? { color: accentColor } : null,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>

      <Pressable
        onPress={onCapture}
        style={[
          styles.photoPreviewWrap,
          compact && styles.photoPreviewWrapCompact,
        ]}
      >
        {photo ? (
          <>
            <ExpoImage
              source={{ uri: photo.uri }}
              style={[styles.photoThumb, compact && styles.photoThumbCompact]}
              contentFit="cover"
              transition={150}
            />
            <View style={styles.photoOverlay}>
              <View style={styles.photoOverlayButton}>
                <Text style={styles.photoOverlayButtonText}>Retake</Text>
              </View>
            </View>
          </>
        ) : (
          <View
            style={[styles.photoEmpty, compact && styles.photoEmptyCompact]}
          >
            <Text style={styles.photoEmptyIcon}>📷</Text>
            <Text
              style={
                compact ? styles.photoEmptyTitleCompact : styles.photoEmptyTitle
              }
            >
              Tap to capture
            </Text>
          </View>
        )}
      </Pressable>

      <View style={styles.photoSavedRow}>
        {photo ? (
          <View style={[styles.statusChip, styles.statusChipSuccess]}>
            <Text style={[styles.statusChipText, styles.statusChipTextSuccess]}>
              Photo saved
            </Text>
          </View>
        ) : !compact ? (
          <Pressable
            onPress={onCapture}
            style={({ pressed }) => [
              styles.captureMiniBtn,
              { backgroundColor: accentColor },
              pressed && styles.pressedDown,
            ]}
          >
            <Text style={styles.captureMiniBtnText}>Capture</Text>
          </Pressable>
        ) : (
          <View />
        )}
      </View>
    </View>
  );
}

const BLUR_DETECT_HTML = `<!DOCTYPE html><html><body style="margin:0;padding:0"><canvas id="c" style="display:none"></canvas><script>
function run(b64){
  var img=new Image();
  img.onload=function(){
    var W=Math.min(img.width,200),H=Math.min(img.height,200);
    var c=document.getElementById('c');c.width=W;c.height=H;
    var ctx=c.getContext('2d');ctx.drawImage(img,0,0,W,H);
    var d=ctx.getImageData(0,0,W,H).data;
    var g=new Float32Array(W*H);
    for(var i=0;i<W*H;i++)g[i]=0.299*d[i*4]+0.587*d[i*4+1]+0.114*d[i*4+2];
    var s=0,n=0;
    for(var y=1;y<H-1;y++){for(var x=1;x<W-1;x++){
      var v=-4*g[y*W+x]+g[(y-1)*W+x]+g[(y+1)*W+x]+g[y*W+x-1]+g[y*W+x+1];
      s+=v*v;n++;
    }}
    window.ReactNativeWebView.postMessage(JSON.stringify({v:n>0?s/n:999}));
  };
  img.onerror=function(){window.ReactNativeWebView.postMessage(JSON.stringify({v:999}));};
  img.src='data:image/jpeg;base64,'+b64;
}
document.addEventListener('message',function(e){run(e.data);});
window.addEventListener('message',function(e){run(e.data);});
window.ReactNativeWebView.postMessage(JSON.stringify({ready:1}));
<\/script></body></html>`;

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

  const accentColor = params.accent || "#0B7A5A";
  const projFolder = sanitize(params.project_name);
  const toPoleCode = sanitize(params.to_pole_code);
  const fromCode = sanitize(params.pole_code);

  const draftDir = `${FileSystem.documentDirectory}teardown_drafts/${projFolder}/${params.node_id}/${params.from_pole_id}/`;

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

  const [qualityAlertOpen, setQualityAlertOpen] = useState(false);
  const [qualityRetakeFn, setQualityRetakeFn] = useState<(() => void) | null>(
    null,
  );

  const [elapsedSecs, setElapsedSecs] = useState(0);

  const timerStartRef = useRef(Date.now());
  const toPoleGpsRef = useRef<GpsData | null>(null);
  const locationWatcher = useRef<Location.LocationSubscription | null>(null);
  const blurCheckRef = useRef<WebView>(null);
  const blurResolverRef = useRef<((r: "ok" | "poor") => void) | null>(null);

  const hasGps = !!capturedGps;

  const canProceed =
    hasGps &&
    !!photoBefore &&
    !!photoAfter &&
    !!photoTag &&
    !!slot &&
    !!landmark.trim();

  const progress = useMemo(
    () =>
      getCompletionState({
        hasGps,
        photoBefore,
        photoAfter,
        photoTag,
        slot,
        landmark,
      }),
    [hasGps, photoBefore, photoAfter, photoTag, slot, landmark],
  );

  useEffect(() => {
    const id = setInterval(() => {
      setElapsedSecs(Math.floor((Date.now() - timerStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (slot) cacheSet(`draft_slot_${params.to_pole_id}`, slot).catch(() => {});
  }, [slot, params.to_pole_id]);

  useEffect(() => {
    cacheSet(`draft_landmark_${params.to_pole_id}`, landmark).catch(() => {});
  }, [landmark, params.to_pole_id]);

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

    const srcDir = `${FileSystem.documentDirectory}pole_drafts/${projFolder}/${params.node_id}/${params.from_pole_id}/`;
    const copyDir = `${FileSystem.documentDirectory}teardown_drafts/${projFolder}/${params.node_id}/${params.from_pole_id}/`;

    FileSystem.makeDirectoryAsync(copyDir, { intermediates: true })
      .then(async () => {
        const files = [
          {
            src: `pole_${params.from_pole_id}_before.jpg`,
            dest: `${fromCode}_before.jpg`,
          },
          {
            src: `pole_${params.from_pole_id}_after.jpg`,
            dest: `${fromCode}_after.jpg`,
          },
          {
            src: `pole_${params.from_pole_id}_poletag.jpg`,
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

      // Do NOT pre-copy from pole_drafts into destination — that would pull in
      // photos from a previous teardown pass on this pole. Only load what was
      // explicitly captured on this teardown screen (stored in draftDir).

      const load = async (file: string): Promise<PhotoField | null> => {
        const path = draftDir + file;
        const info = await FileSystem.getInfoAsync(path);
        if (!info.exists) return null;
        return createPhotoField(info.uri, file);
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
  }, [
    draftDir,
    fromCode,
    projFolder,
    F.before,
    F.after,
    F.tag,
    params.node_id,
    params.pole_code,
    params.to_pole_code,
    params.to_pole_id,
  ]);

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

  function handleBlurMessage(event: { nativeEvent: { data: string } }) {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.ready || !blurResolverRef.current) return;
      const isBlurry = typeof data.v === "number" && data.v < 80;
      blurResolverRef.current(isBlurry ? "poor" : "ok");
      blurResolverRef.current = null;
    } catch {}
  }

  async function checkPhotoQuality(fileUri: string): Promise<"ok" | "poor"> {
    try {
      const b64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: "base64" as any,
      });
      return new Promise<"ok" | "poor">((resolve) => {
        blurResolverRef.current = resolve;
        blurCheckRef.current?.injectJavaScript(
          `(function(){document.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(b64)}}));})();true;`
        );
        setTimeout(() => {
          if (blurResolverRef.current) {
            blurResolverRef.current("ok");
            blurResolverRef.current = null;
          }
        }, 8000);
      });
    } catch {
      return "ok";
    }
  }

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
          gps_captured_at: coords.captured_at,
          gps_accuracy_meters: coords.accuracy,
        });
        setGpsQueued(false);
      } catch {
        await gpsQueuePush(
          params.to_pole_id,
          coords.latitude,
          coords.longitude,
          coords.captured_at as any,
        ).catch(() => {});
        setGpsQueued(true);
      }
    } finally {
      setGpsCapturing(false);
    }
  }

  async function compressPhoto(uri: string): Promise<string> {
    try {
      const ctx = ImageManipulator.manipulate(uri);
      const img = await ctx.renderAsync();
      const result = await img.saveAsync({
        compress: 0.88,
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
  ): Promise<NonNullable<PhotoField>> {
    await FileSystem.makeDirectoryAsync(draftDir, { intermediates: true });

    const compressed = await compressPhoto(uri);
    const dest = draftDir + fileName;
    const existing = await FileSystem.getInfoAsync(dest);

    if (existing.exists) {
      await FileSystem.deleteAsync(dest, { idempotent: true });
    }

    await FileSystem.copyAsync({ from: compressed, to: dest });

    if (fileName === F.before || fileName === F.tag) {
      const suffix = fileName === F.before ? "_before.jpg" : "_poletag.jpg";
      const poleDir = `${FileSystem.documentDirectory}pole_drafts/${projFolder}/${params.node_id}/${params.to_pole_id}/`;
      const poleDest = `${poleDir}pole_${params.to_pole_id}${suffix}`;

      FileSystem.makeDirectoryAsync(poleDir, { intermediates: true })
        .then(async () => {
          const existingPole = await FileSystem.getInfoAsync(poleDest);
          if (existingPole.exists) {
            await FileSystem.deleteAsync(poleDest, { idempotent: true });
          }
          return FileSystem.copyAsync({ from: compressed, to: poleDest });
        })
        .catch(() => {});
    }

    return createPhotoField(dest, fileName);
  }

  async function openCamera(setter: (p: PhotoField) => void, fileName: string) {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Please allow camera access.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets[0]) return;

    const rawUri = result.assets[0].uri;
    const preview = createPhotoField(rawUri, fileName);
    setter(preview);

    try {
      const saved = await savePhotoDraft(fileName, rawUri);
      setter(saved);

      const quality = await checkPhotoQuality(saved.fileUri ?? rawUri);
      if (quality === "poor") {
        setQualityRetakeFn(() => () => openCamera(setter, fileName));
        setQualityAlertOpen(true);
        return;
      }
    } catch (e: any) {
      Alert.alert("Photo Error", e?.message ?? "Failed to save photo.");
    }

    MediaLibrary.requestPermissionsAsync()
      .then(({ status: s }) => {
        if (s === "granted") {
          MediaLibrary.saveToLibraryAsync(rawUri).catch(() => {});
        }
      })
      .catch(() => {});
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

  const gpsTopLabel = hasGps
    ? `${capturedGps?.latitude.toFixed(6)}, ${capturedGps?.longitude.toFixed(6)}`
    : "Captured GPS";

  const gpsSecondaryLabel = hasGps
    ? "Location saved"
    : gpsAccuracy === null
      ? "Acquiring signal…"
      : gpsAccuracy <= REQUIRED_GPS_ACCURACY_METERS
        ? `Accuracy: ${gpsAccuracy}m • Ready to capture`
        : gpsAccuracy <= 20
          ? `Accuracy: ${gpsAccuracy}m • Tap to capture`
          : `Accuracy: ${gpsAccuracy}m • Weak signal — tap to capture anyway`;

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
            style={({ pressed }) => [
              styles.floatingBackBtn,
              pressed && styles.pressedDown,
            ]}
          >
            <Text style={styles.floatingBackIcon}>‹</Text>
          </Pressable>

          <View style={styles.heroCard}>
            <View style={[styles.heroBg, { backgroundColor: accentColor }]} />
            <View style={styles.heroNoise} />
            <View style={styles.heroGlow} />
            <View style={styles.heroContent}>
              <View style={styles.heroTopLine}>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>Destination Pole</Text>
                </View>
              </View>

              <Text style={styles.heroTitle} numberOfLines={2}>
                {params.to_pole_name ||
                  params.to_pole_code ||
                  "Destination Pole"}
              </Text>

              <Text style={styles.heroMeta} numberOfLines={1}>
                {params.project_name || "—"} • {params.to_pole_code || "—"}
              </Text>
            </View>
          </View>

          <View style={styles.progressCard}>
            <View style={styles.progressTopRow}>
              <Text style={styles.progressTitle}>Completion Tracker</Text>
              <View style={styles.timerBadge}>
                <Text style={styles.timerText}>
                  ⏱ {String(Math.floor(elapsedSecs / 60)).padStart(2, "0")}:
                  {String(elapsedSecs % 60).padStart(2, "0")}
                </Text>
              </View>
              <Text style={[styles.progressPercent, { color: accentColor }]}>
                {progress.percent}%
              </Text>
            </View>

            <View style={styles.trackerRow}>
              <TrackerMini done={hasGps} label="GPS" />
              <TrackerMini done={!!photoBefore} label="Before" />
              <TrackerMini done={!!photoAfter} label="After" />
              <TrackerMini done={!!photoTag} label="Tag" />
              <TrackerMini done={!!slot} label="Slot" />
              <TrackerMini done={!!landmark.trim()} label="Landmark" />
            </View>

            <ProgressWaveBar
              progress={progress.percent}
              accentColor={accentColor}
            />
          </View>

          <View style={styles.sectionCard}>
            <SectionHeading
              title="GPS Location"
              right={
                <View
                  style={[
                    styles.sectionPill,
                    hasGps
                      ? styles.sectionPillSuccess
                      : styles.sectionPillMuted,
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
              }
            />

            {hasGps && capturedGps ? (
              <View style={styles.gpsMapBox}>
                <WebView
                  style={StyleSheet.absoluteFillObject}
                  scrollEnabled={false}
                  originWhitelist={["*"]}
                  javaScriptEnabled
                  domStorageEnabled
                  mixedContentMode="always"
                  source={{
                    html: buildPoleMapHtml(
                      capturedGps.latitude,
                      capturedGps.longitude,
                      accentColor,
                    ),
                    baseUrl: "https://local.telcovantage/",
                  }}
                  cacheEnabled={false}
                />
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.gpsCardButton,
                hasGps
                  ? styles.gpsCardButtonSuccess
                  : {
                      borderColor: `${accentColor}35`,
                      backgroundColor: "#FFFFFF",
                    },
                pressed && !gpsCapturing && styles.pressedDown,
              ]}
              onPress={captureGps}
              disabled={gpsCapturing}
            >
              <View
                style={[
                  styles.gpsBigIconWrap,
                  hasGps
                    ? { backgroundColor: `${accentColor}16` }
                    : { backgroundColor: `${accentColor}10` },
                ]}
              >
                {gpsCapturing ? (
                  <ActivityIndicator color={accentColor} size="small" />
                ) : (
                  <Text style={[styles.gpsEmoji, { color: accentColor }]}>
                    📍
                  </Text>
                )}
              </View>

              <View style={styles.gpsTextWrap}>
                <Text style={styles.gpsEyebrow}>GPS DISPLAY</Text>

                <Text
                  style={[
                    styles.gpsCoordinateText,
                    hasGps && { color: "#0F172A" },
                  ]}
                  numberOfLines={1}
                >
                  {gpsTopLabel}
                </Text>

                <Text style={styles.gpsLocationText} numberOfLines={2}>
                  {gpsSecondaryLabel}
                </Text>

                {capturedGps?.captured_at ? (
                  <Text style={styles.gpsCapturedAt}>
                    Captured at{" "}
                    {new Date(capturedGps.captured_at).toLocaleString()}
                  </Text>
                ) : null}

                {gpsQueued ? (
                  <Text style={styles.gpsPendingLabel}>
                    Pending upload • will sync when online
                  </Text>
                ) : null}
              </View>

              <View style={styles.gpsArrowWrap}>
                <Text style={[styles.gpsArrow, { color: accentColor }]}>
                  {hasGps ? "✓" : "›"}
                </Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.sectionCard}>
            <SectionHeading
              title="Pole Photos"
              subtitle="Capture clear reference photos before proceeding"
            />

            <View style={styles.photoRow}>
              <View style={styles.photoHalf}>
                <PhotoTile
                  label="Before"
                  photo={photoBefore}
                  accentColor={accentColor}
                  onCapture={() => openCamera(setPhotoBefore, F.before)}
                  compact
                />
              </View>

              <View style={styles.photoHalf}>
                <PhotoTile
                  label="After"
                  photo={photoAfter}
                  accentColor={accentColor}
                  onCapture={() => openCamera(setPhotoAfter, F.after)}
                  compact
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <PhotoTile
                label="Pole Tag"
                photo={photoTag}
                accentColor={accentColor}
                onCapture={() => openCamera(setPhotoTag, F.tag)}
              />
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.inlineHeader}>
                <Text style={styles.fieldLabelInline}>Slot</Text>
                <Text style={styles.fieldMeta}>
                  {slot ? `Selected: ${slot}` : "Required"}
                </Text>
              </View>

              <View style={styles.slotRowStatic}>
                {SLOTS.map((s) => (
                  <Pressable
                    key={s}
                    style={({ pressed }) => [
                      styles.slotBtn,
                      slot === s && {
                        backgroundColor: accentColor,
                        borderColor: accentColor,
                      },
                      pressed && styles.pressedDown,
                    ]}
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
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={[styles.fieldGroup, { marginBottom: 0 }]}>
              <View style={styles.inlineHeader}>
                <Text style={styles.fieldLabelInline}>Landmark</Text>
                <Text style={styles.fieldMeta}>
                  {landmark.trim() ? "Filled" : "Required"}
                </Text>
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
          </View>
        </ScrollView>

        <View style={styles.ctaBar}>
          <Pressable
            style={({ pressed }) => [
              styles.submitBtn,
              {
                backgroundColor: canProceed ? accentColor : "#C9CED6",
              },
              pressed && canProceed && styles.pressedDown,
            ]}
            onPress={canProceed ? goToComponents : undefined}
            disabled={!canProceed}
          >
            <Text style={styles.submitText}>
              {canProceed
                ? "Continue to Components  →"
                : "Complete required fields first"}
            </Text>
          </Pressable>
        </View>

        <Modal
          visible={qualityAlertOpen}
          transparent
          animationType="fade"
          onRequestClose={() => {}}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.qualityAlertCard}>
              <View style={styles.qualityAlertIconWrap}>
                <Text style={styles.qualityAlertIcon}>⚠️</Text>
              </View>

              <Text style={styles.qualityAlertTitle}>Blurry Photo Detected</Text>

              <Text style={styles.qualityAlertBody}>
                This photo appears to be{" "}
                <Text style={styles.qualityAlertBold}>too blurry</Text>.
                {"\n"}Please retake for a clearer image of the pole tag.
              </Text>

              <View style={styles.qualityAlertActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.qualityRetakeBtn,
                    { backgroundColor: accentColor },
                    pressed && styles.pressedDown,
                  ]}
                  onPress={() => {
                    setQualityAlertOpen(false);
                    qualityRetakeFn?.();
                  }}
                >
                  <Text style={styles.qualityRetakeBtnText}>Retake Photo</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Hidden WebView for blur detection */}
        <WebView
          ref={blurCheckRef}
          style={{ position: "absolute", width: 0, height: 0, opacity: 0 }}
          source={{ html: BLUR_DETECT_HTML }}
          onMessage={handleBlurMessage}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={["*"]}
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F4F6F8",
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 170,
  },

  pressedDown: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
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
    borderColor: "#E7EBEF",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  floatingBackIcon: {
    fontSize: 28,
    color: "#111827",
    fontWeight: "700",
    marginTop: -2,
  },

  heroCard: {
    borderRadius: 30,
    overflow: "hidden",
    marginBottom: 14,
    minHeight: 164,
    backgroundColor: "#0B7A5A",
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
  },

  heroBg: {
    ...StyleSheet.absoluteFillObject,
    opacity: 1,
  },

  heroNoise: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.03)",
  },

  heroGlow: {
    position: "absolute",
    right: -30,
    top: -20,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  heroContent: {
    paddingHorizontal: 18,
    paddingVertical: 18,
    justifyContent: "space-between",
    flex: 1,
  },

  heroTopLine: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },

  heroBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  heroTitle: {
    marginTop: 18,
    fontSize: 28,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.6,
  },

  heroMeta: {
    marginTop: 8,
    fontSize: 13,
    color: "rgba(255,255,255,0.82)",
    fontWeight: "600",
  },

  progressCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#EAECEF",
    shadowColor: "#0F172A",
    shadowOpacity: 0.035,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },

  progressTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  progressTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#111827",
  },

  progressPercent: {
    fontSize: 13,
    fontWeight: "900",
  },

  trackerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    marginBottom: 12,
  },

  trackerMini: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
  },

  trackerMiniDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
  },

  trackerMiniDotDone: {
    backgroundColor: "#DCFCE7",
  },

  trackerMiniDotText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#64748B",
  },

  trackerMiniDotTextDone: {
    color: "#166534",
  },

  trackerMiniLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6B7280",
  },

  trackerMiniLabelDone: {
    color: "#166534",
  },

  progressBarTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: "#E8EDF2",
    overflow: "hidden",
  },

  progressBarFill: {
    height: "100%",
    borderRadius: 999,
    overflow: "hidden",
    justifyContent: "center",
  },

  progressWave: {
    position: "absolute",
    top: -10,
    bottom: -10,
    width: 70,
    backgroundColor: "rgba(255,255,255,0.24)",
    borderRadius: 24,
  },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#E9EDF2",
    shadowColor: "#0F172A",
    shadowOpacity: 0.035,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 10,
  },

  sectionHeaderTextWrap: {
    flex: 1,
    minWidth: 0,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#151826",
  },

  sectionSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: "#667085",
    fontWeight: "500",
  },

  sectionPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 2,
  },

  sectionPillSuccess: {
    backgroundColor: "#DCFCE7",
  },

  sectionPillMuted: {
    backgroundColor: "#F3F4F6",
  },

  sectionPillText: {
    fontSize: 11,
    fontWeight: "800",
  },

  sectionPillTextSuccess: {
    color: "#166534",
  },

  sectionPillTextMuted: {
    color: "#667085",
  },

  gpsMapBox: {
    height: 200,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
  },

  gpsCardButton: {
    borderWidth: 1.25,
    borderRadius: 22,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },

  gpsCardButtonSuccess: {
    backgroundColor: "#F7FBF9",
    borderColor: "#CFE7DB",
  },

  gpsBigIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  gpsEmoji: {
    fontSize: 24,
  },

  gpsTextWrap: {
    flex: 1,
    paddingRight: 10,
  },

  gpsEyebrow: {
    fontSize: 10,
    fontWeight: "900",
    color: "#667085",
    letterSpacing: 1,
    marginBottom: 4,
    textTransform: "uppercase",
  },

  gpsCoordinateText: {
    fontSize: 16,
    lineHeight: 21,
    color: "#111827",
    fontWeight: "900",
  },

  gpsLocationText: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    color: "#667085",
    fontWeight: "500",
  },

  gpsCapturedAt: {
    fontSize: 11,
    color: "#475467",
    fontWeight: "600",
    marginTop: 6,
  },

  gpsArrowWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F4F6F8",
    alignItems: "center",
    justifyContent: "center",
  },

  gpsArrow: {
    fontSize: 18,
    fontWeight: "900",
  },

  gpsPendingLabel: {
    fontSize: 11,
    color: "#B45309",
    fontWeight: "700",
    marginTop: 5,
  },

  photoRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
    alignItems: "stretch",
  },

  photoHalf: {
    flex: 1,
    alignSelf: "stretch",
  },

  fieldGroup: {
    marginBottom: 18,
  },

  photoTile: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E8ECF0",
    padding: 14,
    alignItems: "center",
    justifyContent: "space-between",
    height: 255,
  },

  photoTileCompact: {
    padding: 14,
    height: 255,
  },

  photoTileEyebrow: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: 0.9,
    textTransform: "uppercase",
    marginBottom: 10,
    alignSelf: "center",
  },

  photoPreviewWrap: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
    width: "100%",
  },

  photoPreviewWrapCompact: {
    borderRadius: 18,
  },

  photoThumb: {
    width: "100%",
    height: 180,
    backgroundColor: "#E5E7EB",
  },

  photoThumbCompact: {
    height: 180,
  },

  photoOverlay: {
    position: "absolute",
    right: 10,
    bottom: 10,
  },

  photoOverlayButton: {
    minWidth: 56,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 19,
    backgroundColor: "rgba(17,24,39,0.78)",
    alignItems: "center",
    justifyContent: "center",
  },

  photoOverlayButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  photoEmpty: {
    width: "100%",
    height: 180,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.2,
    borderColor: "#D8E0E8",
    borderStyle: "dashed",
    borderRadius: 18,
  },

  photoEmptyCompact: {
    width: "100%",
    height: 180,
  },

  photoEmptyIcon: {
    fontSize: 28,
    marginBottom: 10,
  },

  photoEmptyTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 4,
    letterSpacing: -0.1,
  },

  photoEmptyTitleCompact: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111827",
  },

  photoSavedRow: {
    alignItems: "center",
    marginTop: 8,
    minHeight: 32,
    justifyContent: "center",
    width: "100%",
  },

  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },

  statusChipSuccess: {
    backgroundColor: "#DDF5E8",
  },

  statusChipText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.45,
    textTransform: "uppercase",
  },

  statusChipTextSuccess: {
    color: "#166534",
  },

  captureMiniBtn: {
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },

  captureMiniBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.35,
  },

  inlineHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 10,
  },

  fieldLabelInline: {
    fontSize: 14,
    fontWeight: "900",
    color: "#111827",
  },

  fieldMeta: {
    fontSize: 12,
    fontWeight: "700",
    color: "#667085",
  },

  slotRowStatic: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },

  slotBtn: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1.2,
    borderColor: "#E1E5EA",
    backgroundColor: "#FAFAFA",
    alignItems: "center",
    justifyContent: "center",
  },

  slotText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#384152",
  },

  textArea: {
    backgroundColor: "#FCFCFD",
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    color: "#111827",
    minHeight: 84,
    textAlignVertical: "top",
    lineHeight: 19,
  },

  ctaBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
    elevation: 10,
    gap: 8,
  },

  submitBtn: {
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  submitText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },

  timerBadge: {
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  timerText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#374151",
    letterSpacing: 0.5,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(12,16,24,0.62)",
    justifyContent: "center",
    padding: 18,
  },

  qualityAlertCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 24,
    marginHorizontal: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },

  qualityAlertIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#FFF7E7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },

  qualityAlertIcon: {
    fontSize: 30,
  },

  qualityAlertTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 10,
    textAlign: "center",
  },

  qualityAlertBody: {
    fontSize: 14,
    lineHeight: 22,
    color: "#667085",
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 24,
  },

  qualityAlertBold: {
    fontWeight: "800",
    color: "#B45309",
  },

  qualityAlertActions: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },

  qualityKeepBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#F3F4F6",
  },

  qualityKeepBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#374151",
  },

  qualityRetakeBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },

  qualityRetakeBtnText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#FFFFFF",
  },
});
