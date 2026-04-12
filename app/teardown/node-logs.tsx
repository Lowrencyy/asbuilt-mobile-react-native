import api from "@/lib/api";
import { cacheGet, cacheSet } from "@/lib/cache";
import { getPHTToday } from "@/lib/display-time";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Stack,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

type TeardownLog = {
  id: number;
  created_at: string;
  status: string;
  team?: string;
  collected_cable?: number;
  collected_node?: number;
  collected_amplifier?: number;
  collected_extender?: number;
  collected_tsc?: number;
  collected_powersupply?: number;
  collected_powersupply_housing?: number;
  pole_span?: {
    pole_span_code?: string;
    from_pole?: {
      pole_code: string;
      pole_name?: string;
      map_latitude?: string | null;
      map_longitude?: string | null;
    };
    to_pole?: {
      pole_code: string;
      pole_name?: string;
      map_latitude?: string | null;
      map_longitude?: string | null;
    };
  };
  node?: { id: number; node_id: string };
  project?: { id: number; name?: string };
};

const n2 = (v: unknown) => (v == null || v === "" ? 0 : Number(v) || 0);
const fmtCable = (v: number) =>
  v >= 1000 ? `${(v / 1000).toFixed(2)} km` : `${v} m`;

const STATUS_META: Record<
  string,
  {
    label: string;
    color: string;
    bg: string;
    dot: string;
  }
> = {
  submitted: {
    label: "Submitted",
    color: "#1D4ED8",
    bg: "#EEF4FF",
    dot: "#1D4ED8",
  },
  done: {
    label: "Done",
    color: "#067647",
    bg: "#ECFDF3",
    dot: "#10B981",
  },
  approved: {
    label: "Approved",
    color: "#067647",
    bg: "#ECFDF3",
    dot: "#10B981",
  },
  rejected: {
    label: "Rejected",
    color: "#B42318",
    bg: "#FEF3F2",
    dot: "#DC2626",
  },
  pending: {
    label: "Pending",
    color: "#B54708",
    bg: "#FFF7E8",
    dot: "#F59E0B",
  },
  draft: {
    label: "Draft",
    color: "#667085",
    bg: "#F2F4F7",
    dot: "#98A2B3",
  },
};

const SUB_STATUS_META: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  draft: { label: "Draft", color: "#667085", bg: "#F2F4F7" },
  submitted_to_pm: {
    label: "Submitted to PM",
    color: "#1D4ED8",
    bg: "#EEF4FF",
  },
  pm_approved: {
    label: "PM Approved",
    color: "#067647",
    bg: "#ECFDF3",
  },
  telcovantage_approved: {
    label: "Approved",
    color: "#067647",
    bg: "#ECFDF3",
  },
  pm_for_rework: {
    label: "For Rework",
    color: "#B42318",
    bg: "#FEF3F2",
  },
};

function shortPole(code?: string | null) {
  if (!code) return "—";
  return code.replace(/^[A-Z0-9]+-/, "");
}

function SummaryCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}) {
  return (
    <View style={styles.summaryCard}>
      <View style={[styles.summaryIconWrap, { backgroundColor: `${color}14` }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={[styles.summaryValue, { color }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.summaryLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function ComponentTotalCard({
  label,
  value,
  color,
  bg,
  icon,
}: {
  label: string;
  value: string | number;
  color: string;
  bg: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}) {
  return (
    <View style={[styles.componentMiniCard, { backgroundColor: bg }]}>
      <View style={styles.componentMiniTop}>
        <MaterialCommunityIcons name={icon} size={16} color={color} />
        <Text style={styles.componentMiniLabel}>{label}</Text>
      </View>
      <Text style={[styles.componentMiniValue, { color }]}>{value}</Text>
    </View>
  );
}

function StatChip({
  label,
  value,
  color,
  bg,
}: {
  label: string;
  value: string | number;
  color: string;
  bg: string;
}) {
  return (
    <View style={[styles.statChip, { backgroundColor: bg }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function buildOverviewMapHtml(
  segments: Array<{
    fromLat: number;
    fromLng: number;
    fromCode: string;
    toLat: number;
    toLng: number;
    toCode: string;
  }>,
  accentColor: string,
) {
  const allPoints = segments.flatMap((s) => [
    [s.fromLat, s.fromLng],
    [s.toLat, s.toLng],
  ]);

  const pointsJson = JSON.stringify(segments);
  const boundsJson = JSON.stringify(allPoints);

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html,body,#map{
  width:100%;
  height:100%;
  background:#0f172a;
  font-family:-apple-system,BlinkMacSystemFont,sans-serif;
  overflow:hidden;
}
.leaflet-control-zoom{display:none;}
.leaflet-div-icon{background:none!important;border:none!important;}
.pin{
  display:flex;
  flex-direction:column;
  align-items:center;
}
.pin-dot{
  width:10px;
  height:10px;
  border-radius:50%;
  border:2px solid #fff;
  box-shadow:0 2px 8px rgba(0,0,0,.35);
}
.pin-label{
  margin-top:4px;
  background:rgba(15,23,42,.84);
  color:#fff;
  font-size:9px;
  font-weight:800;
  padding:3px 7px;
  border-radius:999px;
  white-space:nowrap;
}
.legend{
  position:absolute;
  left:10px;
  bottom:10px;
  z-index:9999;
  background:rgba(15,23,42,.82);
  color:#fff;
  font-size:10px;
  font-weight:800;
  padding:6px 9px;
  border-radius:999px;
}
</style>
</head>
<body>
<div id="map"></div>
<div class="legend">Report area</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var segments = ${pointsJson};
var allBounds = ${boundsJson};

var map = L.map('map', {
  zoomControl:false,
  attributionControl:false,
  dragging:false,
  doubleClickZoom:false,
  boxZoom:false,
  keyboard:false,
  scrollWheelZoom:false,
  tap:false,
  touchZoom:false
});

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  subdomains:'abcd',
  maxZoom:20
}).addTo(map);

segments.forEach(function(seg){
  var fromIcon=L.divIcon({
    className:'',
    html:'<div class="pin"><div class="pin-dot" style="background:${accentColor}"></div><div class="pin-label">'+seg.fromCode+'</div></div>',
    iconAnchor:[5,5]
  });

  var toIcon=L.divIcon({
    className:'',
    html:'<div class="pin"><div class="pin-dot" style="background:#6366F1"></div><div class="pin-label">'+seg.toCode+'</div></div>',
    iconAnchor:[5,5]
  });

  L.marker([seg.fromLat, seg.fromLng], {icon: fromIcon}).addTo(map);
  L.marker([seg.toLat, seg.toLng], {icon: toIcon}).addTo(map);

  L.polyline([[seg.fromLat, seg.fromLng],[seg.toLat, seg.toLng]], {
    color:'${accentColor}',
    weight:4,
    opacity:0.78,
    dashArray:'6,4'
  }).addTo(map);
});

var bounds = L.latLngBounds(allBounds);
map.fitBounds(bounds, {padding:[26,26], maxZoom:15});

L.rectangle(bounds.pad(0.08), {
  color:'${accentColor}',
  weight:2,
  opacity:0.8,
  fillColor:'${accentColor}',
  fillOpacity:0.04,
  dashArray:'7,5'
}).addTo(map);

setTimeout(function(){ map.invalidateSize(); }, 120);
</script>
</body>
</html>`;
}

function PoleRoute({
  from,
  to,
  accent,
  cable,
}: {
  from?: string | null;
  to?: string | null;
  accent: string;
  cable: string;
}) {
  return (
    <View style={styles.routeWrap}>
      <View
        style={[
          styles.routeCableBadge,
          { backgroundColor: `${accent}12`, borderColor: `${accent}22` },
        ]}
      >
        <Ionicons name="git-network-outline" size={13} color={accent} />
        <Text style={[styles.routeCableText, { color: accent }]}>{cable}</Text>
      </View>

      <View style={styles.miniRoute}>
        <View style={styles.miniRoutePole}>
          <View style={[styles.miniRouteDot, { backgroundColor: accent }]} />
          <Text style={styles.miniRouteCode} numberOfLines={1}>
            {from || "1"}
          </Text>
        </View>

        <View style={styles.miniRouteCenter}>
          <View
            style={[styles.miniRouteLine, { borderColor: `${accent}55` }]}
          />
          <MaterialCommunityIcons
            name="transmission-tower"
            size={15}
            color={accent}
          />
          <View
            style={[styles.miniRouteLine, { borderColor: `${accent}55` }]}
          />
        </View>

        <View style={styles.miniRoutePole}>
          <View style={[styles.miniRouteDot, { backgroundColor: "#6366F1" }]} />
          <Text style={styles.miniRouteCode} numberOfLines={1}>
            {to || "2"}
          </Text>
        </View>
      </View>
    </View>
  );
}

function LogCard({
  log,
  accent,
  delay,
  nodeId,
  nodeName,
  projectName,
}: {
  log: TeardownLog;
  accent: string;
  delay: number;
  nodeId: string;
  nodeName?: string;
  projectName?: string;
}) {
  const sm = STATUS_META[log.status] ?? STATUS_META.submitted;
  const from = log.pole_span?.from_pole?.pole_code ?? null;
  const to = log.pole_span?.to_pole?.pole_code ?? null;

  const cable = n2(log.collected_cable);
  const node = n2(log.collected_node);
  const amp = n2(log.collected_amplifier);
  const ext = n2(log.collected_extender);
  const tsc = n2(log.collected_tsc);
  const ps = n2(log.collected_powersupply);

  const date = new Date(log.created_at).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()}>
      <TouchableOpacity
        activeOpacity={0.92}
        style={styles.logCard}
        onPress={() =>
          router.push({
            pathname: "/teardown/log-detail",
            params: {
              id: String(log.id),
              node_id: nodeId,
              node_name: nodeName ?? "",
              project_name: projectName ?? "",
              accent,
            },
          } as any)
        }
      >
        <View
          style={[styles.logCardGlow, { backgroundColor: `${accent}10` }]}
        />
        <View style={[styles.logAccentBar, { backgroundColor: accent }]} />

        <View style={styles.logBodyFull}>
          <View style={styles.logTop}>
            <View style={styles.logTypePill}>
              <Text style={styles.logTypePillText}>Teardown Log</Text>
            </View>

            <View style={[styles.statusBadge, { backgroundColor: sm.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: sm.dot }]} />
              <Text style={[styles.statusText, { color: sm.color }]}>
                {sm.label}
              </Text>
            </View>
          </View>

          <View style={styles.logMiddleCompact}>
            <View style={styles.logPoleNamesWrapCompact}>
              <Text style={styles.logPoleNameTextCompact} numberOfLines={1}>
                {from || "RARAR-1"}
              </Text>
              <Text style={styles.logPoleNameArrowCompact}>→</Text>
              <Text style={styles.logPoleNameTextCompact} numberOfLines={1}>
                {to || "RARAR-2"}
              </Text>
            </View>

            <Text style={styles.logDateCentered}>{date}</Text>
          </View>

          <PoleRoute
            from={shortPole(from)}
            to={shortPole(to)}
            accent={accent}
            cable={fmtCable(cable)}
          />

          <View style={styles.statsWrap}>
            {node > 0 ? (
              <StatChip
                label="Node"
                value={node}
                color="#1D4ED8"
                bg="#EEF4FF"
              />
            ) : null}
            {amp > 0 ? (
              <StatChip label="Amp" value={amp} color="#10B981" bg="#ECFDF3" />
            ) : null}
            {ext > 0 ? (
              <StatChip label="Ext" value={ext} color="#7C3AED" bg="#F5F3FF" />
            ) : null}
            {tsc > 0 ? (
              <StatChip label="TSC" value={tsc} color="#F59E0B" bg="#FFF7E8" />
            ) : null}
            {ps > 0 ? (
              <StatChip label="PS" value={ps} color="#DB2777" bg="#FDF2F8" />
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function SubmitToPMModal({
  visible,
  onClose,
  onConfirm,
  loading,
  accentColor,
  nodeId,
  submittedCount,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  accentColor: string;
  nodeId: string;
  submittedCount: number;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View
            style={[
              styles.modalIconWrap,
              { backgroundColor: `${accentColor}14` },
            ]}
          >
            <Ionicons
              name="paper-plane-outline"
              size={24}
              color={accentColor}
            />
          </View>

          <Text style={styles.modalTitle}>Submit to PM</Text>
          <Text style={styles.modalBody}>
            Submit{" "}
            <Text style={styles.modalBodyStrong}>
              {submittedCount} teardown log{submittedCount !== 1 ? "s" : ""}
            </Text>{" "}
            from node <Text style={styles.modalBodyStrong}>{nodeId}</Text> for
            PM review?
          </Text>

          <View style={styles.modalInfoBox}>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color="#667085"
            />
            <Text style={styles.modalInfoText}>
              After submission, this node will be marked as awaiting PM review.
            </Text>
          </View>

          <View style={styles.modalActions}>
            <Pressable style={styles.modalCancelBtn} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={[styles.modalConfirmBtn, { backgroundColor: accentColor }]}
              onPress={onConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.modalConfirmText}>Submit</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function NodeLogsScreen() {
  const { node_id, node_name, city, province, project_name, accent } =
    useLocalSearchParams<{
      node_id: string;
      node_name: string;
      city: string;
      province: string;
      project_name: string;
      accent: string;
    }>();

  const accentColor = accent || "#0B7A5A";
  const CACHE_KEY = `node_logs_${node_id}`;

  const [logs, setLogs] = useState<TeardownLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [subStatus, setSubStatus] = useState<string | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  async function load() {
    setError(null);

    const cached = await cacheGet<TeardownLog[]>(CACHE_KEY);
    if (cached?.length) {
      setLogs(cached);
      setLoading(false);
    }

    try {
      const { data } = await api.get(
        `/teardown-logs?per_page=500&node_code=${encodeURIComponent(node_id)}`,
      );
      const all: TeardownLog[] = data.data ?? data ?? [];
      // Backend already filters by node_code — only re-filter client-side if node info is present
      const filtered = all.filter(
        (l) => !l.node || String(l.node.node_id).trim() === String(node_id).trim(),
      );
      // Use all results if filter wipes everything (backend already scoped the query)
      const finalLogs = filtered.length > 0 ? filtered : all;

      cacheSet(CACHE_KEY, finalLogs);
      setLogs(finalLogs);
      checkSubmission(finalLogs);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Network error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function checkSubmission(currentLogs: TeardownLog[]) {
    const nodeDbId = currentLogs[0]?.node?.id;
    if (!nodeDbId) return;

    try {
      const { data } = await api.get(
        `/teardown-submissions?node_id=${nodeDbId}`,
      );
      const subs: any[] = data.data ?? data ?? [];
      if (subs.length > 0) {
        setSubStatus(subs[0].status ?? "draft");
      }
    } catch {}
  }

  function handleSubmitToPM() {
    const nodeDbId = logs[0]?.node?.id;
    const projectId = logs[0]?.project?.id;

    if (!nodeDbId || !projectId) {
      setError("Cannot determine node or project. Please reload.");
      return;
    }

    const submittedLogs = logs.filter((l) => l.status === "submitted");
    if (submittedLogs.length === 0) {
      setError("All teardown logs are already approved or pending.");
      return;
    }

    if (
      subStatus === "submitted_to_pm" ||
      subStatus === "pm_approved" ||
      subStatus === "telcovantage_approved"
    ) {
      return;
    }

    setShowSubmitModal(true);
  }

  async function doSubmit() {
    const nodeDbId = logs[0]?.node?.id;
    const projectId = logs[0]?.project?.id;

    if (!nodeDbId || !projectId) return;

    setSubmitting(true);

    try {
      const today = getPHTToday();

      const { data: fill } = await api.get(
        `/teardown-submissions/autofill?node_id=${nodeDbId}&date=${today}`,
      );

      const { data: sub } = await api.post("/teardown-submissions", {
        node_id: nodeDbId,
        project_id: projectId,
        report_date: today,
        total_cable: fill.total_cable ?? 0,
        total_strand_length: fill.total_strand_length ?? 0,
        total_node: fill.total_node ?? 0,
        total_amplifier: fill.total_amplifier ?? 0,
        total_extender: fill.total_extender ?? 0,
        total_tsc: fill.total_tsc ?? 0,
        total_powersupply: fill.total_powersupply ?? 0,
        total_powersupply_housing: fill.total_powersupply_housing ?? 0,
      });

      await api.post(`/teardown-submissions/${sub.id}/submit`, {});
      setSubStatus("submitted_to_pm");
      setShowSubmitModal(false);
      // Clear cache so next load fetches fresh statuses from backend
      cacheSet(CACHE_KEY, null).catch(() => {});
      // Reload logs so individual log statuses reflect backend state
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  const totalCable = useMemo(
    () => logs.reduce((s, l) => s + n2(l.collected_cable), 0),
    [logs],
  );

  const totalNode = useMemo(
    () => logs.reduce((s, l) => s + n2(l.collected_node), 0),
    [logs],
  );

  const totalAmp = useMemo(
    () => logs.reduce((s, l) => s + n2(l.collected_amplifier), 0),
    [logs],
  );

  const totalExt = useMemo(
    () => logs.reduce((s, l) => s + n2(l.collected_extender), 0),
    [logs],
  );

  const totalTsc = useMemo(
    () => logs.reduce((s, l) => s + n2(l.collected_tsc), 0),
    [logs],
  );

  const approved = useMemo(
    () =>
      logs.filter((l) => l.status === "approved" || l.status === "done").length,
    [logs],
  );

  const submitted = useMemo(
    () => logs.filter((l) => l.status === "submitted").length,
    [logs],
  );

  const pct = logs.length > 0 ? Math.round((approved / logs.length) * 100) : 0;

  const canSubmit =
    submitted > 0 &&
    subStatus !== "submitted_to_pm" &&
    subStatus !== "pm_approved" &&
    subStatus !== "telcovantage_approved";

  const subMeta = subStatus ? (SUB_STATUS_META[subStatus] ?? null) : null;

  const mapSegments = useMemo(() => {
    return logs
      .map((log) => {
        const fromLat = Number(log.pole_span?.from_pole?.map_latitude);
        const fromLng = Number(log.pole_span?.from_pole?.map_longitude);
        const toLat = Number(log.pole_span?.to_pole?.map_latitude);
        const toLng = Number(log.pole_span?.to_pole?.map_longitude);

        if (
          !Number.isFinite(fromLat) ||
          !Number.isFinite(fromLng) ||
          !Number.isFinite(toLat) ||
          !Number.isFinite(toLng)
        ) {
          return null;
        }

        return {
          fromLat,
          fromLng,
          fromCode: shortPole(log.pole_span?.from_pole?.pole_code),
          toLat,
          toLng,
          toCode: shortPole(log.pole_span?.to_pole?.pole_code),
        };
      })
      .filter(Boolean) as Array<{
      fromLat: number;
      fromLng: number;
      fromCode: string;
      toLat: number;
      toLng: number;
      toCode: string;
    }>;
  }, [logs]);

  const overviewMapHtml = useMemo(() => {
    if (mapSegments.length === 0) return null;
    return buildOverviewMapHtml(mapSegments, accentColor);
  }, [mapSegments, accentColor]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#F3F5F7" />

      <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
        <View style={styles.floatingHeader}>
          <Pressable onPress={() => router.back()} style={styles.headerBackBtn}>
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Node Logs</Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {node_id}
              {node_name ? ` • ${node_name}` : ""}
            </Text>
          </View>

          {subMeta ? (
            <View
              style={[styles.headerStatusPill, { backgroundColor: subMeta.bg }]}
            >
              <Text
                style={[styles.headerStatusPillText, { color: subMeta.color }]}
              >
                {subMeta.label}
              </Text>
            </View>
          ) : (
            <View style={styles.headerGhostSpace} />
          )}
        </View>

        <FlatList
          data={logs}
          keyExtractor={(item) => String(item.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={accentColor}
            />
          }
          ListHeaderComponent={
            <>
              <Animated.View
                entering={FadeInUp.duration(350)}
                style={styles.heroWrap}
              >
                <View style={styles.heroCard}>
                  <View style={styles.heroGlowTop} />
                  <View style={styles.heroGlowBottom} />

                  <View style={styles.heroTopRow}>
                    <View style={styles.heroInfoCol}>
                      <Text style={styles.heroKicker}>Teardown Progress</Text>
                      <Text style={styles.heroNode}>{node_id}</Text>

                      {node_name ? (
                        <Text style={styles.heroName}>{node_name}</Text>
                      ) : null}

                      {city ? (
                        <Text style={styles.heroMeta}>
                          {city}
                          {province ? `, ${province}` : ""}
                        </Text>
                      ) : null}

                      <Text style={styles.heroProject}>{project_name}</Text>
                    </View>

                    <View style={styles.heroMapShell}>
                      {overviewMapHtml ? (
                        <WebView
                          source={{
                            html: overviewMapHtml,
                            baseUrl: "https://local.telcovantage/",
                          }}
                          style={styles.heroMap}
                          originWhitelist={["*"]}
                          javaScriptEnabled
                          domStorageEnabled
                          mixedContentMode="always"
                          scrollEnabled={false}
                          bounces={false}
                        />
                      ) : (
                        <View style={styles.heroMapFallback}>
                          <Ionicons
                            name="map-outline"
                            size={20}
                            color="#D0D5DD"
                          />
                          <Text style={styles.heroMapFallbackText}>
                            No map data
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.heroProgressBlock}>
                    <View style={styles.heroProgressHeader}>
                      <Text style={styles.heroProgressValue}>
                        {pct}% approved
                      </Text>
                      <Text style={styles.heroProgressCount}>
                        {approved}/{logs.length || 0} completed
                      </Text>
                    </View>

                    <View style={styles.heroProgressTrack}>
                      <View
                        style={[
                          styles.heroProgressFill,
                          { width: `${pct}%`, backgroundColor: "#CFF6E8" },
                        ]}
                      />
                    </View>
                  </View>

                  <View style={styles.heroFooterRow}>
                    <View style={styles.heroBottomPillLeft}>
                      <Ionicons
                        name="albums-outline"
                        size={14}
                        color="rgba(255,255,255,0.92)"
                      />
                      <Text style={styles.heroInfoPillText}>
                        {logs.length} logs
                      </Text>
                    </View>

                    <View style={styles.heroBottomPillRight}>
                      <Ionicons
                        name="paper-plane-outline"
                        size={14}
                        color="rgba(255,255,255,0.92)"
                      />
                      <Text style={styles.heroInfoPillText}>
                        {submitted} pending submit
                      </Text>
                    </View>
                  </View>
                </View>
              </Animated.View>

              <View style={styles.summaryRow}>
                <SummaryCard
                  label="Logs"
                  value={logs.length}
                  icon="albums-outline"
                  color="#111827"
                />
                <SummaryCard
                  label="Approved"
                  value={approved}
                  icon="checkmark-circle-outline"
                  color="#067647"
                />
                <SummaryCard
                  label="Submitted"
                  value={submitted}
                  icon="paper-plane-outline"
                  color="#1D4ED8"
                />
                <SummaryCard
                  label="Cable"
                  value={
                    totalCable >= 1000
                      ? `${(totalCable / 1000).toFixed(1)}km`
                      : `${totalCable}m`
                  }
                  icon="git-network-outline"
                  color={accentColor}
                />
              </View>

              {!loading && !error && logs.length > 0 ? (
                <>
                  <View style={styles.componentsCard}>
                    <View style={styles.componentsCardHeader}>
                      <Text style={styles.componentsCardTitle}>
                        Collected Components
                      </Text>
                      <Text style={styles.componentsCardSub}>
                        Total sum from all reports
                      </Text>
                    </View>

                    <View style={styles.componentsRow}>
                      <ComponentTotalCard
                        label="Node"
                        value={totalNode}
                        color="#1D4ED8"
                        bg="#EEF4FF"
                        icon="router-network"
                      />
                      <ComponentTotalCard
                        label="Amplifier"
                        value={totalAmp}
                        color="#10B981"
                        bg="#ECFDF3"
                        icon="signal-distance-variant"
                      />
                      <ComponentTotalCard
                        label="Extender"
                        value={totalExt}
                        color="#7C3AED"
                        bg="#F5F3FF"
                        icon="access-point-plus"
                      />
                      <ComponentTotalCard
                        label="TSC"
                        value={totalTsc}
                        color="#F59E0B"
                        bg="#FFF7E8"
                        icon="memory"
                      />
                    </View>
                  </View>

                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Submitted Logs</Text>
                    <Text style={styles.sectionSub}>
                      Tap a card to open detailed teardown info
                    </Text>
                  </View>
                </>
              ) : null}

              {loading ? (
                <View style={styles.stateCard}>
                  <View
                    style={[
                      styles.stateOrb,
                      { backgroundColor: `${accentColor}12` },
                    ]}
                  >
                    <ActivityIndicator color={accentColor} />
                  </View>
                  <Text style={styles.stateTitle}>Loading logs</Text>
                  <Text style={styles.stateText}>
                    Pulling teardown records for this node.
                  </Text>
                </View>
              ) : null}

              {!loading && error ? (
                <View style={styles.stateCard}>
                  <View style={styles.stateIconWrap}>
                    <Ionicons
                      name="alert-circle-outline"
                      size={30}
                      color="#B42318"
                    />
                  </View>
                  <Text style={styles.stateTitle}>Failed to load</Text>
                  <Text style={styles.stateText}>{error}</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setLoading(true);
                      load();
                    }}
                    style={[styles.retryBtn, { backgroundColor: accentColor }]}
                  >
                    <Text style={styles.retryBtnText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {!loading && !error && logs.length === 0 ? (
                <View style={styles.stateCard}>
                  <View style={styles.stateIconWrap}>
                    <Ionicons
                      name="document-text-outline"
                      size={30}
                      color="#667085"
                    />
                  </View>
                  <Text style={styles.stateTitle}>No logs yet</Text>
                  <Text style={styles.stateText}>
                    No teardown logs found for this node.
                  </Text>
                </View>
              ) : null}
            </>
          }
          renderItem={({ item, index }) => (
            <LogCard
              log={item}
              accent={accentColor}
              delay={index * 40}
              nodeId={node_id ?? ""}
              nodeName={node_name}
              projectName={project_name}
            />
          )}
          ListFooterComponent={
            !loading && !error && logs.length > 0 ? (
              <View style={styles.footerWrap}>
                <TouchableOpacity
                  activeOpacity={canSubmit ? 0.9 : 1}
                  style={[
                    styles.submitBtn,
                    {
                      backgroundColor: canSubmit ? accentColor : "#DDE3E8",
                    },
                  ]}
                  onPress={canSubmit ? handleSubmitToPM : undefined}
                  disabled={submitting || !canSubmit}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Text
                        style={[
                          styles.submitBtnText,
                          { color: canSubmit ? "#FFFFFF" : "#98A2B3" },
                        ]}
                      >
                        {subStatus === "submitted_to_pm"
                          ? "Submitted to PM"
                          : subStatus === "pm_approved"
                            ? "PM Approved"
                            : subStatus === "telcovantage_approved"
                              ? "Approved"
                              : subStatus === "pm_for_rework"
                                ? "Resubmit to PM"
                                : "Submit to PM"}
                      </Text>

                      {canSubmit ? (
                        <Text style={styles.submitBtnSub}>
                          {submitted} log{submitted !== 1 ? "s" : ""} ready for
                          review
                        </Text>
                      ) : null}
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ height: 30 }} />
            )
          }
        />

        <SubmitToPMModal
          visible={showSubmitModal}
          onClose={() => setShowSubmitModal(false)}
          onConfirm={doSubmit}
          loading={submitting}
          accentColor={accentColor}
          nodeId={node_id}
          submittedCount={submitted}
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F3F5F7",
  },

  floatingHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
    backgroundColor: "#F3F5F7",
    zIndex: 10,
  },

  headerBackBtn: {
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

  headerCenter: {
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

  headerStatusPill: {
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  headerStatusPillText: {
    fontSize: 11,
    fontWeight: "800",
  },

  headerGhostSpace: {
    width: 34,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },

  heroWrap: {
    marginTop: 2,
    marginBottom: 16,
  },

  heroCard: {
    borderRadius: 30,
    padding: 20,
    backgroundColor: "#0E231C",
    overflow: "hidden",
  },

  heroGlowTop: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    top: -42,
    right: -24,
  },

  heroGlowBottom: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.04)",
    bottom: -18,
    left: -14,
  },

  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
  },

  heroInfoCol: {
    flex: 1,
    paddingRight: 6,
  },

  heroKicker: {
    fontSize: 11,
    fontWeight: "800",
    color: "rgba(255,255,255,0.68)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },

  heroNode: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.6,
  },

  heroName: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: "700",
    color: "rgba(255,255,255,0.92)",
  },

  heroMeta: {
    marginTop: 4,
    fontSize: 12,
    color: "rgba(255,255,255,0.72)",
  },

  heroProject: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "800",
    color: "rgba(255,255,255,0.64)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  heroMapShell: {
    width: 124,
    height: 124,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  heroMap: {
    flex: 1,
    backgroundColor: "#0F172A",
  },

  heroMapFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },

  heroMapFallbackText: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: "800",
    color: "rgba(255,255,255,0.72)",
    textAlign: "center",
  },

  heroProgressBlock: {
    marginTop: 18,
  },

  heroProgressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 10,
  },

  heroProgressValue: {
    fontSize: 16,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  heroProgressCount: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.72)",
  },

  heroProgressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    overflow: "hidden",
  },

  heroProgressFill: {
    height: "100%",
    borderRadius: 999,
  },

  heroFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 16,
  },

  heroBottomPillLeft: {
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  heroBottomPillRight: {
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginLeft: "auto",
  },

  heroInfoPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  summaryRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },

  summaryCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#E9EDF2",
    shadowColor: "#101828",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
    alignItems: "center",
  },

  summaryIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },

  summaryValue: {
    fontSize: 16,
    fontWeight: "900",
  },

  summaryLabel: {
    marginTop: 4,
    fontSize: 10,
    color: "#98A2B3",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },

  componentsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E9EDF2",
    padding: 16,
    marginBottom: 16,
    shadowColor: "#101828",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },

  componentsCardHeader: {
    marginBottom: 12,
  },

  componentsCardTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
  },

  componentsCardSub: {
    marginTop: 3,
    fontSize: 12,
    color: "#667085",
    fontWeight: "600",
  },

  componentsRow: {
    flexDirection: "row",
    gap: 8,
  },

  componentMiniCard: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },

  componentMiniTop: {
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },

  componentMiniLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#667085",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    textAlign: "center",
  },

  componentMiniValue: {
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },

  sectionHeader: {
    marginBottom: 8,
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

  stateCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E9EDF2",
    padding: 28,
    alignItems: "center",
    marginBottom: 8,
  },

  stateOrb: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  stateIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  stateTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },

  stateText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: "#98A2B3",
    textAlign: "center",
  },

  retryBtn: {
    marginTop: 14,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 11,
  },

  retryBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 13,
  },

  logCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E7ECEF",
    shadowColor: "#0B1F19",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    marginBottom: 14,
    position: "relative",
  },

  logCardGlow: {
    position: "absolute",
    right: -26,
    top: -16,
    width: 118,
    height: 118,
    borderRadius: 999,
  },

  logAccentBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
  },

  logBodyFull: {
    paddingTop: 18,
    paddingBottom: 18,
    paddingLeft: 18,
    paddingRight: 18,
  },

  logTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  logTypePill: {
    minHeight: 32,
    borderRadius: 999,
    paddingHorizontal: 14,
    justifyContent: "center",
    backgroundColor: "#ECF4F0",
    borderWidth: 1,
    borderColor: "#D4E5DD",
  },

  logTypePillText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#0B7A5A",
  },

  logMiddleCompact: {
    marginTop: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  logPoleNamesWrapCompact: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 12,
  },

  logPoleNameTextCompact: {
    maxWidth: "40%",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
    color: "#0F172A",
    textAlign: "center",
  },

  logPoleNameArrowCompact: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0F172A",
    marginTop: -2,
  },

  logDateCentered: {
    marginTop: 12,
    fontSize: 12,
    color: "#98A2B3",
    fontWeight: "700",
    textAlign: "center",
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    alignSelf: "flex-start",
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },

  statusText: {
    fontSize: 11,
    fontWeight: "800",
  },

  routeWrap: {
    marginTop: 18,
    marginBottom: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  routeCableBadge: {
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 18,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  routeCableText: {
    fontSize: 14,
    fontWeight: "900",
  },

  miniRoute: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 34,
  },

  miniRoutePole: {
    width: 56,
    alignItems: "center",
    justifyContent: "center",
  },

  miniRouteDot: {
    width: 12,
    height: 12,
    borderRadius: 12,
    marginBottom: 10,
  },

  miniRouteCode: {
    fontSize: 13,
    fontWeight: "900",
    color: "#667085",
    textAlign: "center",
    minHeight: 16,
  },

  miniRouteCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingTop: 6,
  },

  miniRouteLine: {
    flex: 1,
    borderTopWidth: 2.5,
    borderStyle: "dashed",
  },

  statsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },

  statChip: {
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 8,
    minWidth: 64,
    alignItems: "center",
  },

  statValue: {
    fontSize: 12,
    fontWeight: "900",
  },

  statLabel: {
    marginTop: 2,
    fontSize: 9,
    color: "#98A2B3",
    fontWeight: "700",
    textTransform: "uppercase",
  },

  footerWrap: {
    paddingTop: 8,
    paddingBottom: 28,
  },

  submitBtn: {
    borderRadius: 22,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#101828",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },

  submitBtnText: {
    fontSize: 16,
    fontWeight: "900",
  },

  submitBtnSub: {
    marginTop: 4,
    fontSize: 11,
    color: "rgba(255,255,255,0.78)",
    fontWeight: "600",
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.42)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  modalCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: "#E9EDF2",
    shadowColor: "#101828",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },

  modalIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#111827",
  },

  modalBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    color: "#667085",
  },

  modalBodyStrong: {
    color: "#111827",
    fontWeight: "800",
  },

  modalInfoBox: {
    marginTop: 16,
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E7ECF2",
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },

  modalInfoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: "#667085",
    fontWeight: "600",
  },

  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },

  modalCancelBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#F3F5F7",
    alignItems: "center",
    justifyContent: "center",
  },

  modalCancelText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#667085",
  },

  modalConfirmBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  modalConfirmText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#FFFFFF",
  },
});
