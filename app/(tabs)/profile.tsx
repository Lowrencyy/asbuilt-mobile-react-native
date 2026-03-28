import { projectStore } from "@/lib/store";
import { tokenStore } from "@/lib/token";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const APP_VERSION = "2.0";

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
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.cover}>
          <View style={styles.coverGlowOne} />
          <View style={styles.coverGlowTwo} />
        </View>

        <View style={styles.profileHeaderWrap}>
          <View style={styles.avatarOuter}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>

          <View style={styles.profileTextBlock}>
            <Text style={styles.name} numberOfLines={2}>
              {user?.name ?? "—"}
            </Text>
            <Text style={styles.email} numberOfLines={2}>
              {user?.email ?? "—"}
            </Text>

            <View style={styles.rolePill}>
              <Text style={styles.roleText}>{user?.role ?? "—"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>

          <View style={styles.fbCard}>
            <InfoItem label="Full Name" value={user?.name ?? "—"} />
            <Divider />
            <InfoItem label="Email Address" value={user?.email ?? "—"} />
            <Divider />
            <InfoItem label="Role" value={user?.role ?? "—"} />
            {user?.subcontractor_id != null && (
              <>
                <Divider />
                <InfoItem
                  label="Subcontractor ID"
                  value={String(user.subcontractor_id)}
                />
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Application</Text>

          <View style={styles.fbCard}>
            <InfoItem label="App Name" value="Telcovantage Field App" />
            <Divider />
            <InfoItem label="Version" value={`v${APP_VERSION}`} />
          </View>
        </View>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.88}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F0F2F5",
  },

  scroll: {
    paddingBottom: 120,
  },

  cover: {
    height: 180,
    backgroundColor: "#0A5C3B",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: "hidden",
  },

  coverGlowOne: {
    position: "absolute",
    top: -30,
    right: -20,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  coverGlowTwo: {
    position: "absolute",
    bottom: -30,
    left: -20,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  profileHeaderWrap: {
    marginTop: -38,
    marginHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },

  avatarOuter: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: "#E8F3EE",
    justifyContent: "center",
    alignItems: "center",
    marginTop: -54,
    marginBottom: 12,
    borderWidth: 4,
    borderColor: "#FFFFFF",
  },

  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#0A5C3B",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#0A5C3B",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },

  avatarText: {
    fontSize: 30,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 1,
  },

  profileTextBlock: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 8,
  },

  name: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111827",
    textAlign: "center",
    lineHeight: 28,
    maxWidth: "92%",
  },

  email: {
    marginTop: 6,
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 18,
    maxWidth: "92%",
  },

  rolePill: {
    marginTop: 12,
    backgroundColor: "#E7F3FF",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },

  roleText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1877F2",
    textTransform: "capitalize",
    letterSpacing: 0.2,
  },

  section: {
    marginTop: 18,
    paddingHorizontal: 16,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1F2937",
    marginBottom: 10,
    paddingHorizontal: 2,
  },

  fbCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  infoItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  infoLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    marginBottom: 6,
  },

  infoValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    lineHeight: 21,
  },

  divider: {
    height: 1,
    backgroundColor: "#EEF2F7",
    marginHorizontal: 16,
  },

  logoutBtn: {
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F3D0D0",
    shadowColor: "#EF4444",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  logoutText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#DC2626",
    letterSpacing: 0.2,
  },
});
