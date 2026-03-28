import { useLocalSearchParams } from "expo-router";
import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

export default function DeliveryReportSummaryScreen() {
  const { nodeId, customerName, deliveryId } = useLocalSearchParams<{
    nodeId?: string;
    customerName?: string;
    deliveryId?: string;
  }>();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.label}>Delivery Summary</Text>
          <Text style={styles.node}>{nodeId || "NODE-101"}</Text>
          <Text style={styles.customer}>{customerName || "Mark Laurence"}</Text>
          <Text style={styles.meta}>Delivery ID: {deliveryId || "load-1"}</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Approval</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Approved By</Text>
            <Text style={styles.rowValue}>Jane Doe</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Approval Date</Text>
            <Text style={styles.rowValue}>Mar 23, 2026</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Status</Text>
            <Text style={styles.rowValue}>Approved for Delivery</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Daily Report</Text>
          <Text style={styles.paragraph}>
            Materials are approved and ready for lineman deployment. Delivery
            route has been confirmed and truck assignment is complete.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F6F8FB" },
  content: { padding: 16, paddingBottom: 32 },
  headerCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
  },
  label: { fontSize: 12, fontWeight: "700", color: "#64748B" },
  node: { marginTop: 4, fontSize: 24, fontWeight: "800", color: "#111827" },
  customer: { marginTop: 6, fontSize: 16, fontWeight: "700", color: "#374151" },
  meta: { marginTop: 6, fontSize: 13, color: "#64748B" },

  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  rowLabel: { fontSize: 13, color: "#64748B" },
  rowValue: { fontSize: 13, fontWeight: "800", color: "#111827" },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    color: "#475569",
  },
});
