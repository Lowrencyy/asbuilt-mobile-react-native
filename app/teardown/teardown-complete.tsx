import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp, ZoomIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const PRIMARY = "#0A5C3B";

export default function TeardownCompleteScreen() {
  const {
    from_pole_code,
    from_pole_name,
    to_pole_id,
    to_pole_code,
    to_pole_name,
    node_id,
    project_id,
    project_name,
    accent,
    span_id,
    cable_collected,
    expected_cable,
    length_meters,
    node_count,
    amplifier_count,
    extender_count,
    tsc_count,
    ps_count,
    ps_housing_count,
    submitted_at,
  } = useLocalSearchParams<Record<string, string>>();

  const [showLog, setShowLog] = useState(false);

  const accentColor = accent || PRIMARY;
  const dateStr = submitted_at
    ? new Date(submitted_at).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })
    : new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });

  function goToNext() {
    router.replace({
      pathname: "/projects/pole-detail" as any,
      params: {
        pole_id:      to_pole_id,
        pole_code:    to_pole_code,
        pole_name:    to_pole_name,
        node_id,
        project_id,
        project_name,
        accent,
      },
    });
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Check icon ── */}
        <Animated.View entering={ZoomIn.delay(80).springify()} style={styles.iconWrap}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>✓</Text>
          </View>
        </Animated.View>

        {/* ── Title ── */}
        <Animated.View entering={FadeInDown.delay(200)} style={{ alignItems: "center", marginBottom: 6 }}>
          <Text style={styles.title}>Teardown Complete</Text>
          <Text style={styles.subtitle}>{dateStr}</Text>
        </Animated.View>

        {/* ── Span card ── */}
        <Animated.View entering={FadeInDown.delay(300)} style={styles.spanCard}>
          <Text style={styles.spanLabel}>Completed Span</Text>
          <View style={styles.spanRow}>
            <View style={styles.poleChip}>
              <Text style={styles.poleChipText}>{from_pole_code ?? "—"}</Text>
            </View>
            <Text style={styles.arrow}>→</Text>
            <View style={[styles.poleChip, { backgroundColor: "#dbeafe" }]}>
              <Text style={[styles.poleChipText, { color: "#1e40af" }]}>{to_pole_code ?? "—"}</Text>
            </View>
          </View>
          <Text style={styles.nodeText}>Node: {project_name ?? ""} · {node_id ?? ""}</Text>
        </Animated.View>

        {/* ── Primary action ── */}
        <Animated.View entering={FadeInDown.delay(400)} style={{ width: "100%" }}>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: accentColor }]} onPress={goToNext} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Go to Next  →</Text>
            <Text style={styles.primaryBtnSub}>Continue teardown on {to_pole_code}</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* ── Secondary actions ── */}
        <Animated.View entering={FadeInUp.delay(500)} style={styles.secondaryRow}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowLog(true)} activeOpacity={0.8}>
            <Text style={styles.secondaryIcon}>📋</Text>
            <Text style={styles.secondaryLabel}>View Teardown{"\n"}Logs</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.replace("/(tabs)/tasks" as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryIcon}>📊</Text>
            <Text style={styles.secondaryLabel}>View Daily{"\n"}Reports</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.replace("/(tabs)" as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryIcon}>🏠</Text>
            <Text style={styles.secondaryLabel}>Go to{"\n"}Dashboard</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {/* ── Log details modal ── */}
      <Modal visible={showLog} animationType="slide" transparent statusBarTranslucent>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowLog(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Teardown Log Details</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Row label="From Pole"   value={`${from_pole_code ?? "—"}  ${from_pole_name ? `(${from_pole_name})` : ""}`} />
            <Row label="To Pole"     value={`${to_pole_code ?? "—"}  ${to_pole_name ? `(${to_pole_name})` : ""}`} />
            <Row label="Node"        value={node_id ?? "—"} />
            <Row label="Project"     value={project_name ?? "—"} />
            <Row label="Submitted"   value={dateStr} />
            <Row label="Span ID"     value={span_id ?? "—"} />

            <View style={styles.divider} />
            <Text style={styles.sectionHead}>Cable</Text>
            <Row label="Collected"   value={cable_collected === "1" ? "Yes" : "No"} />
            <Row label="Length"      value={length_meters ? `${Number(length_meters).toLocaleString()} m` : "—"} />
            <Row label="Expected"    value={expected_cable ? `${Number(expected_cable).toLocaleString()} m` : "—"} />

            <View style={styles.divider} />
            <Text style={styles.sectionHead}>Components</Text>
            <Row label="Node"           value={node_count      ?? "0"} />
            <Row label="Amplifier"      value={amplifier_count ?? "0"} />
            <Row label="Extender"       value={extender_count  ?? "0"} />
            <Row label="TSC"            value={tsc_count       ?? "0"} />
            <Row label="Power Supply"   value={ps_count        ?? "0"} />
            <Row label="PS Housing"     value={ps_housing_count ?? "0"} />
          </ScrollView>

          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: PRIMARY, marginTop: 16 }]} onPress={() => setShowLog(false)}>
            <Text style={styles.primaryBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row:   { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  label: { fontSize: 13, color: "#6b7280", fontWeight: "600", flex: 1 },
  value: { fontSize: 13, color: "#111827", fontWeight: "700", flex: 2, textAlign: "right" },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8faf9" },
  content:   { alignItems: "center", paddingHorizontal: 20, paddingTop: 32, paddingBottom: 40 },

  iconWrap:   { marginBottom: 20 },
  iconCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: "#dcfce7",
    alignItems: "center", justifyContent: "center",
    shadowColor: PRIMARY, shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  iconText: { fontSize: 44, color: PRIMARY },

  title:    { fontSize: 24, fontWeight: "900", color: "#111827", letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: "#6b7280", marginTop: 4 },

  spanCard: {
    width: "100%", backgroundColor: "#fff", borderRadius: 20, padding: 18, marginTop: 20,
    borderWidth: 1, borderColor: "#e5e7eb",
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  spanLabel:    { fontSize: 10, fontWeight: "800", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 },
  spanRow:      { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  poleChip:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: "#dcfce7" },
  poleChipText: { fontSize: 14, fontWeight: "800", color: PRIMARY },
  arrow:        { fontSize: 18, color: "#9ca3af", fontWeight: "700" },
  nodeText:     { fontSize: 12, color: "#6b7280", fontWeight: "600" },

  primaryBtn: {
    width: "100%", borderRadius: 18, paddingVertical: 18, paddingHorizontal: 24,
    alignItems: "center", marginTop: 24,
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  primaryBtnText: { fontSize: 17, fontWeight: "900", color: "#fff", letterSpacing: 0.2 },
  primaryBtnSub:  { fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 3 },

  secondaryRow: { flexDirection: "row", gap: 12, marginTop: 16, width: "100%" },
  secondaryBtn: {
    flex: 1, backgroundColor: "#fff", borderRadius: 16, padding: 14, alignItems: "center",
    borderWidth: 1, borderColor: "#e5e7eb",
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  secondaryIcon:  { fontSize: 24, marginBottom: 6 },
  secondaryLabel: { fontSize: 11, fontWeight: "700", color: "#374151", textAlign: "center", lineHeight: 16 },

  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 36, maxHeight: "85%",
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#e5e7eb", alignSelf: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "900", color: "#111827", marginBottom: 20 },
  divider:    { height: 1, backgroundColor: "#f3f4f6", marginVertical: 12 },
  sectionHead:{ fontSize: 11, fontWeight: "800", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
});
