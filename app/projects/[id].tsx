import api, { assetUrl } from "@/lib/api";
import { cacheGet, cacheSet } from "@/lib/cache";
import { projectStore } from "@/lib/store";
import { tokenStore } from "@/lib/token";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
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

const BRAND = {
  primary: "#00704A",
  primaryDark: "#005C3D",
  primarySoft: "#0C8A5C",
  mintSoft: "#F2FBF7",
  lightBlue: "#D9F0FF",
  skySoft: "#EEF8FF",
  ink: "#103126",
  muted: "#6B7280",
  white: "#FFFFFF",
  border: "#E2EEF0",
  bg: "#F4FBF8",
};

const TELCO_LOGO = require("@/assets/images/telco-mainlogo.png");
const LINEMAN_BG = require("@/assets/images/lineman.png");

function getProjectColors(status: string) {
  switch (status) {
    case "Priority":
      return {
        base: BRAND.primary,
        overlay: BRAND.primarySoft,
        pillBg: "#DCFCE7",
        pillText: "#166534",
      };
    case "In Progress":
      return {
        base: BRAND.primary,
        overlay: "#17A673",
        pillBg: "#DDF7EE",
        pillText: BRAND.primaryDark,
      };
    case "Ongoing":
      return {
        base: "#0B8F63",
        overlay: "#53C69A",
        pillBg: "#DDF7EE",
        pillText: BRAND.primaryDark,
      };
    case "Pending":
      return {
        base: "#0E7490",
        overlay: "#38BDF8",
        pillBg: "#E0F2FE",
        pillText: "#075985",
      };
    default:
      return {
        base: BRAND.primary,
        overlay: BRAND.primarySoft,
        pillBg: "#DDF7EE",
        pillText: BRAND.primaryDark,
      };
  }
}

function AnimatedSiteCard({
  children,
  index,
}: {
  children: React.ReactNode;
  index: number;
}) {
  const fade = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(28)).current;
  const scale = useRef(new Animated.Value(0.985)).current;

  useEffect(() => {
    const delay = 120 + index * 500;

    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 460,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 460,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 460,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, index, scale, translateY]);

  return (
    <Animated.View
      style={{
        opacity: fade,
        transform: [{ translateY }, { scale }],
      }}
    >
      {children}
    </Animated.View>
  );
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const project = projectStore.get().find((p) => String(p.id) === id);
  const colors = getProjectColors(project?.status ?? "");
  const projectLogoUri = assetUrl(project?.project_logo);

  const [nodes, setNodes] = useState<Node[]>([]);
  const [loadingNodes, setLoadingNodes] = useState(true);

  const heroFade = useRef(new Animated.Value(0)).current;
  const heroTranslate = useRef(new Animated.Value(22)).current;
  const heroScale = useRef(new Animated.Value(0.985)).current;
  const heroFloat = useRef(new Animated.Value(0)).current;
  const viewPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroFade, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(heroTranslate, {
        toValue: 0,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(heroScale, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(heroFloat, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(heroFloat, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(viewPulse, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(viewPulse, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ]),
    ).start();
  }, [heroFade, heroFloat, heroScale, heroTranslate, viewPulse]);

  const animatedViewBg = viewPulse.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(0,112,74,0.08)", "rgba(0,112,74,0.16)"],
  });

  const animatedViewBorder = viewPulse.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(0,112,74,0.14)", "rgba(0,112,74,0.28)"],
  });

  const heroFloatTranslate = heroFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -6],
  });

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
      <View style={styles.backFloatingWrap}>
        <Pressable onPress={() => router.back()} style={styles.floatingBackBtn}>
          <Text style={styles.floatingBackIcon}>‹</Text>
        </Pressable>
      </View>

      <FlatList
        data={siteGroups}
        keyExtractor={(g) => g.site}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <Animated.View
              style={{
                opacity: heroFade,
                transform: [
                  { translateY: heroTranslate },
                  { scale: heroScale },
                  { translateY: heroFloatTranslate },
                ],
              }}
            >
              <View style={styles.projectCard}>
                <View
                  style={[styles.cardBg, { backgroundColor: colors.base }]}
                />
                <View
                  style={[
                    styles.cardGradientTop,
                    { backgroundColor: colors.overlay },
                  ]}
                />
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
                    <Text style={styles.heroBadgeText}>PROJECT OVERVIEW</Text>
                  </View>

                  {projectLogoUri ? (
                    <Image
                      source={{ uri: projectLogoUri }}
                      style={styles.heroProjectLogoStandalone}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.heroProjectLogoFallbackStandalone}>
                      <Text style={styles.heroProjectLogoFallbackText}>
                        {(project?.project_name?.[0] ?? "P").toUpperCase()}
                      </Text>
                    </View>
                  )}

                  <Text style={styles.projectName}>
                    {project?.project_name}
                  </Text>
                  <Text style={styles.projectCode}>
                    {project?.project_code}
                  </Text>

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
            </Animated.View>

            <Text style={styles.sectionLabel}>Sites</Text>

            {loadingNodes && nodes.length === 0 && (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={BRAND.primary} size="small" />
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
          <AnimatedSiteCard index={index}>
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
                  { backgroundColor: `${colors.base}12` },
                ]}
              />
              <View style={styles.siteCardGlowBlue} />

              <View style={styles.siteCardTop}>
                <View style={styles.siteIconWrap}>
                  <Image
                    source={TELCO_LOGO}
                    style={styles.siteCardLogo}
                    resizeMode="contain"
                  />
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
                        : "Ready to open"}
                    </Text>
                  </View>
                </View>

                <Animated.View
                  style={[
                    styles.viewButton,
                    {
                      backgroundColor: animatedViewBg,
                      borderColor: animatedViewBorder,
                    },
                  ]}
                >
                  <Text style={styles.viewButtonText}>View</Text>
                </Animated.View>
              </View>
            </TouchableOpacity>
          </AnimatedSiteCard>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },

  backFloatingWrap: {
    position: "absolute",
    top: 49,
    left: 16,
    zIndex: 50,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 84,
    paddingBottom: 48,
  },

  floatingBackBtn: {
    width: 48,
    height: 48,
    borderRadius: 20,
    backgroundColor: BRAND.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: BRAND.border,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  floatingBackIcon: {
    fontSize: 28,
    color: BRAND.primary,
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
  },

  cardGradientTop: {
    position: "absolute",
    top: -30,
    left: -30,
    right: -30,
    height: 210,
    opacity: 0.45,
    transform: [{ skewY: "-8deg" }],
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

  heroLinemanFull: {
    position: "absolute",
    left: -38,
    top: -45,
    width: 300,
    height: 470,
    opacity: 5,
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
    backgroundColor: BRAND.white,
  },

  heroProjectLogoFallbackStandalone: {
    width: "100%",
    height: 190,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    marginBottom: 18,
  },

  heroProjectLogoFallback: {
    width: 100,
    height: 100,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  heroProjectLogoFallbackText: {
    fontSize: 42,
    fontWeight: "900",
    color: BRAND.white,
  },

  projectName: {
    fontSize: 25,
    fontWeight: "900",
    color: BRAND.white,
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
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 5,
  },

  statValue: {
    fontSize: 13,
    fontWeight: "800",
    color: BRAND.white,
  },

  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },

  statusPillText: {
    fontSize: 11,
    fontWeight: "800",
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6B8A7D",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 14,
  },

  siteCard: {
    backgroundColor: BRAND.white,
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    overflow: "hidden",
    position: "relative",
  },

  siteCardGlow: {
    position: "absolute",
    top: -26,
    right: -18,
    width: 118,
    height: 118,
    borderRadius: 59,
  },

  siteCardGlowBlue: {
    position: "absolute",
    bottom: -26,
    left: -18,
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(169,220,255,0.18)",
  },

  siteCardTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },

  siteIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "rgba(0,112,74,0.10)",
    backgroundColor: "rgba(0,112,74,0.05)",
  },

  siteCardLogo: {
    width: 32,
    height: 32,
    tintColor: BRAND.primary,
  },

  siteMainInfo: {
    flex: 1,
    paddingRight: 10,
  },

  siteCardName: {
    fontSize: 17,
    fontWeight: "800",
    color: BRAND.ink,
    marginBottom: 4,
  },

  siteCardSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
    color: BRAND.muted,
  },

  siteCardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#EEF5F4",
    paddingTop: 13,
  },

  siteMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    flex: 1,
    paddingRight: 8,
  },

  siteMetaPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: BRAND.mintSoft,
    borderWidth: 1,
    borderColor: "#D9EFE6",
  },

  siteMetaText: {
    fontSize: 12,
    fontWeight: "700",
    color: BRAND.primaryDark,
  },

  siteMetaPillSoft: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: BRAND.skySoft,
  },

  siteMetaSoftText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0C6E90",
  },

  viewButton: {
    minWidth: 56,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  viewButtonText: {
    fontSize: 11,
    fontWeight: "900",
    color: BRAND.primary,
    letterSpacing: 0.2,
  },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
  },

  loadingText: {
    fontSize: 13,
    color: BRAND.muted,
  },

  emptyWrap: {
    paddingVertical: 40,
    alignItems: "center",
  },

  emptyText: {
    fontSize: 14,
    color: BRAND.muted,
    fontWeight: "600",
  },
});
