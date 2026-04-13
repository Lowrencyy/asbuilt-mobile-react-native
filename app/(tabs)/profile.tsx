import { gpsQueueCount } from "@/lib/gps-queue";
import { stopLocationSync } from "@/lib/location-sync";
import { projectStore } from "@/lib/store";
import { queueCount } from "@/lib/sync-queue";
import { tokenStore } from "@/lib/token";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const APP_VERSION = "2.0";
const APP_FONT = Platform.select({
  ios: "System",
  android: "sans-serif",
  default: "System",
});

type IconName = keyof typeof Ionicons.glyphMap;

export default function ProfileScreen() {
  const [user, setUser] = useState<any>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    tokenStore.getUser().then(setUser);
    Promise.all([gpsQueueCount(), queueCount()]).then(([gps, sync]) => {
      setPendingCount(gps + sync);
    });
  }, []);

  const initials = useMemo(() => {
    if (!user?.name) return "?";
    return user.name
      .split(" ")
      .map((w: string) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, [user]);

  const roleLabel = useMemo(() => {
    if (!user?.role) return "No role assigned";
    return String(user.role)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (m) => m.toUpperCase());
  }, [user]);

  const progressValue = useMemo(() => {
    const total = 20;
    const normalized = Math.min(pendingCount, total);
    return normalized / total;
  }, [pendingCount]);

  function handleLogout() {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          stopLocationSync();
          await tokenStore.clear();
          projectStore.clear();
          router.replace("/login" as any);
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F7F7" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.headerIconButton}
          >
            <Ionicons name="chevron-back" size={22} color="#111111" />
          </Pressable>

          <Text style={styles.headerTitle}>Profile</Text>

          <Pressable
            onPress={() => router.push("/profile/edit" as any)}
            style={styles.headerIconButton}
          >
            <Ionicons name="settings-outline" size={20} color="#111111" />
          </Pressable>
        </View>

        <View style={styles.profileBlock}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>

          <View style={styles.profileMeta}>
            <Text style={styles.name} numberOfLines={1}>
              {user?.name ?? "Unknown User"}
            </Text>
            <Text style={styles.subText} numberOfLines={1}>
              {user?.email ?? "No email available"}
            </Text>
            <Text style={styles.subTextSmall} numberOfLines={1}>
              {roleLabel}
            </Text>
          </View>
        </View>

        <View style={styles.topActionRow}>
          <MiniStat value={String(pendingCount)} label="Pending" />
          <MiniStat value={`v${APP_VERSION}`} label="Version" />
        </View>

        <View style={styles.kpiCard}>
          <View style={styles.kpiHeaderRow}>
            <View>
              <Text style={styles.kpiLabel}>Upload KPI Progress</Text>
              <Text style={styles.kpiValue}>
                {Math.round(progressValue * 100)}%
              </Text>
            </View>

            <Pressable
              style={styles.editProfileButton}
              onPress={() => router.push("/profile/edit" as any)}
            >
              <Ionicons name="create-outline" size={16} color="#111111" />
              <Text style={styles.editProfileText}>Edit Profile</Text>
            </Pressable>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.max(progressValue * 100, 8)}%` },
              ]}
            />
          </View>

          <View style={styles.kpiFooterRow}>
            <Text style={styles.kpiFootText}>
              Current queue: {pendingCount}
            </Text>
            <Text style={styles.kpiFootText}>Target sync: 20</Text>
          </View>
        </View>

        <View style={styles.menuList}>
          <MenuRow
            icon="cloud-upload-outline"
            title="Pending Uploads"
            subtitle="View queued items waiting for sync"
            rightText={pendingCount > 0 ? String(pendingCount) : undefined}
            onPress={() => router.push("/teardown/queue-dashboard" as any)}
          />

          <MenuRow
            icon="person-outline"
            title="Personal Information"
            subtitle={user?.name ?? "Manage your basic account details"}
            onPress={() => router.push("/profile/edit" as any)}
          />

          <MenuRow
            icon="mail-outline"
            title="Email Address"
            subtitle={user?.email ?? "No email available"}
            onPress={() => {}}
          />

          <MenuRow
            icon="briefcase-outline"
            title="Role"
            subtitle={roleLabel}
            onPress={() => {}}
          />

          <MenuRow
            icon="shield-checkmark-outline"
            title="App Version"
            subtitle={`Telcovantage Field App • v${APP_VERSION}`}
            onPress={() => {}}
          />

          <MenuRow
            icon="settings-outline"
            title="Settings"
            subtitle="Edit profile and preferences"
            onPress={() => router.push("/profile/edit" as any)}
            isLast
          />
        </View>

        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.miniStatCard}>
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
}

function MenuRow({
  icon,
  title,
  subtitle,
  onPress,
  rightText,
  isLast = false,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
  rightText?: string;
  isLast?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.menuRow, isLast && styles.menuRowLast]}
    >
      <View style={styles.menuLeft}>
        <View style={styles.menuIconWrap}>
          <Ionicons name={icon} size={20} color="#1B1B1B" />
        </View>

        <View style={styles.menuTextWrap}>
          <Text style={styles.menuTitle}>{title}</Text>
          <Text style={styles.menuSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </View>

      <View style={styles.menuRight}>
        {rightText ? (
          <View style={styles.menuBadge}>
            <Text style={styles.menuBadgeText}>{rightText}</Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={18} color="#1B1B1B" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F7F7F7",
  },

  content: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 6,
    paddingBottom: 18,
  },

  headerTitle: {
    fontFamily: APP_FONT,
    fontSize: 22,
    fontWeight: "600",
    color: "#111111",
    letterSpacing: -0.4,
  },

  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECECEC",
  },

  profileBlock: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },

  avatarWrap: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "#DFF4F5",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    fontFamily: APP_FONT,
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  profileMeta: {
    flex: 1,
  },

  name: {
    fontFamily: APP_FONT,
    fontSize: 22,
    fontWeight: "700",
    color: "#131313",
    letterSpacing: -0.4,
  },

  subText: {
    marginTop: 3,
    fontFamily: APP_FONT,
    fontSize: 15,
    color: "#666666",
  },

  subTextSmall: {
    marginTop: 2,
    fontFamily: APP_FONT,
    fontSize: 13,
    color: "#8B8B8B",
  },

  topActionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },

  miniStatCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#EEEEEE",
  },

  miniStatValue: {
    fontFamily: APP_FONT,
    fontSize: 18,
    fontWeight: "700",
    color: "#111111",
  },

  miniStatLabel: {
    marginTop: 4,
    fontFamily: APP_FONT,
    fontSize: 12,
    color: "#7A7A7A",
  },

  kpiCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    marginBottom: 18,
  },

  kpiHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 10,
  },

  kpiLabel: {
    fontFamily: APP_FONT,
    fontSize: 14,
    color: "#777777",
  },

  kpiValue: {
    marginTop: 4,
    fontFamily: APP_FONT,
    fontSize: 30,
    fontWeight: "700",
    color: "#111111",
    letterSpacing: -0.8,
  },

  editProfileButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "#F5F5F5",
  },

  editProfileText: {
    fontFamily: APP_FONT,
    fontSize: 13,
    fontWeight: "600",
    color: "#111111",
  },

  progressTrack: {
    height: 14,
    borderRadius: 999,
    backgroundColor: "#EFEFEF",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#9ED9B3",
  },

  kpiFooterRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  kpiFootText: {
    fontFamily: APP_FONT,
    fontSize: 12,
    color: "#7A7A7A",
  },

  menuList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    overflow: "hidden",
  },

  menuRow: {
    minHeight: 78,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#EFEFEF",
  },

  menuRowLast: {
    borderBottomWidth: 0,
  },

  menuLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 12,
  },

  menuIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  menuTextWrap: {
    flex: 1,
  },

  menuTitle: {
    fontFamily: APP_FONT,
    fontSize: 16,
    fontWeight: "600",
    color: "#111111",
  },

  menuSubtitle: {
    marginTop: 3,
    fontFamily: APP_FONT,
    fontSize: 14,
    color: "#7C7C7C",
  },

  menuRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  menuBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
  },

  menuBadgeText: {
    fontFamily: APP_FONT,
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  logoutButton: {
    marginTop: 18,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#0B132B",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },

  logoutText: {
    fontFamily: APP_FONT,
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});

// Pending Upload Modal note:
// Remove the old header/title bar completely.
// Use only a floating circle back button like this:
//
// <View style={{ paddingHorizontal: 20, paddingTop: 8, marginBottom: 8 }}>
//   <Pressable onPress={onClose} style={styles.headerIconButton}>
//     <Ionicons name="chevron-back" size={22} color="#111111" />
//   </Pressable>
// </View>
//
// Then continue directly with the modal content list/card layout.
