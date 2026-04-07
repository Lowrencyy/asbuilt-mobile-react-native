import api, { assetUrl } from "@/lib/api";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type LogImage = {
  id: number;
  type?: string;
  field?: string;
  field_name?: string;
  image_type?: string;
  photo_type?: string;
  path?: string;
  url?: string;
  file_path?: string;
  image_path?: string;
};

type LogDetail = {
  id: number;
  status: string;
  created_at: string;
  started_at?: string;
  finished_at?: string;
  collected_cable?: number;
  recovered_cable?: number;
  unrecovered_cable?: number;
  unrecovered_reason?: string;
  cable_reason?: string;
  expected_cable?: number;
  actual_runs?: number;
  declared_runs?: number;
  collected_node?: number;
  collected_amplifier?: number;
  collected_extender?: number;
  collected_tsc?: number;
  collected_powersupply?: number;
  collected_powersupply_housing?: number;
  expected_node?: number;
  expected_amplifier?: number;
  expected_extender?: number;
  expected_tsc?: number;
  expected_powersupply?: number;
  expected_powersupply_housing?: number;
  captured_latitude?: number | string | null;
  captured_longitude?: number | string | null;
  gps_accuracy_meters?: number | string | null;
  captured_at_device?: string;
  synced_at_server?: string | null;
  gps_source?: string | null;
  offline_mode?: number | boolean | null;
  destination_slot?: string;
  destination_landmark?: string;
  submitted_by?: string;
  images?: LogImage[];
  teardown_log_images?: LogImage[];
  photos?: LogImage[];
  pole_span?: {
    pole_span_code?: string;
    from_pole?: { pole_code: string; pole_name?: string };
    to_pole?: { pole_code: string; pole_name?: string };
  };
  span?: {
    pole_span_code?: string;
    from_pole?: { pole_code: string; pole_name?: string };
    to_pole?: { pole_code: string; pole_name?: string };
  };
  to_pole?: { pole_code: string; pole_name?: string };
  node?: { node_id: string; node_name?: string };
};

const n2 = (v: unknown) => (v == null || v === "" ? 0 : Number(v) || 0);
const fmtLen = (v: number) => (v ? `${v.toLocaleString()} m` : "—");

function resolvePhoto(path?: string): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return assetUrl(path);
}

function findImage(log: LogDetail, fieldName: string): string | null {
  const list = log.images ?? log.teardown_log_images ?? log.photos ?? [];
  const img = list.find((i) => {
    const key =
      i.type ?? i.field ?? i.field_name ?? i.image_type ?? i.photo_type ?? "";
    return key === fieldName;
  });
  if (!img) return null;
  const raw = img.url ?? img.path ?? img.file_path ?? img.image_path ?? "";
  return resolvePhoto(raw) ?? null;
}

function fmtTime(s?: string) {
  if (!s) return "—";
  return new Date(s).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function InfoPill({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoPill}>
      <Ionicons name={icon} size={14} color="#667085" />
      <View style={{ marginLeft: 8 }}>
        <Text style={styles.infoPillLabel}>{label}</Text>
        <Text style={styles.infoPillValue}>{value}</Text>
      </View>
    </View>
  );
}

function StatChip({
  title,
  value,
  tone = "blue",
}: {
  title: string;
  value: string | number;
  tone?: "blue" | "green" | "violet" | "amber";
}) {
  const palette = {
    blue: { bg: "#EEF4FF", fg: "#1D4ED8" },
    green: { bg: "#ECFDF3", fg: "#067647" },
    violet: { bg: "#F5F3FF", fg: "#6D28D9" },
    amber: { bg: "#FFF7E8", fg: "#B54708" },
  }[tone];

  return (
    <View style={[styles.statChip, { backgroundColor: palette.bg }]}>
      <Text style={styles.statChipTitle}>{title}</Text>
      <Text style={[styles.statChipValue, { color: palette.fg }]}>{value}</Text>
    </View>
  );
}

function DetailRow({
  label,
  value,
  noBorder = false,
}: {
  label: string;
  value: string;
  noBorder?: boolean;
}) {
  return (
    <View style={[styles.detailRow, noBorder && styles.detailRowLast]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function PhotoTile({
  label,
  uri,
  onPress,
}: {
  label: string;
  uri: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={styles.photoTileWrap}
      onPress={uri ? onPress : undefined}
      disabled={!uri}
    >
      <Text style={styles.photoLabel}>{label}</Text>
      {uri ? (
        <Image source={{ uri }} style={styles.photoTile} contentFit="cover" />
      ) : (
        <View style={[styles.photoTile, styles.photoEmpty]}>
          <Ionicons name="image-outline" size={22} color="#98A2B3" />
          <Text style={styles.photoEmptyText}>No photo</Text>
        </View>
      )}
    </Pressable>
  );
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <MaterialCommunityIcons name={icon} size={18} color="#0F172A" />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export default function LogDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [log, setLog] = useState<LogDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .get(`/teardown-logs/${id}`)
      .then(({ data }) => setLog(data.data ?? data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  const fromCode =
    log?.pole_span?.from_pole?.pole_code ??
    log?.span?.from_pole?.pole_code ??
    "—";

  const toCode =
    log?.pole_span?.to_pole?.pole_code ??
    log?.span?.to_pole?.pole_code ??
    log?.to_pole?.pole_code ??
    "—";

  const cable = n2(log?.collected_cable ?? log?.recovered_cable);

  const colNode = n2(log?.collected_node);
  const colAmp = n2(log?.collected_amplifier);
  const colExt = n2(log?.collected_extender);
  const colTsc = n2(log?.collected_tsc);

  const exNode = n2(log?.expected_node);
  const exAmp = n2(log?.expected_amplifier);
  const exExt = n2(log?.expected_extender);
  const exTsc = n2(log?.expected_tsc);

  const hasUnrecovered = n2(log?.unrecovered_cable) > 0;

  const gpsMeta = useMemo(() => {
    if (log?.captured_latitude == null || log?.captured_longitude == null) {
      return null;
    }

    const lat = Number(log.captured_latitude).toFixed(6);
    const lng = Number(log.captured_longitude).toFixed(6);
    const accVal =
      log.gps_accuracy_meters != null ? Number(log.gps_accuracy_meters) : null;

    const acc =
      accVal != null
        ? accVal <= 5
          ? {
              label: `Excellent ±${accVal.toFixed(1)}m`,
              bg: "#ECFDF3",
              text: "#067647",
            }
          : accVal <= 15
            ? {
                label: `Good ±${accVal.toFixed(1)}m`,
                bg: "#EEF4FF",
                text: "#1D4ED8",
              }
            : accVal <= 50
              ? {
                  label: `Fair ±${accVal.toFixed(1)}m`,
                  bg: "#FFF7E8",
                  text: "#B54708",
                }
              : {
                  label: `Poor ±${accVal.toFixed(1)}m`,
                  bg: "#FEF3F2",
                  text: "#B42318",
                }
        : null;

    const src = log.gps_source;
    const isManual = src === "manual";
    const isOffline = log.offline_mode === 1 || log.offline_mode === true;

    return {
      lat,
      lng,
      acc,
      src,
      isManual,
      isOffline,
    };
  }, [log]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        {loading && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#0B7A5A" />
          </View>
        )}

        {error && (
          <View style={styles.center}>
            <View style={styles.errorIconWrap}>
              <Ionicons name="alert-circle-outline" size={34} color="#B42318" />
            </View>
            <Text style={styles.errorTitle}>Could not load teardown log</Text>
            <Text style={styles.errorBody}>
              Please try again or go back to the previous screen.
            </Text>
            <Pressable onPress={() => router.back()} style={styles.goBackBtn}>
              <Text style={styles.goBackText}>Go Back</Text>
            </Pressable>
          </View>
        )}

        {!loading && !error && log && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
          >
            <View style={styles.topBar}>
              <Pressable onPress={() => router.back()} style={styles.iconBtn}>
                <Ionicons name="chevron-back" size={22} color="#111827" />
              </Pressable>

              <View style={styles.topBarCenter}>
                <Text style={styles.topBarTitle}>Teardown Log</Text>
                <Text style={styles.topBarSub}>Log #{log.id}</Text>
              </View>

              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>
                  {log.status || "Submitted"}
                </Text>
              </View>
            </View>

            <View style={styles.heroCard}>
              <View style={styles.heroGlowOne} />
              <View style={styles.heroGlowTwo} />

              <Text style={styles.heroKicker}>Span Summary</Text>

              <View style={styles.spanRow}>
                <View style={styles.poleCard}>
                  <View
                    style={[styles.poleBubble, { backgroundColor: "#1D4ED8" }]}
                  >
                    <Text style={styles.poleBubbleText} numberOfLines={1}>
                      {fromCode.replace(/^[A-Z0-9]+-/, "")}
                    </Text>
                  </View>
                  <Text style={styles.poleCode} numberOfLines={1}>
                    {fromCode}
                  </Text>
                  <Text style={styles.poleHint}>Starting Pole</Text>
                </View>

                <View style={styles.cableCenter}>
                  <View style={styles.cableLine} />
                  <View style={styles.cableBadge}>
                    <Text style={styles.cableBadgeValue}>{fmtLen(cable)}</Text>
                    <Text style={styles.cableBadgeHint}>Collected</Text>
                  </View>
                  <View style={styles.cableLine} />
                </View>

                <View style={styles.poleCard}>
                  <View
                    style={[styles.poleBubble, { backgroundColor: "#10B981" }]}
                  >
                    <Text style={styles.poleBubbleText} numberOfLines={1}>
                      {toCode.replace(/^[A-Z0-9]+-/, "")}
                    </Text>
                  </View>
                  <Text style={styles.poleCode} numberOfLines={1}>
                    {toCode}
                  </Text>
                  <Text style={styles.poleHint}>Destination Pole</Text>
                </View>
              </View>

              <View style={styles.heroInfoRow}>
                <InfoPill
                  icon="play-circle-outline"
                  label="Started"
                  value={fmtTime(log.started_at)}
                />
                <InfoPill
                  icon="checkmark-circle-outline"
                  label="Finished"
                  value={fmtTime(log.finished_at)}
                />
              </View>
            </View>

            {gpsMeta && (
              <SectionCard title="Captured GPS" icon="crosshairs-gps">
                <View style={styles.gpsCard}>
                  <View style={styles.gpsTop}>
                    <View style={styles.gpsPin}>
                      <Ionicons name="location" size={18} color="#067647" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.gpsCoords}>
                        {gpsMeta.lat}, {gpsMeta.lng}
                      </Text>
                      <Text style={styles.gpsSub}>
                        Captured on device during teardown
                      </Text>
                    </View>
                  </View>

                  <View style={styles.gpsMetaWrap}>
                    {gpsMeta.acc ? (
                      <View
                        style={[
                          styles.metaMiniBadge,
                          { backgroundColor: gpsMeta.acc.bg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.metaMiniBadgeText,
                            { color: gpsMeta.acc.text },
                          ]}
                        >
                          {gpsMeta.acc.label}
                        </Text>
                      </View>
                    ) : null}

                    {gpsMeta.src ? (
                      <View
                        style={[
                          styles.metaMiniBadge,
                          {
                            backgroundColor: gpsMeta.isManual
                              ? "#FFF7E8"
                              : "#EEF4FF",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.metaMiniBadgeText,
                            {
                              color: gpsMeta.isManual ? "#B54708" : "#1D4ED8",
                            },
                          ]}
                        >
                          {gpsMeta.isManual ? "Manually Added" : "Device GPS"}
                        </Text>
                      </View>
                    ) : null}

                    {gpsMeta.isOffline ? (
                      <View
                        style={[
                          styles.metaMiniBadge,
                          { backgroundColor: "#FEF3F2" },
                        ]}
                      >
                        <Text
                          style={[
                            styles.metaMiniBadgeText,
                            { color: "#B42318" },
                          ]}
                        >
                          Offline
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </SectionCard>
            )}

            <SectionCard title="Collected Components" icon="cube-outline">
              <View style={styles.statRow}>
                <StatChip
                  title="Node"
                  value={`${colNode}/${exNode}`}
                  tone="blue"
                />
                <StatChip
                  title="AMP"
                  value={`${colAmp}/${exAmp}`}
                  tone="green"
                />
                <StatChip
                  title="EXT"
                  value={`${colExt}/${exExt}`}
                  tone="violet"
                />
                <StatChip
                  title="TSC"
                  value={`${colTsc}/${exTsc}`}
                  tone="amber"
                />
              </View>
            </SectionCard>

            {hasUnrecovered && (
              <SectionCard title="Unrecovered Cable" icon="alert-outline">
                <View style={styles.warningBox}>
                  <View style={styles.warningTop}>
                    <Text style={styles.warningTitle}>Attention Required</Text>
                    <Text style={styles.warningValue}>
                      {fmtLen(n2(log.unrecovered_cable))}
                    </Text>
                  </View>

                  {(log.unrecovered_reason ?? log.cable_reason) ? (
                    <View style={styles.reasonCard}>
                      <Text style={styles.reasonLabel}>Reason</Text>
                      <Text style={styles.reasonText}>
                        {log.unrecovered_reason ?? log.cable_reason}
                      </Text>
                    </View>
                  ) : null}

                  {findImage(log, "before_span") && (
                    <Pressable
                      onPress={() => {
                        const u = findImage(log, "before_span");
                        if (u) setViewerUri(u);
                      }}
                      style={styles.previewWideWrap}
                    >
                      <Image
                        source={{ uri: findImage(log, "before_span")! }}
                        style={styles.previewWide}
                        contentFit="cover"
                      />
                    </Pressable>
                  )}
                </View>
              </SectionCard>
            )}

            <SectionCard
              title={`${fromCode} • Starting Pole`}
              icon="image-outline"
            >
              <View style={styles.photoGrid}>
                <PhotoTile
                  label="Before"
                  uri={findImage(log, "from_before")}
                  onPress={() => setViewerUri(findImage(log, "from_before"))}
                />
                <PhotoTile
                  label="After"
                  uri={findImage(log, "from_after")}
                  onPress={() => setViewerUri(findImage(log, "from_after"))}
                />
                <PhotoTile
                  label="Pole Tag"
                  uri={findImage(log, "from_tag")}
                  onPress={() => setViewerUri(findImage(log, "from_tag"))}
                />
              </View>
            </SectionCard>

            <SectionCard
              title={`${toCode} • Destination Pole`}
              icon="image-multiple-outline"
            >
              <View style={styles.photoGrid}>
                <PhotoTile
                  label="Before"
                  uri={findImage(log, "to_before")}
                  onPress={() => setViewerUri(findImage(log, "to_before"))}
                />
                <PhotoTile
                  label="After"
                  uri={findImage(log, "to_after")}
                  onPress={() => setViewerUri(findImage(log, "to_after"))}
                />
                <PhotoTile
                  label="Pole Tag"
                  uri={findImage(log, "to_tag")}
                  onPress={() => setViewerUri(findImage(log, "to_tag"))}
                />
              </View>
            </SectionCard>

            {(log.destination_slot ||
              log.destination_landmark ||
              log.submitted_by ||
              log.cable_reason) && (
              <SectionCard
                title="Additional Details"
                icon="file-document-outline"
              >
                {log.destination_slot ? (
                  <DetailRow label="Slot" value={log.destination_slot} />
                ) : null}
                {log.destination_landmark ? (
                  <DetailRow
                    label="Landmark"
                    value={log.destination_landmark}
                  />
                ) : null}
                {log.submitted_by ? (
                  <DetailRow label="Submitted by" value={log.submitted_by} />
                ) : null}
                {log.cable_reason ? (
                  <DetailRow
                    label="Cable reason"
                    value={log.cable_reason}
                    noBorder
                  />
                ) : null}
              </SectionCard>
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      <Modal
        visible={!!viewerUri}
        animationType="fade"
        onRequestClose={() => setViewerUri(null)}
      >
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <View style={styles.viewerRoot}>
          <Pressable
            onPress={() => setViewerUri(null)}
            style={styles.viewerClose}
          >
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </Pressable>

          {viewerUri && (
            <Image
              source={{ uri: viewerUri }}
              style={styles.viewerImage}
              contentFit="contain"
            />
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F4F6F8",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },

  errorIconWrap: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF3F2",
    marginBottom: 16,
  },

  errorTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#111827",
  },

  errorBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    color: "#667085",
  },

  goBackBtn: {
    marginTop: 18,
    height: 48,
    paddingHorizontal: 22,
    borderRadius: 16,
    backgroundColor: "#0B7A5A",
    alignItems: "center",
    justifyContent: "center",
  },

  goBackText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },

  scroll: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 42,
    gap: 14,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },

  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7ECF2",
    alignItems: "center",
    justifyContent: "center",
  },

  topBarCenter: {
    flex: 1,
    marginLeft: 12,
  },

  topBarTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },

  topBarSub: {
    marginTop: 2,
    fontSize: 12,
    color: "#667085",
  },

  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#ECFDF3",
    borderWidth: 1,
    borderColor: "#D1FADF",
  },

  statusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#067647",
    textTransform: "capitalize",
  },

  heroCard: {
    borderRadius: 28,
    padding: 20,
    backgroundColor: "#13211C",
    overflow: "hidden",
  },

  heroGlowOne: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    top: -40,
    right: -20,
  },

  heroGlowTwo: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.04)",
    bottom: -18,
    left: -12,
  },

  heroKicker: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 16,
  },

  spanRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },

  poleCard: {
    flex: 1,
    alignItems: "center",
  },

  poleBubble: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },

  poleBubbleText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
    maxWidth: 40,
  },

  poleCode: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
  },

  poleHint: {
    marginTop: 3,
    fontSize: 10,
    color: "rgba(255,255,255,0.6)",
  },

  cableCenter: {
    alignItems: "center",
    paddingHorizontal: 8,
  },

  cableLine: {
    width: 1,
    height: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
  },

  cableBadge: {
    marginVertical: 4,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#0B7A5A",
    alignItems: "center",
  },

  cableBadgeValue: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },

  cableBadgeHint: {
    marginTop: 2,
    color: "rgba(255,255,255,0.7)",
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
  },

  heroInfoRow: {
    gap: 10,
  },

  infoPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  infoPillLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.6)",
    textTransform: "uppercase",
    fontWeight: "700",
  },

  infoPillValue: {
    marginTop: 2,
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: "700",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E9EDF2",
    shadowColor: "#101828",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },

  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#F4F7FA",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },

  gpsCard: {
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    padding: 14,
  },

  gpsTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  gpsPin: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ECFDF3",
    marginRight: 10,
  },

  gpsCoords: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111827",
  },

  gpsSub: {
    marginTop: 3,
    fontSize: 12,
    color: "#667085",
  },

  gpsMetaWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },

  metaMiniBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  metaMiniBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },

  statRow: {
    flexDirection: "row",
    gap: 8,
  },

  statChip: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
  },

  statChipTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: "#667085",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  statChipValue: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: "900",
  },

  warningBox: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#FFF7F7",
    borderWidth: 1,
    borderColor: "#FAD4D4",
  },

  warningTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  warningTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#B42318",
  },

  warningValue: {
    fontSize: 14,
    fontWeight: "900",
    color: "#B42318",
  },

  reasonCard: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: "#FFF1E8",
    padding: 12,
  },

  reasonLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#B54708",
    textTransform: "uppercase",
    marginBottom: 4,
  },

  reasonText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#7A2E0B",
  },

  previewWideWrap: {
    marginTop: 12,
  },

  previewWide: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
  },

  photoGrid: {
    flexDirection: "row",
    gap: 10,
  },

  photoTileWrap: {
    flex: 1,
  },

  photoLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#98A2B3",
    textTransform: "uppercase",
    marginBottom: 6,
  },

  photoTile: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
  },

  photoEmpty: {
    alignItems: "center",
    justifyContent: "center",
  },

  photoEmptyText: {
    marginTop: 6,
    fontSize: 11,
    color: "#98A2B3",
    fontWeight: "600",
  },

  singlePhotoWrap: {
    width: "33.333%",
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F6",
    gap: 16,
  },

  detailRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },

  detailLabel: {
    fontSize: 13,
    color: "#667085",
    fontWeight: "600",
  },

  detailValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 13,
    color: "#111827",
    fontWeight: "800",
  },

  viewerRoot: {
    flex: 1,
    backgroundColor: "#000000",
  },

  viewerClose: {
    position: "absolute",
    top: 54,
    right: 20,
    zIndex: 10,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },

  viewerImage: {
    flex: 1,
  },
});
