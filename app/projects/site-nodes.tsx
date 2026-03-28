import api, { assetUrl } from "@/lib/api";
import { cacheGet, cacheSet } from "@/lib/cache";
import { tokenStore } from "@/lib/token";
import { Stack, router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

const cardIcon = require("../../assets/images/card-icon.png");

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
};

type SearchRow = { type: "search"; key: string };
type NodeRow = { type: "node"; key: string; node: Node };
type ListRow = SearchRow | NodeRow;

const PRIMARY = "#0A5C3B";
const PRIMARY_DARK = "#064E33";
const PRIMARY_SOFT = "#E7F5EE";
const MINT = "#2F8F63";
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

function getStatusColors(status?: string) {
  switch ((status || "").toLowerCase()) {
    case "completed":
    case "done":
    case "finished":
      return { bg: "#DCFCE7", text: "#166534", ring: "#86EFAC" };
    case "in progress":
      return { bg: "#DCFCE7", text: PRIMARY_DARK, ring: "#6EE7B7" };
    case "ongoing":
      return { bg: "#ECFDF5", text: PRIMARY, ring: "#A7F3D0" };
    case "pending":
      return { bg: "#FEF3C7", text: "#B45309", ring: "#FCD34D" };
    case "priority":
      return { bg: "#FCE7F3", text: "#BE185D", ring: "#F9A8D4" };
    default:
      return { bg: "#F1F5F9", text: "#475569", ring: "#CBD5E1" };
  }
}

function buildLeafletHtml(lat: number, lng: number): string {
  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%;background:#e8f0eb;}
.leaflet-control-zoom,.leaflet-control-attribution{display:none!important;}</style>
</head><body>
<div id="map"></div>
<script>
  var map = L.map('map', {
    center: [${lat}, ${lng}],
    zoom: 15,
    zoomControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    touchZoom: false,
    attributionControl: false
  });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map);
  var icon = L.divIcon({
    html: '<div style="width:18px;height:18px;border-radius:50%;background:#DC2626;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>',
    className: '', iconSize: [18, 18], iconAnchor: [9, 9]
  });
  L.marker([${lat}, ${lng}], { icon: icon }).addTo(map);
</script>
</body></html>`;
}

function NodeMapPreview({
  lat,
  lng,
  height,
}: {
  lat: number | null;
  lng: number | null;
  height: number;
}) {
  if (lat && lng) {
    return (
      <View
        style={{
          height,
          borderRadius: 16,
          overflow: "hidden",
          marginBottom: 12,
        }}
      >
        <WebView
          originWhitelist={["*"]}
          source={{ html: buildLeafletHtml(lat, lng) }}
          style={{ flex: 1 }}
          scrollEnabled={false}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          pointerEvents="none"
        />
      </View>
    );
  }
  return (
    <View
      style={{
        height,
        borderRadius: 16,
        overflow: "hidden",
        marginBottom: 12,
        backgroundColor: "#f4faf6",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Image
        source={cardIcon}
        style={{ width: "65%", height: "65%" }}
        resizeMode="contain"
      />
    </View>
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
  const statusColors = getStatusColors(node.status);
  const lat = node.latitude ? Number(node.latitude) : null;
  const lng = node.longitude ? Number(node.longitude) : null;

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      style={styles.cardWrap}
      onPress={() =>
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
        })
      }
    >
      <View style={styles.siteCard}>

        {/* ── Map / Logo image with border frame ── */}
        <View style={[styles.mapFrame, { borderColor: accentColor + "33" }]}>
          <NodeMapPreview lat={lat} lng={lng} height={110} />
          {/* Node ID overlay on image */}
          <View style={[styles.mapNodeIdBadge, { backgroundColor: accentColor }]}>
            <Text style={styles.mapNodeIdText} numberOfLines={1}>{node.node_id}</Text>
          </View>
        </View>

        {/* ── Status badge centered ── */}
        <View style={styles.statusRow}>
          <View style={[styles.nodeBadge, { backgroundColor: statusColors.bg, borderColor: statusColors.ring }]}>
            <Text style={[styles.nodeBadgeText, { color: statusColors.text }]}>
              {node.status || "Unknown"}
            </Text>
          </View>
        </View>

        {/* ── Info grid ── */}
        <View style={styles.infoGrid}>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardLabel}>📍 Location</Text>
            <Text style={styles.infoCardValue} numberOfLines={1}>
              {location || "—"}
            </Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardLabel}>👥 Team</Text>
            <Text style={styles.infoCardValue} numberOfLines={1}>
              {node.team || "Unassigned"}
            </Text>
          </View>
        </View>

        {node.due_date ? (
          <View style={styles.footerInfoRow}>
            <View style={styles.deadlinePill}>
              <Text style={styles.deadlinePillText}>Due {formatDate(node.due_date)}</Text>
            </View>
          </View>
        ) : null}

        {/* ── Open button centered ── */}
        <View style={styles.siteCardBottom}>
          <View style={[styles.viewBtn, { backgroundColor: accentColor }]}>
            <Text style={styles.viewBtnText}>Open</Text>
            <Text style={styles.siteCardArrow}>›</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function SiteNodesScreen() {
  const { project_id, site, project_name, accent, project_logo } = useLocalSearchParams<{
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
    if (!q) return nodes;

    return nodes.filter((node) => {
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
  }, [nodes, search]);

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

              <View style={styles.projectCard}>
                <View style={styles.headerGlowOne} />
                <View style={styles.headerGlowTwo} />

                <View style={styles.cardContent}>
                  <View style={styles.heroBadge}>
                    <Text style={styles.heroBadgeText}>
                      Please Select Node ID
                    </Text>
                  </View>

                  <View style={styles.heroIconWrap}>
                    <Image
                      source={assetUrl(project_logo) ? { uri: assetUrl(project_logo)! } : cardIcon}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="contain"
                    />
                  </View>

                  <Text style={styles.projectName} numberOfLines={2}>
                    {site || "Site Nodes"}
                  </Text>

                  <Text style={styles.projectCode} numberOfLines={1}>
                    {project_name || "Project"}
                  </Text>

                  <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>Project</Text>
                      <Text style={styles.statValue} numberOfLines={1}>
                        {project_name || "—"}
                      </Text>
                    </View>

                    <View style={styles.statDivider} />

                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>Site</Text>
                      <Text style={styles.statValue} numberOfLines={1}>
                        {site || "—"}
                      </Text>
                    </View>

                    <View style={styles.statDivider} />

                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>Nodes</Text>
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
                      placeholder="Search Node Id"
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
    paddingHorizontal: 10,
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
    borderRadius: 28,
    overflow: "hidden",
    marginBottom: 18,
    minHeight: 250,
    shadowColor: PRIMARY,
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    position: "relative",
    backgroundColor: PRIMARY,
  },

  headerGlowOne: {
    position: "absolute",
    top: -30,
    right: -20,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.09)",
  },

  headerGlowTwo: {
    position: "absolute",
    bottom: -60,
    left: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  cardContent: {
    position: "relative",
    zIndex: 10,
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 28,
    paddingHorizontal: 20,
  },

  heroBadge: {
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 14,
  },

  heroBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },

  heroIconWrap: {
    width: "90%",
    height: 80,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    backgroundColor: "#ffffff",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },

  heroIcon: {
    fontSize: 40,
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
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 20,
  },

  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    justifyContent: "space-around",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
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
    color: "rgba(255,255,255,0.60)",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 5,
  },

  statValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#ffffff",
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
    marginBottom: 12,
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

  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: TEXT_SOFT,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
  },

  cardWrap: {
    marginBottom: 14,
  },

  siteCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: PRIMARY,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    overflow: "hidden",
    position: "relative",
  },

  cardOrbOne: {
    position: "absolute",
    top: -22,
    right: -16,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(10,92,59,0.06)",
  },

  cardOrbTwo: {
    position: "absolute",
    bottom: -32,
    left: -20,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(10,92,59,0.04)",
  },

  siteCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  siteMainInfo: {
    flex: 1,
    paddingRight: 10,
  },

  nodeTopLine: {
    flexDirection: "row",
    alignItems: "center",
  },

  nodeIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "rgba(10,92,59,0.08)",
  },

  nodeIcon: {
    fontSize: 26,
  },

  nodeTextWrap: {
    flex: 1,
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
    fontWeight: "600",
    color: TEXT_SOFT,
  },

  nodeBadge: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },

  nodeBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    textAlign: "center",
  },

  heroStrip: {
    borderRadius: 20,
    minHeight: 92,
    overflow: "hidden",
    justifyContent: "flex-end",
    padding: 14,
    marginBottom: 14,
    position: "relative",
  },

  heroStripGlow: {
    position: "absolute",
    right: -20,
    top: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  heroLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "rgba(255,255,255,0.72)",
    letterSpacing: 1.1,
    marginBottom: 4,
  },

  heroTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },

  infoGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },

  infoCard: {
    flex: 1,
    backgroundColor: PRIMARY_SOFT,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },

  infoCardLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: TEXT_SOFT,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },

  infoCardValue: {
    fontSize: 13,
    fontWeight: "800",
    color: PRIMARY_DARK,
  },

  footerInfoRow: {
    marginBottom: 14,
  },

  deadlinePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F3FBF6",
    borderWidth: 1,
    borderColor: BORDER,
  },

  deadlinePillText: {
    fontSize: 12,
    fontWeight: "700",
    color: PRIMARY,
  },

  siteCardBottom: {
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#ECF3EE",
    paddingTop: 13,
  },

  siteArrowText: {
    fontSize: 12,
    fontWeight: "700",
    color: TEXT_SOFT,
  },

  viewBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 32,
    width: "70%",
  },

  viewBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.6,
  },

  siteCardArrow: {
    fontSize: 20,
    color: "#FFFFFF",
    fontWeight: "700",
    marginTop: -1,
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

  mapFrame: {
    borderRadius: 18,
    borderWidth: 2,
    overflow: "hidden",
    marginBottom: 12,
    position: "relative",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },

  mapNodeIdBadge: {
    position: "absolute",
    bottom: 10,
    left: 10,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  mapNodeIdText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },

  statusRow: {
    alignItems: "center",
    marginBottom: 12,
  },
});
