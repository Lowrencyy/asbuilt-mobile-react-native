import { projectStore } from "@/lib/store";
import { tokenStore } from "@/lib/token";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
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

  useEffect(() => {
    tokenStore.getUser().then(setUser);
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

  function handleLogout() {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await tokenStore.clear();
          projectStore.clear();
          router.replace("/login" as any);
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.hero}>
          <View style={[styles.heroGlow, styles.heroGlowTop]} />
          <View style={[styles.heroGlow, styles.heroGlowBottom]} />

          <View style={styles.heroPill}>
            <Ionicons
              name="shield-checkmark-outline"
              size={14}
              color="#E7FFF2"
            />
            <Text style={styles.heroPillText}>Account Center</Text>
          </View>

          <Text style={styles.heroTitle}>Profile</Text>
          <Text style={styles.heroSubtitle}>
            Your account details and application information.
          </Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>

          <View style={styles.profileMeta}>
            <Text style={styles.name} numberOfLines={2}>
              {user?.name ?? "Unknown User"}
            </Text>

            <Text style={styles.email} numberOfLines={2}>
              {user?.email ?? "No email available"}
            </Text>

            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{roleLabel}</Text>
            </View>
          </View>
        </View>

        <Section title="PERSONAL INFORMATION">
          <InfoRow
            icon="person-outline"
            label="Full Name"
            value={user?.name ?? "—"}
          />
          <InfoRow
            icon="mail-outline"
            label="Email Address"
            value={user?.email ?? "—"}
          />
          <InfoRow icon="briefcase-outline" label="Role" value={roleLabel} />
          {user?.subcontractor_id != null ? (
            <InfoRow
              icon="id-card-outline"
              label="Subcontractor ID"
              value={String(user.subcontractor_id)}
              isLast
            />
          ) : (
            <InfoRow
              icon="checkmark-circle-outline"
              label="Status"
              value="Active"
              isLast
            />
          )}
        </Section>

        <Section title="APPLICATION">
          <InfoRow
            icon="phone-portrait-outline"
            label="App Name"
            value="Telcovantage Field App"
          />
          <InfoRow
            icon="cube-outline"
            label="Version"
            value={`v${APP_VERSION}`}
            isLast
          />
        </Section>

        <TouchableOpacity
          style={styles.logoutButton}
          activeOpacity={0.9}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={18} color="#C0342B" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>
          Your session and saved account data are securely managed on this
          device.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  isLast = false,
}: {
  icon: IconName;
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.infoRow, isLast && styles.infoRowLast]}>
      <View style={styles.infoIconBox}>
        <Ionicons name={icon} size={18} color="#204A3D" />
      </View>

      <View style={styles.infoTextBox}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F5F6F8",
  },

  content: {
    paddingBottom: 40,
  },

  hero: {
    marginHorizontal: 16,
    marginTop: 6,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 76,
    borderRadius: 30,
    backgroundColor: "#13211C",
    overflow: "hidden",
  },

  heroGlow: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  heroGlowTop: {
    width: 180,
    height: 180,
    top: -50,
    right: -30,
  },

  heroGlowBottom: {
    width: 120,
    height: 120,
    bottom: -26,
    left: -18,
  },

  heroPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  heroPillText: {
    fontFamily: APP_FONT,
    fontSize: 11,
    fontWeight: "600",
    color: "#E7FFF2",
    letterSpacing: 0.4,
  },

  heroTitle: {
    marginTop: 18,
    fontFamily: APP_FONT,
    fontSize: 30,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },

  heroSubtitle: {
    marginTop: 8,
    maxWidth: "88%",
    fontFamily: APP_FONT,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "400",
    color: "rgba(255,255,255,0.72)",
  },

  profileCard: {
    marginTop: -44,
    marginHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EBEF",
    shadowColor: "#101828",
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },

  avatarWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF4F1",
    borderWidth: 1,
    borderColor: "#E0E8E4",
  },

  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#204A3D",
  },

  avatarText: {
    fontFamily: APP_FONT,
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },

  profileMeta: {
    flex: 1,
    marginLeft: 14,
  },

  name: {
    fontFamily: APP_FONT,
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: -0.3,
  },

  email: {
    marginTop: 4,
    fontFamily: APP_FONT,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
    color: "#7A8599",
  },

  roleBadge: {
    alignSelf: "flex-start",
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#F1F7F4",
    borderWidth: 1,
    borderColor: "#DDE9E3",
  },

  roleBadgeText: {
    fontFamily: APP_FONT,
    fontSize: 12,
    fontWeight: "600",
    color: "#204A3D",
  },

  section: {
    marginTop: 20,
    marginHorizontal: 16,
  },

  sectionTitle: {
    marginBottom: 10,
    paddingHorizontal: 2,
    fontFamily: APP_FONT,
    fontSize: 11,
    fontWeight: "700",
    color: "#98A2B3",
    letterSpacing: 1.1,
  },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E8EBEF",
    overflow: "hidden",
    shadowColor: "#101828",
    shadowOpacity: 0.03,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF1F4",
  },

  infoRowLast: {
    borderBottomWidth: 0,
  },

  infoIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F7F6",
    marginRight: 12,
  },

  infoTextBox: {
    flex: 1,
  },

  infoLabel: {
    marginBottom: 5,
    fontFamily: APP_FONT,
    fontSize: 11,
    fontWeight: "600",
    color: "#98A2B3",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },

  infoValue: {
    fontFamily: APP_FONT,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
    color: "#1F2937",
  },

  logoutButton: {
    marginHorizontal: 16,
    marginTop: 24,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#FFF6F5",
    borderWidth: 1,
    borderColor: "#F5D5D1",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  logoutText: {
    fontFamily: APP_FONT,
    fontSize: 15,
    fontWeight: "700",
    color: "#C0342B",
  },

  footerText: {
    marginTop: 14,
    marginHorizontal: 24,
    textAlign: "center",
    fontFamily: APP_FONT,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "400",
    color: "#98A2B3",
  },
});
