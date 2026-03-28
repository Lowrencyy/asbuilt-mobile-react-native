import api from "@/lib/api";
import { cacheGet, cacheSet } from "@/lib/cache";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const n2 = (v: unknown) => (v == null || v === "" ? 0 : Number(v) || 0);
const fmtLen = (v: number) => (v ? `${v.toLocaleString()} m` : "—");

function parseDateParts(dateStr: string) {
  const parts = (dateStr ?? "").slice(0, 10).split("-");
  return { month: Number(parts[1]) - 1, day: Number(parts[2]) };
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Submission = {
  id: number;
  report_date: string;
  status: string;
  item_status: string;
  total_cable: number;
  total_strand_length: number;
  total_node: number;
  total_amplifier: number;
  total_extender: number;
  total_tsc: number;
  total_powersupply: number;
  total_powersupply_housing: number;
  submitted_by?: string;
  pm_reviewed_by?: string;
  warehouse_location?: string;
  node?: { id: number; node_id: string; node_name?: string; city?: string; province?: string };
  project?: { id: number; name?: string };
};

type AutoFill = {
  total_cable: number; total_strand_length: number;
  total_node: number; total_amplifier: number; total_extender: number;
  total_tsc: number; total_powersupply: number; total_powersupply_housing: number;
  log_count: number;
};

type NodeOption = {
  id: number; node_id: string; node_name?: string;
  city?: string; province?: string; project_id: number;
  project?: { name?: string };
};

// ─── Status maps ─────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  draft:                     { label: "Draft",               color: "#6b7280", bg: "#f3f4f6" },
  submitted_to_pm:           { label: "Pending PM",          color: "#d97706", bg: "#fef3c7" },
  pm_for_rework:             { label: "For Rework",          color: "#dc2626", bg: "#fee2e2" },
  pm_approved:               { label: "PM Approved",         color: "#059669", bg: "#d1fae5" },
  submitted_to_telcovantage: { label: "Pending TelcoVantage",color: "#7c3aed", bg: "#ede9fe" },
  telcovantage_for_rework:   { label: "For Rework",          color: "#dc2626", bg: "#fee2e2" },
  telcovantage_approved:     { label: "Approved",            color: "#059669", bg: "#d1fae5" },
  ready_for_delivery:        { label: "For Delivery",        color: "#0d47c9", bg: "#eef3ff" },
  delivered:                 { label: "Delivered",           color: "#1e8a1e", bg: "#dcfce7" },
  closed:                    { label: "Closed",              color: "#374151", bg: "#e5e7eb" },
};

const DELIVERY_META: Record<string, { label: string; color: string; bg: string }> = {
  onfield:          { label: "On Field",   color: "#b45309", bg: "#fef3c7" },
  ongoing_delivery: { label: "In Transit", color: "#2563eb", bg: "#dbeafe" },
  delivered:        { label: "Delivered",  color: "#059669", bg: "#d1fae5" },
  delivery_onhold:  { label: "On Hold",    color: "#dc2626", bg: "#fee2e2" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ code, map }: { code: string; map: typeof STATUS_META }) {
  const m = map[code] ?? { label: code, color: "#6b7280", bg: "#f3f4f6" };
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

function ReportCard({ sub, delay, onSubmit }: { sub: Submission; delay: number; onSubmit: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const dateLabel = new Date(sub.report_date).toLocaleDateString("en-PH", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
  const canSubmit = sub.status === "draft" || sub.status === "pm_for_rework";
  const sm = STATUS_META[sub.status] ?? STATUS_META.draft;

  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={styles.reportCard}>
      <View style={{ height: 3, backgroundColor: sm.color }} />

      <TouchableOpacity activeOpacity={0.75} onPress={() => setExpanded(e => !e)}>
        <View style={{ padding: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "900", color: "#111827" }}>
                {sub.node?.node_id ?? `Node #${sub.node?.id}`}
              </Text>
              {(sub.node?.city || sub.node?.province) ? (
                <Text style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>
                  {[sub.node?.city, sub.node?.province].filter(Boolean).join(", ")}
                </Text>
              ) : null}
            </View>
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              <Text style={{ fontSize: 10, color: "#9ca3af", fontWeight: "600" }}>{dateLabel}</Text>
              <StatusBadge code={sub.status} map={STATUS_META} />
            </View>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            <StatusBadge code={sub.item_status} map={DELIVERY_META} />
            {sub.submitted_by ? (
              <Text style={{ fontSize: 10, color: "#374151", fontWeight: "600" }}>👷 {sub.submitted_by}</Text>
            ) : null}
            {sub.pm_reviewed_by ? (
              <Text style={{ fontSize: 10, color: "#059669", fontWeight: "600" }}>✓ {sub.pm_reviewed_by}</Text>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: "#f3f4f6", paddingTop: 10, gap: 4 }}>
            <StatCell lbl="Cable" val={fmtLen(n2(sub.total_cable))} color="#166534" />
            <StatCell lbl="Node"  val={String(n2(sub.total_node))}  color="#0d47c9" />
            <StatCell lbl="Amp"   val={String(n2(sub.total_amplifier))} color="#10b981" />
            <StatCell lbl="Ext"   val={String(n2(sub.total_extender))}  color="#6366f1" />
            <StatCell lbl="TSC"   val={String(n2(sub.total_tsc))}       color="#f59e0b" />
            <StatCell lbl="PS"    val={String(n2(sub.total_powersupply))} color="#ec4899" />
          </View>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={{ borderTopWidth: 1, borderTopColor: "#f3f4f6", padding: 14, gap: 8 }}>
          {[
            { lbl: "Actual Cable",  val: fmtLen(n2(sub.total_cable)) },
            { lbl: "Strand Length", val: fmtLen(n2(sub.total_strand_length)) },
            { lbl: "Nodes",         val: String(n2(sub.total_node)) },
            { lbl: "Amplifiers",    val: String(n2(sub.total_amplifier)) },
            { lbl: "Extenders",     val: String(n2(sub.total_extender)) },
            { lbl: "TSC",           val: String(n2(sub.total_tsc)) },
            { lbl: "Power Supply",  val: String(n2(sub.total_powersupply)) },
            { lbl: "PS Housing",    val: String(n2(sub.total_powersupply_housing)) },
          ].map(r => (
            <View key={r.lbl} style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 12, color: "#6b7280" }}>{r.lbl}</Text>
              <Text style={{ fontSize: 12, fontWeight: "800", color: "#111827" }}>{r.val}</Text>
            </View>
          ))}
          {sub.warehouse_location ? (
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 12, color: "#6b7280" }}>Warehouse</Text>
              <Text style={{ fontSize: 12, fontWeight: "800", color: "#111827" }}>{sub.warehouse_location}</Text>
            </View>
          ) : null}

          {canSubmit && (
            <TouchableOpacity
              onPress={onSubmit}
              style={{ marginTop: 6, backgroundColor: "#0d47c9", borderRadius: 12, paddingVertical: 11, alignItems: "center" }}
            >
              <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900" }}>Submit to PM</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </Animated.View>
  );
}

// ─── New Report Modal ─────────────────────────────────────────────────────────

function NewReportModal({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const [nodes, setNodes] = useState<NodeOption[]>([]);
  const [selectedNode, setSelectedNode] = useState<NodeOption | null>(null);
  const [autoFill, setAutoFill] = useState<AutoFill | null>(null);
  const [loadingFill, setLoadingFill] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    total_cable: "", total_strand_length: "", total_node: "",
    total_amplifier: "", total_extender: "", total_tsc: "",
    total_powersupply: "", total_powersupply_housing: "", warehouse_location: "",
  });

  useEffect(() => {
    if (visible) loadNodes();
  }, [visible]);

  async function loadNodes() {
    try {
      const { data } = await api.get("/nodes?per_page=500");
      setNodes(data.data ?? data ?? []);
    } catch {}
  }

  async function selectNode(node: NodeOption) {
    setSelectedNode(node);
    setLoadingFill(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await api.get(`/teardown-submissions/autofill?node_id=${node.id}&date=${today}`);
      setAutoFill(data);
      setForm({
        total_cable:               String(data.total_cable || ""),
        total_strand_length:       "",
        total_node:                String(data.total_node || ""),
        total_amplifier:           String(data.total_amplifier || ""),
        total_extender:            String(data.total_extender || ""),
        total_tsc:                 String(data.total_tsc || ""),
        total_powersupply:         String(data.total_powersupply || ""),
        total_powersupply_housing: String(data.total_powersupply_housing || ""),
        warehouse_location:        "",
      });
    } catch {}
    finally { setLoadingFill(false); }
  }

  async function save() {
    if (!selectedNode) return;
    setSaving(true);
    try {
      await api.post("/teardown-submissions", {
        node_id:                   selectedNode.id,
        project_id:                selectedNode.project_id,
        total_cable:               Number(form.total_cable) || 0,
        total_strand_length:       Number(form.total_strand_length) || 0,
        total_node:                Number(form.total_node) || 0,
        total_amplifier:           Number(form.total_amplifier) || 0,
        total_extender:            Number(form.total_extender) || 0,
        total_tsc:                 Number(form.total_tsc) || 0,
        total_powersupply:         Number(form.total_powersupply) || 0,
        total_powersupply_housing: Number(form.total_powersupply_housing) || 0,
        warehouse_location:        form.warehouse_location || undefined,
      });
      onSaved();
      onClose();
      resetForm();
    } catch (e: any) {
      Alert.alert("Error", e.response?.data?.message ?? "Failed to save report.");
    } finally { setSaving(false); }
  }

  function resetForm() {
    setSelectedNode(null); setAutoFill(null);
    setForm({ total_cable: "", total_strand_length: "", total_node: "", total_amplifier: "",
      total_extender: "", total_tsc: "", total_powersupply: "", total_powersupply_housing: "", warehouse_location: "" });
  }

  const fields: { key: keyof typeof form; lbl: string }[] = [
    { key: "total_cable",               lbl: "Actual Cable (m)" },
    { key: "total_strand_length",       lbl: "Strand Length (m)" },
    { key: "total_node",                lbl: "Total Nodes" },
    { key: "total_amplifier",           lbl: "Total Amplifiers" },
    { key: "total_extender",            lbl: "Total Extenders" },
    { key: "total_tsc",                 lbl: "Total TSC" },
    { key: "total_powersupply",         lbl: "Total Power Supply" },
    { key: "total_powersupply_housing", lbl: "PS Housing" },
    { key: "warehouse_location",        lbl: "Warehouse Location" },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f3f4f6" }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" }}>
          <TouchableOpacity onPress={() => { onClose(); resetForm(); }}>
            <Text style={{ fontSize: 14, color: "#6b7280", fontWeight: "700" }}>Cancel</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 16, fontWeight: "900", color: "#111827" }}>New Daily Report</Text>
          <TouchableOpacity onPress={save} disabled={saving || !selectedNode}>
            <Text style={{ fontSize: 14, color: !selectedNode ? "#9ca3af" : "#0d47c9", fontWeight: "900" }}>
              {saving ? "Saving…" : "Save"}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 14 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#374151", marginBottom: 8 }}>SELECT NODE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {nodes.map(n => (
                  <TouchableOpacity
                    key={n.id}
                    onPress={() => selectNode(n)}
                    style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5,
                      borderColor: selectedNode?.id === n.id ? "#0d47c9" : "#e5e7eb",
                      backgroundColor: selectedNode?.id === n.id ? "#eef3ff" : "#fff" }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "800", color: selectedNode?.id === n.id ? "#0d47c9" : "#374151" }}>{n.node_id}</Text>
                    {n.node_name ? <Text style={{ fontSize: 9, color: "#9ca3af" }}>{n.node_name}</Text> : null}
                    {(n.city || n.province) ? (
                      <Text style={{ fontSize: 9, color: selectedNode?.id === n.id ? "#4b6bcc" : "#9ca3af" }}>
                        {[n.city, n.province].filter(Boolean).join(", ")}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {loadingFill && (
            <View style={{ alignItems: "center", paddingVertical: 12 }}>
              <ActivityIndicator color="#0d47c9" />
              <Text style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>Loading today's teardown data…</Text>
            </View>
          )}
          {autoFill && autoFill.log_count > 0 && (
            <View style={{ backgroundColor: "#eef3ff", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#c7d7fa" }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: "#0d47c9" }}>
                Auto-filled from {autoFill.log_count} teardown log{autoFill.log_count !== 1 ? "s" : ""} today
              </Text>
              <Text style={{ fontSize: 10, color: "#4b6bcc", marginTop: 2 }}>Edit the values below if needed</Text>
            </View>
          )}

          {selectedNode && (
            <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 14, gap: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#374151", marginBottom: 2 }}>QUANTITIES</Text>
              {fields.map(f => (
                <View key={f.key}>
                  <Text style={{ fontSize: 11, color: "#6b7280", fontWeight: "600", marginBottom: 4 }}>{f.lbl}</Text>
                  <TextInput
                    value={form[f.key]}
                    onChangeText={v => setForm(p => ({ ...p, [f.key]: v }))}
                    keyboardType={f.key === "warehouse_location" ? "default" : "numeric"}
                    placeholder="0"
                    placeholderTextColor="#d1d5db"
                    style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, fontWeight: "700", color: "#111827", backgroundColor: "#fafafa" }}
                  />
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function DailyReportScreen() {
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[today.getMonth()]);
  const [selectedDay,   setSelectedDay]   = useState(today.getDate());
  const [showMonthFilter, setShowMonthFilter] = useState(false);

  const [subs,       setSubs]       = useState<Submission[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal,  setShowModal]  = useState(false);

  useFocusEffect(useCallback(() => { load(); }, []));

  async function load() {
    // Show cached data instantly
    const cached = await cacheGet<Submission[]>("teardown_submissions");
    if (cached?.length) { setSubs(cached); setLoading(false); }

    // Fetch fresh in background
    try {
      const { data } = await api.get("/teardown-submissions?per_page=500");
      const fresh = data.data ?? data ?? [];
      cacheSet("teardown_submissions", fresh);
      setSubs(fresh);
    } catch { /* keep showing cached */ }
    finally { setLoading(false); setRefreshing(false); }
  }

  async function submitReport(sub: Submission) {
    Alert.alert(
      "Submit to PM",
      `Submit daily report for ${sub.node?.node_id ?? "this node"} on ${sub.report_date}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Submit", onPress: async () => {
            try {
              await api.post(`/teardown-submissions/${sub.id}/submit`, {});
              load();
            } catch (e: any) {
              Alert.alert("Error", e.response?.data?.message ?? "Failed to submit.");
            }
          }
        },
      ]
    );
  }

  const availableMonths = useMemo(() => {
    const set = new Set(subs.map(s => MONTHS[parseDateParts(s.report_date).month]));
    const from = MONTHS.filter(m => set.has(m));
    return from.length ? from : [MONTHS[today.getMonth()]];
  }, [subs]);

  const days = useMemo(() => {
    const year = today.getFullYear();
    const monthIdx = MONTHS.indexOf(selectedMonth);
    const count = new Date(year, monthIdx + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(year, monthIdx, i + 1);
      return { number: i + 1, name: d.toLocaleDateString("en", { weekday: "short" }).slice(0, 3) };
    });
  }, [selectedMonth]);

  const filteredSubs = useMemo(() => {
    return subs.filter(s => {
      const { month, day } = parseDateParts(s.report_date);
      return MONTHS[month] === selectedMonth && day === selectedDay;
    });
  }, [subs, selectedMonth, selectedDay]);

  const totalCable  = useMemo(() => filteredSubs.reduce((s, r) => s + n2(r.total_cable), 0), [filteredSubs]);
  const totalStrand = useMemo(() => filteredSubs.reduce((s, r) => s + n2(r.total_strand_length), 0), [filteredSubs]);

  const listHeader = (
    <>
      <View style={styles.topCard}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <Text style={styles.title}>Daily Report</Text>
          <TouchableOpacity
            onPress={() => setShowModal(true)}
            style={{ backgroundColor: "#0d47c9", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 }}
          >
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900" }}>+ New</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Filter by date</Text>
          <View style={styles.filterWrapper}>
            <TouchableOpacity style={styles.dateSelector} onPress={() => setShowMonthFilter(v => !v)} activeOpacity={0.8}>
              <Text style={styles.dateSelectorText}>{selectedMonth}</Text>
              <Text style={styles.arrow}>{showMonthFilter ? "⌃" : "⌄"}</Text>
            </TouchableOpacity>
            {showMonthFilter && (
              <View style={styles.dropdown}>
                {availableMonths.map(month => (
                  <TouchableOpacity
                    key={month}
                    style={styles.dropdownItem}
                    onPress={() => { setSelectedMonth(month); setShowMonthFilter(false); }}
                  >
                    <Text style={styles.dropdownText}>{month}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          <Text style={styles.selectedDateText}>{selectedMonth} {selectedDay}</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateScrollContent}>
          {days.map(day => {
            const isActive = selectedDay === day.number;
            return (
              <TouchableOpacity key={day.number} style={styles.dayItem} onPress={() => setSelectedDay(day.number)} activeOpacity={0.8}>
                <View style={[styles.dayNumberBox, isActive && styles.dayActiveBox]}>
                  <Text style={[styles.dayNumber, isActive && styles.dayActiveText]}>{day.number}</Text>
                </View>
                <View style={[styles.dayNameBox, isActive && styles.dayActiveBox]}>
                  <Text style={[styles.dayName, isActive && styles.dayActiveText]}>{day.name}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.totalCard}>
        <View style={styles.totalRow}>
          <View style={styles.totalBox}>
            <Text style={styles.totalValue}>{filteredSubs.length}</Text>
            <Text style={styles.totalLabel}>Total Reports</Text>
          </View>
          <View style={styles.totalBox}>
            <Text style={styles.totalValue}>{fmtLen(totalStrand)}</Text>
            <Text style={styles.totalLabel}>Total Strand</Text>
          </View>
        </View>
        <View style={styles.totalRow}>
          <View style={styles.totalBox}>
            <Text style={styles.totalValue}>{fmtLen(totalCable)}</Text>
            <Text style={styles.totalLabel}>Actual Cable</Text>
          </View>
          <View style={styles.totalBox}>
            <Text style={styles.totalValue}>
              {filteredSubs.filter(s => s.status === "pm_approved" || s.status === "telcovantage_approved").length}
            </Text>
            <Text style={styles.totalLabel}>Approved</Text>
          </View>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.summaryTitle}>Report Cards</Text>
        <Text style={styles.summaryCount}>{filteredSubs.length} record{filteredSubs.length !== 1 ? "s" : ""}</Text>
      </View>

      {loading && (
        <View style={{ backgroundColor: "#fff", borderRadius: 20, paddingVertical: 48, alignItems: "center", marginBottom: 12 }}>
          <ActivityIndicator color="#0d47c9" />
          <Text style={{ color: "#9ca3af", marginTop: 10, fontSize: 12 }}>Loading reports…</Text>
        </View>
      )}

      {!loading && filteredSubs.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={{ fontSize: 40 }}>📋</Text>
          <Text style={styles.emptyTitle}>No reports found</Text>
          <Text style={styles.emptyText}>
            No records for {selectedMonth} {selectedDay}.{"\n"}Tap "+ New" to create one.
          </Text>
        </View>
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        data={loading ? [] : filteredSubs}
        keyExtractor={item => String(item.id)}
        renderItem={({ item, index }) => (
          <ReportCard sub={item} delay={60 + index * 40} onSubmit={() => submitReport(item)} />
        )}
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

      <NewReportModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSaved={load}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: "#f3f4f6" },
  listContent: { padding: 16, paddingBottom: 40 },

  topCard:          { backgroundColor: "#e9eeea", borderRadius: 30, padding: 20, marginBottom: 16 },
  title:            { fontSize: 24, fontWeight: "700", color: "#111111" },
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

  reportCard: { backgroundColor: "#fff", borderRadius: 20, marginBottom: 12, overflow: "hidden", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6 },

  emptyCard:  { backgroundColor: "#f8f8f8", borderRadius: 20, padding: 32, alignItems: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#111111", marginTop: 12, marginBottom: 6 },
  emptyText:  { fontSize: 13, color: "#666666", textAlign: "center" },
});
