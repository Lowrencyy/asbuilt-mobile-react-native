import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as MediaLibrary from "expo-media-library";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const STORE_DIR = FileSystem.documentDirectory + "auth-store/";
const ONBOARDING_FLAG = STORE_DIR + "onboarding_v1.txt";

export async function isOnboardingDone(): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(ONBOARDING_FLAG);
    return info.exists;
  } catch {
    return false;
  }
}

async function markOnboardingDone() {
  try {
    const info = await FileSystem.getInfoAsync(STORE_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(STORE_DIR, { intermediates: true });
    }
    await FileSystem.writeAsStringAsync(ONBOARDING_FLAG, "1");
  } catch {}
}

const ACCENT = "#0B7A5A";

type PermissionKey = "location" | "camera" | "storage";
type PermissionState = "idle" | "granted" | "denied";

const PERMISSIONS = [
  {
    key: "location" as PermissionKey,
    icon: "location-outline" as const,
    title: "Location Access",
    desc: "Used to capture GPS coordinates at pole teardown sites.",
  },
  {
    key: "camera" as PermissionKey,
    icon: "camera-outline" as const,
    title: "Camera Access",
    desc: "Required to capture Before, After, and Pole Tag photos.",
  },
  {
    key: "storage" as PermissionKey,
    icon: "images-outline" as const,
    title: "Storage Access",
    desc: "Saves photos to your device for offline use and sync.",
  },
];

export default function OnboardingScreen() {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const [permissionStatus, setPermissionStatus] = useState<
    Record<PermissionKey, PermissionState>
  >({
    location: "idle",
    camera: "idle",
    storage: "idle",
  });

  const checkAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    isOnboardingDone().then((done) => {
      if (done) {
        router.replace("/login" as any);
      } else {
        setChecking(false);
      }
    });
  }, []);

  function toggleAgreed() {
    const next = !agreed;
    setAgreed(next);
    Animated.spring(checkAnim, {
      toValue: next ? 1 : 0,
      useNativeDriver: true,
      tension: 180,
      friction: 10,
    }).start();
  }

  async function requestPermission(type: PermissionKey) {
    try {
      if (type === "location") {
        const res = await Location.requestForegroundPermissionsAsync();
        setPermissionStatus((prev) => ({
          ...prev,
          location: res.status === "granted" ? "granted" : "denied",
        }));
        if (res.status !== "granted") {
          Alert.alert(
            "Location Permission Needed",
            "Please allow location access so the app can capture teardown coordinates.",
          );
        }
        return;
      }

      if (type === "camera") {
        const res = await ImagePicker.requestCameraPermissionsAsync();
        setPermissionStatus((prev) => ({
          ...prev,
          camera: res.status === "granted" ? "granted" : "denied",
        }));
        if (res.status !== "granted") {
          Alert.alert(
            "Camera Permission Needed",
            "Please allow camera access to capture required field photos.",
          );
        }
        return;
      }

      if (type === "storage") {
        const res = await MediaLibrary.requestPermissionsAsync();
        setPermissionStatus((prev) => ({
          ...prev,
          storage: res.status === "granted" ? "granted" : "denied",
        }));
        if (res.status !== "granted") {
          Alert.alert(
            "Storage Permission Needed",
            "Please allow media/storage access so photos can be saved for offline use and sync.",
          );
        }
      }
    } catch {
      Alert.alert(
        "Permission Error",
        "Unable to request permission right now.",
      );
    }
  }

  const allPermissionsGranted = useMemo(() => {
    return (
      permissionStatus.location === "granted" &&
      permissionStatus.camera === "granted" &&
      permissionStatus.storage === "granted"
    );
  }, [permissionStatus]);

  async function handleContinue() {
    if (!allPermissionsGranted) {
      Alert.alert(
        "Allow All Permissions",
        "Please allow Location, Camera, and Storage before continuing.",
      );
      return;
    }

    if (!agreed) {
      Alert.alert(
        "Agreement Required",
        "Please read and accept the Terms & Data Privacy Policy to continue.",
      );
      return;
    }

    setLoading(true);

    try {
      await markOnboardingDone();
      router.replace("/login" as any);
    } catch {
      setLoading(false);
      Alert.alert("Error", "Unable to continue. Please try again.");
    }
  }

  if (checking) return null;

  const checkScale = checkAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroGlowOne} />
          <View style={styles.heroGlowTwo} />

          <View style={styles.brandWrap}>
            <View style={styles.logoCircle}>
              <Image
                source={require("../assets/images/telco-mainlogo.png")}
                style={styles.logo}
                contentFit="contain"
              />
            </View>

            <Text style={styles.brandName}>POLE MASTER</Text>
            <Text style={styles.brandSub}>by TelcoVantage</Text>
          </View>

          <Text style={styles.heroTitle}>Before you get started</Text>
          <Text style={styles.heroBody}>
            To use the app in the field, please allow all required permissions
            below and accept the privacy agreement.
          </Text>
        </View>

        <View style={styles.progressCard}>
          <Text style={styles.progressTitle}>Setup Progress</Text>
          <Text style={styles.progressValue}>
            {
              [
                permissionStatus.location,
                permissionStatus.camera,
                permissionStatus.storage,
              ].filter((x) => x === "granted").length
            }
            /3
          </Text>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${
                    ([
                      permissionStatus.location,
                      permissionStatus.camera,
                      permissionStatus.storage,
                    ].filter((x) => x === "granted").length /
                      3) *
                    100
                  }%`,
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>REQUIRED PERMISSIONS</Text>

          {PERMISSIONS.map((p, i) => {
            const state = permissionStatus[p.key];
            const granted = state === "granted";
            const denied = state === "denied";

            return (
              <Pressable
                key={p.key}
                onPress={() => requestPermission(p.key)}
                style={[
                  styles.permRow,
                  i < PERMISSIONS.length - 1 && styles.permRowBorder,
                ]}
              >
                <View
                  style={[
                    styles.permIconWrap,
                    granted && styles.permIconGranted,
                    denied && styles.permIconDenied,
                  ]}
                >
                  <Ionicons
                    name={p.icon}
                    size={20}
                    color={granted ? "#0B7A5A" : denied ? "#B42318" : "#204A3D"}
                  />
                </View>

                <View style={styles.permText}>
                  <Text style={styles.permTitle}>{p.title}</Text>
                  <Text style={styles.permDesc}>{p.desc}</Text>
                </View>

                <View
                  style={[
                    styles.statusPill,
                    granted
                      ? styles.statusGranted
                      : denied
                        ? styles.statusDenied
                        : styles.statusIdle,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      granted
                        ? styles.statusGrantedText
                        : denied
                          ? styles.statusDeniedText
                          : styles.statusIdleText,
                    ]}
                  >
                    {granted ? "Allowed" : denied ? "Denied" : "Tap to allow"}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>DATA PRIVACY POLICY</Text>

          <Text style={styles.termsBody}>
            By using <Text style={styles.termsBold}>POLE MASTER</Text>, you
            agree to the following:
          </Text>

          <View style={styles.termsBullets}>
            <Text style={styles.termsBullet}>
              {"•  "}
              <Text style={styles.termsBold}>GPS / Location data</Text> is
              collected solely for recording pole teardown coordinates within
              TelcoVantage field operations.
            </Text>

            <Text style={styles.termsBullet}>
              {"•  "}
              <Text style={styles.termsBold}>Photos</Text> taken through this
              app are stored on your device and uploaded only to TelcoVantage
              servers for project documentation.
            </Text>

            <Text style={styles.termsBullet}>
              {"•  "}Your data is used exclusively within TelcoVantage teardown
              operations.
            </Text>

            <Text style={styles.termsBullet}>
              {"•  "}You may contact your project administrator to request
              deletion of your submitted data.
            </Text>
          </View>
        </View>

        <Pressable onPress={toggleAgreed} style={styles.agreeRow}>
          <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
            {agreed ? (
              <Animated.Text
                style={[
                  styles.checkmark,
                  { transform: [{ scale: checkScale }] },
                ]}
              >
                ✓
              </Animated.Text>
            ) : null}
          </View>

          <Text style={styles.agreeText}>
            I have read and agree to the{" "}
            <Text style={styles.agreeLink}>Terms of Use</Text> and{" "}
            <Text style={styles.agreeLink}>Data Privacy Policy</Text>
          </Text>
        </Pressable>
      </ScrollView>

      <View style={styles.ctaBar}>
        <Pressable
          style={[
            styles.acceptBtn,
            !(allPermissionsGranted && agreed) && styles.acceptBtnDisabled,
          ]}
          onPress={handleContinue}
          disabled={loading}
        >
          <Text style={styles.acceptBtnText}>
            {loading
              ? "Setting up…"
              : allPermissionsGranted && agreed
                ? "Continue to Login"
                : !allPermissionsGranted
                  ? "Allow all permissions first"
                  : "Accept agreement to continue"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F4F6F8",
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 130,
    gap: 16,
  },

  hero: {
    borderRadius: 28,
    padding: 22,
    backgroundColor: "#12231D",
    overflow: "hidden",
  },

  heroGlowOne: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    top: -40,
    right: -30,
  },

  heroGlowTwo: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    bottom: -20,
    left: -20,
  },

  brandWrap: {
    alignItems: "center",
    marginBottom: 18,
  },

  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  logo: {
    width: 62,
    height: 62,
  },

  brandName: {
    fontSize: 24,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.4,
  },

  brandSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.72)",
    fontWeight: "600",
    marginTop: 4,
  },

  heroTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },

  heroBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255,255,255,0.74)",
    fontWeight: "400",
  },

  progressCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E9EE",
  },

  progressTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#667085",
  },

  progressValue: {
    marginTop: 4,
    fontSize: 28,
    fontWeight: "900",
    color: "#111827",
  },

  progressTrack: {
    marginTop: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: "#ECF0F3",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    backgroundColor: ACCENT,
    borderRadius: 999,
  },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E9EE",
  },

  sectionLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#667085",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 14,
  },

  permRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },

  permRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F1F3F5",
  },

  permIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#F0FBF6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D1F0E2",
  },

  permIconGranted: {
    backgroundColor: "#ECFDF3",
    borderColor: "#ABEFC6",
  },

  permIconDenied: {
    backgroundColor: "#FEF3F2",
    borderColor: "#FECDCA",
  },

  permText: {
    flex: 1,
  },

  permTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 3,
  },

  permDesc: {
    fontSize: 12,
    lineHeight: 18,
    color: "#667085",
    fontWeight: "500",
  },

  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  statusIdle: {
    backgroundColor: "#F2F4F7",
  },

  statusGranted: {
    backgroundColor: "#ECFDF3",
  },

  statusDenied: {
    backgroundColor: "#FEF3F2",
  },

  statusPillText: {
    fontSize: 11,
    fontWeight: "800",
  },

  statusIdleText: {
    color: "#667085",
  },

  statusGrantedText: {
    color: "#067647",
  },

  statusDeniedText: {
    color: "#B42318",
  },

  termsBody: {
    fontSize: 13,
    color: "#475467",
    fontWeight: "500",
    marginBottom: 12,
    lineHeight: 20,
  },

  termsBold: {
    fontWeight: "800",
    color: "#0F172A",
  },

  termsBullets: {
    gap: 10,
  },

  termsBullet: {
    fontSize: 13,
    lineHeight: 20,
    color: "#475467",
    fontWeight: "500",
  },

  agreeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E9EE",
  },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },

  checkboxChecked: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },

  checkmark: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },

  agreeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: "#374151",
    fontWeight: "500",
  },

  agreeLink: {
    color: ACCENT,
    fontWeight: "700",
  },

  ctaBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: "#EAECF0",
  },

  acceptBtn: {
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: "center",
    backgroundColor: ACCENT,
  },

  acceptBtnDisabled: {
    backgroundColor: "#C9CED6",
  },

  acceptBtnText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
});
