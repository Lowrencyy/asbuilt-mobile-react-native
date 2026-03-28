import api, { assetUrl } from "@/lib/api";
import { cacheGet, cacheSet } from "@/lib/cache";
import { projectStore } from "@/lib/store";
import { tokenStore } from "@/lib/token";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
  data_source?: string;
};

type SiteGroup = { site: string; nodes: Node[] };

function getProjectColors(status: string) {
  switch (status) {
    case "Priority":
      return {
        base: "#5B21B6",
        overlay: "#7C3AED",
        pillBg: "#FFE4E6",
        pillText: "#E11D48",
      };
    case "In Progress":
      return {
        base: "#1D4ED8",
        overlay: "#2563EB",
        pillBg: "#E0E7FF",
        pillText: "#4338CA",
      };
    case "Ongoing":
      return {
        base: "#0369A1",
        overlay: "#0EA5E9",
        pillBg: "#E0F2FE",
        pillText: "#0369A1",
      };
    case "Pending":
      return {
        base: "#B45309",
        overlay: "#F59E0B",
        pillBg: "#FEF3C7",
        pillText: "#B45309",
      };
    default:
      return {
        base: "#334155",
        overlay: "#64748B",
        pillBg: "#E2E8F0",
        pillText: "#475569",
      };
  }
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const project = projectStore.get().find((p) => String(p.id) === id);
  const colors = getProjectColors(project?.status ?? "");
  const logoUri = assetUrl(project?.project_logo);

  const [nodes, setNodes] = useState<Node[]>([]);
  const [loadingNodes, setLoadingNodes] = useState(true);

  useEffect(() => {
    const CACHE_KEY = `nodes_project_${id}`;

    function applyFilter(raw: Node[], u: any): Node[] {
      if (u?.role === "subcon" && u?.team_name) {
        return raw.filter((n) => n.team === u.team_name);
      }
      return raw;
    }

    cacheGet<Node[]>(CACHE_KEY).then((cached) => {
      if (cached?.length) {
        tokenStore.getUser().then((u: any) => {
          setNodes(applyFilter(cached, u));
          setLoadingNodes(false);
        });
      }
    });

    api
      .get(`/nodes?project_id=${id}`)
      .then(({ data }) => {
        const raw: Node[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
            ? data.data
            : [];
        cacheSet(CACHE_KEY, raw);
        tokenStore.getUser().then((u: any) => {
          setNodes(applyFilter(raw, u));
          setLoadingNodes(false);
        });
      })
      .catch((err) => {
        const status = err?.response?.status;
        if (status === 403 || status === 401) {
          Alert.alert(
            "Access Denied",
            "You are not assigned to this project.",
            [{ text: "OK", onPress: () => router.back() }],
          );
        }
        setLoadingNodes(false);
      });
  }, [id]);

  const siteGroups = useMemo<SiteGroup[]>(() => {
    const map = new Map<string, Node[]>();

    for (const n of nodes) {
      const key = n.sites?.trim() || "Unassigned";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    }

    const named: SiteGroup[] = [];
    const unassigned: SiteGroup[] = [];

    for (const [site, ns] of map) {
      if (site === "Unassigned") unassigned.push({ site, nodes: ns });
      else named.push({ site, nodes: ns });
    }

    named.sort((a, b) => a.site.localeCompare(b.site));
    return [...named, ...unassigned];
  }, [nodes]);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <FlatList
        data={siteGroups}
        keyExtractor={(g) => g.site}
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

            <View style={styles.projectCard}>
              <View style={[styles.cardBg, { backgroundColor: colors.base }]} />
              <View
                style={[
                  styles.cardOverlay,
                  { backgroundColor: colors.overlay },
                ]}
              />
              <View style={styles.gridOverlay}>
                {Array.from({ length: 40 }).map((_, i) => (
                  <View key={i} style={styles.gridDot} />
                ))}
              </View>
              <View style={styles.curveTopRight} />
              <View style={styles.curveBottomLeft} />

              <View style={styles.cardContent}>
                <View style={styles.logoWrap}>
                  {logoUri ? (
                    <Image
                      source={{ uri: logoUri }}
                      style={styles.logoImg}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.logoFallback}>
                      <Text style={styles.logoEmoji}></Text>
                    </View>
                  )}
                </View>

                <Text style={styles.projectName}>{project?.project_name}</Text>
                <Text style={styles.projectCode}>{project?.project_code}</Text>

                <View style={styles.separator} />

                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>CLIENT</Text>
                    <Text style={styles.statValue} numberOfLines={1}>
                      {project?.client ?? "—"}
                    </Text>
                  </View>

                  <View style={styles.statDivider} />

                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>STATUS</Text>
                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: colors.pillBg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          { color: colors.pillText },
                        ]}
                      >
                        {project?.status ?? "—"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.statDivider} />

                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>NODES</Text>
                    <Text style={styles.statValue}>
                      {loadingNodes ? "…" : nodes.length}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <Text style={styles.sectionLabel}>Sites</Text>

            {loadingNodes && nodes.length === 0 && (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#0A5C3B" size="small" />
                <Text style={styles.loadingText}>Loading sites...</Text>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          !loadingNodes ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>
                No nodes found for this project.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item: group, index }) => (
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.siteCard}
            onPress={() =>
              router.push({
                pathname: "/projects/site-nodes",
                params: {
                  project_id: id,
                  site: group.site,
                  project_name: project?.project_name ?? "",
                  accent: colors.base,
                  accent_overlay: colors.overlay,
                  project_logo: project?.project_logo ?? "",
                },
              })
            }
          >
            <View
              style={[
                styles.siteCardGlow,
                { backgroundColor: `${colors.base}10` },
              ]}
            />

            <View style={styles.siteCardTop}>
              <View
                style={[
                  styles.siteIconWrap,
                  {
                    backgroundColor:
                      group.site === "Unassigned"
                        ? "#FFF7ED"
                        : `${colors.base}18`,
                    borderColor:
                      group.site === "Unassigned"
                        ? "#FED7AA"
                        : `${colors.base}25`,
                  },
                ]}
              >
                <Text style={styles.siteCardIcon}>
                  {group.site === "Unassigned" ? "📂" : "📍"}
                </Text>
              </View>

              <View style={styles.siteMainInfo}>
                <Text style={styles.siteCardName} numberOfLines={1}>
                  {group.site}
                </Text>
                <Text style={styles.siteCardSubtitle}>
                  {group.site === "Unassigned"
                    ? "Nodes waiting for site assignment"
                    : "Tap to view site nodes and details"}
                </Text>
              </View>

              <View
                style={[
                  styles.nodeBadge,
                  {
                    backgroundColor:
                      group.site === "Unassigned"
                        ? "#FFF7ED"
                        : `${colors.base}14`,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.nodeBadgeText,
                    {
                      color:
                        group.site === "Unassigned" ? "#C2410C" : colors.base,
                    },
                  ]}
                >
                  {group.nodes.length}
                </Text>
              </View>
            </View>

            <View style={styles.siteCardBottom}>
              <View style={styles.siteMetaRow}>
                <View style={styles.siteMetaPill}>
                  <Text style={styles.siteMetaText}>
                    {group.nodes.length} node
                    {group.nodes.length !== 1 ? "s" : ""}
                  </Text>
                </View>

                <View style={styles.siteMetaPillSoft}>
                  <Text style={styles.siteMetaSoftText}>
                    {group.site === "Unassigned"
                      ? "Needs review"
                      : `Site ${index + 1}`}
                  </Text>
                </View>
              </View>

              <View style={styles.siteArrowWrap}>
                <Text style={styles.siteArrowText}>View</Text>
                <Text style={styles.siteCardArrow}>›</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F6F8FB",
  },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 48,
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
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  floatingBackIcon: {
    fontSize: 28,
    color: "#111827",
    fontWeight: "600",
    marginTop: -2,
  },

  projectCard: {
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 22,
    minHeight: 280,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    position: "relative",
  },

  cardBg: {
    ...StyleSheet.absoluteFillObject,
  },

  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.45,
    transform: [{ skewY: "-6deg" }, { translateY: -20 }],
  },

  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    flexWrap: "wrap",
    opacity: 0.08,
    padding: 4,
  },

  gridDot: {
    width: "10%",
    height: "20%",
    borderWidth: 0.5,
    borderColor: "#ffffff",
  },

  curveTopRight: {
    position: "absolute",
    top: -40,
    right: -30,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  curveBottomLeft: {
    position: "absolute",
    bottom: -36,
    left: -24,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(255,255,255,0.07)",
  },

  cardContent: {
    position: "relative",
    zIndex: 10,
    alignItems: "center",
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 20,
  },

  logoWrap: {
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },

  logoImg: {
    width: 96,
    height: 96,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  logoFallback: {
    width: 96,
    height: 96,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },

  logoEmoji: {
    fontSize: 44,
  },

  projectName: {
    fontSize: 24,
    fontWeight: "900",
    color: "#ffffff",
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 4,
  },

  projectCode: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.65)",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 20,
  },

  separator: {
    width: "80%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginBottom: 20,
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
    height: 34,
    backgroundColor: "rgba(255,255,255,0.18)",
  },

  statLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 5,
  },

  statValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#ffffff",
  },

  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },

  statusPillText: {
    fontSize: 11,
    fontWeight: "800",
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#9CA3AF",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 14,
  },

  siteCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#EEF2F7",
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    overflow: "hidden",
    position: "relative",
  },

  siteCardGlow: {
    position: "absolute",
    top: -30,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
  },

  siteCardTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },

  siteIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
  },

  siteCardIcon: {
    fontSize: 28,
  },

  siteMainInfo: {
    flex: 1,
    paddingRight: 10,
  },

  siteCardName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },

  siteCardSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
    color: "#6B7280",
  },

  nodeBadge: {
    minWidth: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  nodeBadgeText: {
    fontSize: 14,
    fontWeight: "900",
  },

  siteCardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 13,
  },

  siteMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },

  siteMetaPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  siteMetaText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },

  siteMetaPillSoft: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
  },

  siteMetaSoftText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },

  siteArrowWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  siteArrowText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },

  siteCardArrow: {
    fontSize: 22,
    color: "#94A3B8",
    fontWeight: "700",
    marginTop: -1,
  },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
  },

  loadingText: {
    fontSize: 13,
    color: "#9CA3AF",
  },

  emptyWrap: {
    paddingVertical: 40,
    alignItems: "center",
  },

  emptyText: {
    fontSize: 14,
    color: "#9CA3AF",
    fontWeight: "600",
  },
});
