import api, { assetUrl } from "@/lib/api";
import { cacheGet, cacheSet } from "@/lib/cache";
import { tokenStore } from "@/lib/token";
import { Stack, router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
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

const cardIcon = require("../../assets/images/card-icon.png");
const LINEMAN_BG = require("@/assets/images/lineman.png");
const telcoMainLogo = require("@/assets/images/telco-mainlogo.png");
const telcovantageWideLogo = require("@/assets/images/telcovantage-logo.png");

type Node = {
  id: number;
  node_id: string;
  node_name: string;
  sites: string | null;
  province: string;
  city: string;
  team?: string | null;
  status?: string;
  due_date?: string | null;
  date_start?: string | null;
  date_finished?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  poles_progress?: { total: number; completed: number } | null;
};

type SearchRow = { type: "search"; key: string };
type NodeRow = { type: "node"; key: string; node: Node };
type ListRow = SearchRow | NodeRow;

type StatusFilter = "all" | "ongoing" | "pending" | "completed" | "canceled";

const PRIMARY = "#0A5C3B";
const PRIMARY_SOFT = "#E7F5EE";
const BORDER = "#D8EBDD";
const TEXT_SOFT = "#5E7B6C";
const BG = "#F4FAF6";

function formatDate(d?: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusLabel(status?: string) {
  return status?.trim() || "Unknown";
}

function getStatusColors(status?: string) {
  const s = (status || "").trim().toLowerCase();

  if (s === "pending") {
    return {
      bg: "#FEF3C7",
      text: "#B45309",
      border: "#FCD34D",
    };
  }

  if (s === "ongoing" || s === "in progress") {
    return {
      bg: "#E7F5EE",
      text: "#0A5C3B",
      border: "#86C9A3",
    };
  }

  if (s === "canceled" || s === "cancelled" || s === "cancel") {
    return {
      bg: "#FEE2E2",
      text: "#B91C1C",
      border: "#FCA5A5",
    };
  }

  if (s === "completed" || s === "done" || s === "finished") {
    return {
      bg: "#DCFCE7",
      text: "#166534",
      border: "#86EFAC",
    };
  }

  return {
    bg: "#F1F5F9",
    text: "#475569",
    border: "#CBD5E1",
  };
}

function matchesFilter(node: Node, filter: StatusFilter) {
  const s = (node.status || "").trim().toLowerCase();

  const isCompleted = s === "completed" || s === "done" || s === "finished";
  const isPending = s === "pending";
  const isOngoing = s === "ongoing" || s === "in progress";
  const isCanceled = s === "canceled" || s === "cancelled" || s === "cancel";

  switch (filter) {
    case "ongoing":
      return isOngoing;
    case "pending":
      return isPending;
    case "completed":
      return isCompleted;
    case "canceled":
      return isCanceled;
    case "all":
    default:
      return !isPending && !isCompleted && !isCanceled;
  }
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[styles.filterChip, active && styles.filterChipActive]}
    >
      <Text
        style={[styles.filterChipText, active && styles.filterChipTextActive]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function NodeCard({
  node,
  accentColor,
  projectId,
  projectName,
}: {
  node: Node;
  accentColor: string;
  projectId: string;
  projectName: string;
}) {
  const title = node.node_name || node.node_id;
  const location = [node.city, node.province].filter(Boolean).join(", ");
  const total = node.poles_progress?.total ?? 0;
  const completed = node.poles_progress?.completed ?? 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const statusLabel = getStatusLabel(node.status);
  const statusColors = getStatusColors(node.status);

  const handleOpen = () =>
    router.push({
      pathname: "/projects/poles",
      params: {
        node_id: String(node.id),
        node_name: node.node_name || node.node_id,
        node_code: node.node_id,
        accent: accentColor,
        project_id: projectId,
        project_name: projectName,
      },
    });

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      style={styles.cardWrap}
      onPress={handleOpen}
    >
      <View style={styles.horizontalCard}>
        <View style={styles.leftRail}>
          <View style={styles.nodeIdTopWrap}>
            <Text style={styles.nodeIdTopLabel}>NODE ID :</Text>
            <Text style={styles.nodeIdTopValue} numberOfLines={1}>
              {node.node_id || "—"}
            </Text>
          </View>

          <Image
            source={telcoMainLogo}
            style={styles.leftRailLogo}
            resizeMode="contain"
          />

          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: statusColors.bg,
                borderColor: statusColors.border,
              },
            ]}
          >
            <Text style={[styles.statusPillText, { color: statusColors.text }]}>
              {statusLabel}
            </Text>
          </View>
        </View>

        <View style={styles.mainPanel}>
          <View style={styles.topRow}>
            <View style={styles.nameBlock}>
              <Text style={styles.sectionEyebrow}>NODE NAME</Text>
              <Text style={styles.nodeTitle} numberOfLines={1}>
                {title || "Untitled Node"}
              </Text>
              <Text style={styles.nodeLocation} numberOfLines={1}>
                {location || "No location available"}
              </Text>
            </View>

            <View style={styles.brandCard}>
              <Image
                source={telcovantageWideLogo}
                style={styles.brandCardLogo}
                resizeMode="contain"
              />
            </View>
          </View>

          <View style={styles.bottomRow}>
            <View style={styles.infoBlockDate}>
              <Text style={styles.infoLabel}>Due Date</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {formatDate(node.due_date) || "Not set"}
              </Text>
            </View>

            <View style={styles.verticalDivider} />

            <View style={styles.infoBlockTeam}>
              <Text style={styles.infoLabel}>Team</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {node.team || "Unassigned"}
              </Text>
            </View>

            <View style={styles.progressBlock}>
              <View style={styles.progressTopLine}>
                <View style={styles.progressTrack}>
                  <View
                    style={[styles.progressFill, { width: `${pct}%` as any }]}
                  />
                </View>
                <Text style={styles.progressPct}>{pct}%</Text>
              </View>

              <Text style={styles.progressText} numberOfLines={1}>
                {completed} of {total} poles
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleOpen}
              style={[
                styles.circleButton,
                { backgroundColor: accentColor || PRIMARY },
              ]}
            >
              <Text style={styles.circleButtonText}>›</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function SiteNodesScreen() {
  const { project_id, site, project_name, accent, project_logo } =
    useLocalSearchParams<{
      project_id: string;
      site: string;
      project_name: string;
      accent: string;
      accent_overlay: string;
      project_logo: string;
    }>();

  const accentColor = accent || PRIMARY;

  const [nodes, setNodes] = useState<Node[]>([]);
  const [loadingNodes, setLoadingNodes] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    const CACHE_KEY = `nodes_project_${project_id}`;

    function filterBySite(raw: Node[]): Node[] {
      const siteKey = site === "Unassigned" ? null : site;
      return raw.filter((n) =>
        siteKey ? (n.sites?.trim() || null) === siteKey : !n.sites?.trim(),
      );
    }

    function applyFilters(raw: Node[], u: any): Node[] {
      let result = filterBySite(raw);
      if (u?.role === "subcon" && u?.team_name) {
        result = result.filter((n) => n.team === u.team_name);
      }
      return result;
    }

    cacheGet<Node[]>(CACHE_KEY).then((cached) => {
      if (cached?.length) {
        tokenStore.getUser().then((u: any) => {
          setNodes(applyFilters(cached, u));
          setLoadingNodes(false);
        });
      }
    });

    api
      .get(`/nodes?project_id=${project_id}`)
      .then(({ data }) => {
        const raw: Node[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
            ? data.data
            : [];
        cacheSet(CACHE_KEY, raw);
        tokenStore.getUser().then((u: any) => {
          setNodes(applyFilters(raw, u));
          setLoadingNodes(false);
        });
      })
      .catch(() => setLoadingNodes(false));
  }, [project_id, site]);

  const filteredNodes = useMemo(() => {
    const q = search.trim().toLowerCase();

    return nodes.filter((node) => {
      if (!matchesFilter(node, statusFilter)) return false;

      if (!q) return true;

      const haystack = [
        node.node_id,
        node.node_name,
        node.sites,
        node.province,
        node.city,
        node.team,
        node.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [nodes, search, statusFilter]);

  const listData = useMemo<ListRow[]>(
    () => [
      { type: "search", key: "search-row" },
      ...filteredNodes.map((node) => ({
        type: "node" as const,
        key: String(node.id),
        node,
      })),
    ],
    [filteredNodes],
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.root} edges={["top"]}>
        <FlatList
          data={listData}
          keyExtractor={(item) => item.key}
          stickyHeaderIndices={[1]}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <>
              <Pressable
                onPress={() => router.back()}
                style={styles.floatingBackBtn}
              >
                <Text style={styles.floatingBackIcon}>‹</Text>
              </Pressable>

              <View
                style={[styles.projectCard, { backgroundColor: accentColor }]}
              >
                <View style={styles.cardBg} />
                <View style={styles.cardGradientTop} />
                <View style={styles.cardGradientBlue} />

                <Image
                  source={LINEMAN_BG}
                  style={styles.heroLinemanFull}
                  resizeMode="contain"
                />

                <View style={styles.topShineBand} />
                <View style={styles.bottomGlowLine} />
                <View style={styles.heroAccentRing} />

                <View style={styles.cardContent}>
                  <View style={styles.heroBadgeCentered}>
                    <Text style={styles.heroBadgeText}>SELECT NODE ID</Text>
                  </View>

                  <View style={styles.heroProjectLogoStandalone}>
                    <Image
                      source={
                        assetUrl(project_logo)
                          ? { uri: assetUrl(project_logo)! }
                          : cardIcon
                      }
                      style={styles.heroProjectLogoImage}
                      resizeMode="contain"
                    />
                  </View>

                  <Text style={styles.projectName} numberOfLines={2}>
                    {site || "Site Nodes"}
                  </Text>

                  <Text style={styles.projectCode} numberOfLines={1}>
                    {project_name || "Project"}
                  </Text>

                  <View style={styles.separator} />

                  <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>PROJECT</Text>
                      <Text style={styles.statValue} numberOfLines={1}>
                        {project_name || "—"}
                      </Text>
                    </View>

                    <View style={styles.statDivider} />

                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>SITE</Text>
                      <Text style={styles.statValue} numberOfLines={1}>
                        {site || "—"}
                      </Text>
                    </View>

                    <View style={styles.statDivider} />

                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>NODES</Text>
                      <Text style={styles.statValue}>
                        {loadingNodes ? "…" : filteredNodes.length}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </>
          }
          ListEmptyComponent={
            !loadingNodes ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>
                  {search.trim()
                    ? "No matching nodes found."
                    : "No nodes in this site."}
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            if (item.type === "search") {
              return (
                <View style={styles.stickySearchContainer}>
                  <View style={styles.searchWrap}>
                    <Text style={styles.searchIcon}>⌕</Text>
                    <TextInput
                      value={search}
                      onChangeText={setSearch}
                      placeholder="Search Node ID"
                      placeholderTextColor="#9CA3AF"
                      style={styles.searchInput}
                    />
                    {search.length > 0 ? (
                      <Pressable
                        onPress={() => setSearch("")}
                        style={styles.clearBtn}
                      >
                        <Text style={styles.clearBtnText}>✕</Text>
                      </Pressable>
                    ) : null}
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterRow}
                  >
                    <FilterChip
                      label="All"
                      active={statusFilter === "all"}
                      onPress={() => setStatusFilter("all")}
                    />
                    <FilterChip
                      label="Ongoing"
                      active={statusFilter === "ongoing"}
                      onPress={() => setStatusFilter("ongoing")}
                    />
                    <FilterChip
                      label="Pending"
                      active={statusFilter === "pending"}
                      onPress={() => setStatusFilter("pending")}
                    />
                    <FilterChip
                      label="Completed"
                      active={statusFilter === "completed"}
                      onPress={() => setStatusFilter("completed")}
                    />
                    <FilterChip
                      label="Canceled"
                      active={statusFilter === "canceled"}
                      onPress={() => setStatusFilter("canceled")}
                    />
                  </ScrollView>

                  <Text style={styles.sectionLabel}>
                    {loadingNodes && nodes.length === 0
                      ? "Loading nodes..."
                      : `${filteredNodes.length} node${filteredNodes.length !== 1 ? "s" : ""}`}
                  </Text>
                </View>
              );
            }

            return (
              <NodeCard
                node={item.node}
                accentColor={accentColor}
                projectId={project_id ?? ""}
                projectName={project_name ?? ""}
              />
            );
          }}
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },

  listContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 48,
  },

  floatingBackBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: PRIMARY,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },

  floatingBackIcon: {
    fontSize: 28,
    color: PRIMARY,
    fontWeight: "700",
    marginTop: -2,
  },

  projectCard: {
    borderRadius: 30,
    overflow: "hidden",
    marginBottom: 22,
    minHeight: 360,
    shadowColor: "#003A28",
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
    position: "relative",
  },

  cardBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: PRIMARY,
  },

  cardGradientTop: {
    position: "absolute",
    top: -30,
    left: -30,
    right: -30,
    height: 210,
    opacity: 0.45,
    transform: [{ skewY: "-8deg" }],
    backgroundColor: "#17A673",
  },

  cardGradientBlue: {
    position: "absolute",
    right: -42,
    top: 70,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: "rgba(169,220,255,0.22)",
  },

  heroLinemanFull: {
    position: "absolute",
    left: -38,
    top: -45,
    width: 300,
    height: 470,
    opacity: 0.9,
  },

  topShineBand: {
    position: "absolute",
    top: 0,
    left: 22,
    right: 22,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.38)",
  },

  bottomGlowLine: {
    position: "absolute",
    bottom: 0,
    left: 18,
    right: 18,
    height: 5,
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  heroAccentRing: {
    position: "absolute",
    width: 210,
    height: 210,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    top: 36,
    left: -40,
  },

  cardContent: {
    position: "relative",
    zIndex: 10,
    alignItems: "center",
    paddingTop: 34,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },

  heroBadgeCentered: {
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 18,
  },

  heroBadgeText: {
    color: "rgba(255,255,255,0.96)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },

  heroProjectLogoStandalone: {
    width: "74%",
    height: 154,
    borderRadius: 24,
    marginBottom: 18,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },

  heroProjectLogoImage: {
    width: "100%",
    height: "100%",
  },

  projectName: {
    fontSize: 25,
    fontWeight: "900",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: -0.6,
    marginBottom: 4,
  },

  projectCode: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.72)",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginBottom: 20,
  },

  separator: {
    width: "92%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginBottom: 18,
  },

  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    justifyContent: "space-around",
  },

  statBox: {
    alignItems: "center",
    flex: 1,
  },

  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: "rgba(255,255,255,0.18)",
  },

  statLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "rgba(255,255,255,0.60)",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 5,
  },

  statValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  stickySearchContainer: {
    backgroundColor: BG,
    paddingTop: 2,
    paddingBottom: 10,
  },

  searchWrap: {
    height: 54,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 10,
    shadowColor: PRIMARY,
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  searchIcon: {
    fontSize: 18,
    color: "#8AA395",
    marginRight: 10,
  },

  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },

  clearBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PRIMARY_SOFT,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  clearBtnText: {
    fontSize: 12,
    color: PRIMARY,
    fontWeight: "800",
  },

  filterRow: {
    paddingBottom: 10,
    gap: 8,
  },

  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
  },

  filterChipActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },

  filterChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#425466",
  },

  filterChipTextActive: {
    color: "#FFFFFF",
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: TEXT_SOFT,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
  },

  cardWrap: {
    marginBottom: 10,
  },

  horizontalCard: {
    backgroundColor: "#F8FBF7",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "stretch",
    borderWidth: 1,
    borderColor: "#E6EEE8",
    shadowColor: "#003A28",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    overflow: "hidden",
  },

  leftRail: {
    width: 96,
    alignItems: "center",
    paddingRight: 10,
    paddingTop: 2,
    borderRightWidth: 1,
    borderRightColor: "#E2E8E2",
  },

  nodeIdTopWrap: {
    width: "100%",
    marginBottom: 2,
    alignItems: "center",
  },

  nodeIdTopLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#7B8A80",
    letterSpacing: 0.6,
    marginBottom: -3,
  },

  nodeIdTopValue: {
    fontSize: 12,
    fontWeight: "900",
    color: "#1B1F1D",
  },

  leftRailLogo: {
    width: 48,
    height: 48,
    marginBottom: 2,
    marginTop: -10,
  },

  statusPill: {
    width: "88%",
    minHeight: 32,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: "auto",
  },

  statusPillText: {
    fontSize: 7.5,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 9,
    letterSpacing: 0.02,
  },

  mainPanel: {
    flex: 1,
    paddingLeft: 12,
    justifyContent: "space-between",
    minWidth: 0,
  },

  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
    minWidth: 0,
  },

  nameBlock: {
    width: 110,
    flexShrink: 0,
    paddingRight: 8,
  },

  sectionEyebrow: {
    fontSize: 8.5,
    fontWeight: "800",
    color: "#8B918C",
    letterSpacing: 1,
    marginBottom: 5,
  },

  nodeTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#111111",
    marginBottom: 4,
    letterSpacing: -0.2,
  },

  nodeLocation: {
    fontSize: 10,
    fontWeight: "500",
    color: "#262626",
  },

  brandCard: {
    flex: 1,
    minWidth: 110,
    maxWidth: 160,
    height: 58,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    overflow: "hidden",
  },

  brandCardLogo: {
    width: "92%",
    height: "48%",
  },

  bottomRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    minWidth: 0,
    marginTop: -4,
  },

  infoBlockTeam: {
    width: 64,
    marginRight: 8,
    marginTop: 0,
  },

  infoBlockDate: {
    width: 50,
    marginRight: 8,
    marginTop: 0,
  },

  infoLabel: {
    fontSize: 9,
    color: "#777777",
    marginBottom: 4,
    fontWeight: "500",
  },

  infoValue: {
    fontSize: 9.5,
    color: "#111111",
    fontWeight: "900",
  },

  verticalDivider: {
    width: 1,
    height: 38,
    backgroundColor: "#E1E5E1",
    marginRight: 8,
    marginTop: 2,
  },

  progressBlock: {
    width: 66,
    marginRight: 6,
    marginTop: 0,
  },

  progressTopLine: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },

  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#DCE8E0",
    overflow: "hidden",
    marginRight: 4,
  },

  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#0A6A49",
  },

  progressPct: {
    fontSize: 9,
    fontWeight: "900",
    color: "#0A6A49",
  },

  progressText: {
    fontSize: 9,
    fontWeight: "500",
    color: "#111111",
  },

  circleButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 6,
  },

  circleButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "500",
    marginTop: -2,
  },

  emptyWrap: {
    paddingVertical: 40,
    alignItems: "center",
  },

  emptyText: {
    fontSize: 14,
    color: TEXT_SOFT,
    fontWeight: "600",
  },
});
