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

const deliveries = [
  {
    id: "1",
    nodeId: "NODE-101",
    customerName: "Mark Laurence",
    company: "UIverse Logistics, Inc.",
    amount: "$900",
    status: "Pending Delivery",
    pickup: "Marlboro, NJ",
    dropoff: "Mansfield, PA",
    date: "Jun 07, Wed",
    units: ["TL", "F", "48 ft", "46000 lbs"],
  },
  {
    id: "2",
    nodeId: "NODE-102",
    customerName: "Jane Doe",
    company: "Prime Route Cargo",
    amount: "$1120",
    status: "In Transit",
    pickup: "Newark, NJ",
    dropoff: "Scranton, PA",
    date: "Jun 09, Fri",
    units: ["TL", "R", "53 ft", "42000 lbs"],
  },
  {
    id: "3",
    nodeId: "NODE-103",
    customerName: "Carlos Reyes",
    company: "NorthLink Freight",
    amount: "$840",
    status: "Delivered",
    pickup: "Trenton, NJ",
    dropoff: "Allentown, PA",
    date: "Jun 10, Sat",
    units: ["LTL", "Dry", "24 ft", "18000 lbs"],
  },
];

function getStatusColors(status: string) {
  switch (status) {
    case "Pending Delivery":
      return {
        bg: "#FEF3C7",
        text: "#92400E",
      };
    case "In Transit":
      return {
        bg: "#DBEAFE",
        text: "#1D4ED8",
      };
    case "Delivered":
      return {
        bg: "#DCFCE7",
        text: "#166534",
      };
    default:
      return {
        bg: "#E5E7EB",
        text: "#374151",
      };
  }
}

export default function DeliveryScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Delivery Dashboard</Text>
        <Text style={styles.subtitle}>Track deliveries by node ID</Text>
      </View>

      <FlatList
        data={deliveries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const statusColors = getStatusColors(item.status);

          return (
            <Pressable
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: "/deliveries/deliveryreportsummary",
                  params: {
                    id: item.id,
                    nodeId: item.nodeId,
                    customerName: item.customerName,
                    company: item.company,
                    status: item.status,
                  },
                })
              }
            >
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nodeId}>{item.nodeId}</Text>
                  <Text style={styles.customer}>{item.customerName}</Text>
                  <Text style={styles.company}>{item.company}</Text>
                </View>

                <Text style={styles.amount}>{item.amount}</Text>
              </View>

              <View style={styles.routeCard}>
                <View style={styles.routeLeft}>
                  <Text style={styles.date}>{item.date}</Text>

                  <View style={styles.routeGroup}>
                    <View style={styles.routeRow}>
                      <View style={styles.circle} />
                      <Text style={styles.routeText}>{item.pickup}</Text>
                    </View>

                    <View style={styles.dottedLine} />

                    <View style={styles.routeRow}>
                      <View style={styles.square} />
                      <Text style={styles.routeText}>{item.dropoff}</Text>
                    </View>
                  </View>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: statusColors.bg },
                  ]}
                >
                  <Text
                    style={[styles.statusText, { color: statusColors.text }]}
                  >
                    {item.status}
                  </Text>
                </View>
              </View>

              <View style={styles.pillsRow}>
                <View style={styles.pillsWrap}>
                  {item.units.map((unit) => (
                    <View key={unit} style={styles.pill}>
                      <Text style={styles.pillText}>{unit}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.footerRow}>
                <Text style={styles.footerLabel}>View Summary</Text>
                <Text style={styles.footerArrow}>›</Text>
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
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#EEF2F7",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  nodeId: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
  },
  customer: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  company: {
    marginTop: 3,
    fontSize: 13,
    color: "#6B7280",
  },
  amount: {
    fontSize: 22,
    fontWeight: "800",
    color: "#00B529",
    marginLeft: 12,
  },
  routeCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    columnGap: 12,
    marginBottom: 14,
  },
  routeLeft: {
    flex: 1,
  },
  date: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
    marginBottom: 10,
  },
  routeGroup: {
    paddingLeft: 2,
    position: "relative",
  },
  dottedLine: {
    position: "absolute",
    left: 4,
    top: 18,
    bottom: 18,
    borderLeftWidth: 2,
    borderStyle: "dotted",
    borderColor: "#C4C4C4",
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  circle: {
    width: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#737373",
    backgroundColor: "#fff",
    marginRight: 10,
    zIndex: 2,
  },
  square: {
    width: 10,
    height: 10,
    borderWidth: 2,
    borderColor: "#FF9D1F",
    backgroundColor: "#fff",
    marginRight: 10,
    zIndex: 2,
  },
  routeText: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "800",
  },
  pillsRow: {
    marginBottom: 12,
  },
  pillsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  pill: {
    backgroundColor: "#E4F7E8",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillText: {
    fontSize: 12,
    color: "#484848",
    fontWeight: "600",
  },
  footerRow: {
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0284C7",
  },
  footerArrow: {
    fontSize: 22,
    color: "#0284C7",
    fontWeight: "800",
    lineHeight: 22,
  },
});
