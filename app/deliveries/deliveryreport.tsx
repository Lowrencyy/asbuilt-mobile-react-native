import { router } from "expo-router";
import React from "react";
import {
    FlatList,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from "react-native";

const reports = [
  {
    id: "r1",
    nodeId: "NODE-101",
    title: "Daily Report Submitted",
    submittedBy: "Mark Laurence",
    date: "Mar 23, 2026",
    status: "Pending Delivery",
  },
  {
    id: "r2",
    nodeId: "NODE-102",
    title: "Arrived At Warehouse",
    submittedBy: "Jane Doe",
    date: "Mar 24, 2026",
    status: "In Transit",
  },
  {
    id: "r3",
    nodeId: "NODE-103",
    title: "Package Delivered",
    submittedBy: "Carlos Reyes",
    date: "Mar 20, 2026",
    status: "Delivered",
  },
];

function getStatusColors(status: string) {
  switch (status) {
    case "Pending Delivery":
      return { bg: "#FEF3C7", text: "#92400E" };
    case "In Transit":
      return { bg: "#DBEAFE", text: "#1D4ED8" };
    case "Delivered":
      return { bg: "#DCFCE7", text: "#166534" };
    default:
      return { bg: "#E5E7EB", text: "#374151" };
  }
}

export default function DeliveryReportsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Delivery Reports</Text>
        <Text style={styles.subtitle}>Daily reports and delivery updates</Text>
      </View>

      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const colors = getStatusColors(item.status);

          return (
            <Pressable
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: "/deliveries/deliveryreportsummary",
                  params: {
                    id: item.id,
                    nodeId: item.nodeId,
                    customerName: item.submittedBy,
                    status: item.status,
                    company: "Delivery Report",
                  },
                })
              }
            >
              <View style={styles.cardTop}>
                <View style={styles.iconWrap}>
                  <View style={styles.iconDot} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.reportTitle}>{item.title}</Text>
                  <Text style={styles.reportMeta}>
                    Submitted by {item.submittedBy}
                  </Text>
                  <Text style={styles.reportDate}>{item.date}</Text>
                </View>

                <View style={[styles.badge, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.badgeText, { color: colors.text }]}>
                    {item.status}
                  </Text>
                </View>
              </View>

              <View style={styles.bottomRow}>
                <Text style={styles.nodeText}>{item.nodeId}</Text>
                <Text style={styles.linkText}>Open Summary</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F6F8FB",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#111827",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: "#6B7280",
  },
  content: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EEF2F7",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 12,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  iconDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: "#0284C7",
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  reportMeta: {
    marginTop: 4,
    fontSize: 13,
    color: "#4B5563",
  },
  reportDate: {
    marginTop: 6,
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  bottomRow: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  nodeText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "700",
  },
  linkText: {
    fontSize: 14,
    color: "#0284C7",
    fontWeight: "800",
  },
});
