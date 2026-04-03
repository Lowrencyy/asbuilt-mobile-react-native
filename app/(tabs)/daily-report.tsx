import api from "@/lib/api";
import { cacheGet, cacheSet } from "@/lib/cache";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

// Update this path if needed
import telcoLogo from "@/assets/images/telco-mainlogo.png";

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

const CACHE_KEY = "teardown_submissions";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const WEEKDAY_SHORT = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

const n2 = (v: unknown) => (v == null || v === "" ? 0 : Number(v) || 0);
const fmtLen = (v: number) => (v ? `${v.toLocaleString()} m` : "—");

function parseDateParts(dateStr: string) {
  const parts = (dateStr ?? "").slice(0, 10).split("-");
  return {
    year: Number(parts[0]),
    month: Number(parts[1]) - 1,
    day: Number(parts[2]),
  };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatHeaderDate(date: Date) {
  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusCount(list: Submission[], statuses: string[]) {
  return list.filter((item) => statuses.includes(item.status)).length;
}

function buildDaysForMonth(year: number, monthIndex: number) {
  const count = new Date(year, monthIndex + 1, 0).getDate();

  return Array.from({ length: count }, (_, index) => {
    const dayNumber = index + 1;
    const date = new Date(year, monthIndex, dayNumber);

    return {
      number: dayNumber,
      weekday: WEEKDAY_SHORT[date.getDay()],
    };
  });
}

function getAvailableDaysForMonth(subs: Submission[], monthIndex: number) {
  const days = subs
    .filter((item) => parseDateParts(item.report_date).month === monthIndex)
    .map((item) => parseDateParts(item.report_date).day);

  return Array.from(new Set(days)).sort((a, b) => a - b);
}

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

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
  node?: {
    id: number;
    node_id: string;
    node_name?: string;
    city?: string;
    province?: string;
  };
  project?: {
    id: number;
    name?: string;
  };
};

/* -------------------------------------------------------------------------- */
/*                                  Metadata                                  */
/* -------------------------------------------------------------------------- */

const STATUS_META: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  all: {
    label: "All",
    color: "#1f2937",
    bg: "#f3f4f6",
    border: "#e5e7eb",
  },
  draft: {
    label: "Draft",
    color: "#6b7280",
    bg: "#f3f4f6",
    border: "#e5e7eb",
  },
  submitted_to_pm: {
    label: "Pending PM",
    color: "#b45309",
    bg: "#fef3c7",
    border: "#fcd34d",
  },
  pm_for_rework: {
    label: "For Rework",
    color: "#dc2626",
    bg: "#fee2e2",
    border: "#fecaca",
  },
  pm_approved: {
    label: "PM Approved",
    color: "#059669",
    bg: "#d1fae5",
    border: "#a7f3d0",
  },
  submitted_to_telcovantage: {
    label: "Pending TV",
    color: "#7c3aed",
    bg: "#ede9fe",
    border: "#ddd6fe",
  },
  telcovantage_for_rework: {
    label: "TV Rework",
    color: "#dc2626",
    bg: "#fee2e2",
    border: "#fecaca",
  },
  telcovantage_approved: {
    label: "Approved",
    color: "#047857",
    bg: "#d1fae5",
    border: "#a7f3d0",
  },
  ready_for_delivery: {
    label: "For Delivery",
    color: "#1d4ed8",
    bg: "#dbeafe",
    border: "#bfdbfe",
  },
  delivered: {
    label: "Delivered",
    color: "#166534",
    bg: "#dcfce7",
    border: "#bbf7d0",
  },
  closed: {
    label: "Closed",
    color: "#374151",
    bg: "#e5e7eb",
    border: "#d1d5db",
  },
};

const DELIVERY_META: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  onfield: {
    label: "On Field",
    color: "#b45309",
    bg: "#fef3c7",
    border: "#fcd34d",
  },
  ongoing_delivery: {
    label: "In Transit",
    color: "#2563eb",
    bg: "#dbeafe",
    border: "#bfdbfe",
  },
  delivered: {
    label: "Delivered",
    color: "#059669",
    bg: "#d1fae5",
    border: "#a7f3d0",
  },
  delivery_onhold: {
    label: "On Hold",
    color: "#dc2626",
    bg: "#fee2e2",
    border: "#fecaca",
  },
};

/* -------------------------------------------------------------------------- */
/*                                UI Elements                                 */
/* -------------------------------------------------------------------------- */

function FilterChip({
  label,
  active,
  onPress,
  count,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  count?: number;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.filterChip, active && styles.filterChipActive]}
    >
      <Text
        style={[styles.filterChipText, active && styles.filterChipTextActive]}
      >
        {label}
      </Text>
      {typeof count === "number" ? (
        <View
          style={[
            styles.filterChipCount,
            active && styles.filterChipCountActive,
          ]}
        >
          <Text
            style={[
              styles.filterChipCountText,
              active && styles.filterChipCountTextActive,
            ]}
          >
            {count}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function DayChip({
  day,
  weekday,
  active,
  hasData,
  onPress,
}: {
  day: number;
  weekday: string;
  active?: boolean;
  hasData?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        styles.dayChip,
        active && styles.dayChipActive,
        !active && hasData && styles.dayChipHasData,
      ]}
    >
      <View
        style={[
          styles.dayDot,
          hasData && styles.dayDotHasData,
          active && styles.dayDotActive,
        ]}
      />
      <Text style={[styles.dayWeekText, active && styles.dayWeekTextActive]}>
        {weekday}
      </Text>
      <Text
        style={[styles.dayNumberText, active && styles.dayNumberTextActive]}
      >
        {day}
      </Text>
    </TouchableOpacity>
  );
}

function StatusBadge({
  code,
  map,
}: {
  code: string;
  map: Record<
    string,
    { label: string; color: string; bg: string; border: string }
  >;
}) {
  const meta = map[code] ?? {
    label: code,
    color: "#6b7280",
    bg: "#f3f4f6",
    border: "#e5e7eb",
  };

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: meta.bg,
          borderColor: meta.border,
        },
      ]}
    >
      <Text style={[styles.badgeText, { color: meta.color }]}>
        {meta.label}
      </Text>
    </View>
  );
}

function MetricCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub?: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricTitle} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.metricValue} numberOfLines={1}>
        {value}
      </Text>
      {sub ? (
        <Text style={styles.metricSub} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

function InlineMiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.inlineMiniStat}>
      <Text style={[styles.inlineMiniStatValue, { color }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.inlineMiniStatLabel}>{label}</Text>
    </View>
  );
}

function ReportCard({
  item,
  index,
  onSubmit,
}: {
  item: Submission;
  index: number;
  onSubmit: (item: Submission) => void;
}) {
  const canSubmit = item.status === "draft" || item.status === "pm_for_rework";
  const statusMeta = STATUS_META[item.status] ?? STATUS_META.draft;

  return (
    <Animated.View
      entering={FadeInDown.delay(50 + index * 30).springify()}
      style={styles.reportCard}
    >
      <View
        style={[styles.reportCardAccent, { backgroundColor: statusMeta.color }]}
      />

      <View style={styles.reportCardBody}>
        <View style={styles.reportCardHeader}>
          <View style={styles.reportCardLeft}>
            <Text style={styles.nodeIdText}>
              {item.node?.node_id ?? `Node #${item.node?.id ?? "-"}`}
            </Text>

            {!!item.node?.node_name && (
              <Text style={styles.nodeNameText}>{item.node.node_name}</Text>
            )}

            {(item.node?.city || item.node?.province) && (
              <Text style={styles.locationText}>
                {[item.node?.city, item.node?.province]
                  .filter(Boolean)
                  .join(", ")}
              </Text>
            )}
          </View>

          <View style={styles.reportCardRight}>
            <Text style={styles.cardDate}>{formatDate(item.report_date)}</Text>
            <View style={{ marginTop: 8 }}>
              <StatusBadge code={item.status} map={STATUS_META} />
            </View>
          </View>
        </View>

        <View style={styles.badgeRow}>
          <StatusBadge code={item.item_status} map={DELIVERY_META} />
          {item.submitted_by ? (
            <Text style={styles.metaText}>By: {item.submitted_by}</Text>
          ) : null}
          {item.pm_reviewed_by ? (
            <Text style={styles.metaApproved}>PM: {item.pm_reviewed_by}</Text>
          ) : null}
        </View>

        <View style={styles.inlineStatsGrid}>
          <InlineMiniStat
            label="Cable"
            value={fmtLen(n2(item.total_cable))}
            color="#166534"
          />
          <InlineMiniStat
            label="Strand"
            value={fmtLen(n2(item.total_strand_length))}
            color="#1d4ed8"
          />
          <InlineMiniStat
            label="Node"
            value={String(n2(item.total_node))}
            color="#0f766e"
          />
          <InlineMiniStat
            label="Amp"
            value={String(n2(item.total_amplifier))}
            color="#7c3aed"
          />
          <InlineMiniStat
            label="Ext"
            value={String(n2(item.total_extender))}
            color="#c2410c"
          />
          <InlineMiniStat
            label="TSC"
            value={String(n2(item.total_tsc))}
            color="#d97706"
          />
          <InlineMiniStat
            label="PS"
            value={String(n2(item.total_powersupply))}
            color="#db2777"
          />
          <InlineMiniStat
            label="PSH"
            value={String(n2(item.total_powersupply_housing))}
            color="#4b5563"
          />
        </View>

        {!!item.warehouse_location && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Warehouse</Text>
            <Text style={styles.infoValue}>{item.warehouse_location}</Text>
          </View>
        )}

        {canSubmit && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => onSubmit(item)}
            style={styles.submitBtn}
          >
            <Text style={styles.submitBtnText}>Submit to PM</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Main Screen                                 */
/* -------------------------------------------------------------------------- */

export default function DailyReportScreen() {
  const today = new Date();

  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number>(today.getDate());
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  const load = useCallback(async () => {
    const cached = await cacheGet<Submission[]>(CACHE_KEY);

    if (cached?.length) {
      setSubs(cached);
      setLoading(false);
    }

    try {
      const { data } = await api.get("/teardown-submissions?per_page=500");
      const fresh = data.data ?? data ?? [];
      setSubs(fresh);
      cacheSet(CACHE_KEY, fresh);
    } catch {
      // keep cached if fetch fails
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const submitReport = useCallback(
    (sub: Submission) => {
      Alert.alert(
        "Submit to PM",
        `Submit report for ${sub.node?.node_id ?? "this node"}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Submit",
            onPress: async () => {
              try {
                await api.post(`/teardown-submissions/${sub.id}/submit`, {});
                load();
              } catch (e: any) {
                Alert.alert(
                  "Error",
                  e?.response?.data?.message ?? "Failed to submit.",
                );
              }
            },
          },
        ],
      );
    },
    [load],
  );

  const availableMonths = useMemo(() => {
    const set = new Set(subs.map((s) => parseDateParts(s.report_date).month));

    const ordered = MONTHS.map((name, index) => ({
      label: name,
      value: index,
      count: subs.filter(
        (item) => parseDateParts(item.report_date).month === index,
      ).length,
    })).filter((m) => set.has(m.value));

    return ordered.length
      ? ordered
      : [
          {
            label: MONTHS[today.getMonth()],
            value: today.getMonth(),
            count: 0,
          },
        ];
  }, [subs, today]);

  const availableDaysInSelectedMonth = useMemo(() => {
    return getAvailableDaysForMonth(subs, selectedMonth);
  }, [subs, selectedMonth]);

  const days = useMemo(() => {
    return buildDaysForMonth(today.getFullYear(), selectedMonth);
  }, [today, selectedMonth]);

  const monthFiltered = useMemo(() => {
    return subs.filter(
      (s) => parseDateParts(s.report_date).month === selectedMonth,
    );
  }, [subs, selectedMonth]);

  const dayFiltered = useMemo(() => {
    return monthFiltered.filter(
      (s) => parseDateParts(s.report_date).day === selectedDay,
    );
  }, [monthFiltered, selectedDay]);

  const filteredSubs = useMemo(() => {
    if (selectedStatus === "all") return dayFiltered;
    return dayFiltered.filter((s) => s.status === selectedStatus);
  }, [dayFiltered, selectedStatus]);

  const totalCable = useMemo(
    () => filteredSubs.reduce((sum, item) => sum + n2(item.total_cable), 0),
    [filteredSubs],
  );

  const totalApproved = useMemo(
    () =>
      getStatusCount(filteredSubs, ["pm_approved", "telcovantage_approved"]),
    [filteredSubs],
  );

  const totalPending = useMemo(
    () =>
      getStatusCount(filteredSubs, [
        "submitted_to_pm",
        "submitted_to_telcovantage",
      ]),
    [filteredSubs],
  );

  const totalRework = useMemo(
    () =>
      getStatusCount(filteredSubs, [
        "pm_for_rework",
        "telcovantage_for_rework",
      ]),
    [filteredSubs],
  );

  const totalDelivered = useMemo(
    () =>
      filteredSubs.filter((item) => item.item_status === "delivered").length,
    [filteredSubs],
  );

  const statusFilters = [
    { key: "all", label: "All" },
    { key: "draft", label: "Draft" },
    { key: "submitted_to_pm", label: "Pending PM" },
    { key: "pm_for_rework", label: "Rework" },
    { key: "pm_approved", label: "Approved" },
    { key: "ready_for_delivery", label: "Delivery" },
    { key: "delivered", label: "Delivered" },
    { key: "closed", label: "Closed" },
  ];

  const heroSummaryText = useMemo(() => {
    if (filteredSubs.length === 0) {
      return `No reports available for ${MONTHS[selectedMonth]} ${selectedDay}.`;
    }

    return `${filteredSubs.length} report${
      filteredSubs.length !== 1 ? "s" : ""
    } tracked for selected day.`;
  }, [filteredSubs.length, selectedMonth, selectedDay]);

  const handleMonthSelect = useCallback(
    (monthValue: number) => {
      const nextAvailableDays = getAvailableDaysForMonth(subs, monthValue);

      setSelectedMonth(monthValue);

      if (nextAvailableDays.length === 0) {
        setSelectedDay(1);
        return;
      }

      if (nextAvailableDays.includes(selectedDay)) {
        setSelectedDay(selectedDay);
        return;
      }

      const lastAvailableDay = nextAvailableDays[nextAvailableDays.length - 1];
      setSelectedDay(lastAvailableDay);
    },
    [subs, selectedDay],
  );

  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        data={loading ? [] : filteredSubs}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => (
          <ReportCard item={item} index={index} onSubmit={submitReport} />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <View style={styles.topBar}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>TV</Text>
              </View>

              <View style={styles.topBarTextWrap}>
                <Text style={styles.topBarTitle}>Daily Report Dashboard</Text>
                <Text style={styles.topBarDate}>
                  Today {formatHeaderDate(today)}
                </Text>
              </View>

              <View style={styles.searchCircle}>
                <Text style={styles.searchIcon}>⌕</Text>
              </View>
            </View>

            <LinearGradient
              colors={["#86efac", "#22c55e", "#166534"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={styles.heroGlowOne} />
              <View style={styles.heroGlowTwo} />

              <View style={styles.heroLeft}>
                <Text style={styles.heroTitle}>Daily{`\n`}challenge</Text>
                <Text style={styles.heroSubtitle}>
                  Review, monitor, and submit teardown reports before cutoff.
                </Text>

                <View style={styles.heroFooterRow}>
                  <View style={styles.heroCountPill}>
                    <Text style={styles.heroCountPillText}>
                      {filteredSubs.length} report
                      {filteredSubs.length !== 1 ? "s" : ""}
                    </Text>
                  </View>
                  <Text style={styles.heroSummary}>{heroSummaryText}</Text>
                </View>
              </View>

              <View style={styles.heroLogoWrap}>
                <Image
                  source={telcoLogo}
                  style={styles.heroLogo}
                  resizeMode="contain"
                />
              </View>
            </LinearGradient>

            <View style={styles.monthPanel}>
              <View style={styles.monthPanelHeader}>
                <Text style={styles.monthPanelTitle}>Filter by month</Text>
                <Text style={styles.monthPanelSubtitle}>
                  Showing only months with report data
                </Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterScrollContent}
              >
                {availableMonths.map((month) => (
                  <FilterChip
                    key={month.value}
                    label={month.label}
                    count={month.count}
                    active={selectedMonth === month.value}
                    onPress={() => handleMonthSelect(month.value)}
                  />
                ))}
              </ScrollView>
            </View>

            <View style={styles.dayScrollerWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dayScrollContent}
              >
                {days.map((day) => (
                  <DayChip
                    key={day.number}
                    day={day.number}
                    weekday={day.weekday}
                    active={selectedDay === day.number}
                    hasData={availableDaysInSelectedMonth.includes(day.number)}
                    onPress={() => setSelectedDay(day.number)}
                  />
                ))}
              </ScrollView>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Status</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterScrollContent}
              >
                {statusFilters.map((status) => (
                  <FilterChip
                    key={status.key}
                    label={status.label}
                    active={selectedStatus === status.key}
                    onPress={() => setSelectedStatus(status.key)}
                  />
                ))}
              </ScrollView>
            </View>

            <View style={styles.metricsGrid}>
              <MetricCard
                title="Reports"
                value={String(filteredSubs.length)}
                sub={`${MONTHS[selectedMonth]} ${selectedDay}`}
              />
              <MetricCard
                title="Cable"
                value={fmtLen(totalCable)}
                sub="Actual cable"
              />
              <MetricCard
                title="Approved"
                value={String(totalApproved)}
                sub="PM / TV"
              />
              <MetricCard
                title="Pending"
                value={String(totalPending)}
                sub="Awaiting review"
              />
              <MetricCard
                title="Rework"
                value={String(totalRework)}
                sub="Needs update"
              />
              <MetricCard
                title="Delivered"
                value={String(totalDelivered)}
                sub="Item status"
              />
            </View>

            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionHeaderTitle}>Daily Report</Text>
                <Text style={styles.sectionHeaderSub}>
                  {MONTHS[selectedMonth]} {selectedDay} •{" "}
                  {selectedStatus === "all"
                    ? "All statuses"
                    : (STATUS_META[selectedStatus]?.label ?? selectedStatus)}
                </Text>
              </View>

              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>
                  {filteredSubs.length} item
                  {filteredSubs.length !== 1 ? "s" : ""}
                </Text>
              </View>
            </View>

            {loading && (
              <View style={styles.loadingCard}>
                <ActivityIndicator color="#111111" />
                <Text style={styles.loadingText}>Loading reports...</Text>
              </View>
            )}

            {!loading && filteredSubs.length === 0 && (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyEmoji}>📭</Text>
                <Text style={styles.emptyTitle}>No reports found</Text>
                <Text style={styles.emptyText}>
                  No records matched the selected day and status filter.
                </Text>
              </View>
            )}
          </>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#111111"
          />
        }
      />
    </SafeAreaView>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    Styles                                  */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f5f7f4",
  },

  listContent: {
    padding: 16,
    paddingBottom: 40,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },

  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#14532d",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  avatarText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },

  topBarTextWrap: {
    flex: 1,
  },

  topBarTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111111",
  },

  topBarDate: {
    fontSize: 13,
    color: "#666666",
    marginTop: 2,
  },

  searchCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f4f4f4",
    borderWidth: 1,
    borderColor: "#dddddd",
    alignItems: "center",
    justifyContent: "center",
  },

  searchIcon: {
    fontSize: 22,
    color: "#111111",
    fontWeight: "700",
  },

  heroCard: {
    borderRadius: 26,
    padding: 20,
    marginBottom: 16,
    flexDirection: "row",
    overflow: "hidden",
    minHeight: 180,
    position: "relative",
  },

  heroGlowOne: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.14)",
    top: -30,
    right: -20,
  },

  heroGlowTwo: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(255,255,255,0.12)",
    bottom: -10,
    left: 120,
  },

  heroLeft: {
    flex: 1,
    paddingRight: 12,
    justifyContent: "space-between",
    zIndex: 2,
  },

  heroTitle: {
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "900",
    color: "#052e16",
  },

  heroSubtitle: {
    fontSize: 13,
    color: "#14532d",
    marginTop: 8,
    lineHeight: 18,
    maxWidth: 190,
  },

  heroFooterRow: {
    marginTop: 14,
    gap: 8,
  },

  heroCountPill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.82)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  heroCountPillText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#14532d",
  },

  heroSummary: {
    fontSize: 12,
    color: "#14532d",
    lineHeight: 16,
    maxWidth: 190,
    fontWeight: "600",
  },

  heroLogoWrap: {
    width: 120,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },

  heroLogo: {
    width: 118,
    height: 118,
  },

  monthPanel: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e6ece6",
  },

  monthPanelHeader: {
    marginBottom: 10,
  },

  monthPanelTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#111111",
  },

  monthPanelSubtitle: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 2,
  },

  dayScrollerWrap: {
    marginBottom: 16,
  },

  dayScrollContent: {
    paddingRight: 8,
    gap: 10,
  },

  dayChip: {
    width: 60,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#d8d8d8",
    backgroundColor: "#f7f7f7",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },

  dayChipHasData: {
    borderColor: "#86efac",
    backgroundColor: "#f0fdf4",
  },

  dayChipActive: {
    backgroundColor: "#14532d",
    borderColor: "#14532d",
  },

  dayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#bbbbbb",
    marginBottom: 7,
  },

  dayDotHasData: {
    backgroundColor: "#22c55e",
  },

  dayDotActive: {
    backgroundColor: "#ffffff",
  },

  dayWeekText: {
    fontSize: 11,
    color: "#7a7a7a",
    marginBottom: 4,
  },

  dayWeekTextActive: {
    color: "#ffffff",
  },

  dayNumberText: {
    fontSize: 26,
    fontWeight: "900",
    color: "#111111",
    lineHeight: 28,
  },

  dayNumberTextActive: {
    color: "#ffffff",
  },

  filterSection: {
    marginBottom: 14,
  },

  filterLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#666666",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 10,
  },

  filterScrollContent: {
    paddingRight: 8,
    gap: 10,
  },

  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e1e1e1",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  filterChipActive: {
    backgroundColor: "#14532d",
    borderColor: "#14532d",
  },

  filterChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
  },

  filterChipTextActive: {
    color: "#ffffff",
  },

  filterChipCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },

  filterChipCountActive: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },

  filterChipCountText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#166534",
  },

  filterChipCountTextActive: {
    color: "#ffffff",
  },

  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  metricCard: {
    width: "31.8%",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e8eee8",
  },

  metricTitle: {
    fontSize: 11,
    color: "#6b7280",
    fontWeight: "700",
    marginBottom: 6,
  },

  metricValue: {
    fontSize: 17,
    fontWeight: "900",
    color: "#111111",
  },

  metricSub: {
    fontSize: 10,
    color: "#9ca3af",
    marginTop: 3,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 12,
  },

  sectionHeaderTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111111",
  },

  sectionHeaderSub: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },

  countBadge: {
    backgroundColor: "#ecfdf5",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  countBadgeText: {
    fontSize: 12,
    color: "#166534",
    fontWeight: "800",
  },

  loadingCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    paddingVertical: 42,
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e8e8e8",
  },

  loadingText: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 10,
  },

  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 30,
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e8e8e8",
  },

  emptyEmoji: {
    fontSize: 42,
    marginBottom: 10,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111111",
    marginBottom: 6,
  },

  emptyText: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 19,
  },

  reportCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    marginBottom: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e9eee9",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  reportCardAccent: {
    height: 4,
  },

  reportCardBody: {
    padding: 16,
  },

  reportCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  reportCardLeft: {
    flex: 1,
    paddingRight: 10,
  },

  reportCardRight: {
    alignItems: "flex-end",
  },

  nodeIdText: {
    fontSize: 17,
    fontWeight: "900",
    color: "#111111",
  },

  nodeNameText: {
    fontSize: 12,
    color: "#374151",
    marginTop: 3,
    fontWeight: "600",
  },

  locationText: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 4,
  },

  cardDate: {
    fontSize: 11,
    color: "#6b7280",
    fontWeight: "700",
    textAlign: "right",
  },

  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },

  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },

  badgeText: {
    fontSize: 10,
    fontWeight: "900",
  },

  metaText: {
    fontSize: 10,
    color: "#4b5563",
    fontWeight: "700",
  },

  metaApproved: {
    fontSize: 10,
    color: "#059669",
    fontWeight: "800",
  },

  inlineStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
    marginBottom: 12,
  },

  inlineMiniStat: {
    width: "23.5%",
    backgroundColor: "#fafafa",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#efefef",
  },

  inlineMiniStatValue: {
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
  },

  inlineMiniStatLabel: {
    fontSize: 9,
    color: "#6b7280",
    textTransform: "uppercase",
    fontWeight: "800",
    marginTop: 4,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
    marginBottom: 12,
    gap: 12,
  },

  infoLabel: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "700",
  },

  infoValue: {
    fontSize: 12,
    color: "#111111",
    fontWeight: "800",
    flex: 1,
    textAlign: "right",
  },

  submitBtn: {
    backgroundColor: "#14532d",
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 4,
  },

  submitBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
});
