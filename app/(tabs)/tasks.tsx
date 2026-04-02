import api from "@/lib/api";
import { cacheGet, cacheSet } from "@/lib/cache";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── Types ────────────────────────────────────────────────────────────────────

type TeardownLog = {
  id: number;
  status: string;
  team?: string;
  collected_cable?: number;
  pole_span?: {
    pole_span_code?: string;
    from_pole?: { pole_code: string };
    to_pole?:   { pole_code: string };
  };
  node?: { id: number; node_id: string; node_name?: string; city?: string; province?: string };
  project?: { id: number; name?: string; project_code?: string };
};

type NodeGroup = {
  node_id: string;
  node_db_id: number;
  node_name?: string;
  city?: string;
  province?: string;
  total: number;
  approved: number;
  logs: TeardownLog[];
};

type ProjectGroup = {
  project_id: number;
  project_name: string;
  nodes: NodeGroup[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const n2 = (v: unknown) => (v == null || v === "" ? 0 : Number(v) || 0);

function groupLogs(logs: TeardownLog[]): ProjectGroup[] {
  const projectMap = new Map<number, ProjectGroup>();

  for (const log of logs) {
    const pid    = log.project?.id ?? 0;
    const pname  = log.project?.name ?? log.project?.project_code ?? "Unknown Project";
    const ndbid  = log.node?.id ?? 0;
    const nid    = log.node?.node_id ?? "Unknown Node";
    const nname  = log.node?.node_name;
    const city   = log.node?.city;
    const prov   = log.node?.province;

    if (!projectMap.has(pid)) {
      projectMap.set(pid, { project_id: pid, project_name: pname, nodes: [] });
    }
    const proj = projectMap.get(pid)!;

    let nodeGroup = proj.nodes.find((n) => n.node_id === nid);
    if (!nodeGroup) {
      nodeGroup = { node_id: nid, node_db_id: ndbid, node_name: nname, city, province: prov, total: 0, approved: 0, logs: [] };
      proj.nodes.push(nodeGroup);
    }
    nodeGroup.logs.push(log);
    nodeGroup.total++;
    if (log.status === "approved" || log.status === "done") nodeGroup.approved++;
  }

  return Array.from(projectMap.values());
}

// ─── Node Row ─────────────────────────────────────────────────────────────────

function NodeRow({ node, projectName, accent, delay }: {
  node: NodeGroup;
  projectName: string;
  accent: string;
  delay: number;
}) {
  const pct      = node.total > 0 ? Math.round((node.approved / node.total) * 100) : 0;
  const barColor = pct === 100 ? "#059669" : accent;
  const cable    = node.logs.reduce((s, l) => s + n2(l.collected_cable), 0);

  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()}>
      <TouchableOpacity
        activeOpacity={0.82}
        style={styles.nodeCard}
        onPress={() =>
          router.push({
            pathname: "/teardown/node-logs" as any,
            params: {
              node_id:      node.node_id,
              node_name:    node.node_name ?? "",
              city:         node.city ?? "",
              province:     node.province ?? "",
              project_name: projectName,
              accent,
            },
          })
        }
      >
        {/* Accent bar */}
        <View style={[styles.nodeAccent, { backgroundColor: accent }]} />

        <View style={styles.nodeBody}>
          <View style={styles.nodeTop}>
            <View style={styles.nodeLeft}>
              <Text style={styles.nodeId}>{node.node_id}</Text>
              {node.node_name ? <Text style={styles.nodeName}>{node.node_name}</Text> : null}
              {node.city ? (
                <Text style={styles.nodeCity}>
                  {node.city}{node.province ? `, ${node.province}` : ""}
                </Text>
              ) : null}
            </View>
            <View style={styles.nodeRight}>
              <Text style={[styles.nodePct, { color: barColor }]}>{pct}%</Text>
              <Text style={styles.nodeSpans}>{node.approved}/{node.total} spans</Text>
              {cable > 0 ? <Text style={styles.nodeCable}>{cable.toLocaleString()} m</Text> : null}
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
          </View>
        </View>

        <Text style={styles.nodeArrow}>›</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Project Section ──────────────────────────────────────────────────────────

const PROJECT_ACCENTS = ["#0d47c9", "#0A5C3B", "#7c3aed", "#0e7490", "#b45309", "#be123c"];

function ProjectSection({ group, colorIdx, delay }: {
  group: ProjectGroup;
  colorIdx: number;
  delay: number;
}) {
  const accent     = PROJECT_ACCENTS[colorIdx % PROJECT_ACCENTS.length];
  const totalLogs  = group.nodes.reduce((s, n) => s + n.total, 0);
  const doneLogs   = group.nodes.reduce((s, n) => s + n.approved, 0);

  return (
    <View style={styles.projectSection}>
      <View style={[styles.projectHeader, { borderLeftColor: accent }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.projectName}>{group.project_name}</Text>
          <Text style={styles.projectSub}>
            {group.nodes.length} node{group.nodes.length !== 1 ? "s" : ""} · {doneLogs}/{totalLogs} spans approved
          </Text>
        </View>
      </View>
      {group.nodes.map((node, i) => (
        <NodeRow
          key={node.node_id}
          node={node}
          projectName={group.project_name}
          accent={accent}
          delay={delay + i * 50}
        />
      ))}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TasksScreen() {
  const [logs,       setLogs]       = useState<TeardownLog[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  useFocusEffect(useCallback(() => { load(); }, []));

  async function load() {
    setError(null);
    const cached = await cacheGet<TeardownLog[]>("teardown_logs");
    if (cached?.length) { setLogs(cached); setLoading(false); }

    try {
      const { data } = await api.get("/teardown-logs?per_page=500");
      const fresh: TeardownLog[] = data.data ?? data ?? [];
      cacheSet("teardown_logs", fresh);
      setLogs(fresh);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Network error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const groups     = groupLogs(logs);
  const totalSpans = logs.length;
  const totalCable = logs.reduce((s, l) => s + n2(l.collected_cable), 0);
  const approved   = logs.filter((l) => l.status === "approved" || l.status === "done").length;

  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        data={groups}
        keyExtractor={(item) => String(item.project_id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor="#0A5C3B"
          />
        }
        ListHeaderComponent={
          <>
            <View style={styles.topCard}>
              <Text style={styles.title}>Teardown Logs</Text>
              <Text style={styles.titleSub}>Tap a node to view its logs</Text>
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.pill}>
                <Text style={styles.pillValue}>{totalSpans}</Text>
                <Text style={styles.pillLabel}>Total</Text>
              </View>
              <View style={styles.pill}>
                <Text style={[styles.pillValue, { color: "#059669" }]}>{approved}</Text>
                <Text style={styles.pillLabel}>Approved</Text>
              </View>
              <View style={styles.pill}>
                <Text style={[styles.pillValue, { color: "#0d47c9" }]}>
                  {totalCable >= 1000
                    ? `${(totalCable / 1000).toFixed(1)}km`
                    : `${totalCable}m`}
                </Text>
                <Text style={styles.pillLabel}>Cable</Text>
              </View>
            </View>

            {loading && (
              <View style={styles.centerBox}>
                <ActivityIndicator color="#0A5C3B" />
                <Text style={styles.centerText}>Loading logs…</Text>
              </View>
            )}

            {!loading && error && (
              <View style={styles.centerBox}>
                <Text style={{ fontSize: 36 }}>⚠️</Text>
                <Text style={styles.emptyTitle}>Failed to load</Text>
                <Text style={styles.centerText}>{error}</Text>
                <TouchableOpacity
                  onPress={() => { setLoading(true); load(); }}
                  style={styles.retryBtn}
                >
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {!loading && !error && logs.length === 0 && (
              <View style={styles.centerBox}>
                <Text style={{ fontSize: 40 }}>📋</Text>
                <Text style={styles.emptyTitle}>No logs yet</Text>
                <Text style={styles.centerText}>No teardown logs found for your team.</Text>
              </View>
            )}
          </>
        }
        renderItem={({ item, index }) => (
          <ProjectSection group={item} colorIdx={index} delay={80 + index * 60} />
        )}
        ListFooterComponent={<View style={{ height: 40 }} />}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: "#f3f4f6" },
  listContent: { padding: 16, paddingBottom: 40 },

  topCard:  { backgroundColor: "#0A5C3B", borderRadius: 24, padding: 20, marginBottom: 14 },
  title:    { fontSize: 22, fontWeight: "900", color: "#ffffff" },
  titleSub: { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2, fontWeight: "600" },

  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  pill: {
    flex: 1, backgroundColor: "#ffffff", borderRadius: 18,
    paddingVertical: 14, alignItems: "center",
    elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  pillValue: { fontSize: 17, fontWeight: "900", color: "#111827" },
  pillLabel: { fontSize: 10, color: "#9ca3af", fontWeight: "700", marginTop: 2, textTransform: "uppercase" },

  centerBox:  { backgroundColor: "#fff", borderRadius: 20, padding: 36, alignItems: "center", marginBottom: 12 },
  centerText: { fontSize: 13, color: "#9ca3af", marginTop: 8, textAlign: "center" },
  emptyTitle: { fontSize: 15, fontWeight: "800", color: "#111827", marginTop: 10 },
  retryBtn:   { marginTop: 12, backgroundColor: "#0A5C3B", borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10 },
  retryText:  { color: "#fff", fontWeight: "800", fontSize: 13 },

  projectSection: { marginBottom: 24 },
  projectHeader: {
    borderLeftWidth: 4, paddingLeft: 12, marginBottom: 10,
    flexDirection: "row", alignItems: "center",
  },
  projectName: { fontSize: 15, fontWeight: "900", color: "#111827" },
  projectSub:  { fontSize: 11, color: "#9ca3af", fontWeight: "600", marginTop: 2 },

  nodeCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#ffffff", borderRadius: 18, marginBottom: 10,
    overflow: "hidden", elevation: 3,
    shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  nodeAccent: { width: 4, alignSelf: "stretch" },
  nodeBody:   { flex: 1, padding: 14 },
  nodeTop:    { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  nodeLeft:   { flex: 1 },
  nodeRight:  { alignItems: "flex-end", gap: 2 },
  nodeId:     { fontSize: 14, fontWeight: "900", color: "#111827" },
  nodeName:   { fontSize: 11, color: "#6b7280", fontWeight: "600", marginTop: 2 },
  nodeCity:   { fontSize: 10, color: "#9ca3af", marginTop: 1 },
  nodePct:    { fontSize: 16, fontWeight: "900" },
  nodeSpans:  { fontSize: 10, color: "#9ca3af", fontWeight: "700" },
  nodeCable:  { fontSize: 10, color: "#6b7280", fontWeight: "600" },
  nodeArrow:  { fontSize: 26, color: "#d1d5db", paddingRight: 14 },
  progressTrack: { height: 4, backgroundColor: "#f3f4f6", borderRadius: 2, overflow: "hidden" },
  progressFill:  { height: 4, borderRadius: 2 },
});
