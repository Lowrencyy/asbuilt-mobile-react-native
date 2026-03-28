import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import {
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

const allLoads = [
  {
    id: "load-1",
    company: "UIverse Logistics, Inc.",
    price: "$900",
    time: "3h",
    ratePerMile: "$3.60/mi",
    month: "Jun",
    date: "07",
    day: "Wed",
    pickupCity: "Marlboro, NJ",
    pickupMi: "16 mi",
    dropoffCity: "Mansfield, PA",
    dropoffMi: "157 mi",
    rateCheck: "$950",
    rateCheckPerMile: "$3.80/mi",
    units: ["TL", "F", "48 ft", "46000 lbs"],
    totalMiles: "197mi",
    approved: true,
  },
  {
    id: "load-2",
    company: "Prime Route Cargo",
    price: "$1120",
    time: "5h",
    ratePerMile: "$4.10/mi",
    month: "Jun",
    date: "09",
    day: "Fri",
    pickupCity: "Newark, NJ",
    pickupMi: "8 mi",
    dropoffCity: "Scranton, PA",
    dropoffMi: "182 mi",
    rateCheck: "$1180",
    rateCheckPerMile: "$4.30/mi",
    units: ["TL", "R", "53 ft", "42000 lbs"],
    totalMiles: "190mi",
    approved: false,
  },
];

function LoadCard({
  item,
  nodeId,
  customerName,
  role,
}: {
  item: any;
  nodeId?: string;
  customerName?: string;
  role?: string;
}) {
  const canViewSummary = role === "warehouse" || item.approved;

  return (
    <View style={styles.loadCard}>
      <View style={styles.cardNamePrice}>
        <Text style={styles.loadCardName}>{item.company}</Text>
        <Text style={styles.loadCardPrice}>{item.price}</Text>
      </View>

      <View style={styles.cardTime}>
        <Text style={styles.smallMuted}>{item.time}</Text>
        <Text style={styles.smallMuted}>{item.ratePerMile}</Text>
      </View>

      <View style={styles.cardInfo}>
        <View style={styles.cardDateWrapper}>
          <Text style={styles.smallMuted}>{item.month}</Text>
          <Text style={styles.cardDate}>{item.date}</Text>
          <Text style={styles.smallMuted}>{item.day}</Text>
        </View>

        <View style={styles.cardCityUnitWrapper}>
          <View style={styles.cityWithMi}>
            <View style={styles.roundIcon} />
            <Text style={styles.cityName}>{item.pickupCity}</Text>
            <Text style={styles.smallMuted}>{item.pickupMi}</Text>
          </View>

          <View style={styles.routeLine} />

          <View style={styles.cityWithMi}>
            <View style={styles.squareIcon} />
            <Text style={styles.cityName}>{item.dropoffCity}</Text>
            <Text style={styles.smallMuted}>{item.dropoffMi}</Text>
          </View>
        </View>

        <View style={styles.rateCheckBox}>
          <Text style={styles.rcLabel}>RATE CHECK</Text>
          <Text style={styles.rateValue}>{item.rateCheck}</Text>
          <Text style={styles.rcLabel}>{item.rateCheckPerMile}</Text>
        </View>
      </View>

      <View style={styles.unitsWrapper}>
        <View style={styles.pillsWrapper}>
          {item.units.map((unit: string) => (
            <View key={unit} style={styles.unitPill}>
              <Text style={styles.unitPillText}>{unit}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.smallMuted}>{item.totalMiles}</Text>
      </View>

      <View style={styles.cardFooter}>
        <View
          style={[
            styles.approvalBadge,
            item.approved ? styles.approvedBadge : styles.pendingBadge,
          ]}
        >
          <Text
            style={[
              styles.approvalText,
              item.approved ? styles.approvedText : styles.pendingText,
            ]}
          >
            {item.approved ? "Approved" : "Awaiting Approval"}
          </Text>
        </View>

        {canViewSummary ? (
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/deliveries/deliveryreportsummary",
                params: {
                  nodeId,
                  customerName,
                  deliveryId: item.id,
                },
              })
            }
          >
            <Text style={styles.summaryLink}>View Summary</Text>
          </Pressable>
        ) : (
          <Text style={styles.disabledText}>Lineman cannot open yet</Text>
        )}
      </View>
    </View>
  );
}

export default function DeliveryNodeScreen() {
  const { nodeId, customerName, role } = useLocalSearchParams<{
    id?: string;
    nodeId?: string;
    customerName?: string;
    role?: string;
  }>();

  const visibleLoads =
    role === "warehouse" ? allLoads : allLoads.filter((item) => item.approved);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.headerLabel}>Deliveries</Text>
          <Text style={styles.headerNode}>{nodeId || "NODE-101"}</Text>
          <Text style={styles.headerCustomer}>
            {customerName || "Mark Laurence"}
          </Text>
          <Text style={styles.headerRole}>
            {role === "warehouse"
              ? "Warehouse can view all pending for delivery"
              : "Lineman sees approved deliveries only"}
          </Text>
        </View>

        {visibleLoads.map((item) => (
          <LoadCard
            key={item.id}
            item={item}
            nodeId={nodeId}
            customerName={customerName}
            role={role}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F6F8FB" },
  content: { padding: 16, paddingBottom: 32 },
  headerCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  headerLabel: { fontSize: 12, color: "#6B7280", fontWeight: "700" },
  headerNode: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
  },
  headerCustomer: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: "700",
    color: "#374151",
  },
  headerRole: { marginTop: 6, fontSize: 13, color: "#64748B" },

  loadCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    borderBottomWidth: 6,
    borderBottomColor: "rgb(228, 247, 232)",
  },
  cardNamePrice: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  loadCardName: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#484848",
    paddingRight: 12,
  },
  loadCardPrice: {
    fontSize: 20,
    fontWeight: "700",
    color: "rgb(0, 181, 41)",
  },
  cardTime: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
    marginBottom: 10,
  },
  smallMuted: { fontSize: 12, color: "#6b7280" },
  cardInfo: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    marginBottom: 12,
  },
  cardDateWrapper: { alignItems: "center", width: 50 },
  cardDate: {
    fontSize: 28,
    fontWeight: "700",
    color: "#484848",
    lineHeight: 32,
  },
  cardCityUnitWrapper: {
    flex: 1,
    position: "relative",
    paddingLeft: 2,
    rowGap: 20,
  },
  routeLine: {
    position: "absolute",
    left: 4,
    top: 12,
    bottom: 12,
    borderLeftWidth: 2,
    borderStyle: "dotted",
    borderColor: "#9ca3af",
  },
  cityWithMi: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    zIndex: 2,
  },
  roundIcon: {
    width: 10,
    height: 10,
    borderRadius: 99,
    borderWidth: 2,
    borderColor: "gray",
    backgroundColor: "#fff",
  },
  squareIcon: {
    width: 10,
    height: 10,
    borderWidth: 2,
    borderColor: "rgb(255, 157, 31)",
    backgroundColor: "#fff",
  },
  cityName: {
    flex: 1,
    fontSize: 14,
    color: "#484848",
    fontWeight: "500",
  },
  rateCheckBox: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#919191",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: "center",
    minWidth: 74,
  },
  rcLabel: { fontSize: 9, color: "#6b7280" },
  rateValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#484848",
    marginVertical: 2,
  },
  unitsWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pillsWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  unitPill: {
    backgroundColor: "rgb(228, 247, 232)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  unitPillText: { fontSize: 12, color: "#484848", fontWeight: "500" },

  cardFooter: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  approvalBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  approvedBadge: { backgroundColor: "#DCFCE7" },
  pendingBadge: { backgroundColor: "#FEF3C7" },
  approvalText: { fontSize: 12, fontWeight: "800" },
  approvedText: { color: "#166534" },
  pendingText: { color: "#92400E" },
  summaryLink: { fontSize: 14, fontWeight: "800", color: "#0284C7" },
  disabledText: { fontSize: 12, color: "#94A3B8", fontWeight: "700" },
});
