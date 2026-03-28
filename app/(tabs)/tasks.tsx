import api from "@/lib/api";
import { cacheGet, cacheSet } from "@/lib/cache";
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const n2 = (v: unknown) => (v == null || v === "" ? 0 : Number(v) || 0);
const fmtLen = (v: number) => (v ? `${v.toLocaleString()} m` : "—");

// ─── Types ────────────────────────────────────────────────────────────────────

type TeardownLog = {
  id: number;
  created_at: string;
  status: string;
  pole_span_id?: number;
  to_pole_id?: number;
  // cable — backend uses collected_cable (or recovered_cable if partial)
  collected_cable?: number;
  recovered_cable?: number;
  actual_runs?: number;
  cable_reason?: string;
  destination_slot?: string;
  destination_landmark?: string;
  collected_node?: number;
  collected_amplifier?: number;
  collected_extender?: number;
  collected_tsc?: number;
  collected_powersupply?: number;
  collected_powersupply_housing?: number;
  // Laravel eager-loaded relations
  pole_span?: {
    pole_span_code?: string;
    from_pole?: { pole_code: string; pole_name?: string };
    to_pole?:   { pole_code: string; pole_name?: string };
  };
  span?: {
    pole_span_code?: string;
    from_pole?: { pole_code: string; pole_name?: string };
    to_pole?:   { pole_code: string; pole_name?: string };
  };
  to_pole?:       { pole_code: string; pole_name?: string };
  to_pole_code?:  string;
  pole?:          { pole_code: string; pole_name?: string };
  from_pole?:     { pole_code: string; pole_name?: string };
  from_pole_code?: string;
  node?: { node_id: string; node_name?: string; city?: string; province?: string };
  project?: { name?: string };
};

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: "Pending",   color: "#d97706", bg: "#fef3c7" },
  submitted: { label: "Submitted", color: "#0d47c9", bg: "#eef3ff" },
  done:      { label: "Done",      color: "#059669", bg: "#d1fae5" },
  approved:  { label: "Approved",  color: "#059669", bg: "#d1fae5" },
  rejected:  { label: "Rejected",  color: "#dc2626", bg: "#fee2e2" },
  draft:     { label: "Draft",     color: "#6b7280", bg: "#f3f4f6" },
};

function StatusBadge({ code }: { code: string }) {
  const m = STATUS_META[code] ?? { label: code, color: "#6b7280", bg: "#f3f4f6" };
  return (
    <View style={{ borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: m.bg }}>
      <Text style={{ fontSize: 10, fontWeight: "800", color: m.color }}>{m.label}</Text>
    </View>
  );
}

function StatCell({ lbl, val, color }: { lbl: string; val: string; color: string }) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text style={{ fontSize: 13, fontWeight: "900", color }}>{val}</Text>
      <Text style={{ fontSize: 9, color: "#9ca3af", fontWeight: "700", textTransform: "uppercase" }}>{lbl}</Text>
    </View>
  );
}

// ─── Log Card ─────────────────────────────────────────────────────────────────

function LogCard({ log, delay }: { log: TeardownLog; delay: number }) {
  const sm = STATUS_META[log.status] ?? STATUS_META.submitted;

  const fromCode = log.pole_span?.from_pole?.pole_code ?? log.span?.from_pole?.pole_code ?? log.pole?.pole_code ?? log.from_pole?.pole_code ?? log.from_pole_code ?? "—";
  const toCode   = log.pole_span?.to_pole?.pole_code  ?? log.span?.to_pole?.pole_code   ?? log.to_pole?.pole_code ?? log.to_pole_code ?? "—";
  const spanCode = log.pole_span?.pole_span_code ?? log.span?.pole_span_code ?? null;
  const nodeId   = log.node?.node_id ?? "";

  const cable = n2(log.collected_cable ?? log.recovered_cable);
  const node  = n2(log.collected_node);
  const amp   = n2(log.collected_amplifier);
  const ext   = n2(log.collected_extender);
  const tsc   = n2(log.collected_tsc);
  const ps    = n2(log.collected_powersupply);

  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={styles.card}>
      <View style={{ height: 3, backgroundColor: sm.color }} />

      <TouchableOpacity activeOpacity={0.75} onPress={() => router.push({ pathname: "/teardown/log-detail", params: { id: String(log.id) } } as any)}>
        <View style={{ padding: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "900", color: "#111827" }}>
                {fromCode}  →  {toCode}
              </Text>
              {spanCode ? (
                <Text style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>Span: {spanCode}</Text>
              ) : null}
              {nodeId ? (
                <Text style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>Node: {nodeId}</Text>
              ) : null}
            </View>
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              <StatusBadge code={log.status} />
              {log.destination_slot ? (
                <Text style={{ fontSize: 10, color: "#9ca3af", fontWeight: "600" }}>
                  Slot: {log.destination_slot}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: "#f3f4f6", paddingTop: 10, gap: 4 }}>
            <StatCell lbl="Cable" val={fmtLen(cable)} color="#166534" />
            <StatCell lbl="Node"  val={String(node)}  color="#0d47c9" />
            <StatCell lbl="Amp"   val={String(amp)}   color="#10b981" />
            <StatCell lbl="Ext"   val={String(ext)}   color="#6366f1" />
            <StatCell lbl="TSC"   val={String(tsc)}   color="#f59e0b" />
            <StatCell lbl="PS"    val={String(ps)}     color="#ec4899" />
          </View>
        </View>
      </TouchableOpacity>

    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TasksScreen() {
  const [logs,       setLogs]       = useState<TeardownLog[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => { load(); }, []));

  async function load() {
    const cached = await cacheGet<TeardownLog[]>("teardown_logs");
    if (cached?.length) { setLogs(cached); setLoading(false); }

    try {
      const { data } = await api.get("/teardown-logs?per_page=500");
      const fresh = data.data ?? data ?? [];
      cacheSet("teardown_logs", fresh);
      setLogs(fresh);
    } catch { /* keep showing cached */ }
    finally { setLoading(false); setRefreshing(false); }
  }

  const totalCable = useMemo(() => logs.reduce((s, r) => s + n2(r.recovered_cable), 0), [logs]);
  const doneCount  = logs.filter(s => s.status === "done" || s.status === "approved").length;

  const listHeader = (
    <>
      <View style={styles.topCard}>
        <Text style={styles.title}>Daily Tasks</Text>
      </View>

      <View style={styles.totalCard}>
        <View style={styles.totalRow}>
          <View style={styles.totalBox}>
            <Text style={styles.totalValue}>{logs.length}</Text>
            <Text style={styles.totalLabel}>Spans Done</Text>
          </View>
          <View style={styles.totalBox}>
            <Text style={styles.totalValue}>{fmtLen(totalCable)}</Text>
            <Text style={styles.totalLabel}>Cable Recovered</Text>
          </View>
        </View>
        <View style={styles.totalRow}>
          <View style={styles.totalBox}>
            <Text style={styles.totalValue}>{doneCount}</Text>
            <Text style={styles.totalLabel}>Approved</Text>
          </View>
          <View style={styles.totalBox}>
            <Text style={styles.totalValue}>{logs.length - doneCount}</Text>
            <Text style={styles.totalLabel}>Pending</Text>
          </View>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.summaryTitle}>Teardown Logs</Text>
        <Text style={styles.summaryCount}>{logs.length} record{logs.length !== 1 ? "s" : ""}</Text>
      </View>

      {loading && (
        <View style={{ backgroundColor: "#fff", borderRadius: 20, paddingVertical: 48, alignItems: "center", marginBottom: 12 }}>
          <ActivityIndicator color="#0d47c9" />
          <Text style={{ color: "#9ca3af", marginTop: 10, fontSize: 12 }}>Loading tasks…</Text>
        </View>
      )}

      {!loading && logs.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={{ fontSize: 40 }}>📋</Text>
          <Text style={styles.emptyTitle}>No tasks yet</Text>
          <Text style={styles.emptyText}>No teardown logs found.</Text>
        </View>
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        data={loading ? [] : logs}
        keyExtractor={item => String(item.id)}
        renderItem={({ item, index }) => <LogCard log={item} delay={60 + index * 40} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={listHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor="#0d47c9"
          />
        }
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: "#f3f4f6" },
  listContent: { padding: 16, paddingBottom: 40 },

  topCard:     { backgroundColor: "#e9eeea", borderRadius: 30, padding: 20, marginBottom: 16 },
  title:       { fontSize: 24, fontWeight: "700", color: "#111111" },
  filterSection:    { marginBottom: 18 },
  filterLabel:      { fontSize: 14, fontWeight: "600", color: "#444444", marginBottom: 10 },
  filterWrapper:    { position: "relative", zIndex: 20 },
  dateSelector:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f8f8f6", borderRadius: 999, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: "#d0d0ce" },
  dateSelectorText: { fontSize: 14, fontWeight: "500", color: "#111111" },
  arrow:            { fontSize: 14, color: "#111111", marginLeft: 8 },
  dropdown:         { marginTop: 8, backgroundColor: "#ffffff", borderRadius: 16, borderWidth: 1, borderColor: "#dddddd", overflow: "hidden" },
  dropdownItem:     { paddingVertical: 12, paddingHorizontal: 14 },
  dropdownText:     { fontSize: 14, color: "#111111" },
  selectedDateText: { fontSize: 13, color: "#666666", marginTop: 10 },
  dateScrollContent:{ paddingRight: 8 },
  dayItem:          { alignItems: "center", marginRight: 12 },
  dayNumberBox:     { width: 50, height: 36, justifyContent: "center", alignItems: "center", borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: "#ffffff" },
  dayNameBox:       { width: 50, height: 24, justifyContent: "center", alignItems: "center", borderBottomLeftRadius: 20, borderBottomRightRadius: 20, backgroundColor: "#ffffff" },
  dayNumber:        { fontSize: 18, fontWeight: "700", color: "#111111" },
  dayName:          { fontSize: 11, color: "#666666" },
  dayActiveBox:     { backgroundColor: "#0A5C3B" },
  dayActiveText:    { color: "#f8f8f8" },

  totalCard:  { backgroundColor: "#f8f8f8", borderRadius: 24, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: "#efefef" },
  totalRow:   { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  totalBox:   { width: "48%", backgroundColor: "#ffffff", borderRadius: 16, paddingVertical: 18, paddingHorizontal: 12, alignItems: "center" },
  totalValue: { fontSize: 18, fontWeight: "700", color: "#111111", marginBottom: 6 },
  totalLabel: { fontSize: 12, color: "#666666" },

  summaryRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  summaryTitle: { fontSize: 18, fontWeight: "700", color: "#111111" },
  summaryCount: { fontSize: 13, color: "#666666" },

  card:       { backgroundColor: "#fff", borderRadius: 20, marginBottom: 12, overflow: "hidden", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6 },

  emptyCard:  { backgroundColor: "#f8f8f8", borderRadius: 20, padding: 32, alignItems: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#111111", marginTop: 12, marginBottom: 6 },
  emptyText:  { fontSize: 13, color: "#666666", textAlign: "center" },
});
