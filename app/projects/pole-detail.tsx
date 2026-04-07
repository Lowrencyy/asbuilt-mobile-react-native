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
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

type PhotoField = {
  uri: string;
  fileUri: string;
  name: string;
  type: string;
  version: number;
} | null;

type GpsDraft = {
  lat: number;
  lng: number;
  capturedAt: string;
};

type Span = {
  id: number;
  pole_span_code: string | null;
  length_meters: number;
  runs: number;
  expected_cable: number;
  expected_node: number;
  expected_amplifier: number;
  expected_extender: number;
  expected_tsc: number;
  expected_powersupply: number;
  expected_powersupply_housing: number;
  from_pole: { id: number; pole_code: string; pole_name: string | null };
  to_pole: { id: number; pole_code: string; pole_name: string | null };
};

const SLOTS = ["DA", "C1", "C2", "C3", "C4", "C5"] as const;
const REQUIRED_GPS_ACCURACY_METERS = 10;

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
  onView,
  compact = false,
}: {
  label: string;
  subtitle?: string;
  required?: boolean;
  photo: PhotoField;
  accentColor: string;
  onCapture: () => void;
  onView: () => void;
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
        onPress={photo ? onView : onCapture}
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
                <Text style={styles.photoOverlayButtonText}>View</Text>
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

      {photo ? (
        <View style={styles.photoSavedRow}>
          <View style={[styles.statusChip, styles.statusChipSuccess]}>
            <Text style={[styles.statusChipText, styles.statusChipTextSuccess]}>
              Photo saved
            </Text>
          </View>
        </View>
      ) : !compact ? (
        <View style={styles.photoSavedRow}>
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
        </View>
      ) : null}
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

export default function PoleDetailScreen() {
  const {
    pole_id,
    pole_code,
    pole_name,
    node_id,
    project_id,
    project_name,
    accent,
  } = useLocalSearchParams<{
    pole_id: string;
    pole_code: string;
    pole_name: string;
    node_id: string;
    project_id: string;
    project_name: string;
    accent: string;
  }>();

  const accentColor = accent || "#0B7A5A";

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [gpsCapturedAt, setGpsCapturedAt] = useState("");
  const [poleLoading, setPoleLoading] = useState(true);
  const [gpsCapturing, setGpsCapturing] = useState(false);
  const [gpsQueued, setGpsQueued] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const prewarmedGps = useRef<{
    latitude: number;
    longitude: number;
    accuracy: number | null;
  } | null>(null);
  const locationWatcher = useRef<Location.LocationSubscription | null>(null);
  const [street, setStreet] = useState("");

  const [photoBefore, setPhotoBefore] = useState<PhotoField>(null);
  const [photoAfter, setPhotoAfter] = useState<PhotoField>(null);
  const [photoTag, setPhotoTag] = useState<PhotoField>(null);

  const [slot, setSlot] = useState("");
  const [landmark, setLandmark] = useState("");
  const [spans, setSpans] = useState<Span[]>([]);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [qualityAlertOpen, setQualityAlertOpen] = useState(false);
  const [qualityRetakeFn, setQualityRetakeFn] = useState<(() => void) | null>(null);
  const [viewerLabel, setViewerLabel] = useState("");
  const [viewerPhoto, setViewerPhoto] = useState<PhotoField>(null);
  const [viewerRetake, setViewerRetake] = useState<(() => void) | null>(null);

  // Work timer
  const timerStartRef = useRef(Date.now());
  const blurCheckRef = useRef<WebView>(null);
  const blurResolverRef = useRef<((r: "ok" | "poor") => void) | null>(null);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setElapsedSecs(Math.floor((Date.now() - timerStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Draft recovery
  const [draftRestored, setDraftRestored] = useState(false);

  const projFolder = sanitize(project_name);
  const draftDir = `${FileSystem.documentDirectory}pole_drafts/${projFolder}/${node_id ?? "node"}/${pole_id}/`;
  const gpsDraftKey = `pole_gps_${pole_id}`;
  const F = {
    before: `pole_${pole_id}_before.jpg`,
    after: `pole_${pole_id}_after.jpg`,
    tag: `pole_${pole_id}_poletag.jpg`,
  };

  const setGpsDraftState = useCallback((draft: GpsDraft) => {
    setLat(draft.lat);
    setLng(draft.lng);
    setGpsCapturedAt(draft.capturedAt);
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
          prewarmedGps.current = loc.coords;
          setGpsAccuracy(Math.round(loc.coords.accuracy ?? 999));
        },
      );

      if (mounted) {
        locationWatcher.current = sub;
      } else {
        sub.remove();
      }
    })();

    return () => {
      mounted = false;
      locationWatcher.current?.remove();
      locationWatcher.current = null;
    };
  }, []);

  useEffect(() => {
    if (slot) cacheSet(`draft_slot_${pole_id}`, slot).catch(() => {});
  }, [slot, pole_id]);

  useEffect(() => {
    cacheSet(`draft_landmark_${pole_id}`, landmark).catch(() => {});
  }, [landmark, pole_id]);

  useEffect(() => {
    gpsQueueFlush().catch(() => {});
    gpsQueueHasPole(pole_id).then(setGpsQueued);

    cacheGet<GpsDraft>(gpsDraftKey)
      .then(async (cached) => {
        if (cached?.lat && cached?.lng) {
          setGpsDraftState(cached);
          setPoleLoading(false);
          return;
        }

        const queued = await gpsQueueGet(pole_id);
        if (queued?.lat && queued?.lng) {
          setGpsDraftState({
            lat: queued.lat,
            lng: queued.lng,
            capturedAt:
              queued.capturedAt ||
              queued.gps_captured_at ||
              queued.created_at ||
              "",
          });
        }
      })
      .catch(() => {});

    cacheGet<string>(`draft_slot_${pole_id}`)
      .then((v) => {
        if (v) setSlot(v);
      })
      .catch(() => {});

    cacheGet<string>(`draft_landmark_${pole_id}`)
      .then((v) => {
        if (typeof v === "string") setLandmark(v);
      })
      .catch(() => {});

    const SPANS_KEY = `spans_pole_${pole_id}`;
    cacheGet<Span[]>(SPANS_KEY).then((cached) => {
      if (cached?.length) setSpans(cached);
    });

    api
      .get(`/poles/${pole_id}/spans`)
      .then(({ data }) => {
        const list: Span[] = Array.isArray(data) ? data : (data?.data ?? []);
        cacheSet(SPANS_KEY, list);
        setSpans(list);
      })
      .catch(() => {});

    api
      .get(`/poles/${pole_id}`)
      .then(({ data }) => {
        const d = data?.data ?? data;

        if (d?.slot) setSlot(d.slot);
        if (typeof d?.remarks === "string") setLandmark(d.remarks);

        if (d?.map_latitude && d?.map_longitude) {
          const draft: GpsDraft = {
            lat: Number(d.map_latitude),
            lng: Number(d.map_longitude),
            capturedAt:
              d.gps_captured_at || d.map_captured_at || d.updated_at || "",
          };
          setGpsDraftState(draft);
          cacheSet(gpsDraftKey, draft).catch(() => {});
        }

        setPoleLoading(false);
      })
      .catch(() => {
        setPoleLoading(false);
      });

    (async () => {
      const dirInfo = await FileSystem.getInfoAsync(draftDir);
      if (!dirInfo.exists) return;

      const load = async (file: string): Promise<PhotoField | null> => {
        const path = draftDir + file;
        const info = await FileSystem.getInfoAsync(path);
        if (!info.exists) return null;
        return createPhotoField(info.uri, file);
      };

      const [pb, pa, pt] = await Promise.all([
        load(F.before),
        load(F.after),
        load(F.tag),
      ]);

      if (pb) setPhotoBefore(pb);
      if (pa) setPhotoAfter(pa);
      if (pt) setPhotoTag(pt);
      if (pb || pa || pt) setDraftRestored(true);
    })();
  }, [
    pole_id,
    gpsDraftKey,
    draftDir,
    F.after,
    F.before,
    F.tag,
    setGpsDraftState,
  ]);

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

    return createPhotoField(dest, fileName);
  }

  async function openCamera(
    setter: (p: PhotoField) => void,
    fileName: string,
    modalLabel?: string,
  ) {
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

    if (modalLabel && viewerLabel === modalLabel) {
      setViewerPhoto(preview);
    }

    try {
      const saved = await savePhotoDraft(fileName, rawUri);
      setter(saved);

      if (modalLabel && viewerLabel === modalLabel) {
        setViewerPhoto(saved);
      }

      const quality = await checkPhotoQuality(saved.fileUri);
      if (quality === "poor") {
        setQualityRetakeFn(() => () => openCamera(setter, fileName, modalLabel));
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

  function openViewer(label: string, photo: PhotoField, retakeFn: () => void) {
    if (!photo) return;
    setViewerLabel(label);
    setViewerPhoto(photo);
    setViewerRetake(() => retakeFn);
    setViewerOpen(true);
  }

  async function captureGps() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Please allow location access.");
      return;
    }

    setGpsCapturing(true);

    try {
      const coords = prewarmedGps.current;
      const currentAccuracy = Math.round(
        coords?.accuracy ?? gpsAccuracy ?? 999,
      );

      if (!coords) {
        Alert.alert(
          "GPS not ready",
          "Still acquiring signal. Please wait a moment.",
        );
        return;
      }

      const capturedAt = new Date().toISOString();
      const draft: GpsDraft = {
        lat: coords.latitude,
        lng: coords.longitude,
        capturedAt,
      };

      setGpsDraftState(draft);
      await cacheSet(gpsDraftKey, draft).catch(() => {});

      try {
        await api.post(`/poles/${pole_id}/gps`, {
          map_latitude: draft.lat,
          map_longitude: draft.lng,
          gps_captured_at: draft.capturedAt,
          gps_accuracy_meters: currentAccuracy,
        });
        setGpsQueued(false);
      } catch {
        await gpsQueuePush(
          pole_id,
          draft.lat,
          draft.lng,
          draft.capturedAt as any,
        ).catch(async () => {
          await cacheSet(`gps_queue_fallback_${pole_id}`, draft).catch(
            () => {},
          );
        });
        setGpsQueued(true);
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to capture GPS.");
    } finally {
      setGpsCapturing(false);
    }
  }

  const hasGps = !!(lat && lng);
  const canSelectPair =
    (hasGps || poleLoading) &&
    !!photoBefore &&
    !!photoAfter &&
    !!photoTag &&
    !!slot;

  const gpsTopLabel = hasGps
    ? `${lat?.toFixed(6)}, ${lng?.toFixed(6)}`
    : "Captured GPS";

  const gpsSecondaryLabel = hasGps
    ? street || "Location saved"
    : gpsAccuracy === null
      ? "Acquiring signal…"
      : gpsAccuracy <= REQUIRED_GPS_ACCURACY_METERS
        ? `Accuracy: ${gpsAccuracy}m • Ready to capture`
        : gpsAccuracy <= 20
          ? `Accuracy: ${gpsAccuracy}m • Tap to capture`
          : `Accuracy: ${gpsAccuracy}m • Weak signal — tap to capture anyway`;

  function goToDestination(span: Span) {
    const isReversed = span.to_pole.pole_code === pole_code;
    const actualToId = isReversed
      ? String(span.from_pole.id)
      : String(span.to_pole.id);
    const actualToCode = isReversed
      ? span.from_pole.pole_code
      : span.to_pole.pole_code;
    const actualToName = isReversed
      ? (span.from_pole.pole_name ?? span.from_pole.pole_code)
      : (span.to_pole.pole_name ?? span.to_pole.pole_code);

    router.push({
      pathname: "/teardown/destination-pole" as any,
      params: {
        pole_code,
        pole_name,
        node_id,
        project_id,
        project_name,
        accent: accentColor,
        span_id: String(span.id),
        span_code: span.pole_span_code ?? "",
        to_pole_id: actualToId,
        to_pole_code: actualToCode,
        to_pole_name: actualToName,
        expected_cable: String(span.expected_cable),
        length_meters: String(span.length_meters),
        declared_runs: String(span.runs),
        expected_node: String(span.expected_node),
        expected_amplifier: String(span.expected_amplifier),
        expected_extender: String(span.expected_extender),
        expected_tsc: String(span.expected_tsc),
        expected_powersupply: String(span.expected_powersupply),
        expected_powersupply_housing: String(span.expected_powersupply_housing),
        from_pole_id: pole_id ?? "",
        from_pole_latitude: lat ? String(lat) : "",
        from_pole_longitude: lng ? String(lng) : "",
        from_pole_gps_captured_at: gpsCapturedAt,
      },
    });
  }

  function handleNext() {
    if (!canSelectPair) return;

    if (spans.length === 1) {
      goToDestination(spans[0]);
    } else {
      router.push({
        pathname: "/teardown/select-pair" as any,
        params: {
          pole_id,
          pole_code,
          pole_name,
          node_id,
          project_id,
          project_name,
          accent: accentColor,
          from_pole_latitude: lat ? String(lat) : "",
          from_pole_longitude: lng ? String(lng) : "",
          from_pole_gps_captured_at: gpsCapturedAt,
        },
      });
    }
  }

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
                  <Text style={styles.heroBadgeText}>Pole Teardown</Text>
                </View>
              </View>

              <Text style={styles.heroTitle} numberOfLines={2}>
                {pole_name || "Pole"}
              </Text>

              <Text style={styles.heroMeta} numberOfLines={1}>
                {project_name || "—"} • ID {pole_id || "—"}
              </Text>
            </View>
          </View>

          {draftRestored ? (
            <View style={styles.draftBanner}>
              <Text style={styles.draftBannerText}>
                ↩  Draft restored from previous session
              </Text>
            </View>
          ) : null}

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
                    {hasGps
                      ? "Captured"
                      : poleLoading
                        ? "Checking…"
                        : "Required"}
                  </Text>
                </View>
              }
            />

            {hasGps && lat !== null && lng !== null ? (
              <View style={styles.gpsMapBox}>
                <WebView
                  style={StyleSheet.absoluteFillObject}
                  scrollEnabled={false}
                  originWhitelist={["*"]}
                  javaScriptEnabled
                  domStorageEnabled
                  mixedContentMode="always"
                  source={{
                    html: buildPoleMapHtml(lat, lng, accentColor),
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
                  styles.gpsIconWrap,
                  hasGps
                    ? { backgroundColor: `${accentColor}16` }
                    : { backgroundColor: `${accentColor}10` },
                ]}
              >
                {gpsCapturing || (poleLoading && !hasGps) ? (
                  <ActivityIndicator color={accentColor} size="small" />
                ) : (
                  <Text style={[styles.gpsIcon, { color: accentColor }]}>
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

                {gpsCapturedAt ? (
                  <Text style={styles.gpsCapturedAt}>
                    Captured at {new Date(gpsCapturedAt).toLocaleString()}
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
                  subtitle="Capture pole condition before teardown"
                  required
                  photo={photoBefore}
                  accentColor={accentColor}
                  onCapture={() =>
                    openCamera(setPhotoBefore, F.before, "Before")
                  }
                  onView={() =>
                    openViewer("Before", photoBefore, () =>
                      openCamera(setPhotoBefore, F.before, "Before"),
                    )
                  }
                  compact
                />
              </View>

              <View style={styles.photoHalf}>
                <PhotoTile
                  label="After"
                  subtitle="Capture pole after cable removal"
                  required
                  photo={photoAfter}
                  accentColor={accentColor}
                  onCapture={() => openCamera(setPhotoAfter, F.after, "After")}
                  onView={() =>
                    openViewer("After", photoAfter, () =>
                      openCamera(setPhotoAfter, F.after, "After"),
                    )
                  }
                  compact
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <PhotoTile
                label="Pole Tag"
                subtitle="Capture visible pole identification tag"
                required
                photo={photoTag}
                accentColor={accentColor}
                onCapture={() => openCamera(setPhotoTag, F.tag, "Pole Tag")}
                onView={() =>
                  openViewer("Pole Tag", photoTag, () =>
                    openCamera(setPhotoTag, F.tag, "Pole Tag"),
                  )
                }
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
                <Text style={styles.fieldMeta}>Optional</Text>
              </View>

              <TextInput
                style={styles.textArea}
                placeholder="e.g. Near Jollibee corner, 3rd pole from left..."
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
                backgroundColor: canSelectPair ? accentColor : "#C9CED6",
              },
              pressed && canSelectPair && styles.pressedDown,
            ]}
            onPress={handleNext}
            disabled={!canSelectPair}
          >
            <Text style={styles.submitText}>
              {canSelectPair
                ? "Select Pair  →"
                : "Complete required fields first"}
            </Text>
          </Pressable>
        </View>

        <Modal
          visible={viewerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setViewerOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setViewerOpen(false)}
            />

            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>{viewerLabel}</Text>
                  <Text style={styles.modalSubtitle}>Preview photo</Text>
                </View>

                <Pressable
                  onPress={() => setViewerOpen(false)}
                  style={({ pressed }) => [
                    styles.modalCloseBtn,
                    pressed && styles.pressedDown,
                  ]}
                >
                  <Text style={styles.modalCloseText}>✕</Text>
                </Pressable>
              </View>

              {viewerPhoto ? (
                <ExpoImage
                  source={{ uri: viewerPhoto.uri }}
                  style={styles.modalImage}
                  contentFit="cover"
                  transition={150}
                />
              ) : null}

              <View style={styles.modalFooter}>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalGhostBtn,
                    pressed && styles.pressedDown,
                  ]}
                  onPress={() => setViewerOpen(false)}
                >
                  <Text style={styles.modalGhostBtnText}>Close</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.modalPrimaryBtn,
                    { backgroundColor: accentColor },
                    pressed && styles.pressedDown,
                  ]}
                  onPress={() => {
                    setViewerOpen(false);
                    viewerRetake?.();
                  }}
                >
                  <Text style={styles.modalPrimaryBtnText}>Retake</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Quality Alert Modal */}
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

  gpsIconWrap: {
    width: 56,
    height: 56,
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

  gpsPinRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },

  gpsPinIcon: {
    fontSize: 14,
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
    alignItems: "flex-start",
  },

  photoHalf: {
    flex: 1,
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
  },

  photoTileCompact: {
    padding: 14,
  },

  photoTileTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },

  photoTileTopCompact: {
    marginBottom: 12,
  },

  photoTileIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#F4F6F8",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  photoTileIconWrapCompact: {
    width: 40,
    height: 40,
    borderRadius: 14,
    marginRight: 10,
  },

  photoTileIcon: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
  },

  photoTileIconCompact: {
    fontSize: 16,
  },

  photoTileHeaderText: {
    flex: 1,
    justifyContent: "center",
    minWidth: 0,
    paddingTop: 1,
  },

  photoTileTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
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

  photoRequiredBadge: {
    backgroundColor: "#FFF7E7",
    borderWidth: 1,
    borderColor: "#F5D9A7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  photoRequiredBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#B45309",
  },

  photoTileSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: "#667085",
    fontWeight: "500",
    marginTop: 7,
  },

  photoTileSubtitleCompact: {
    fontSize: 12,
    lineHeight: 17,
    color: "#667085",
    fontWeight: "600",
    marginTop: 6,
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
    height: 190,
    backgroundColor: "#E5E7EB",
  },

  photoThumbCompact: {
    height: 172,
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
    height: 190,
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
    height: 172,
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

  photoEmptySub: {
    fontSize: 11,
    color: "#667085",
    fontWeight: "600",
    letterSpacing: 0.2,
    textAlign: "center",
  },

  photoTileBottom: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },

  photoSavedRow: {
    alignItems: "center",
    marginTop: 8,
  },

  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },

  statusChipSuccess: {
    backgroundColor: "#DDF5E8",
  },

  statusChipMuted: {
    backgroundColor: "#F3F4F6",
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

  statusChipTextMuted: {
    color: "#667085",
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

  requirementsList: {
    backgroundColor: "#FFF7E7",
    borderRadius: 18,
    padding: 14,
    gap: 5,
    borderWidth: 1,
    borderColor: "#F5D9A7",
  },

  reqItem: {
    fontSize: 12,
    color: "#B45309",
    fontWeight: "700",
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(12,16,24,0.62)",
    justifyContent: "center",
    padding: 18,
  },

  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 14,
    overflow: "hidden",
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#161A25",
  },

  modalSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: "#667085",
    fontWeight: "600",
  },

  modalCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },

  modalCloseText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#111827",
  },

  modalImage: {
    width: "100%",
    height: 380,
    borderRadius: 18,
    backgroundColor: "#E5E7EB",
  },

  modalFooter: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },

  modalGhostBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    backgroundColor: "#F3F4F6",
  },

  modalGhostBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#374151",
  },

  modalPrimaryBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
  },

  modalPrimaryBtnText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#FFFFFF",
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

  // Draft recovery banner
  draftBanner: {
    backgroundColor: "#EFF6FF",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  draftBannerText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1D4ED8",
  },

  // Work timer
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

});
