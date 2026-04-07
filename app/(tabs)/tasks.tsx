import api from "@/lib/api";
import { cacheGet, cacheSet } from "@/lib/cache";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
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

const COLORS = {
  bg: "#F7F8FA",
  bgSoft: "#FFFFFF",
  surface: "#1E2329",
  surface2: "#252B33",
  surface3: "#2C333D",
  primary: "#0B7A5A",
  secondary: "#36B38A",
  accentBlue: "#3B82F6",
  text: "#F8FAFC",
  textSoft: "rgba(248,250,252,0.78)",
  textMuted: "rgba(248,250,252,0.54)",
  ink: "#111827",
  inkSoft: "#667085",
  borderLight: "#E7ECF2",
  borderDark: "rgba(255,255,255,0.07)",
  glowGreen: "rgba(11,122,90,0.10)",
  glowWhite: "rgba(255,255,255,0.04)",
  success: "#36B38A",
  warning: "#F59E0B",
  danger: "#E76F51",
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
  "#36B38A",
  "#3B82F6",
  "#14B8A6",
  "#10B981",
  "#0F766E",
];

function MetricCard({
  label,
  value,
  sublabel,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricGlow, { backgroundColor: `${accent}16` }]} />

      <View style={styles.metricTopRow}>
        <View
          style={[styles.metricIconWrap, { backgroundColor: `${accent}14` }]}
        >
          <Ionicons name={icon} size={18} color={accent} />
        </View>

        <View style={styles.metricBadge}>
          <Text style={styles.metricBadgeText}>{label}</Text>
        </View>
      </View>

      <Text style={styles.metricValue}>{value}</Text>
      {!!sublabel && <Text style={styles.metricSubLabel}>{sublabel}</Text>}

      <View style={[styles.metricAccentLine, { backgroundColor: accent }]} />
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
  const cable = node.logs.reduce((s, l) => s + n2(l.collected_cable), 0);
  const done = pct === 100;

  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()}>
      <TouchableOpacity
        activeOpacity={0.92}
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
        <View style={[styles.nodeGlow, { backgroundColor: `${accent}12` }]} />

        <View style={styles.nodeHeader}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <View style={styles.nodeIdRow}>
              <Text style={styles.nodeId}>{node.node_id}</Text>

              <View
                style={[
                  styles.nodeBadge,
                  {
                    backgroundColor: done
                      ? "rgba(54,179,138,0.14)"
                      : "rgba(255,255,255,0.06)",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.nodeBadgeText,
                    { color: done ? COLORS.secondary : COLORS.textSoft },
                  ]}
                >
                  {done ? "Complete" : "In Progress"}
                </Text>
              </View>
            </View>

            {!!node.node_name && (
              <Text style={styles.nodeName}>{node.node_name}</Text>
            )}

            {!!node.city && (
              <Text style={styles.nodeMeta}>
                {node.city}
                {node.province ? `, ${node.province}` : ""}
              </Text>
            )}
          </View>

          <View style={styles.nodeScoreWrap}>
            <Text
              style={[
                styles.nodePct,
                { color: done ? COLORS.secondary : COLORS.text },
              ]}
            >
              {pct}%
            </Text>
            <Text style={styles.nodeScoreLabel}>completion</Text>
          </View>
        </View>

        <View style={styles.nodeStatsRow}>
          <View style={styles.nodeStatPill}>
            <Text style={styles.nodeStatLabel}>Approved</Text>
            <Text style={styles.nodeStatValue}>
              {node.approved}/{node.total}
            </Text>
          </View>

          <View style={styles.nodeStatPill}>
            <Text style={styles.nodeStatLabel}>Cable</Text>
            <Text style={styles.nodeStatValue}>
              {cable > 0 ? `${cable.toLocaleString()} m` : "—"}
            </Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${pct}%` as const,
                backgroundColor: accent,
              },
            ]}
          />
        </View>

        <View style={styles.nodeFooter}>
          <Text style={styles.nodeFooterText}>Open node details</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textSoft} />
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

        <View style={styles.projectHeaderTop}>
          <View
            style={[styles.projectIconWrap, { backgroundColor: `${accent}14` }]}
          >
            <Ionicons name="layers-outline" size={18} color={accent} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.projectName}>{group.project_name}</Text>
            <Text style={styles.projectSub}>
              {group.nodes.length} node{group.nodes.length !== 1 ? "s" : ""} •{" "}
              {doneLogs}/{totalLogs} approved
            </Text>
          </View>

          <View style={[styles.projectPill, { borderColor: `${accent}2E` }]}>
            <Text style={[styles.projectPillText, { color: accent }]}>
              {pct}%
            </Text>
          </View>
        </View>

        <View style={styles.projectProgressTrack}>
          <View
            style={[
              styles.projectProgressFill,
              { width: `${pct}%`, backgroundColor: accent },
            ]}
          />
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
  const completion =
    totalSpans > 0 ? Math.round((approved / totalSpans) * 100) : 0;

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
            tintColor={COLORS.primary}
          />
        }
        ListHeaderComponent={
          <>
            <View style={styles.heroCard}>
              <View style={styles.heroGlowA} />
              <View style={styles.heroGlowB} />

              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>FIELD OPERATIONS</Text>
              </View>

              <Text style={styles.title}>Teardown Logs</Text>
              <Text style={styles.titleSub}>
                Executive overview of teardown activity, project progress, and
                cable recovery performance.
              </Text>

              <View style={styles.heroFooter}>
                <View style={styles.heroStatChip}>
                  <Text style={styles.heroStatLabel}>Projects</Text>
                  <Text style={styles.heroStatValue}>{groups.length}</Text>
                </View>

                <View style={styles.heroDivider} />

                <View style={styles.heroStatChip}>
                  <Text style={styles.heroStatLabel}>Completion</Text>
                  <Text style={styles.heroStatValue}>{completion}%</Text>
                </View>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.metricsScrollContent}
              style={styles.metricsScroll}
            >
              <MetricCard
                label="Total Logs"
                value={totalSpans}
                sublabel="Recorded field spans"
                icon="albums-outline"
                accent={COLORS.primary}
              />
              <MetricCard
                label="Approved"
                value={approved}
                sublabel="Validated work items"
                icon="checkmark-circle-outline"
                accent={COLORS.secondary}
              />
              <MetricCard
                label="Cable"
                value={
                  totalCable >= 1000
                    ? `${(totalCable / 1000).toFixed(1)} km`
                    : `${totalCable} m`
                }
                sublabel="Recovered material"
                icon="git-network-outline"
                accent={COLORS.accentBlue}
              />
              <MetricCard
                label="Completion"
                value={`${completion}%`}
                sublabel="Execution performance"
                icon="pulse-outline"
                accent={COLORS.primary}
              />
            </ScrollView>

            {loading && (
              <View style={styles.stateCard}>
                <ActivityIndicator color={COLORS.primary} />
                <Text style={styles.centerText}>Loading teardown logs…</Text>
              </View>
            )}

            {!loading && error && (
              <View style={styles.stateCard}>
                <View style={styles.stateIconWrap}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={30}
                    color={COLORS.danger}
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
                  activeOpacity={0.9}
                >
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {!loading && !error && logs.length === 0 && (
              <View style={styles.stateCard}>
                <View style={styles.stateIconWrap}>
                  <Ionicons
                    name="document-text-outline"
                    size={30}
                    color={COLORS.textSoft}
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
        ListFooterComponent={<View style={{ height: 50 }} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  listContent: {
    padding: 16,
    paddingBottom: 40,
  },

  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 28,
    padding: 22,
    overflow: "hidden",
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    shadowColor: "#0F172A",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },

  heroGlowA: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(11,122,90,0.09)",
    right: -28,
    top: -38,
  },

  heroGlowB: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.03)",
    left: -18,
    bottom: -24,
  },

  heroBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 14,
  },

  heroBadgeText: {
    color: COLORS.textSoft,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },

  title: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.8,
  },

  titleSub: {
    color: COLORS.textSoft,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    maxWidth: "92%",
    fontWeight: "500",
  },

  heroFooter: {
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.07)",
    paddingTop: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  heroStatChip: {
    gap: 2,
  },

  heroStatLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  heroStatValue: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
  },

  heroDivider: {
    width: 1,
    height: 34,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginHorizontal: 18,
  },

  metricsScroll: {
    marginBottom: 20,
  },

  metricsScrollContent: {
    paddingRight: 8,
    gap: 12,
  },

  metricCard: {
    width: 176,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },

  metricGlow: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 999,
    right: -18,
    top: -22,
  },

  metricTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },

  metricIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  metricBadge: {
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },

  metricBadgeText: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  metricValue: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.7,
  },

  metricSubLabel: {
    marginTop: 6,
    color: COLORS.textSoft,
    fontSize: 12,
    lineHeight: 17,
  },

  metricAccentLine: {
    marginTop: 16,
    width: 52,
    height: 4,
    borderRadius: 999,
  },

  stateCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 26,
    padding: 28,
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
  },

  stateIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    marginBottom: 12,
  },

  centerText: {
    fontSize: 13,
    color: COLORS.textSoft,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 19,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: COLORS.text,
  },

  retryBtn: {
    marginTop: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 13,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },

  retryText: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 0.2,
  },

  projectSection: {
    marginBottom: 24,
  },

  projectHeaderCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },

  projectHeaderGlow: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 999,
    right: -22,
    top: -24,
  },

  projectHeaderTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },

  projectIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  projectName: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.text,
  },

  projectSub: {
    fontSize: 11,
    color: COLORS.textSoft,
    fontWeight: "600",
    marginTop: 4,
  },

  projectPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
  },

  projectPillText: {
    fontSize: 12,
    fontWeight: "900",
  },

  projectProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },

  projectProgressFill: {
    height: "100%",
    borderRadius: 999,
  },

  nodeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },

  nodeGlow: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 999,
    right: -22,
    top: -22,
  },

  nodeHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },

  nodeIdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  nodeId: {
    fontSize: 17,
    fontWeight: "900",
    color: COLORS.text,
    letterSpacing: -0.3,
  },

  nodeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },

  nodeBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.45,
    textTransform: "uppercase",
  },

  nodeName: {
    marginTop: 6,
    color: COLORS.textSoft,
    fontSize: 13,
    fontWeight: "600",
  },

  nodeMeta: {
    marginTop: 4,
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "500",
  },

  nodeScoreWrap: {
    alignItems: "flex-end",
  },

  nodePct: {
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.8,
  },

  nodeScoreLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontWeight: "700",
    marginTop: 2,
  },

  nodeStatsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },

  nodeStatPill: {
    flex: 1,
    backgroundColor: COLORS.surface2,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },

  nodeStatLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "800",
  },

  nodeStatValue: {
    marginTop: 4,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },

  progressTrack: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    overflow: "hidden",
  },

  progressFill: {
    height: 8,
    borderRadius: 999,
  },

  nodeFooter: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  nodeFooterText: {
    color: COLORS.textSoft,
    fontSize: 12,
    fontWeight: "700",
  },
});
