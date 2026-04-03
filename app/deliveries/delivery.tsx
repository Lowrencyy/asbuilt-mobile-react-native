import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
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
    company: "Telcovantage Philippines.",
    amount: "$900",
    status: "Pending Delivery",
    pickup: "Marlboro, NJ",
    dropoff: "Mansfield, PA",
    date: "Jun 07, Wed",
    units: ["TL", "F", "48 ft", "46000 lbs"],
  },
];

function getStatusColors(status: string) {
  switch (status) {
    case "Pending Delivery":
      return {
        bg: "#FEF3C7",
        text: "#92400E",
        dot: "#F59E0B",
      };
    case "In Transit":
      return {
        bg: "#DBEAFE",
        text: "#1D4ED8",
        dot: "#2563EB",
      };
    case "Delivered":
      return {
        bg: "#DCFCE7",
        text: "#166534",
        dot: "#16A34A",
      };
    default:
      return {
        bg: "#E5E7EB",
        text: "#374151",
        dot: "#6B7280",
      };
  }
}

export default function DeliveryScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Delivery Dashboard</Text>
            <Text style={styles.subtitle}>Track deliveries by node ID</Text>
          </View>

          <Pressable style={styles.headerIcon}>
            <Ionicons name="options-outline" size={20} color="#111827" />
          </Pressable>
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
                  <View style={styles.nodeBadge}>
                    <Text style={styles.nodeBadgeText}>{item.nodeId}</Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: statusColors.bg },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: statusColors.dot },
                      ]}
                    />
                    <Text
                      style={[styles.statusText, { color: statusColors.text }]}
                    >
                      {item.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.mainInfo}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.customer}>{item.customerName}</Text>
                    <Text style={styles.company}>{item.company}</Text>
                  </View>

                  <Text style={styles.amount}>{item.amount}</Text>
                </View>

                <View style={styles.routeWrap}>
                  <View style={styles.routeLine} />

                  <View style={styles.routeItem}>
                    <View style={styles.pickupDot} />
                    <View style={styles.routeTextWrap}>
                      <Text style={styles.routeLabel}>Pickup</Text>
                      <Text style={styles.routeText}>{item.pickup}</Text>
                    </View>
                  </View>

                  <View style={styles.routeItem}>
                    <View style={styles.dropoffDot} />
                    <View style={styles.routeTextWrap}>
                      <Text style={styles.routeLabel}>Dropoff</Text>
                      <Text style={styles.routeText}>{item.dropoff}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Ionicons
                      name="calendar-outline"
                      size={15}
                      color="#6B7280"
                    />
                    <Text style={styles.metaText}>{item.date}</Text>
                  </View>

                  <View style={styles.metaItem}>
                    <Ionicons name="cube-outline" size={15} color="#6B7280" />
                    <Text style={styles.metaText}>
                      {item.units.join(" • ")}
                    </Text>
                  </View>
                </View>

                <View style={styles.bottomRow}>
                  <Text style={styles.bottomLabel}>View Summary</Text>
                  <View style={styles.arrowWrap}>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color="#111827"
                    />
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F6F8",
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.6,
  },

  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: "#6B7280",
  },

  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E9EEF5",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },

  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  nodeBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },

  nodeBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4B5563",
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    gap: 6,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },

  statusText: {
    fontSize: 12,
    fontWeight: "800",
  },

  mainInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 18,
  },

  customer: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.3,
  },

  company: {
    marginTop: 4,
    fontSize: 13,
    color: "#6B7280",
  },

  amount: {
    fontSize: 24,
    fontWeight: "800",
    color: "#16A34A",
  },

  routeWrap: {
    position: "relative",
    paddingLeft: 4,
    marginBottom: 16,
    gap: 14,
  },

  routeLine: {
    position: "absolute",
    left: 8,
    top: 10,
    bottom: 10,
    width: 1.5,
    backgroundColor: "#D1D5DB",
  },

  routeItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  pickupDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#111827",
    backgroundColor: "#FFFFFF",
    marginRight: 12,
    zIndex: 2,
    marginTop: 3,
  },

  dropoffDot: {
    width: 12,
    height: 12,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#F59E0B",
    backgroundColor: "#FFFFFF",
    marginRight: 12,
    zIndex: 2,
    marginTop: 3,
  },

  routeTextWrap: {
    flex: 1,
  },

  routeLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },

  routeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },

  metaRow: {
    gap: 10,
    marginBottom: 14,
  },

  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  metaText: {
    flex: 1,
    fontSize: 13,
    color: "#6B7280",
  },

  bottomRow: {
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  bottomLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },

  arrowWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
});
