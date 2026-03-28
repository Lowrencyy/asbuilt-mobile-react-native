import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type ReportItem = {
  id: string;
  month: string;
  day: number;
  nodeId: string;
  lineman: string;
  area: string;
  cable: number;
  node: number;
  amplifier: number;
  extender: number;
  tsc: number;
  powerSupply: number;
  strandLength: number;
  actualCable: number;
  remarks: string;
  approved: boolean;
  approvedBy: string;
  projectStatus: string;
  deliveryStatus: string;
  arrivedWarehouse: boolean;
};

const reports: ReportItem[] = [
  {
    id: "1",
    month: "September",
    day: 11,
    nodeId: "ND-1001",
    lineman: "Team Arvin",
    area: "Area 1",
    cable: 3,
    node: 1,
    amplifier: 2,
    extender: 1,
    tsc: 1,
    powerSupply: 1,
    strandLength: 120,
    actualCable: 360,
    remarks: "3 wires collected in one pole span",
    approved: true,
    approvedBy: "Engr. Santos",
    projectStatus: "Completed",
    deliveryStatus: "Delivered",
    arrivedWarehouse: true,
  },
  {
    id: "2",
    month: "September",
    day: 11,
    nodeId: "ND-1002",
    lineman: "Team Mark",
    area: "Area 2",
    cable: 2,
    node: 0,
    amplifier: 1,
    extender: 1,
    tsc: 0,
    powerSupply: 1,
    strandLength: 90,
    actualCable: 180,
    remarks: "Partial recovery completed",
    approved: false,
    approvedBy: "-",
    projectStatus: "Ongoing",
    deliveryStatus: "In Transit",
    arrivedWarehouse: false,
  },
  {
    id: "3",
    month: "September",
    day: 11,
    nodeId: "ND-1003",
    lineman: "Team John",
    area: "Area 3",
    cable: 1,
    node: 1,
    amplifier: 0,
    extender: 0,
    tsc: 1,
    powerSupply: 0,
    strandLength: 75,
    actualCable: 150,
    remarks: "Collected from side street line",
    approved: true,
    approvedBy: "Supervisor Reyes",
    projectStatus: "For Validation",
    deliveryStatus: "Pending Delivery",
    arrivedWarehouse: false,
  },
  {
    id: "4",
    month: "September",
    day: 12,
    nodeId: "ND-1004",
    lineman: "Team Arvin",
    area: "Area 1",
    cable: 4,
    node: 1,
    amplifier: 2,
    extender: 2,
    tsc: 1,
    powerSupply: 1,
    strandLength: 160,
    actualCable: 420,
    remarks: "Heavy collection for main road",
    approved: true,
    approvedBy: "Engr. Lopez",
    projectStatus: "Completed",
    deliveryStatus: "Delivered",
    arrivedWarehouse: true,
  },
  {
    id: "5",
    month: "October",
    day: 11,
    nodeId: "ND-1005",
    lineman: "Team Mark",
    area: "Area 4",
    cable: 2,
    node: 1,
    amplifier: 1,
    extender: 0,
    tsc: 0,
    powerSupply: 1,
    strandLength: 110,
    actualCable: 210,
    remarks: "With damaged cable section",
    approved: false,
    approvedBy: "-",
    projectStatus: "Ongoing",
    deliveryStatus: "Pending",
    arrivedWarehouse: false,
  },
];

export default function DailyReportScreen() {
  const [selectedMonth, setSelectedMonth] = useState("September");
  const [selectedDay, setSelectedDay] = useState(11);
  const [showMonthFilter, setShowMonthFilter] = useState(false);

  const months = ["September", "October", "November"];

  const days = [
    { number: 8, name: "Mon" },
    { number: 9, name: "Tue" },
    { number: 10, name: "Wed" },
    { number: 11, name: "Thu" },
    { number: 12, name: "Fri" },
    { number: 13, name: "Sat" },
    { number: 14, name: "Sun" },
    { number: 15, name: "Mon" },
    { number: 16, name: "Tue" },
  ];

  const filteredReports = useMemo(() => {
    return reports.filter(
      (item) => item.month === selectedMonth && item.day === selectedDay,
    );
  }, [selectedMonth, selectedDay]);

  const renderStatusPill = (approved: boolean) => (
    <View
      style={[
        styles.statusPill,
        approved ? styles.statusApproved : styles.statusPending,
      ]}
    >
      <Text
        style={[
          styles.statusPillText,
          approved ? styles.statusApprovedText : styles.statusPendingText,
        ]}
      >
        {approved ? "Approved" : "Pending"}
      </Text>
    </View>
  );

  const renderReportCard = ({ item }: { item: ReportItem }) => (
    <View style={styles.reportCard}>
      <View style={styles.reportHeader}>
        <Text style={styles.nodeTitle}>NODE ID: {item.nodeId}</Text>
        <View style={styles.areaBadge}>
          <Text style={styles.areaBadgeText}>{item.area}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Lineman</Text>
        <Text style={styles.metaValue}>{item.lineman}</Text>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Date</Text>
        <Text style={styles.metaValue}>
          {item.month} {item.day}
        </Text>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Approval</Text>
        {renderStatusPill(item.approved)}
      </View>

      <View style={styles.divider} />

      <TouchableOpacity
        style={styles.openDetailsRow}
        onPress={() =>
          router.push({
            pathname: "/DailyReportScreen",
            params: { id: item.id },
          } as any)
        }
        activeOpacity={0.7}
      >
        <Text style={styles.openDetailsText}>Open details</Text>
        <Text style={styles.openDetailsArrow}>›</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={filteredReports}
        keyExtractor={(item) => item.id}
        renderItem={renderReportCard}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <View style={styles.topCard}>
              <Text style={styles.title}>Daily Report</Text>

              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Filter by date</Text>

                <View style={styles.filterWrapper}>
                  <TouchableOpacity
                    style={styles.dateSelector}
                    onPress={() => setShowMonthFilter(!showMonthFilter)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.dateSelectorText}>{selectedMonth}</Text>
                    <Text style={styles.arrow}>
                      {showMonthFilter ? "⌃" : "⌄"}
                    </Text>
                  </TouchableOpacity>

                  {showMonthFilter && (
                    <View style={styles.dropdown}>
                      {months.map((month) => (
                        <TouchableOpacity
                          key={month}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setSelectedMonth(month);
                            setShowMonthFilter(false);
                          }}
                        >
                          <Text style={styles.dropdownText}>{month}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                <Text style={styles.selectedDateText}>
                  {selectedMonth} {selectedDay}
                </Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dateScrollContent}
              >
                {days.map((day) => {
                  const isActive = selectedDay === day.number;
                  return (
                    <TouchableOpacity
                      key={`${day.name}-${day.number}`}
                      style={styles.dayItem}
                      onPress={() => setSelectedDay(day.number)}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          styles.dayNumberBox,
                          isActive && styles.dayActiveBox,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayNumber,
                            isActive && styles.dayActiveText,
                          ]}
                        >
                          {day.number}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.dayNameBox,
                          isActive && styles.dayActiveBox,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayName,
                            isActive && styles.dayActiveText,
                          ]}
                        >
                          {day.name}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryTitle}>Daily Report Entries</Text>
              <Text style={styles.summaryCount}>
                {filteredReports.length} record
                {filteredReports.length !== 1 ? "s" : ""}
              </Text>
            </View>

            {filteredReports.length === 0 && (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No daily report found</Text>
                <Text style={styles.emptyText}>
                  No records available for {selectedMonth} {selectedDay}.
                </Text>
              </View>
            )}
          </>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#ffffff",
  },

  listContent: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 100,
  },

  topCard: {
    backgroundColor: "#e9eeea",
    borderRadius: 30,
    padding: 20,
    marginBottom: 20,
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111111",
    textAlign: "center",
    marginBottom: 20,
  },

  filterSection: {
    marginBottom: 18,
  },

  filterLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#444444",
    marginBottom: 10,
  },

  filterWrapper: {
    position: "relative",
    zIndex: 20,
  },

  dateSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8f8f6",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#d0d0ce",
  },

  dateSelectorText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111111",
  },

  arrow: {
    fontSize: 14,
    color: "#111111",
    marginLeft: 8,
  },

  dropdown: {
    marginTop: 8,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dddddd",
    overflow: "hidden",
  },

  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },

  dropdownText: {
    fontSize: 14,
    color: "#111111",
  },

  selectedDateText: {
    fontSize: 13,
    color: "#666666",
    marginTop: 10,
  },

  dateScrollContent: {
    paddingRight: 8,
  },

  dayItem: {
    alignItems: "center",
    marginRight: 12,
  },

  dayNumberBox: {
    width: 50,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: "#ffffff",
  },

  dayNameBox: {
    width: 50,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    backgroundColor: "#ffffff",
  },

  dayNumber: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111111",
  },

  dayName: {
    fontSize: 11,
    color: "#666666",
  },

  dayActiveBox: {
    backgroundColor: "#f0ff7a",
  },

  dayActiveText: {
    color: "#000000",
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  summaryTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111111",
  },

  summaryCount: {
    fontSize: 13,
    color: "#666666",
  },

  reportCard: {
    backgroundColor: "#f8f8f8",
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#efefef",
  },

  reportHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  nodeTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111111",
    flex: 1,
    marginRight: 10,
  },

  areaBadge: {
    backgroundColor: "#e9eeea",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },

  areaBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333333",
  },

  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  metaLabel: {
    fontSize: 14,
    color: "#666666",
  },

  metaValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111111",
  },

  statusPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },

  statusApproved: {
    backgroundColor: "#e8f7ec",
  },

  statusPending: {
    backgroundColor: "#fff4db",
  },

  statusPillText: {
    fontSize: 12,
    fontWeight: "700",
  },

  statusApprovedText: {
    color: "#1f7a3d",
  },

  statusPendingText: {
    color: "#b07800",
  },

  divider: {
    height: 1,
    backgroundColor: "#e8e8e8",
    marginVertical: 12,
  },

  openDetailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  openDetailsText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111111",
  },

  openDetailsArrow: {
    fontSize: 20,
    color: "#888888",
  },

  emptyCard: {
    backgroundColor: "#f8f8f8",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    alignItems: "center",
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111111",
    marginBottom: 6,
  },

  emptyText: {
    fontSize: 13,
    color: "#666666",
    textAlign: "center",
  },
});
