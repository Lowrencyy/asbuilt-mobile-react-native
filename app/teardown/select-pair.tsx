import api from "@/lib/api";
import { cacheGet, cacheSet } from "@/lib/cache";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import { Stack, router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

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
  status: string;
  from_pole: {
    id: number;
    pole_code: string;
    pole_name: string | null;
    status: string;
    map_latitude?: string | null;
    map_longitude?: string | null;
  };
  to_pole: {
    id: number;
    pole_code: string;
    pole_name: string | null;
    status: string;
    map_latitude?: string | null;
    map_longitude?: string | null;
  };
  from_pole_latitude?: string | null;
  from_pole_longitude?: string | null;
  to_pole_latitude?: string | null;
  to_pole_longitude?: string | null;
};

function sanitize(s?: string) {
  return (s ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "_");
}

function buildSpanMapHtml(
  fromLat: number,
  fromLng: number,
  fromLabel: string,
  toLat: number,
  toLng: number,
  toLabel: string,
  accent: string,
) {
  const midLat = (fromLat + toLat) / 2;
  const midLng = (fromLng + toLng) / 2;

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html,body,#map{
  width:100%;
  height:100%;
  background:#eef2f7;
  font-family:-apple-system,BlinkMacSystemFont,sans-serif;
}
.leaflet-div-icon{background:none!important;border:none!important;}
.pin{display:flex;flex-direction:column;align-items:center;}
.pin-dot{
  width:14px;
  height:14px;
  border-radius:50%;
  border:2px solid #fff;
  box-shadow:0 2px 8px rgba(0,0,0,0.35);
}
.pin-label{
  margin-top:4px;
  background:rgba(15,23,42,0.88);
  color:#fff;
  font-size:10px;
  font-weight:800;
  padding:4px 8px;
  border-radius:999px;
  white-space:nowrap;
}
.legend{
  position:fixed;
  bottom:14px;
  left:50%;
  transform:translateX(-50%);
  z-index:9999;
  background:rgba(15,23,42,0.88);
  color:#fff;
  font-size:11px;
  font-weight:700;
  padding:8px 12px;
  border-radius:999px;
  box-shadow:0 4px 16px rgba(0,0,0,.22);
}
</style>
</head>
<body>
<div id="map"></div>
<div class="legend">Span vicinity preview</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map=L.map('map',{
  zoomControl:true,
  scrollWheelZoom:true,
  dragging:true,
  doubleClickZoom:true,
  touchZoom:true
}).setView([${midLat},${midLng}],16);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{
  subdomains:'abcd',
  maxZoom:20
}).addTo(map);

var fromIcon=L.divIcon({
  className:'',
  html:'<div class="pin"><div class="pin-dot" style="background:${accent}"></div><div class="pin-label">${fromLabel}</div></div>',
  iconAnchor:[7,7]
});

var toIcon=L.divIcon({
  className:'',
  html:'<div class="pin"><div class="pin-dot" style="background:#6366F1"></div><div class="pin-label">${toLabel}</div></div>',
  iconAnchor:[7,7]
});

L.marker([${fromLat},${fromLng}],{icon:fromIcon}).addTo(map);
L.marker([${toLat},${toLng}],{icon:toIcon}).addTo(map);

L.polyline([[${fromLat},${fromLng}],[${toLat},${toLng}]],{
  color:'${accent}',
  weight:5,
  opacity:0.9,
  dashArray:'8,5'
}).addTo(map);

L.marker([${midLat},${midLng}], {
  icon: L.divIcon({
    className:'',
    html:'<div style="background:#fff;color:#111827;font-size:11px;font-weight:900;padding:4px 10px;border-radius:999px;box-shadow:0 2px 10px rgba(0,0,0,.18);border:1px solid ${accent}44;">${fromLabel} → ${toLabel}</div>',
    iconSize:[120,24],
    iconAnchor:[60,12]
  })
}).addTo(map);

var bounds=L.latLngBounds([[${fromLat},${fromLng}],[${toLat},${toLng}]]);
map.fitBounds(bounds,{padding:[48,48],maxZoom:18});
setTimeout(function(){ map.invalidateSize(); }, 120);
</script>
</body>
</html>`;
}

function getSpanCoords(
  span: Span,
  fallbackFromLat?: string,
  fallbackFromLng?: string,
) {
  const fromLat =
    span.from_pole_latitude ??
    span.from_pole?.map_latitude ??
    fallbackFromLat ??
    null;

  const fromLng =
    span.from_pole_longitude ??
    span.from_pole?.map_longitude ??
    fallbackFromLng ??
    null;

  const toLat = span.to_pole_latitude ?? span.to_pole?.map_latitude ?? null;
  const toLng = span.to_pole_longitude ?? span.to_pole?.map_longitude ?? null;

  const hasCoords = !!(fromLat && fromLng && toLat && toLng);

  return {
    hasCoords,
    fromLat: fromLat ? Number(fromLat) : null,
    fromLng: fromLng ? Number(fromLng) : null,
    toLat: toLat ? Number(toLat) : null,
    toLng: toLng ? Number(toLng) : null,
  };
}

function shortPole(code?: string | null) {
  if (!code) return "—";
  return code.replace(/^[A-Z0-9]+-/, "");
}

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statPillLabel}>{label}</Text>
      <Text style={styles.statPillValue}>{value}</Text>
    </View>
  );
}

function DetailStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <View style={styles.detailStatCard}>
      <Text style={styles.detailStatLabel}>{label}</Text>
      <Text style={styles.detailStatValue}>{value}</Text>
    </View>
  );
}

function RouteMini({
  fromCode,
  toCode,
  accentColor,
}: {
  fromCode: string;
  toCode: string;
  accentColor: string;
}) {
  return (
    <View style={styles.routeMini}>
      <View style={styles.routeMiniPole}>
        <View style={[styles.routeMiniDot, { backgroundColor: accentColor }]} />
        <Text style={styles.routeMiniCode} numberOfLines={1}>
          {fromCode}
        </Text>
      </View>

      <View style={styles.routeMiniCenter}>
        <View
          style={[styles.routeMiniLine, { borderColor: `${accentColor}66` }]}
        />
        <MaterialCommunityIcons
          name="transmission-tower"
          size={14}
          color={accentColor}
        />
        <View
          style={[styles.routeMiniLine, { borderColor: `${accentColor}66` }]}
        />
      </View>

      <View style={styles.routeMiniPole}>
        <View style={[styles.routeMiniDot, { backgroundColor: "#6366F1" }]} />
        <Text style={styles.routeMiniCode} numberOfLines={1}>
          {toCode}
        </Text>
      </View>
    </View>
  );
}

function SpanCard({
  fromCode,
  poleCode,
  poleName,
  spanCode,
  expectedCable,
  lengthMeters,
  runs,
  accentColor,
  index,
  onCardPress,
  onVicinityPress,
}: {
  fromCode: string;
  poleCode: string;
  poleName: string;
  spanCode: string;
  expectedCable: number;
  lengthMeters: number;
  runs: number;
  accentColor: string;
  index: number;
  onCardPress: () => void;
  onVicinityPress: () => void;
}) {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: withSpring(pressed.value ? 0.985 : 1, {
            damping: 18,
            stiffness: 240,
          }),
        },
      ],
      opacity: withTiming(pressed.value ? 0.97 : 1, { duration: 100 }),
    };
  });

  return (
    <Animated.View entering={FadeInDown.delay(index * 70).springify()}>
      <Pressable
        onPress={onCardPress}
        onPressIn={() => {
          pressed.value = 1;
        }}
        onPressOut={() => {
          pressed.value = 0;
        }}
      >
        <Animated.View
          style={[
            styles.spanCard,
            {
              borderColor: `${accentColor}20`,
              shadowColor: accentColor,
            },
            animatedStyle,
          ]}
        >
          <View
            style={[
              styles.spanCardGlowOne,
              { backgroundColor: `${accentColor}12` },
            ]}
          />
          <View
            style={[
              styles.spanCardGlowTwo,
              { backgroundColor: `${accentColor}0D` },
            ]}
          />

          <View style={styles.spanCardTop}>
            <View
              style={[
                styles.destinationPill,
                {
                  backgroundColor: `${accentColor}12`,
                  borderColor: `${accentColor}24`,
                },
              ]}
            >
              <Text
                style={[styles.destinationPillText, { color: accentColor }]}
              >
                Destination Pole
              </Text>
            </View>

            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onVicinityPress();
              }}
              style={({ pressed: btnPressed }) => [
                styles.iconGhostBtn,
                btnPressed && styles.buttonPressed,
              ]}
            >
              <Ionicons name="map-outline" size={17} color={accentColor} />
            </Pressable>
          </View>

          <RouteMini
            fromCode={shortPole(fromCode)}
            toCode={shortPole(poleCode)}
            accentColor={accentColor}
          />

          <Text
            style={[styles.spanPoleCode, { color: accentColor }]}
            numberOfLines={1}
          >
            {poleCode}
          </Text>

          <Text style={styles.spanPoleName} numberOfLines={1}>
            {poleName || poleCode}
          </Text>

          <Text style={styles.spanCodeText} numberOfLines={1}>
            {spanCode || "No span code"}
          </Text>

          <View style={styles.spanStatsRow}>
            <StatPill label="Cable" value={`${expectedCable}m`} />
            <StatPill label="Length" value={`${lengthMeters}m`} />
            <StatPill label="Runs" value={runs} />
          </View>

          <View style={styles.bottomActions}>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onVicinityPress();
              }}
              style={({ pressed: btnPressed }) => [
                styles.secondaryAction,
                {
                  backgroundColor: `${accentColor}10`,
                  borderColor: `${accentColor}24`,
                },
                btnPressed && styles.buttonPressed,
              ]}
            >
              <Ionicons
                name="navigate-circle-outline"
                size={16}
                color={accentColor}
              />
              <Text
                style={[styles.secondaryActionText, { color: accentColor }]}
              >
                View Vicinity
              </Text>
            </Pressable>

            <View
              style={[
                styles.primaryHint,
                {
                  backgroundColor: `${accentColor}0E`,
                  borderColor: `${accentColor}20`,
                },
              ]}
            >
              <Text style={[styles.primaryHintText, { color: accentColor }]}>
                Tap card to continue
              </Text>
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export default function SelectPairScreen() {
  const {
    pole_id,
    pole_code,
    pole_name,
    node_id,
    project_id,
    project_name,
    accent,
    from_pole_latitude,
    from_pole_longitude,
    from_pole_gps_captured_at,
  } = useLocalSearchParams<{
    pole_id: string;
    pole_code: string;
    pole_name: string;
    node_id: string;
    project_id: string;
    project_name: string;
    accent: string;
    from_pole_latitude: string;
    from_pole_longitude: string;
    from_pole_gps_captured_at: string;
  }>();

  const accentColor = accent || "#0B7A5A";

  const [spans, setSpans] = useState<Span[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error" | "empty">(
    "loading",
  );
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null);
  const [showVicinityModal, setShowVicinityModal] = useState(false);

  useEffect(() => {
    if (!pole_code || !node_id) return;

    (async () => {
      const projFolder = sanitize(project_name);
      const poleSanitized = sanitize(pole_code);
      const srcDir = `${FileSystem.documentDirectory}pole_drafts/${projFolder}/${node_id}/${pole_id}/`;
      const destDir = `${FileSystem.documentDirectory}teardown_drafts/${projFolder}/${node_id}/${pole_id}/`;

      await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });

      const srcFiles = [
        {
          src: `pole_${pole_id}_before.jpg`,
          dest: `${poleSanitized}_before.jpg`,
        },
        {
          src: `pole_${pole_id}_after.jpg`,
          dest: `${poleSanitized}_after.jpg`,
        },
        {
          src: `pole_${pole_id}_poletag.jpg`,
          dest: `${poleSanitized}_poletag.jpg`,
        },
      ];

      let beforeCopied = false;

      for (const f of srcFiles) {
        const srcPath = srcDir + f.src;
        const destPath = destDir + f.dest;
        const info = await FileSystem.getInfoAsync(srcPath);

        if (info.exists) {
          const destInfo = await FileSystem.getInfoAsync(destPath);
          if (!destInfo.exists) {
            await FileSystem.copyAsync({ from: srcPath, to: destPath }).catch(
              () => {},
            );
          }
          if (f.dest.includes("_before")) beforeCopied = true;
        }
      }

      if (!beforeCopied) {
        const destInfo = await FileSystem.getInfoAsync(
          destDir + `${poleSanitized}_before.jpg`,
        );

        if (!destInfo.exists) {
          Alert.alert(
            "Photos not found",
            "Starting pole photos not found. Please go back and retake them.",
            [{ text: "Go Back", onPress: () => router.back() }],
          );
        }
      }
    })();
  }, [pole_code, node_id, project_name, pole_id]);

  useEffect(() => {
    if (!pole_id) return;

    setStatus("loading");
    const CACHE_KEY = `spans_pole_${pole_id}`;

    cacheGet<Span[]>(CACHE_KEY).then((cached) => {
      if (cached?.length) {
        const active = cached.filter((s) => s.status !== "completed");
        if (active.length === 1) {
          navigateToKabila(active[0]);
          return;
        }
        if (active.length > 0) {
          setSpans(active);
          setStatus("ok");
        }
      }
    });

    api
      .get(`/poles/${pole_id}/spans`)
      .then(({ data }) => {
        const list: Span[] = Array.isArray(data) ? data : (data?.data ?? []);
        cacheSet(CACHE_KEY, list);

        const active = list.filter((s) => s.status !== "completed");

        if (active.length === 0) {
          setStatus("empty");
          return;
        }

        if (active.length === 1) {
          navigateToKabila(active[0]);
          return;
        }

        setSpans(active);
        setStatus("ok");
      })
      .catch(() => {
        cacheGet<Span[]>(CACHE_KEY).then((cached) => {
          if (!cached?.length) {
            setStatus("error");
          } else {
            const active = cached.filter((s) => s.status !== "completed");
            if (active.length === 0) setStatus("empty");
            // else: cache handler already set spans + "ok"
          }
        });
      });
  }, [pole_id, pole_code, pole_name]);

  function getDisplayPole(span: Span) {
    const isReversed = span.from_pole && span.to_pole.pole_code === pole_code;
    return isReversed ? span.from_pole : span.to_pole;
  }

  function navigateToKabila(span: Span) {
    const isReversed = span.from_pole && span.to_pole.pole_code === pole_code;

    const actualFromCode = isReversed ? span.from_pole.pole_code : pole_code;
    const actualFromName = isReversed
      ? (span.from_pole.pole_name ?? span.from_pole.pole_code)
      : (pole_name ?? pole_code);

    const actualToId = isReversed
      ? String(span.from_pole.id)
      : String(span.to_pole.id);

    const actualToCode = isReversed
      ? span.from_pole.pole_code
      : span.to_pole.pole_code;

    const actualToName = isReversed
      ? (span.from_pole.pole_name ?? span.from_pole.pole_code)
      : (span.to_pole.pole_name ?? span.to_pole.pole_code);

    router.replace({
      pathname: "/teardown/destination-pole" as any,
      params: {
        pole_code: actualFromCode,
        pole_name: actualFromName,
        node_id,
        project_id,
        project_name,
        accent,
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
        from_pole_latitude: from_pole_latitude ?? "",
        from_pole_longitude: from_pole_longitude ?? "",
        from_pole_gps_captured_at: from_pole_gps_captured_at ?? "",
      },
    });
  }

  function retryFetch() {
    if (!pole_id) return;

    setStatus("loading");
    const CACHE_KEY = `spans_pole_${pole_id}`;

    api
      .get(`/poles/${pole_id}/spans`)
      .then(({ data }) => {
        const list: Span[] = Array.isArray(data) ? data : (data?.data ?? []);
        cacheSet(CACHE_KEY, list);

        const active = list.filter((s) => s.status !== "completed");

        if (active.length === 0) {
          setStatus("empty");
          return;
        }

        if (active.length === 1) {
          navigateToKabila(active[0]);
          return;
        }

        setSpans(active);
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  }

  function openVicinity(span: Span) {
    setSelectedSpan(span);
    setShowVicinityModal(true);
  }

  const selectedDisplayPole = useMemo(() => {
    if (!selectedSpan) return null;
    return getDisplayPole(selectedSpan);
  }, [selectedSpan, pole_code]);

  const spanCoords = useMemo(() => {
    if (!selectedSpan) {
      return {
        hasCoords: false,
        fromLat: null,
        fromLng: null,
        toLat: null,
        toLng: null,
      };
    }

    return getSpanCoords(selectedSpan, from_pole_latitude, from_pole_longitude);
  }, [selectedSpan, from_pole_latitude, from_pole_longitude]);

  const mapHtml = useMemo(() => {
    if (
      !selectedSpan ||
      !spanCoords.hasCoords ||
      spanCoords.fromLat == null ||
      spanCoords.fromLng == null ||
      spanCoords.toLat == null ||
      spanCoords.toLng == null
    ) {
      return null;
    }

    return buildSpanMapHtml(
      spanCoords.fromLat,
      spanCoords.fromLng,
      pole_code || "FROM",
      spanCoords.toLat,
      spanCoords.toLng,
      selectedDisplayPole?.pole_code || "TO",
      accentColor,
    );
  }, [selectedSpan, spanCoords, pole_code, selectedDisplayPole, accentColor]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#F4F6F8" />

      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <View style={styles.floatingHeader}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </Pressable>

          <View style={styles.floatingHeaderText}>
            <Text style={styles.headerTitle}>Select Span</Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {pole_name || pole_code}
            </Text>
          </View>

          <View
            style={[
              styles.headerAccentBadge,
              {
                backgroundColor: `${accentColor}14`,
                borderColor: `${accentColor}28`,
              },
            ]}
          >
            <View
              style={[styles.headerAccentDot, { backgroundColor: accentColor }]}
            />
            <Text style={[styles.headerAccentText, { color: accentColor }]}>
              Ready
            </Text>
          </View>
        </View>

        {status === "loading" && (
          <View style={styles.center}>
            <View
              style={[
                styles.loadingOrb,
                { backgroundColor: `${accentColor}12` },
              ]}
            >
              <ActivityIndicator size="large" color={accentColor} />
            </View>
            <Text style={styles.centerTitle}>Loading available spans</Text>
            <Text style={styles.centerSub}>
              Checking nearby connections for this starting pole.
            </Text>
          </View>
        )}

        {status === "error" && (
          <View style={styles.center}>
            <View style={styles.stateIconWrap}>
              <Ionicons
                name="cloud-offline-outline"
                size={30}
                color="#B42318"
              />
            </View>
            <Text style={styles.centerTitle}>Could not load spans</Text>
            <Text style={styles.centerSub}>
              Check your connection and try again.
            </Text>

            <Pressable
              style={[styles.primaryButton, { backgroundColor: accentColor }]}
              onPress={retryFetch}
            >
              <Text style={styles.primaryButtonText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {status === "empty" && (
          <View style={styles.center}>
            <View style={styles.stateIconWrap}>
              <MaterialCommunityIcons
                name="transmission-tower-off"
                size={30}
                color="#667085"
              />
            </View>
            <Text style={styles.centerTitle}>No spans found</Text>
            <Text style={styles.centerSub}>
              This pole does not have any available connections.
            </Text>

            <Pressable
              style={[styles.primaryButton, { backgroundColor: "#111827" }]}
              onPress={() => router.back()}
            >
              <Text style={styles.primaryButtonText}>Go Back</Text>
            </Pressable>
          </View>
        )}

        {status === "ok" && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
          >
            <Animated.View
              entering={FadeInUp.duration(350)}
              style={styles.heroWrap}
            >
              <View style={styles.heroCard}>
                <View style={styles.heroGlowOne} />
                <View style={styles.heroGlowTwo} />

                <Text style={styles.heroEyebrow}>Span Selection</Text>

                <Text style={styles.heroTitle}>
                  Choose the next pole to continue
                </Text>

                <Text style={styles.heroSub}>
                  Premium rework style na ito: tap the whole card to proceed, or
                  preview the route first using the vicinity action.
                </Text>

                <View style={styles.heroInfoRow}>
                  <View style={styles.heroInfoPill}>
                    <Ionicons
                      name="git-network-outline"
                      size={14}
                      color="#667085"
                    />
                    <Text style={styles.heroInfoPillText}>
                      {spans.length} spans found
                    </Text>
                  </View>

                  <View style={styles.heroInfoPill}>
                    <Ionicons name="radio-outline" size={14} color="#667085" />
                    <Text style={styles.heroInfoPillText}>
                      From {shortPole(pole_code)}
                    </Text>
                  </View>
                </View>
              </View>
            </Animated.View>

            <View style={styles.sectionWrap}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Available Connections</Text>
                <Text style={styles.sectionSub}>
                  Pick your destination pole
                </Text>
              </View>

              <View style={styles.listWrap}>
                {spans.map((item, index) => {
                  const displayPole = getDisplayPole(item);

                  return (
                    <SpanCard
                      key={item.id}
                      fromCode={pole_code || ""}
                      poleCode={displayPole.pole_code}
                      poleName={displayPole.pole_name ?? displayPole.pole_code}
                      spanCode={item.pole_span_code ?? ""}
                      expectedCable={item.expected_cable}
                      lengthMeters={item.length_meters}
                      runs={item.runs}
                      accentColor={accentColor}
                      index={index}
                      onCardPress={() => navigateToKabila(item)}
                      onVicinityPress={() => openVicinity(item)}
                    />
                  );
                })}
              </View>
            </View>
          </ScrollView>
        )}

        <Modal
          visible={showVicinityModal}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowVicinityModal(false)}
        >
          <StatusBar barStyle="dark-content" backgroundColor="#F4F6F8" />

          <View style={styles.modalRoot}>
            <View style={styles.modalHeader}>
              <Pressable
                onPress={() => setShowVicinityModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#111827" />
              </Pressable>

              <View style={styles.modalHeaderText}>
                <Text style={styles.modalTitle}>Vicinity Map</Text>
                <Text style={styles.modalSub} numberOfLines={1}>
                  {selectedSpan?.pole_span_code || "Selected Span"}
                </Text>
              </View>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScroll}
            >
              {mapHtml ? (
                <View style={styles.mapWrap}>
                  <WebView
                    source={{
                      html: mapHtml,
                      baseUrl: "https://local.telcovantage/",
                    }}
                    style={styles.mapView}
                    originWhitelist={["*"]}
                    javaScriptEnabled
                    domStorageEnabled
                    mixedContentMode="always"
                    cacheEnabled={false}
                  />
                </View>
              ) : (
                <View style={styles.noMapCard}>
                  <View style={styles.noMapIconWrap}>
                    <Ionicons name="map-outline" size={26} color="#98A2B3" />
                  </View>
                  <Text style={styles.noMapTitle}>
                    No vicinity map available
                  </Text>
                  <Text style={styles.noMapText}>
                    Missing GPS coordinates for one or both poles of this span.
                  </Text>
                </View>
              )}

              {selectedSpan && selectedDisplayPole ? (
                <>
                  <View style={styles.routePreviewCard}>
                    <Text style={styles.cardTitle}>Span Route</Text>

                    <View style={styles.routeRow}>
                      <View style={styles.routePoleBlock}>
                        <View
                          style={[
                            styles.routePoleDot,
                            { backgroundColor: accentColor },
                          ]}
                        />
                        <Text
                          style={[styles.routePoleCode, { color: accentColor }]}
                        >
                          {pole_code || "FROM"}
                        </Text>
                        <Text style={styles.routePoleName} numberOfLines={2}>
                          {pole_name || pole_code || "Starting Pole"}
                        </Text>
                      </View>

                      <View style={styles.routeCenter}>
                        <View
                          style={[
                            styles.routeLine,
                            { borderColor: `${accentColor}55` },
                          ]}
                        />
                        <View
                          style={[
                            styles.routeDistanceBadge,
                            { backgroundColor: `${accentColor}12` },
                          ]}
                        >
                          <Text
                            style={[
                              styles.routeDistanceText,
                              { color: accentColor },
                            ]}
                          >
                            {selectedSpan.length_meters}m
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.routeLine,
                            { borderColor: `${accentColor}55` },
                          ]}
                        />
                      </View>

                      <View style={styles.routePoleBlock}>
                        <View
                          style={[
                            styles.routePoleDot,
                            { backgroundColor: "#6366F1" },
                          ]}
                        />
                        <Text
                          style={[styles.routePoleCode, { color: "#6366F1" }]}
                        >
                          {selectedDisplayPole.pole_code}
                        </Text>
                        <Text style={styles.routePoleName} numberOfLines={2}>
                          {selectedDisplayPole.pole_name ??
                            selectedDisplayPole.pole_code}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.detailSectionCard}>
                    <View style={styles.detailSectionHeader}>
                      <Text style={styles.cardTitle}>
                        Collectable Components
                      </Text>
                      <Text style={styles.cardSub}>Span summary preview</Text>
                    </View>

                    <View style={styles.detailStatsGrid}>
                      <DetailStat
                        label="Span Length"
                        value={`${selectedSpan.length_meters}m`}
                      />
                      <DetailStat label="Runs" value={selectedSpan.runs} />
                      <DetailStat
                        label="Node"
                        value={selectedSpan.expected_node}
                      />
                      <DetailStat
                        label="Amplifier"
                        value={selectedSpan.expected_amplifier}
                      />
                      <DetailStat
                        label="Extender"
                        value={selectedSpan.expected_extender}
                      />
                      <DetailStat
                        label="TSC"
                        value={selectedSpan.expected_tsc}
                      />
                    </View>
                  </View>

                  <Pressable
                    style={[
                      styles.modalPrimaryBtn,
                      { backgroundColor: accentColor },
                    ]}
                    onPress={() => navigateToKabila(selectedSpan)}
                  >
                    <Text style={styles.modalPrimaryBtnText}>
                      Continue to Destination Pole
                    </Text>
                  </Pressable>
                </>
              ) : null}
            </ScrollView>
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F4F6F8",
  },

  floatingHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
    backgroundColor: "#F4F6F8",
    zIndex: 20,
  },

  backBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7ECF2",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#101828",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },

  floatingHeaderText: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: "#111827",
  },

  headerSub: {
    marginTop: 2,
    fontSize: 12,
    color: "#667085",
    fontWeight: "600",
  },

  headerAccentBadge: {
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 10,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  headerAccentDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },

  headerAccentText: {
    fontSize: 11,
    fontWeight: "800",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  loadingOrb: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  stateIconWrap: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7ECF2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  centerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
    textAlign: "center",
  },

  centerSub: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "#667085",
    textAlign: "center",
  },

  primaryButton: {
    marginTop: 18,
    height: 50,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },

  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 42,
    gap: 16,
  },

  heroWrap: {
    marginTop: 2,
  },

  heroCard: {
    borderRadius: 30,
    padding: 20,
    backgroundColor: "#13211C",
    overflow: "hidden",
  },

  heroGlowOne: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    top: -55,
    right: -10,
  },

  heroGlowTwo: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.04)",
    bottom: -20,
    left: -18,
  },

  heroEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: "rgba(255,255,255,0.72)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
  },

  heroTitle: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "900",
    color: "#FFFFFF",
    maxWidth: "92%",
  },

  heroSub: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: "rgba(255,255,255,0.72)",
    maxWidth: "95%",
  },

  heroInfoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },

  heroInfoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },

  heroInfoPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  sectionWrap: {
    gap: 12,
  },

  sectionHeader: {
    paddingHorizontal: 2,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
  },

  sectionSub: {
    marginTop: 3,
    fontSize: 12,
    color: "#667085",
    fontWeight: "600",
  },

  listWrap: {
    gap: 14,
  },

  spanCard: {
    minHeight: 250,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    borderWidth: 1,
    overflow: "hidden",
    padding: 16,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },

  spanCardGlowOne: {
    position: "absolute",
    right: -35,
    top: -25,
    width: 130,
    height: 130,
    borderRadius: 999,
  },

  spanCardGlowTwo: {
    position: "absolute",
    left: -18,
    bottom: -25,
    width: 90,
    height: 90,
    borderRadius: 999,
  },

  spanCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  destinationPill: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  destinationPillText: {
    fontSize: 11,
    fontWeight: "800",
  },

  iconGhostBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },

  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },

  routeMini: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 14,
  },

  routeMiniPole: {
    flex: 1,
    alignItems: "center",
  },

  routeMiniDot: {
    width: 10,
    height: 10,
    borderRadius: 10,
    marginBottom: 6,
  },

  routeMiniCode: {
    fontSize: 11,
    fontWeight: "800",
    color: "#667085",
    textAlign: "center",
  },

  routeMiniCenter: {
    flex: 1.2,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 6,
  },

  routeMiniLine: {
    flex: 1,
    borderTopWidth: 2,
    borderStyle: "dashed",
  },

  spanPoleCode: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "900",
  },

  spanPoleName: {
    marginTop: 4,
    fontSize: 14,
    color: "#344054",
    fontWeight: "700",
  },

  spanCodeText: {
    marginTop: 6,
    fontSize: 12,
    color: "#98A2B3",
    fontWeight: "700",
  },

  spanStatsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },

  statPill: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    paddingVertical: 11,
    paddingHorizontal: 10,
  },

  statPillLabel: {
    fontSize: 10,
    color: "#98A2B3",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  statPillValue: {
    marginTop: 4,
    fontSize: 14,
    color: "#111827",
    fontWeight: "900",
  },

  bottomActions: {
    marginTop: 16,
    gap: 10,
  },

  secondaryAction: {
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  secondaryActionText: {
    fontSize: 13,
    fontWeight: "900",
  },

  primaryHint: {
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  primaryHintText: {
    fontSize: 12,
    fontWeight: "800",
  },

  modalRoot: {
    flex: 1,
    backgroundColor: "#F4F6F8",
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: "#F4F6F8",
    borderBottomWidth: 1,
    borderBottomColor: "#E9EDF2",
  },

  modalCloseBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E9EDF2",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  modalHeaderText: {
    flex: 1,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
  },

  modalSub: {
    marginTop: 2,
    fontSize: 12,
    color: "#667085",
    fontWeight: "600",
  },

  modalScroll: {
    padding: 16,
    paddingBottom: 36,
    gap: 16,
  },

  mapWrap: {
    height: 320,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  mapView: {
    flex: 1,
    backgroundColor: "#E5E7EB",
  },

  noMapCard: {
    borderRadius: 24,
    padding: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E9EDF2",
    alignItems: "center",
    justifyContent: "center",
  },

  noMapIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F2F4F7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  noMapTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 6,
  },

  noMapText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#667085",
    textAlign: "center",
  },

  routePreviewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#E9EDF2",
    padding: 18,
    shadowColor: "#101828",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 4,
  },

  cardSub: {
    fontSize: 12,
    color: "#667085",
    fontWeight: "600",
  },

  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
  },

  routePoleBlock: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },

  routePoleDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 2,
  },

  routePoleCode: {
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },

  routePoleName: {
    fontSize: 11,
    fontWeight: "600",
    color: "#98A2B3",
    textAlign: "center",
  },

  routeCenter: {
    flex: 1.4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  routeLine: {
    flex: 1,
    borderTopWidth: 2,
    borderStyle: "dashed",
  },

  routeDistanceBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  routeDistanceText: {
    fontSize: 11,
    fontWeight: "800",
  },

  detailSectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#E9EDF2",
    padding: 18,
    shadowColor: "#101828",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },

  detailSectionHeader: {
    marginBottom: 14,
  },

  detailStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },

  detailStatCard: {
    width: "48.5%",
    backgroundColor: "#F8FAFC",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E8EDF3",
    paddingVertical: 14,
    paddingHorizontal: 12,
  },

  detailStatLabel: {
    fontSize: 11,
    color: "#98A2B3",
    fontWeight: "800",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  detailStatValue: {
    fontSize: 20,
    color: "#111827",
    fontWeight: "900",
  },

  modalPrimaryBtn: {
    minHeight: 54,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#101828",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },

  modalPrimaryBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
});
