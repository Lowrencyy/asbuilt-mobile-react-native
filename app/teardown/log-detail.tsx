import api, { assetUrl } from "@/lib/api";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── Types ────────────────────────────────────────────────────────────────────

type LogImage = {
  id: number;
  // the field/type name — could be any of these keys
  type?: string;
  field?: string;
  field_name?: string;
  image_type?: string;
  photo_type?: string;
  // the actual file path or URL
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
  // cable
  collected_cable?: number;
  recovered_cable?: number;
  unrecovered_cable?: number;
  unrecovered_reason?: string;
  cable_reason?: string;
  expected_cable?: number;
  actual_runs?: number;
  declared_runs?: number;
  // components — collected
  collected_node?: number;
  collected_amplifier?: number;
  collected_extender?: number;
  collected_tsc?: number;
  collected_powersupply?: number;
  collected_powersupply_housing?: number;
  // components — expected
  expected_node?: number;
  expected_amplifier?: number;
  expected_extender?: number;
  expected_tsc?: number;
  expected_powersupply?: number;
  expected_powersupply_housing?: number;
  // span GPS (where the teardown was captured)
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
  // images from teardown_log_images table
  images?: LogImage[];
  teardown_log_images?: LogImage[];
  photos?: LogImage[];
  // pole relations
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Main Screen ──────────────────────────────────────────────────────────────

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

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.root} edges={["top"]}>
        {loading && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#0d47c9" />
          </View>
        )}

        {error && (
          <View style={styles.center}>
            <Text style={{ fontSize: 36, marginBottom: 10 }}>⚠️</Text>
            <Text style={styles.centerText}>Could not load teardown log.</Text>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.goBackBtn}
            >
              <Text style={{ color: "#fff", fontWeight: "800" }}>Go Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !error && log && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
          >
            {/* ── Span summary card ── */}
            <View style={styles.card}>
              <View
                style={{
                  height: 4,
                  backgroundColor: "#10b981",
                  marginHorizontal: -16,
                  marginTop: -16,
                  marginBottom: 14,
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                }}
              />

              {/* From → cable → To */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 14,
                }}
              >
                <View
                  style={{
                    flex: 1,
                    backgroundColor: "#f0f4ff",
                    borderRadius: 12,
                    padding: 10,
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      backgroundColor: "#0d47c9",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 5,
                    }}
                  >
                    <Text
                      style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}
                      numberOfLines={1}
                    >
                      {fromCode.replace(/^[A-Z0-9]+-/, "")}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "800",
                      color: "#0d47c9",
                      textAlign: "center",
                    }}
                    numberOfLines={1}
                  >
                    {fromCode}
                  </Text>
                  <Text style={{ fontSize: 9, color: "#6b7280", marginTop: 1 }}>
                    Starting
                  </Text>
                </View>

                <View style={{ paddingHorizontal: 6, alignItems: "center" }}>
                  <View
                    style={{ width: 1, height: 8, backgroundColor: "#e5e7eb" }}
                  />
                  <View
                    style={{
                      backgroundColor: "#166534",
                      borderRadius: 8,
                      paddingHorizontal: 8,
                      paddingVertical: 5,
                      borderWidth: 1,
                      borderColor: "#bbf7d0",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{ fontSize: 11, fontWeight: "900", color: "#fff" }}
                    >
                      {fmtLen(cable)}
                    </Text>
                    <Text
                      style={{
                        fontSize: 8,
                        color: "#bbf7d0",
                        fontWeight: "600",
                        marginTop: 1,
                      }}
                    >
                      collected
                    </Text>
                  </View>
                  <View
                    style={{ width: 1, height: 8, backgroundColor: "#e5e7eb" }}
                  />
                </View>

                <View
                  style={{
                    flex: 1,
                    backgroundColor: "#f8f9ff",
                    borderRadius: 12,
                    padding: 10,
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      backgroundColor: "#10b981",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 5,
                    }}
                  >
                    <Text
                      style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}
                      numberOfLines={1}
                    >
                      {toCode.replace(/^[A-Z0-9]+-/, "")}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "800",
                      color: "#111",
                      textAlign: "center",
                    }}
                    numberOfLines={1}
                  >
                    {toCode}
                  </Text>
                  <Text style={{ fontSize: 9, color: "#6b7280", marginTop: 1 }}>
                    Destination
                  </Text>
                </View>
              </View>

              {/* Span GPS */}
              {log.captured_latitude != null &&
                log.captured_longitude != null &&
                (() => {
                  const lat = Number(log.captured_latitude).toFixed(6);
                  const lng = Number(log.captured_longitude).toFixed(6);
                  const accVal =
                    log.gps_accuracy_meters != null
                      ? Number(log.gps_accuracy_meters)
                      : null;
                  const acc =
                    accVal != null
                      ? accVal <= 5
                        ? {
                            label: `Excellent ±${accVal.toFixed(1)}m`,
                            bg: "#dcfce7",
                            text: "#166534",
                          }
                        : accVal <= 15
                          ? {
                              label: `Good ±${accVal.toFixed(1)}m`,
                              bg: "#dbeafe",
                              text: "#1e40af",
                            }
                          : accVal <= 50
                            ? {
                                label: `Fair ±${accVal.toFixed(1)}m`,
                                bg: "#fef3c7",
                                text: "#92400e",
                              }
                            : {
                                label: `Poor ±${accVal.toFixed(1)}m`,
                                bg: "#fee2e2",
                                text: "#991b1b",
                              }
                      : null;
                  const src = log.gps_source;
                  const isManual = src === "manual";
                  const isOffline =
                    log.offline_mode === 1 || log.offline_mode === true;
                  return (
                    <View
                      style={{
                        backgroundColor: "#f0fdf4",
                        borderRadius: 10,
                        padding: 10,
                        marginBottom: 12,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <Text style={{ fontSize: 18 }}>📍</Text>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "800",
                            color: "#166534",
                          }}
                        >
                          {lat}, {lng}
                        </Text>
                        <View
                          style={{
                            flexDirection: "row",
                            gap: 6,
                            marginTop: 4,
                            flexWrap: "wrap",
                          }}
                        >
                          {acc && (
                            <View
                              style={{
                                backgroundColor: acc.bg,
                                borderRadius: 6,
                                paddingHorizontal: 6,
                                paddingVertical: 2,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 9,
                                  fontWeight: "700",
                                  color: acc.text,
                                }}
                              >
                                {acc.label}
                              </Text>
                            </View>
                          )}
                          {src && (
                            <View
                              style={{
                                backgroundColor: isManual
                                  ? "#fef3c7"
                                  : "#dbeafe",
                                borderRadius: 6,
                                paddingHorizontal: 6,
                                paddingVertical: 2,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 9,
                                  fontWeight: "700",
                                  color: isManual ? "#92400e" : "#1e40af",
                                }}
                              >
                                {isManual ? "Manually Added" : "Device GPS"}
                              </Text>
                            </View>
                          )}
                          {isOffline && (
                            <View
                              style={{
                                backgroundColor: "#fee2e2",
                                borderRadius: 6,
                                paddingHorizontal: 6,
                                paddingVertical: 2,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 9,
                                  fontWeight: "700",
                                  color: "#991b1b",
                                }}
                              >
                                Offline
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })()}

              {/* Component chips — collected / expected */}
              <View style={{ flexDirection: "row", gap: 6 }}>
                {[
                  {
                    name: "Node",
                    col: colNode,
                    exp: exNode,
                    color: "#0d47c9",
                    bg: "#eef3ff",
                  },
                  {
                    name: "AMP",
                    col: colAmp,
                    exp: exAmp,
                    color: "#10b981",
                    bg: "#d1fae5",
                  },
                  {
                    name: "EXT",
                    col: colExt,
                    exp: exExt,
                    color: "#6366f1",
                    bg: "#ede9fe",
                  },
                  {
                    name: "TSC",
                    col: colTsc,
                    exp: exTsc,
                    color: "#f59e0b",
                    bg: "#fef3c7",
                  },
                ].map((c) => (
                  <View
                    key={c.name}
                    style={{
                      flex: 1,
                      backgroundColor: c.bg,
                      borderRadius: 8,
                      padding: 7,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight: "700",
                        color: "#6b7280",
                        textTransform: "uppercase",
                      }}
                    >
                      {c.name}
                    </Text>
                    <Text
                      style={{
                        fontSize: 17,
                        fontWeight: "900",
                        color: c.color,
                        marginTop: 2,
                      }}
                    >
                      {c.col}
                    </Text>
                    <Text style={{ fontSize: 9, color: "#9ca3af" }}>
                      /{c.exp}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Unrecovered cable — only if unrecovered > 0 */}
              {hasUnrecovered && (
                <View
                  style={{
                    marginTop: 12,
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: "#fecaca",
                    backgroundColor: "#fff5f5",
                    padding: 12,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "800",
                      color: "#dc2626",
                      marginBottom: 10,
                    }}
                  >
                    ⚠️ Unrecovered Cable
                  </Text>

                  <View style={styles.row}>
                    <Text style={styles.rowLbl}>Unrecovered Total</Text>
                    <Text style={[styles.rowVal, { color: "#dc2626" }]}>
                      {fmtLen(n2(log.unrecovered_cable))}
                    </Text>
                  </View>

                  {(log.unrecovered_reason ?? log.cable_reason) ? (
                    <View
                      style={{
                        marginTop: 8,
                        backgroundColor: "#fff7ed",
                        borderRadius: 8,
                        padding: 10,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "700",
                          color: "#92400e",
                          marginBottom: 2,
                        }}
                      >
                        REASON
                      </Text>
                      <Text style={{ fontSize: 12, color: "#7c2d12" }}>
                        {log.unrecovered_reason ?? log.cable_reason}
                      </Text>
                    </View>
                  ) : null}

                  {findImage(log, "before_span") && (
                    <TouchableOpacity
                      style={{ marginTop: 10 }}
                      activeOpacity={0.8}
                      onPress={() => {
                        const u = findImage(log, "before_span");
                        if (u) setViewerUri(u);
                      }}
                    >
                      <Text
                        style={{
                          color: "#9ca3af",
                          fontSize: 9,
                          fontWeight: "700",
                          textTransform: "uppercase",
                          marginBottom: 5,
                        }}
                      >
                        Span Photo
                      </Text>
                      <Image
                        source={{ uri: findImage(log, "before_span")! }}
                        style={{
                          width: "100%",
                          aspectRatio: 16 / 9,
                          borderRadius: 10,
                          backgroundColor: "#f3f4f6",
                        }}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Timestamps */}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: "#f9fafb",
                    borderRadius: 8,
                    padding: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 9,
                      color: "#9ca3af",
                      fontWeight: "700",
                      textTransform: "uppercase",
                    }}
                  >
                    Started
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "800",
                      color: "#374151",
                      marginTop: 2,
                    }}
                  >
                    {fmtTime(log.started_at)}
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: "#f9fafb",
                    borderRadius: 8,
                    padding: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 9,
                      color: "#9ca3af",
                      fontWeight: "700",
                      textTransform: "uppercase",
                    }}
                  >
                    Finished
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "800",
                      color: "#374151",
                      marginTop: 2,
                    }}
                  >
                    {fmtTime(log.finished_at)}
                  </Text>
                </View>
              </View>
            </View>

            {/* ── From Pole Photos ── */}
            <View style={styles.card}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "800",
                  color: "#0d47c9",
                  marginBottom: 12,
                }}
              >
                📷 {fromCode} — Starting Pole
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[
                  { label: "Before", uri: findImage(log, "from_before") },
                  { label: "After", uri: findImage(log, "from_after") },
                  { label: "Pole Tag", uri: findImage(log, "from_tag") },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.label}
                    style={{ flex: 1, alignItems: "center" }}
                    activeOpacity={item.uri ? 0.8 : 1}
                    onPress={() => item.uri && setViewerUri(item.uri)}
                  >
                    <Text
                      style={{
                        color: "#9ca3af",
                        fontSize: 9,
                        fontWeight: "700",
                        textTransform: "uppercase",
                        marginBottom: 5,
                      }}
                    >
                      {item.label}
                    </Text>
                    {item.uri ? (
                      <Image
                        source={{ uri: item.uri }}
                        style={{
                          width: "100%",
                          aspectRatio: 3 / 4,
                          borderRadius: 10,
                          backgroundColor: "#f3f4f6",
                        }}
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={{
                          width: "100%",
                          aspectRatio: 3 / 4,
                          borderRadius: 10,
                          backgroundColor: "#f3f4f6",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ fontSize: 18 }}>📷</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ── To Pole Photos ── */}
            <View style={styles.card}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "800",
                  color: "#1c6100",
                  marginBottom: 12,
                }}
              >
                📷 {toCode} — Destination Pole
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[
                  { label: "Before", uri: findImage(log, "to_before") },
                  { label: "After", uri: findImage(log, "to_after") },
                  { label: "Pole Tag", uri: findImage(log, "to_tag") },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.label}
                    style={{ flex: 1, alignItems: "center" }}
                    activeOpacity={item.uri ? 0.8 : 1}
                    onPress={() => item.uri && setViewerUri(item.uri)}
                  >
                    <Text
                      style={{
                        color: "#9ca3af",
                        fontSize: 9,
                        fontWeight: "700",
                        textTransform: "uppercase",
                        marginBottom: 5,
                      }}
                    >
                      {item.label}
                    </Text>
                    {item.uri ? (
                      <Image
                        source={{ uri: item.uri }}
                        style={{
                          width: "100%",
                          aspectRatio: 3 / 4,
                          borderRadius: 10,
                          backgroundColor: "#f3f4f6",
                        }}
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={{
                          width: "100%",
                          aspectRatio: 3 / 4,
                          borderRadius: 10,
                          backgroundColor: "#f3f4f6",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ fontSize: 18 }}>📷</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ── Span Photo ── */}
            {findImage(log, "before_span") && (
              <View style={styles.card}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "800",
                    color: "#f59e0b",
                    marginBottom: 12,
                  }}
                >
                  📡 Span Photo
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity
                    style={{ flex: 1, alignItems: "center" }}
                    activeOpacity={0.8}
                    onPress={() => {
                      const u = findImage(log, "before_span");
                      if (u) setViewerUri(u);
                    }}
                  >
                    <Text
                      style={{
                        color: "#9ca3af",
                        fontSize: 9,
                        fontWeight: "700",
                        textTransform: "uppercase",
                        marginBottom: 5,
                      }}
                    >
                      Before
                    </Text>
                    <Image
                      source={{ uri: findImage(log, "before_span")! }}
                      style={{
                        width: "100%",
                        aspectRatio: 3 / 4,
                        borderRadius: 10,
                        backgroundColor: "#f3f4f6",
                      }}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                  <View style={{ flex: 2 }} />
                </View>
              </View>
            )}

            {/* ── Extra details ── */}
            {(log.destination_slot ||
              log.destination_landmark ||
              log.cable_reason ||
              log.submitted_by) && (
              <View style={styles.card}>
                {log.destination_slot ? (
                  <View style={styles.row}>
                    <Text style={styles.rowLbl}>Slot</Text>
                    <Text style={styles.rowVal}>{log.destination_slot}</Text>
                  </View>
                ) : null}
                {log.destination_landmark ? (
                  <View style={styles.row}>
                    <Text style={styles.rowLbl}>Landmark</Text>
                    <Text style={styles.rowVal}>
                      {log.destination_landmark}
                    </Text>
                  </View>
                ) : null}
                {log.submitted_by ? (
                  <View style={styles.row}>
                    <Text style={styles.rowLbl}>Submitted by</Text>
                    <Text style={styles.rowVal}>{log.submitted_by}</Text>
                  </View>
                ) : null}
                {log.cable_reason ? (
                  <View
                    style={{
                      marginTop: 8,
                      backgroundColor: "#fff7ed",
                      borderRadius: 8,
                      padding: 8,
                    }}
                  >
                    <Text style={{ fontSize: 11, color: "#92400e" }}>
                      Reason: {log.cable_reason}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* ── Full-screen photo viewer ── */}
      <Modal
        visible={!!viewerUri}
        animationType="fade"
        onRequestClose={() => setViewerUri(null)}
      >
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <Pressable
            onPress={() => setViewerUri(null)}
            style={{
              position: "absolute",
              top: 52,
              right: 20,
              zIndex: 10,
              backgroundColor: "rgba(0,0,0,0.55)",
              borderRadius: 20,
              padding: 10,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "900" }}>
              ✕
            </Text>
          </Pressable>
          {viewerUri && (
            <Image
              source={{ uri: viewerUri }}
              style={{ flex: 1 }}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f3f4f6" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    elevation: 3,
  },
  backIcon: {
    fontSize: 28,
    color: "#111827",
    fontWeight: "600",
    marginTop: -2,
  },
  headerTitle: { fontSize: 17, fontWeight: "900", color: "#111827" },
  headerSub: { fontSize: 11, color: "#6b7280", marginTop: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  centerText: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "700",
    marginBottom: 12,
  },
  goBackBtn: {
    backgroundColor: "#0d47c9",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  scroll: { padding: 16, paddingBottom: 48, gap: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  rowLbl: { fontSize: 12, color: "#6b7280" },
  rowVal: { fontSize: 12, fontWeight: "800", color: "#111827" },
});
