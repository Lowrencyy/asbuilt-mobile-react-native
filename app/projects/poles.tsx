import api from "@/lib/api";
import { cacheGet, cacheSet } from "@/lib/cache";
import { Stack, router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Pole = {
  id: number;
  pole_code: string;
  pole_name: string | null;
  slot: string | null;
  status: string;
  remarks: string | null;
  completed_at: string | null;
  map_latitude: string | null;
  map_longitude: string | null;
};

type SearchRow = { type: "search"; key: string };
type PoleRow = { type: "pole"; key: string; pole: Pole };
type ListRow = SearchRow | PoleRow;

function getPillStyle(status: string) {
  switch (status) {
    case "In Progress":
      return { bg: "#E0E7FF", text: "#4338CA" };
    case "Assigned":
      return { bg: "#DCFCE7", text: "#166534" };
    case "Completed":
      return { bg: "#D1FAE5", text: "#065F46" };
    case "Pending":
      return { bg: "#FEF3C7", text: "#B45309" };
    default:
      return { bg: "#F3F4F6", text: "#374151" };
  }
}

function PoleCard({
  pole,
  accentColor,
  nodeId,
  projectId,
  projectName,
}: {
  pole: Pole;
  accentColor: string;
  nodeId: string;
  projectId: string;
  projectName: string;
}) {
  const pill = getPillStyle(pole.status);
  const label = pole.pole_name || pole.pole_code;

  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    if (!pole.map_latitude || !pole.map_longitude) return;
    
    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${pole.map_latitude}&lon=${pole.map_longitude}&format=json`,
      {
        headers: {
          "Accept-Language": "en",
          "User-Agent": "TelcoVantage/1.0",
        },
      },
    )
      .then((r) => r.json())
      .then((data) => {
        const a = data?.address;
        if (!a) return;
        const street =
          a.road ??
          a.pedestrian ??
          a.footway ??
          a.street ??
          a.path ??
          a.neighbourhood ??
          a.suburb ??
          a.village ??
          a.city_district ??
          a.quarter ??
          null;
        setAddress(street);
      })
      .catch(() => {});
  }, [pole.map_latitude, pole.map_longitude]);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() =>
        router.push({
          pathname: "/projects/pole-detail",
          params: {
            pole_id: String(pole.id),
            pole_code: pole.pole_code,
            pole_name: pole.pole_name || pole.pole_code,
            node_id: nodeId,
            project_id: projectId,
            project_name: projectName,
            accent: accentColor,
          },
        })
      }
      style={styles.cardWrap}
    >
      <View style={styles.siteCard}>
        <View
          style={[styles.siteCardGlow, { backgroundColor: `${accentColor}10` }]}
        />

        <View style={styles.siteCardTop}>
          <View
            style={[
              styles.siteIconWrap,
              {
                backgroundColor: `${accentColor}18`,
                borderColor: `${accentColor}25`,
              },
            ]}
          >
            <Text style={styles.siteCardIcon}>🔌</Text>
          </View>

          <View style={styles.siteMainInfo}>
            <Text style={styles.siteCardName} numberOfLines={1}>
              {label}
            </Text>
            <Text style={styles.siteCardSubtitle} numberOfLines={1}>
              {pole.pole_code}
            </Text>
          </View>

          <View style={[styles.nodeBadge, { backgroundColor: pill.bg }]}>
            <Text style={[styles.nodeBadgeText, { color: pill.text }]}>
              {pole.status}
            </Text>
          </View>
        </View>

        <View style={styles.siteCardBody}>
          <View style={[styles.heroStrip, { backgroundColor: accentColor }]}>
            <View style={styles.heroGrid}>
              {Array.from({ length: 24 }).map((_, i) => (
                <View key={i} style={styles.heroDot} />
              ))}
            </View>

            <Text style={styles.heroLabel}>POLE</Text>
            <Text style={styles.heroTitle} numberOfLines={1}>
              {label}
            </Text>
          </View>
        </View>

        <View style={styles.siteMetaBlock}>
          {pole.slot ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>🧩</Text>
              <Text style={styles.infoText} numberOfLines={1}>
                Slot: {pole.slot}
              </Text>
            </View>
          ) : null}

          {pole.map_latitude && pole.map_longitude ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>📍</Text>
              <Text style={styles.infoText} numberOfLines={2}>
                {address ?? `${pole.map_latitude}, ${pole.map_longitude}`}
              </Text>
            </View>
          ) : null}

          <View style={styles.siteMetaRow}>
            {pole.completed_at ? (
              <View style={styles.siteMetaPill}>
                <Text style={styles.siteMetaText}>✅ Completed</Text>
              </View>
            ) : null}

            {pole.remarks ? (
              <View style={styles.siteMetaPillSoft}>
                <Text style={styles.siteMetaSoftText} numberOfLines={1}>
                  {pole.remarks}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.siteCardBottom}>
          <Text style={styles.siteArrowText}>Tap to view details</Text>
          <View style={[styles.viewBtn, { backgroundColor: accentColor }]}>
            <Text style={styles.viewBtnText}>View</Text>
            <Text style={styles.siteCardArrow}>›</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function PolesScreen() {
  const { node_id, node_name, node_code, accent, project_id, project_name } =
    useLocalSearchParams<{
      node_id: string;
      node_name: string;
      node_code: string;
      accent: string;
      project_id: string;
      project_name: string;
    }>();

  const accentColor = accent || "#334155";
  const projectId = project_id ?? "";
  const projectName = project_name ?? "";

  const [poles, setPoles] = useState<Pole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");

  function applyFilter(raw: Pole[]) {
    return raw.filter((p) => p.status?.toLowerCase() !== "completed");
  }

  function loadPoles(forceRefresh = false) {
    const CACHE_KEY = `poles_node_${node_id}`;

    // 1. Show cached data immediately (no spinner if we have cache)
    if (!forceRefresh) {
      cacheGet<Pole[]>(CACHE_KEY).then((cached) => {
        if (cached?.length) {
          setPoles(applyFilter(cached));
          setLoading(false);
        }
      });
    }

    // 2. Always fetch fresh data in background
    api
      .get(`/nodes/${node_id}/poles`)
      .then(({ data }) => {
        const raw: Pole[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
            ? data.data
            : [];
        cacheSet(CACHE_KEY, raw);
        setPoles(applyFilter(raw));
        setLoading(false);
        setError(false);
      })
      .catch(() => {
        // No internet — only show error if we have no cached data
        cacheGet<Pole[]>(CACHE_KEY).then((cached) => {
          if (!cached?.length) setError(true);
          setLoading(false);
        });
      });
  }

  useEffect(() => { loadPoles(); }, [node_id]);

  const filteredPoles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return poles;

    return poles.filter((pole) => {
      const haystack = [
        pole.pole_code,
        pole.pole_name,
        pole.slot,
        pole.status,
        pole.remarks,
        pole.map_latitude,
        pole.map_longitude,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [poles, search]);

  const listData = useMemo<ListRow[]>(
    () => [
      { type: "search", key: "search-row" },
      ...filteredPoles.map((pole) => ({
        type: "pole" as const,
        key: String(pole.id),
        pole,
      })),
    ],
    [filteredPoles],
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.root} edges={["top"]}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={accentColor} size="large" />
            <Text style={styles.loadingText}>Loading poles...</Text>
          </View>
        ) : error ? (
          <View style={styles.loadingWrap}>
            <Text style={{ fontSize: 36, marginBottom: 10 }}>⚠️</Text>
            <Text style={[styles.loadingText, { color: "#374151", fontWeight: "700" }]}>Could not load poles.</Text>
            <TouchableOpacity
              onPress={() => loadPoles(true)}
              style={{ marginTop: 12, backgroundColor: accentColor, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 12 }}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
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

                <View style={styles.topHeroCard}>
                  <View
                    style={[styles.topHeroBg, { backgroundColor: accentColor }]}
                  />
                  <View
                    style={[
                      styles.topHeroOverlay,
                      { backgroundColor: accentColor },
                    ]}
                  />
                  <View style={styles.topHeroGrid}>
                    {Array.from({ length: 40 }).map((_, i) => (
                      <View key={i} style={styles.topHeroDot} />
                    ))}
                  </View>
                  <View style={styles.topHeroCurveRight} />
                  <View style={styles.topHeroCurveLeft} />

                  <View style={styles.topHeroContent}>
                    <View style={styles.topHeroIconWrap}>
                      <Text style={styles.topHeroIcon}>📡</Text>
                    </View>

                    <Text style={styles.topHeroTitle} numberOfLines={2}>
                      {node_name || node_code || "Poles"}
                    </Text>

                    <Text style={styles.topHeroSub} numberOfLines={1}>
                      {projectName || "Project"}
                    </Text>

                    <View style={styles.topHeroSeparator} />

                    <View style={styles.topHeroStatsRow}>
                      <View style={styles.topHeroStatBox}>
                        <Text style={styles.topHeroStatLabel}>PROJECT</Text>
                        <Text style={styles.topHeroStatValue} numberOfLines={1}>
                          {projectName || "—"}
                        </Text>
                      </View>

                      <View style={styles.topHeroStatDivider} />

                      <View style={styles.topHeroStatBox}>
                        <Text style={styles.topHeroStatLabel}>NODE ID</Text>
                        <Text style={styles.topHeroStatValue} numberOfLines={1}>
                          {node_code || node_id || "—"}
                        </Text>
                      </View>

                      <View style={styles.topHeroStatDivider} />

                      <View style={styles.topHeroStatBox}>
                        <Text style={styles.topHeroStatLabel}>POLES</Text>
                        <Text style={styles.topHeroStatValue}>
                          {filteredPoles.length}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </>
            }
            ListEmptyComponent={null}
            renderItem={({ item }) => {
              if (item.type === "search") {
                return (
                  <View style={styles.stickySearchContainer}>
                    <View style={styles.searchWrap}>
                      <Text style={styles.searchIcon}>⌕</Text>
                      <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Search pole name, code, slot, status..."
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
                      {filteredPoles.length} active pole
                      {filteredPoles.length !== 1 ? "s" : ""}
                    </Text>
                    {filteredPoles.length === 0 && (
                      <View style={styles.emptyWrap}>
                        <Text style={styles.emptyIcon}>
                          {search.trim() ? "🔍" : "✅"}
                        </Text>
                        <Text style={styles.emptyText}>
                          {search.trim()
                            ? "No matching poles found."
                            : "All poles in this node are completed."}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              }

              return (
                <PoleCard
                  pole={item.pole}
                  accentColor={accentColor}
                  nodeId={node_id}
                  projectId={projectId}
                  projectName={projectName}
                />
              );
            }}
          />
        )}
      </SafeAreaView>
    </>
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

  topHeroCard: {
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 18,
    minHeight: 260,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    position: "relative",
  },

  topHeroBg: {
    ...StyleSheet.absoluteFillObject,
  },

  topHeroOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
    transform: [{ skewY: "-6deg" }, { translateY: -20 }],
  },

  topHeroGrid: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    flexWrap: "wrap",
    opacity: 0.08,
    padding: 4,
  },

  topHeroDot: {
    width: "10%",
    height: "20%",
    borderWidth: 0.5,
    borderColor: "#ffffff",
  },

  topHeroCurveRight: {
    position: "absolute",
    top: -40,
    right: -30,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  topHeroCurveLeft: {
    position: "absolute",
    bottom: -36,
    left: -24,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(255,255,255,0.07)",
  },

  topHeroContent: {
    position: "relative",
    zIndex: 10,
    alignItems: "center",
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 20,
  },

  topHeroIconWrap: {
    width: 92,
    height: 92,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.22)",
  },

  topHeroIcon: {
    fontSize: 42,
  },

  topHeroTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#ffffff",
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 4,
  },

  topHeroSub: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 20,
  },

  topHeroSeparator: {
    width: "80%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginBottom: 20,
  },

  topHeroStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    justifyContent: "space-around",
  },

  topHeroStatBox: {
    alignItems: "center",
    flex: 1,
  },

  topHeroStatDivider: {
    width: 1,
    height: 34,
    backgroundColor: "rgba(255,255,255,0.18)",
  },

  topHeroStatLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 5,
  },

  topHeroStatValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#ffffff",
  },

  stickySearchContainer: {
    backgroundColor: "#F6F8FB",
    paddingTop: 2,
    paddingBottom: 10,
  },

  searchWrap: {
    height: 54,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7ECF3",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 12,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  searchIcon: {
    fontSize: 18,
    color: "#94A3B8",
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
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  clearBtnText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "800",
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#9CA3AF",
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
    maxWidth: 110,
    minHeight: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  nodeBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "center",
  },

  siteCardBody: {
    marginBottom: 14,
  },

  heroStrip: {
    borderRadius: 18,
    minHeight: 96,
    overflow: "hidden",
    justifyContent: "flex-end",
    padding: 14,
  },

  heroGrid: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    flexWrap: "wrap",
    opacity: 0.1,
    padding: 4,
  },

  heroDot: {
    width: "12.5%",
    height: "25%",
    borderWidth: 0.5,
    borderColor: "#fff",
  },

  heroLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 1.1,
    marginBottom: 4,
  },

  heroTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },

  siteMetaBlock: {
    marginBottom: 14,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },

  infoIcon: {
    fontSize: 14,
    marginRight: 6,
    marginTop: 1,
  },

  infoText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
    lineHeight: 18,
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
    backgroundColor: "#D1FAE5",
  },

  siteMetaText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#065F46",
  },

  siteMetaPillSoft: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    maxWidth: "100%",
  },

  siteMetaSoftText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },

  siteCardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 13,
  },

  siteArrowText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },

  viewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
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

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },

  loadingText: {
    fontSize: 13,
    color: "#9CA3AF",
  },

  emptyWrap: {
    paddingVertical: 60,
    alignItems: "center",
    gap: 8,
  },

  emptyIcon: {
    fontSize: 40,
  },

  emptyText: {
    fontSize: 14,
    color: "#9CA3AF",
    fontWeight: "600",
  },
});
