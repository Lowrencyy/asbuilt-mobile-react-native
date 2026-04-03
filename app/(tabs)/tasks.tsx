import api from "@/lib/api";
import { cacheGet, cacheSet } from "@/lib/cache";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
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

type TeardownLog = {
  id: number;
  status: string;
  team?: string;
  collected_cable?: number;
  pole_span?: {
    pole_span_code?: string;
    from_pole?: { pole_code: string };
    to_pole?: { pole_code: string };
  };
  node?: {
    id: number;
    node_id: string;
    node_name?: string;
    city?: string;
    province?: string;
  };
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

const n2 = (v: unknown) => (v == null || v === "" ? 0 : Number(v) || 0);

function groupLogs(logs: TeardownLog[]): ProjectGroup[] {
  const projectMap = new Map<number, ProjectGroup>();

  for (const log of logs) {
    const pid = log.project?.id ?? 0;
    const pname =
      log.project?.name ?? log.project?.project_code ?? "Unknown Project";
    const ndbid = log.node?.id ?? 0;
    const nid = log.node?.node_id ?? "Unknown Node";
    const nname = log.node?.node_name;
    const city = log.node?.city;
    const prov = log.node?.province;

    if (!projectMap.has(pid)) {
      projectMap.set(pid, {
        project_id: pid,
        project_name: pname,
        nodes: [],
      });
    }

    const proj = projectMap.get(pid)!;

    let nodeGroup = proj.nodes.find((n) => n.node_id === nid);
    if (!nodeGroup) {
      nodeGroup = {
        node_id: nid,
        node_db_id: ndbid,
        node_name: nname,
        city,
        province: prov,
        total: 0,
        approved: 0,
        logs: [],
      };
      proj.nodes.push(nodeGroup);
    }

    nodeGroup.logs.push(log);
    nodeGroup.total++;
    if (log.status === "approved" || log.status === "done") {
      nodeGroup.approved++;
    }
  }

  return Array.from(projectMap.values());
}

const PROJECT_ACCENTS = [
  "#0B7A5A",
  "#0D47C9",
  "#7C3AED",
  "#C2410C",
  "#0F766E",
  "#BE123C",
];

function SummaryCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string | number;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.summaryCard}>
      <View style={[styles.summaryIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function NodeRow({
  node,
  projectName,
  accent,
  delay,
}: {
  node: NodeGroup;
  projectName: string;
  accent: string;
  delay: number;
}) {
  const pct =
    node.total > 0 ? Math.round((node.approved / node.total) * 100) : 0;
  const barColor = pct === 100 ? "#059669" : accent;
  const cable = node.logs.reduce((s, l) => s + n2(l.collected_cable), 0);

  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()}>
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.nodeCard}
        onPress={() =>
          router.push({
            pathname: "/teardown/node-logs" as any,
            params: {
              node_id: node.node_id,
              node_name: node.node_name ?? "",
              city: node.city ?? "",
              province: node.province ?? "",
              project_name: projectName,
              accent,
            },
          })
        }
      >
        <View style={[styles.nodeAccent, { backgroundColor: accent }]} />

        <View style={styles.nodeBody}>
          <View style={styles.nodeTop}>
            <View style={styles.nodeLeft}>
              <View style={styles.nodeIdRow}>
                <Text style={styles.nodeId}>{node.node_id}</Text>
                <View style={styles.nodeMiniBadge}>
                  <Text style={styles.nodeMiniBadgeText}>Node</Text>
                </View>
              </View>

              {node.node_name ? (
                <Text style={styles.nodeName}>{node.node_name}</Text>
              ) : null}

              {node.city ? (
                <Text style={styles.nodeCity}>
                  {node.city}
                  {node.province ? `, ${node.province}` : ""}
                </Text>
              ) : null}
            </View>

            <View style={styles.nodeRight}>
              <Text style={[styles.nodePct, { color: barColor }]}>{pct}%</Text>
              <Text style={styles.nodeSpans}>
                {node.approved}/{node.total} spans
              </Text>
              {cable > 0 ? (
                <Text style={styles.nodeCable}>{cable.toLocaleString()} m</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${pct}%` as any, backgroundColor: barColor },
              ]}
            />
          </View>
        </View>

        <View style={styles.nodeArrowWrap}>
          <Ionicons name="chevron-forward" size={18} color="#98A2B3" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function ProjectSection({
  group,
  colorIdx,
  delay,
}: {
  group: ProjectGroup;
  colorIdx: number;
  delay: number;
}) {
  const accent = PROJECT_ACCENTS[colorIdx % PROJECT_ACCENTS.length];
  const totalLogs = group.nodes.reduce((s, n) => s + n.total, 0);
  const doneLogs = group.nodes.reduce((s, n) => s + n.approved, 0);
  const pct = totalLogs > 0 ? Math.round((doneLogs / totalLogs) * 100) : 0;

  return (
    <View style={styles.projectSection}>
      <View style={styles.projectHeaderCard}>
        <View
          style={[styles.projectHeaderGlow, { backgroundColor: `${accent}14` }]}
        />
        <View style={[styles.projectIconWrap, { backgroundColor: accent }]}>
          <Ionicons name="folder-open-outline" size={18} color="#FFFFFF" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.projectName}>{group.project_name}</Text>
          <Text style={styles.projectSub}>
            {group.nodes.length} node{group.nodes.length !== 1 ? "s" : ""} •{" "}
            {doneLogs}/{totalLogs} approved
          </Text>

          <View style={styles.projectProgressTrack}>
            <View
              style={[
                styles.projectProgressFill,
                { width: `${pct}%`, backgroundColor: accent },
              ]}
            />
          </View>
        </View>

        <Text style={[styles.projectPct, { color: accent }]}>{pct}%</Text>
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

export default function TasksScreen() {
  const [logs, setLogs] = useState<TeardownLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  async function load() {
    setError(null);
    const cached = await cacheGet<TeardownLog[]>("teardown_logs");
    if (cached?.length) {
      setLogs(cached);
      setLoading(false);
    }

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

  const groups = useMemo(() => groupLogs(logs), [logs]);
  const totalSpans = logs.length;
  const totalCable = logs.reduce((s, l) => s + n2(l.collected_cable), 0);
  const approved = logs.filter(
    (l) => l.status === "approved" || l.status === "done",
  ).length;

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <FlatList
        data={groups}
        keyExtractor={(item) => String(item.project_id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor="#0B7A5A"
          />
        }
        ListHeaderComponent={
          <>
            <View style={styles.heroCard}>
              <View style={styles.heroGlowTop} />
              <View style={styles.heroGlowBottom} />

              <Text style={styles.heroKicker}>Operations Overview</Text>
              <Text style={styles.title}>Teardown Logs</Text>
              <Text style={styles.titleSub}>
                Browse grouped teardown progress by project and node.
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <SummaryCard
                label="Total Logs"
                value={totalSpans}
                color="#111827"
                icon="albums-outline"
              />
              <SummaryCard
                label="Approved"
                value={approved}
                color="#059669"
                icon="checkmark-circle-outline"
              />
              <SummaryCard
                label="Cable"
                value={
                  totalCable >= 1000
                    ? `${(totalCable / 1000).toFixed(1)}km`
                    : `${totalCable}m`
                }
                color="#0D47C9"
                icon="git-network-outline"
              />
            </View>

            {loading && (
              <View style={styles.centerBox}>
                <ActivityIndicator color="#0B7A5A" />
                <Text style={styles.centerText}>Loading teardown logs…</Text>
              </View>
            )}

            {!loading && error && (
              <View style={styles.centerBox}>
                <View style={styles.stateIconWrap}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={30}
                    color="#B42318"
                  />
                </View>
                <Text style={styles.emptyTitle}>Failed to load</Text>
                <Text style={styles.centerText}>{error}</Text>
                <TouchableOpacity
                  onPress={() => {
                    setLoading(true);
                    load();
                  }}
                  style={styles.retryBtn}
                >
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {!loading && !error && logs.length === 0 && (
              <View style={styles.centerBox}>
                <View style={styles.stateIconWrap}>
                  <Ionicons
                    name="document-text-outline"
                    size={30}
                    color="#667085"
                  />
                </View>
                <Text style={styles.emptyTitle}>No logs yet</Text>
                <Text style={styles.centerText}>
                  No teardown logs found for your team.
                </Text>
              </View>
            )}
          </>
        }
        renderItem={({ item, index }) => (
          <ProjectSection
            group={item}
            colorIdx={index}
            delay={80 + index * 60}
          />
        )}
        ListFooterComponent={<View style={{ height: 40 }} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F4F6F8",
  },

  listContent: {
    padding: 16,
    paddingBottom: 40,
  },

  heroCard: {
    borderRadius: 28,
    padding: 20,
    marginBottom: 16,
    backgroundColor: "#13211C",
    overflow: "hidden",
  },

  heroGlowTop: {
    position: "absolute",
    top: -36,
    right: -18,
    width: 160,
    height: 160,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  heroGlowBottom: {
    position: "absolute",
    bottom: -20,
    left: -12,
    width: 100,
    height: 100,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  heroKicker: {
    fontSize: 11,
    fontWeight: "800",
    color: "rgba(255,255,255,0.66)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
  },

  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.7,
  },

  titleSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.72)",
    marginTop: 6,
    lineHeight: 19,
    fontWeight: "500",
  },

  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },

  summaryCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E9EDF2",
    shadowColor: "#101828",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },

  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  summaryValue: {
    fontSize: 18,
    fontWeight: "900",
  },

  summaryLabel: {
    marginTop: 4,
    fontSize: 10,
    color: "#98A2B3",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  centerBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 36,
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E9EDF2",
  },

  stateIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    marginBottom: 10,
  },

  centerText: {
    fontSize: 13,
    color: "#98A2B3",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 19,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginTop: 2,
  },

  retryBtn: {
    marginTop: 14,
    backgroundColor: "#0B7A5A",
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 11,
  },

  retryText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 13,
  },

  projectSection: {
    marginBottom: 24,
  },

  projectHeaderCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E9EDF2",
    overflow: "hidden",
  },

  projectHeaderGlow: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 999,
    right: -25,
    top: -25,
  },

  projectIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  projectName: {
    fontSize: 15,
    fontWeight: "900",
    color: "#111827",
  },

  projectSub: {
    fontSize: 11,
    color: "#98A2B3",
    fontWeight: "600",
    marginTop: 3,
    marginBottom: 8,
  },

  projectProgressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "#F2F4F7",
    overflow: "hidden",
  },

  projectProgressFill: {
    height: "100%",
    borderRadius: 999,
  },

  projectPct: {
    marginLeft: 12,
    fontSize: 15,
    fontWeight: "900",
  },

  nodeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    marginBottom: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E9EDF2",
    shadowColor: "#101828",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  nodeAccent: {
    width: 4,
    alignSelf: "stretch",
  },

  nodeBody: {
    flex: 1,
    padding: 14,
  },

  nodeTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },

  nodeLeft: {
    flex: 1,
    paddingRight: 10,
  },

  nodeRight: {
    alignItems: "flex-end",
    gap: 2,
  },

  nodeIdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  nodeId: {
    fontSize: 15,
    fontWeight: "900",
    color: "#111827",
  },

  nodeMiniBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },

  nodeMiniBadgeText: {
    fontSize: 9,
    color: "#667085",
    fontWeight: "700",
    textTransform: "uppercase",
  },

  nodeName: {
    fontSize: 12,
    color: "#667085",
    fontWeight: "600",
    marginTop: 4,
  },

  nodeCity: {
    fontSize: 11,
    color: "#98A2B3",
    marginTop: 2,
  },

  nodePct: {
    fontSize: 18,
    fontWeight: "900",
  },

  nodeSpans: {
    fontSize: 10,
    color: "#98A2B3",
    fontWeight: "700",
  },

  nodeCable: {
    fontSize: 10,
    color: "#667085",
    fontWeight: "600",
  },

  nodeArrowWrap: {
    paddingRight: 14,
  },

  progressTrack: {
    height: 6,
    backgroundColor: "#F2F4F7",
    borderRadius: 999,
    overflow: "hidden",
  },

  progressFill: {
    height: 6,
    borderRadius: 999,
  },
});
