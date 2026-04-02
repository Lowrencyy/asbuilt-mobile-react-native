import api from "@/lib/api";
import { cacheGet, cacheSet } from "@/lib/cache";
import { Stack, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
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
  created_at: string;
  status: string;
  team?: string;
  collected_cable?: number;
  collected_node?: number;
  collected_amplifier?: number;
  collected_extender?: number;
  collected_tsc?: number;
  collected_powersupply?: number;
  collected_powersupply_housing?: number;
  pole_span?: {
    pole_span_code?: string;
    from_pole?: { pole_code: string; pole_name?: string };
    to_pole?:   { pole_code: string; pole_name?: string };
  };
  node?: { id: number; node_id: string };
  project?: { id: number; name?: string };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const n2 = (v: unknown) => (v == null || v === "" ? 0 : Number(v) || 0);
const fmtCable = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(2)} km` : `${v} m`);

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  submitted:        { label: "Submitted",    color: "#0d47c9", bg: "#eef3ff" },
  done:             { label: "Done",         color: "#059669", bg: "#d1fae5" },
  approved:         { label: "Approved",     color: "#059669", bg: "#d1fae5" },
  rejected:         { label: "Rejected",     color: "#dc2626", bg: "#fee2e2" },
  pending:          { label: "Pending",      color: "#d97706", bg: "#fef3c7" },
  draft:            { label: "Draft",        color: "#6b7280", bg: "#f3f4f6" },
};

const SUB_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  draft:              { label: "Draft",             color: "#6b7280", bg: "#f3f4f6" },
  submitted_to_pm:    { label: "Submitted to PM",   color: "#0d47c9", bg: "#eef3ff" },
  pm_approved:        { label: "PM Approved",       color: "#059669", bg: "#d1fae5" },
  telcovantage_approved: { label: "Approved",       color: "#059669", bg: "#d1fae5" },
  pm_for_rework:      { label: "For Rework",        color: "#dc2626", bg: "#fee2e2" },
};

// ─── Log Card ─────────────────────────────────────────────────────────────────

function LogCard({ log, accent, delay }: { log: TeardownLog; accent: string; delay: number }) {
  const sm    = STATUS_META[log.status] ?? STATUS_META.submitted;
  const from  = log.pole_span?.from_pole?.pole_code ?? null;
  const to    = log.pole_span?.to_pole?.pole_code   ?? null;
  const span  = log.pole_span?.pole_span_code       ?? null;
  const title = (from && to) ? `${from}  →  ${to}` : span ? `Span: ${span}` : `Log #${log.id}`;

  const cable = n2(log.collected_cable);
  const node  = n2(log.collected_node);
  const amp   = n2(log.collected_amplifier);
  const ext   = n2(log.collected_extender);
  const tsc   = n2(log.collected_tsc);
  const ps    = n2(log.collected_powersupply);
  const date  = new Date(log.created_at).toLocaleDateString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
  });

  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={styles.card}>
      <View style={[styles.cardAccent, { backgroundColor: accent }]} />
      <TouchableOpacity
        activeOpacity={0.78}
        onPress={() =>
          router.push({ pathname: "/teardown/log-detail", params: { id: String(log.id) } } as any)
        }
      >
        <View style={styles.cardInner}>
          <View style={styles.cardTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.spanLabel}>{title}</Text>
              {span && from && to ? <Text style={styles.spanCode}>{span}</Text> : null}
              <Text style={styles.dateText}>{date}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: sm.bg }]}>
              <Text style={[styles.badgeText, { color: sm.color }]}>{sm.label}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            {cable > 0 && (
              <View style={styles.statChip}>
                <Text style={[styles.statVal, { color: "#059669" }]}>{fmtCable(cable)}</Text>
                <Text style={styles.statLbl}>Cable</Text>
              </View>
            )}
            {node > 0 && (
              <View style={styles.statChip}>
                <Text style={[styles.statVal, { color: "#0d47c9" }]}>{node}</Text>
                <Text style={styles.statLbl}>Node</Text>
              </View>
            )}
            {amp > 0 && (
              <View style={styles.statChip}>
                <Text style={[styles.statVal, { color: "#10b981" }]}>{amp}</Text>
                <Text style={styles.statLbl}>Amp</Text>
              </View>
            )}
            {ext > 0 && (
              <View style={styles.statChip}>
                <Text style={[styles.statVal, { color: "#6366f1" }]}>{ext}</Text>
                <Text style={styles.statLbl}>Ext</Text>
              </View>
            )}
            {tsc > 0 && (
              <View style={styles.statChip}>
                <Text style={[styles.statVal, { color: "#f59e0b" }]}>{tsc}</Text>
                <Text style={styles.statLbl}>TSC</Text>
              </View>
            )}
            {ps > 0 && (
              <View style={styles.statChip}>
                <Text style={[styles.statVal, { color: "#ec4899" }]}>{ps}</Text>
                <Text style={styles.statLbl}>PS</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function NodeLogsScreen() {
  const { node_id, node_name, city, province, project_name, accent } =
    useLocalSearchParams<{
      node_id: string;
      node_name: string;
      city: string;
      province: string;
      project_name: string;
      accent: string;
    }>();

  const accentColor = accent || "#0A5C3B";
  const CACHE_KEY   = `node_logs_${node_id}`;

  const [logs,       setLogs]       = useState<TeardownLog[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [subStatus,  setSubStatus]  = useState<string | null>(null); // existing submission status

  useFocusEffect(useCallback(() => { load(); }, []));

  async function load() {
    setError(null);

    // Per-node cache — avoids stale shared cache that may lack poleSpan relations
    const cached = await cacheGet<TeardownLog[]>(CACHE_KEY);
    if (cached?.length) { setLogs(cached); setLoading(false); }

    try {
      const { data } = await api.get(`/teardown-logs?per_page=500&node_code=${encodeURIComponent(node_id)}`);
      const all: TeardownLog[] = data.data ?? data ?? [];
      const filtered = all.filter((l) => !l.node || l.node.node_id === node_id);
      cacheSet(CACHE_KEY, filtered);
      setLogs(filtered);

      // Also check if there's an existing submission for this node today
      checkSubmission(filtered);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Network error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function checkSubmission(currentLogs: TeardownLog[]) {
    const nodeDbId = currentLogs[0]?.node?.id;
    if (!nodeDbId) return;
    try {
      const { data } = await api.get(`/teardown-submissions?node_id=${nodeDbId}`);
      const subs: any[] = data.data ?? data ?? [];
      if (subs.length > 0) {
        // get the latest
        setSubStatus(subs[0].status ?? "draft");
      }
    } catch { /* ignore */ }
  }

  async function handleSubmitToPM() {
    const nodeDbId   = logs[0]?.node?.id;
    const projectId  = logs[0]?.project?.id;

    if (!nodeDbId || !projectId) {
      Alert.alert("Error", "Cannot determine node or project. Please reload.");
      return;
    }

    // Only submitted teardown logs should be sent to PM
    const submittedLogs = logs.filter((l) => l.status === "submitted");
    if (submittedLogs.length === 0) {
      Alert.alert("Nothing to Submit", "All teardown logs are already approved or pending.");
      return;
    }

    // Block if already submitted to PM
    if (subStatus === "submitted_to_pm" || subStatus === "pm_approved" || subStatus === "telcovantage_approved") {
      const m = SUB_STATUS_META[subStatus];
      Alert.alert("Already Submitted", `This node's report is already: ${m?.label ?? subStatus}`);
      return;
    }

    Alert.alert(
      "Submit to PM",
      `Submit ${submittedLogs.length} teardown log${submittedLogs.length !== 1 ? "s" : ""} from node ${node_id} to PM for review?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit",
          style: "default",
          onPress: () => doSubmit(nodeDbId, projectId),
        },
      ]
    );
  }

  async function doSubmit(nodeDbId: number, projectId: number) {
    setSubmitting(true);
    try {
      // Step 1: autofill totals from server
      const today = new Date().toISOString().split("T")[0];
      const { data: fill } = await api.get(
        `/teardown-submissions/autofill?node_id=${nodeDbId}&date=${today}`
      );

      // Step 2: create/update submission draft
      const { data: sub } = await api.post("/teardown-submissions", {
        node_id:                    nodeDbId,
        project_id:                 projectId,
        report_date:                today,
        total_cable:                fill.total_cable               ?? 0,
        total_strand_length:        fill.total_strand_length       ?? 0,
        total_node:                 fill.total_node                ?? 0,
        total_amplifier:            fill.total_amplifier           ?? 0,
        total_extender:             fill.total_extender            ?? 0,
        total_tsc:                  fill.total_tsc                 ?? 0,
        total_powersupply:          fill.total_powersupply         ?? 0,
        total_powersupply_housing:  fill.total_powersupply_housing ?? 0,
      });

      // Step 3: submit to PM
      await api.post(`/teardown-submissions/${sub.id}/submit`, {});

      setSubStatus("submitted_to_pm");
      Alert.alert("Submitted!", `Node ${node_id} report has been submitted to PM successfully.`);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Submission failed";
      Alert.alert("Failed", msg);
    } finally {
      setSubmitting(false);
    }
  }

  const totalCable = logs.reduce((s, l) => s + n2(l.collected_cable), 0);
  const approved   = logs.filter((l) => l.status === "approved" || l.status === "done").length;
  const submitted  = logs.filter((l) => l.status === "submitted").length;
  const pct        = logs.length > 0 ? Math.round((approved / logs.length) * 100) : 0;
  const barColor   = pct === 100 ? "#059669" : accentColor;

  const canSubmit = submitted > 0
    && subStatus !== "submitted_to_pm"
    && subStatus !== "pm_approved"
    && subStatus !== "telcovantage_approved";

  const subMeta = subStatus ? (SUB_STATUS_META[subStatus] ?? null) : null;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.screen} edges={["top"]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: accentColor }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.headerNode}>{node_id}</Text>
            {node_name ? <Text style={styles.headerName}>{node_name}</Text> : null}
            {city ? (
              <Text style={styles.headerCity}>
                {city}{province ? `, ${province}` : ""}
              </Text>
            ) : null}
            <Text style={styles.headerProject}>{project_name}</Text>
          </View>
          {/* Submission status badge */}
          {subMeta && (
            <View style={[styles.subBadge, { backgroundColor: subMeta.bg }]}>
              <Text style={[styles.subBadgeText, { color: subMeta.color }]}>{subMeta.label}</Text>
            </View>
          )}
        </View>

        {/* Summary strip */}
        <View style={styles.summaryStrip}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryVal}>{logs.length}</Text>
            <Text style={styles.summaryLbl}>Spans</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: "#059669" }]}>{approved}</Text>
            <Text style={styles.summaryLbl}>Approved</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: "#0d47c9" }]}>{submitted}</Text>
            <Text style={styles.summaryLbl}>Submitted</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: barColor }]}>
              {totalCable >= 1000 ? `${(totalCable / 1000).toFixed(1)}km` : `${totalCable}m`}
            </Text>
            <Text style={styles.summaryLbl}>Cable</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
        </View>

        {/* Log list */}
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color={accentColor} />
            <Text style={styles.centerText}>Loading logs…</Text>
          </View>
        ) : error ? (
          <View style={styles.centerBox}>
            <Text style={{ fontSize: 36 }}>⚠️</Text>
            <Text style={styles.emptyTitle}>Failed to load</Text>
            <Text style={styles.centerText}>{error}</Text>
            <TouchableOpacity
              onPress={() => { setLoading(true); load(); }}
              style={[styles.actionBtn, { backgroundColor: accentColor }]}
            >
              <Text style={styles.actionBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : logs.length === 0 ? (
          <View style={styles.centerBox}>
            <Text style={{ fontSize: 40 }}>📋</Text>
            <Text style={styles.emptyTitle}>No logs yet</Text>
            <Text style={styles.centerText}>No teardown logs found for this node.</Text>
          </View>
        ) : (
          <FlatList
            data={logs}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item, index }) => (
              <LogCard log={item} accent={accentColor} delay={index * 40} />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); load(); }}
                tintColor={accentColor}
              />
            }
            ListFooterComponent={
              <View style={styles.footerWrap}>
                <TouchableOpacity
                  activeOpacity={canSubmit ? 0.82 : 1}
                  style={[
                    styles.submitBtn,
                    { backgroundColor: canSubmit ? accentColor : "#e5e7eb" },
                  ]}
                  onPress={canSubmit ? handleSubmitToPM : undefined}
                  disabled={submitting || !canSubmit}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Text style={[styles.submitBtnText, { color: canSubmit ? "#fff" : "#9ca3af" }]}>
                        {subStatus === "submitted_to_pm"  ? "✓ Submitted to PM" :
                         subStatus === "pm_approved"      ? "✓ PM Approved" :
                         subStatus === "telcovantage_approved" ? "✓ Approved" :
                         subStatus === "pm_for_rework"    ? "Resubmit to PM" :
                         "Submit to PM"}
                      </Text>
                      {canSubmit && (
                        <Text style={styles.submitBtnSub}>
                          {submitted} log{submitted !== 1 ? "s" : ""} ready
                        </Text>
                      )}
                    </>
                  )}
                </TouchableOpacity>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f3f4f6" },

  header: {
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20,
    flexDirection: "row", alignItems: "flex-start", gap: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center", marginTop: 4,
  },
  backIcon:      { fontSize: 28, color: "#fff", fontWeight: "600", marginTop: -2 },
  headerText:    { flex: 1 },
  headerNode:    { fontSize: 22, fontWeight: "900", color: "#ffffff" },
  headerName:    { fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: "600", marginTop: 2 },
  headerCity:    { fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 1 },
  headerProject: { fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 4, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },

  subBadge:     { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start", marginTop: 4 },
  subBadgeText: { fontSize: 10, fontWeight: "800" },

  summaryStrip: {
    flexDirection: "row", backgroundColor: "#ffffff",
    paddingVertical: 14, paddingHorizontal: 8,
    elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  summaryItem:    { flex: 1, alignItems: "center" },
  summaryVal:     { fontSize: 16, fontWeight: "900", color: "#111827" },
  summaryLbl:     { fontSize: 9, color: "#9ca3af", fontWeight: "700", marginTop: 2, textTransform: "uppercase" },
  summaryDivider: { width: 1, backgroundColor: "#f3f4f6", marginVertical: 4 },

  progressTrack: { height: 3, backgroundColor: "#e5e7eb" },
  progressFill:  { height: 3 },

  listContent: { padding: 16, paddingBottom: 16 },

  card: {
    backgroundColor: "#fff", borderRadius: 18, marginBottom: 12,
    flexDirection: "row", overflow: "hidden",
    elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  cardAccent: { width: 4 },
  cardInner:  { flex: 1, padding: 14 },
  cardTop:    { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  spanLabel:  { fontSize: 15, fontWeight: "900", color: "#111827" },
  spanCode:   { fontSize: 11, color: "#6b7280", marginTop: 2 },
  dateText:   { fontSize: 10, color: "#9ca3af", marginTop: 3 },
  badge:      { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
  badgeText:  { fontSize: 10, fontWeight: "800" },

  statsRow:  { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statChip:  { alignItems: "center", backgroundColor: "#f9fafb", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, minWidth: 52 },
  statVal:   { fontSize: 12, fontWeight: "900" },
  statLbl:   { fontSize: 9, color: "#9ca3af", fontWeight: "700", textTransform: "uppercase" },

  centerBox:  { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  centerText: { fontSize: 13, color: "#9ca3af", marginTop: 8, textAlign: "center" },
  emptyTitle: { fontSize: 15, fontWeight: "800", color: "#111827", marginTop: 10 },

  actionBtn:     { marginTop: 14, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10 },
  actionBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },

  footerWrap: { paddingHorizontal: 0, paddingBottom: 32, paddingTop: 4 },
  submitBtn: {
    borderRadius: 18, paddingVertical: 18,
    alignItems: "center", justifyContent: "center",
    elevation: 3, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  submitBtnText: { fontSize: 16, fontWeight: "900" },
  submitBtnSub:  { fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 3, fontWeight: "600" },
});
