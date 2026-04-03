import {
  gpsQueueFlush,
  gpsQueueReadAll,
  gpsQueueRemove,
} from "@/lib/gps-queue";
import { processSyncQueue, queueReadAll, queueRemove } from "@/lib/sync-queue";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type GpsItem = {
  pole_id: string;
  lat: number;
  lng: number;
  queuedAt: string;
};

type SyncItem = {
  id: string;
  fields: Record<string, string>;
  queuedAt: string;
};

const ACCENT = "#0B7A5A";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;

  return `${Math.floor(hrs / 24)}d ago`;
}

export default function QueueDashboardScreen() {
  const [gpsItems, setGpsItems] = useState<GpsItem[]>([]);
  const [syncItems, setSyncItems] = useState<SyncItem[]>([]);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [gps, sync] = await Promise.all([gpsQueueReadAll(), queueReadAll()]);
    setGpsItems(gps as GpsItem[]);
    setSyncItems(sync as SyncItem[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const total = gpsItems.length + syncItems.length;

  const progress = useMemo(() => {
    const max = 20;
    return Math.min(total / max, 1);
  }, [total]);

  async function handleSendAll() {
    setSending(true);
    try {
      await Promise.allSettled([gpsQueueFlush(), processSyncQueue()]);
      await load();
      Alert.alert("Sync Complete", "Pending uploads were processed.");
    } finally {
      setSending(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function removeGps(pole_id: string) {
    Alert.alert(
      "Remove GPS entry?",
      "This will discard the pending GPS for this pole.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await gpsQueueRemove(pole_id);
            await load();
          },
        },
      ],
    );
  }

  async function removeSync(id: string) {
    Alert.alert(
      "Remove submission?",
      "This will discard this pending teardown submission.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await queueRemove(id);
            await load();
          },
        },
      ],
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          title: "",
        }}
      />

      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={ACCENT}
            />
          }
        >
          <View style={styles.topRow}>
            <Pressable onPress={() => router.back()} style={styles.iconBtn}>
              <Ionicons name="chevron-back" size={22} color="#111111" />
            </Pressable>

            <Pressable
              onPress={handleSendAll}
              style={[
                styles.sendBtn,
                (sending || total === 0) && styles.sendBtnDisabled,
              ]}
              disabled={sending || total === 0}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons
                    name="cloud-upload-outline"
                    size={16}
                    color="#FFFFFF"
                  />
                  <Text style={styles.sendBtnText}>Send All</Text>
                </>
              )}
            </Pressable>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Pending Upload Progress</Text>
            <Text style={styles.kpiValue}>{Math.round(progress * 100)}%</Text>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.max(progress * 100, total > 0 ? 8 : 0)}%` },
                ]}
              />
            </View>

            <View style={styles.kpiFooterRow}>
              <Text style={styles.kpiFootText}>{total} items pending</Text>
              <Text style={styles.kpiFootText}>Target queue: 20</Text>
            </View>
          </View>

          {total === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="checkmark-circle" size={34} color={ACCENT} />
              </View>
              <Text style={styles.emptyTitle}>All synced</Text>
              <Text style={styles.emptySub}>
                No pending uploads right now. Pull down to refresh.
              </Text>
            </View>
          ) : null}

          {gpsItems.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>GPS Locations</Text>

              <View style={styles.listCard}>
                {gpsItems.map((item, index) => (
                  <QueueRow
                    key={item.pole_id}
                    icon="location-outline"
                    title={`Pole #${item.pole_id}`}
                    subtitle={`${item.lat.toFixed(6)}, ${item.lng.toFixed(6)}`}
                    time={timeAgo(item.queuedAt)}
                    onRemove={() => removeGps(item.pole_id)}
                    isLast={index === gpsItems.length - 1}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {syncItems.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Teardown Submissions</Text>

              <View style={styles.listCard}>
                {syncItems.map((item, index) => (
                  <QueueRow
                    key={item.id}
                    icon="document-text-outline"
                    title={
                      item.fields?.pole_code ??
                      item.fields?.from_pole_code ??
                      `ID ${item.id.slice(0, 8)}`
                    }
                    subtitle={`Span: ${item.fields?.span_code ?? "—"}`}
                    time={timeAgo(item.queuedAt)}
                    onRemove={() => removeSync(item.id)}
                    isLast={index === syncItems.length - 1}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

function QueueRow({
  icon,
  title,
  subtitle,
  time,
  onRemove,
  isLast = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  time: string;
  onRemove: () => void;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.row, isLast && styles.rowLast]}>
      <View style={styles.rowLeft}>
        <View style={styles.rowIcon}>
          <Ionicons name={icon} size={18} color="#111111" />
        </View>

        <View style={styles.rowTextWrap}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowSub}>{subtitle}</Text>
          <Text style={styles.rowTime}>{time}</Text>
        </View>
      </View>

      <Pressable onPress={onRemove} style={styles.removeBtn}>
        <Ionicons name="close" size={16} color="#DC2626" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F7F7F7",
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 120,
    gap: 16,
    flexGrow: 1,
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECECEC",
  },

  sendBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: ACCENT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  sendBtnDisabled: {
    opacity: 0.45,
  },

  sendBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  kpiCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#EEEEEE",
  },

  kpiLabel: {
    fontSize: 14,
    color: "#777777",
    fontWeight: "500",
  },

  kpiValue: {
    marginTop: 4,
    fontSize: 30,
    fontWeight: "700",
    color: "#111111",
    letterSpacing: -0.8,
  },

  progressTrack: {
    marginTop: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: "#EFEFEF",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: ACCENT,
  },

  kpiFooterRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  kpiFootText: {
    fontSize: 12,
    color: "#7A7A7A",
  },

  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 56,
    paddingBottom: 12,
  },

  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ECFDF3",
    marginBottom: 14,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },

  emptySub: {
    fontSize: 14,
    color: "#667085",
    textAlign: "center",
    lineHeight: 20,
  },

  section: {
    gap: 10,
  },

  sectionLabel: {
    paddingHorizontal: 4,
    fontSize: 12,
    fontWeight: "700",
    color: "#667085",
  },

  listCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    overflow: "hidden",
  },

  row: {
    minHeight: 78,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },

  rowLast: {
    borderBottomWidth: 0,
  },

  rowLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 12,
  },

  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    marginRight: 12,
  },

  rowTextWrap: {
    flex: 1,
  },

  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111111",
  },

  rowSub: {
    marginTop: 3,
    fontSize: 13,
    color: "#7A7A7A",
  },

  rowTime: {
    marginTop: 3,
    fontSize: 11,
    color: "#A0A0A0",
  },

  removeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
  },
});
