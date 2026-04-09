import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as MediaLibrary from "expo-media-library";
import { router } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const STORE_DIR = FileSystem.documentDirectory + "auth-store/";
const ONBOARDING_FLAG = STORE_DIR + "onboarding_v2.txt";

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


type PermissionKey = "location" | "camera" | "storage";
type PermissionState = "idle" | "granted" | "denied" | "requesting";
type StepKey = "location" | "camera" | "storage" | "privacy";

const ACCENT = "#0F7B62";
const ACCENT_DARK = "#0A5B48";
const BG = "#F4F7F6";
const CARD = "#FFFFFF";
const TEXT = "#0F172A";
const MUTED = "#667085";
const BORDER = "#E7ECF0";
const SUCCESS = "#067647";
const DANGER = "#B42318";
const WARNING = "#B54708";

function getCurrentHourInManila() {
  const manilaNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }),
  );
  return manilaNow.getHours();
}

function isGpsCutoffNow() {
  return getCurrentHourInManila() >= 20;
}

function SetupModal({
  visible,
  title,
  subtitle,
  icon,
  cta,
  onPress,
  loading,
  note,
  dangerNote,
}: {
  visible: boolean;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  cta: string;
  onPress: () => void;
  loading?: boolean;
  note?: string;
  dangerNote?: string;
}) {
  if (!visible) return null;
  return (
    <View style={styles.modalBackdrop} pointerEvents="box-none">
      <View style={styles.centerModalCard}>
        <View style={styles.modalHandle} />
        <View style={styles.permissionHeroIcon}>
          <Ionicons name={icon} size={28} color={ACCENT_DARK} />
        </View>

        <Text style={styles.centerModalTitle}>{title}</Text>
        <Text style={styles.centerModalText}>{subtitle}</Text>

        {note ? (
          <View style={styles.modalNoteBox}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={ACCENT_DARK}
            />
            <Text style={styles.modalNoteText}>{note}</Text>
          </View>
        ) : null}

        {dangerNote ? (
          <View style={styles.modalDangerBox}>
            <Ionicons name="alert-circle-outline" size={18} color={DANGER} />
            <Text style={styles.modalDangerText}>{dangerNote}</Text>
          </View>
        ) : null}

        <Pressable
          style={styles.primaryBtn}
          onPress={onPress}
          disabled={loading}
        >
          <Text style={styles.primaryBtnText}>
            {loading ? "Please wait..." : cta}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function PrivacyModal({
  visible,
  agreed,
  onToggleAgree,
  onContinue,
  checkScale,
  gpsBlocked,
}: {
  visible: boolean;
  agreed: boolean;
  onToggleAgree: () => void;
  onContinue: () => void;
  checkScale: Animated.AnimatedInterpolation<string | number>;
  gpsBlocked: boolean;
}) {
  if (!visible) return null;
  return (
    <View style={styles.modalBackdropBottom} pointerEvents="box-none">
      <View style={styles.sheetCard}>
        <View style={styles.modalHandle} />

        <View style={styles.sheetHeaderRow}>
          <View style={styles.sheetIconWrap}>
            <Ionicons
              name="shield-checkmark-outline"
              size={22}
              color={ACCENT_DARK}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sheetTitle}>Data Privacy Policy</Text>
            <Text style={styles.sheetSubtitle}>
              Final step before entering the app
            </Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.sheetScrollContent}
        >
          <View style={styles.privacyCardPrimary}>
            <Text style={styles.privacyLead}>
              By using <Text style={styles.privacyBold}>POLE MASTER</Text>, you
              agree that field data is collected only for authorized
              TelcoVantage operations.
            </Text>
          </View>

          <View style={styles.policyList}>
            <View style={styles.policyItem}>
              <View style={styles.policyBullet}>
                <Ionicons
                  name="navigate-outline"
                  size={16}
                  color={ACCENT_DARK}
                />
              </View>
              <Text style={styles.policyText}>
                <Text style={styles.privacyBold}>Location data</Text> is
                captured only when required for teardown documentation.
              </Text>
            </View>

            <View style={styles.policyItem}>
              <View style={styles.policyBullet}>
                <Ionicons name="camera-outline" size={16} color={ACCENT_DARK} />
              </View>
              <Text style={styles.policyText}>
                <Text style={styles.privacyBold}>Photos</Text> are stored
                on-device and uploaded only for official project records.
              </Text>
            </View>

            <View style={styles.policyItem}>
              <View style={styles.policyBullet}>
                <Ionicons name="server-outline" size={16} color={ACCENT_DARK} />
              </View>
              <Text style={styles.policyText}>
                Submitted records are used exclusively within authorized
                TelcoVantage workflows.
              </Text>
            </View>

            <View
              style={[
                styles.policyItem,
                gpsBlocked ? styles.policyItemWarning : null,
              ]}
            >
              <View
                style={[
                  styles.policyBullet,
                  gpsBlocked ? styles.policyBulletWarning : null,
                ]}
              >
                <Ionicons
                  name={gpsBlocked ? "alert-circle-outline" : "time-outline"}
                  size={16}
                  color={gpsBlocked ? WARNING : ACCENT_DARK}
                />
              </View>
              <Text style={styles.policyText}>
                <Text style={styles.privacyBold}>GPS notice:</Text> GPS capture
                is unavailable after{" "}
                <Text style={styles.privacyBold}>8:00 PM</Text> (Manila time).{" "}
                {gpsBlocked
                  ? "It is currently past 8:00 PM, so GPS-based field functions may not work tonight."
                  : "Please complete location-based field activity before the 8:00 PM cutoff."}
              </Text>
            </View>
          </View>

          <Pressable onPress={onToggleAgree} style={styles.agreementCard}>
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
            <Text style={styles.agreementText}>
              I have read and understood the Data Privacy Policy and GPS cutoff
              advisory.
            </Text>
          </Pressable>
        </ScrollView>

        <Pressable
          style={[styles.primaryBtn, !agreed && styles.primaryBtnDisabled]}
          onPress={onContinue}
        >
          <Text style={styles.primaryBtnText}>
            {agreed ? "Continue to Login" : "Agree to continue"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [activeStep, setActiveStep] = useState<StepKey>("location");
  const [closing, setClosing] = useState(false);
  const [done, setDone] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<
    Record<PermissionKey, PermissionState>
  >({
    location: "idle",
    camera: "idle",
    storage: "idle",
  });

  const checkAnim = useRef(new Animated.Value(0)).current;
  const gpsBlocked = useMemo(() => isGpsCutoffNow(), []);

  useEffect(() => {
    isOnboardingDone().then((onboarded) => {
      if (onboarded) {
        router.replace({ pathname: "/loading", params: { next: "/login" } } as never);
        return;
      }
      setChecking(false);
      setActiveStep("location");
    });
  }, []);

  // Show loading animation first, then go to login
  useEffect(() => {
    if (done)
      router.replace({
        pathname: "/loading",
        params: { next: "/login?fromOnboarding=1" },
      } as never);
  }, [done]);

  const grantedCount = useMemo(() => {
    return Object.values(permissionStatus).filter(
      (value) => value === "granted",
    ).length;
  }, [permissionStatus]);

  const allPermissionsGranted = grantedCount === 3;

  const checkScale = checkAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  const toggleAgree = useCallback(() => {
    const next = !agreed;
    setAgreed(next);
    Animated.spring(checkAnim, {
      toValue: next ? 1 : 0,
      useNativeDriver: true,
      tension: 180,
      friction: 10,
    }).start();
  }, [agreed, checkAnim]);

  const moveToNextStep = useCallback((key: PermissionKey) => {
    if (key === "location") {
      setActiveStep("camera");
      return;
    }
    if (key === "camera") {
      setActiveStep("storage");
      return;
    }
    setActiveStep("privacy");
  }, []);

  const requestPermission = useCallback(
    async (type: PermissionKey) => {
      setPermissionStatus((prev) => ({ ...prev, [type]: "requesting" }));

      try {
        if (type === "location") {
          const res = await Location.requestForegroundPermissionsAsync();
          const next = res.status === "granted" ? "granted" : "denied";
          setPermissionStatus((prev) => ({ ...prev, location: next }));

          if (next === "granted") {
            moveToNextStep("location");
          } else {
            Alert.alert(
              "Location Permission Needed",
              "Please allow location access so the app can capture teardown coordinates.",
            );
          }
          return;
        }

        if (type === "camera") {
          const res = await ImagePicker.requestCameraPermissionsAsync();
          const next = res.status === "granted" ? "granted" : "denied";
          setPermissionStatus((prev) => ({ ...prev, camera: next }));

          if (next === "granted") {
            moveToNextStep("camera");
          } else {
            Alert.alert(
              "Camera Permission Needed",
              "Please allow camera access to capture required field photos.",
            );
          }
          return;
        }

        const res = await MediaLibrary.requestPermissionsAsync();
        const next = res.status === "granted" ? "granted" : "denied";
        setPermissionStatus((prev) => ({ ...prev, storage: next }));

        if (next === "granted") {
          moveToNextStep("storage");
        } else {
          Alert.alert(
            "Storage Permission Needed",
            "Please allow storage/media access so photos can be saved locally for sync.",
          );
        }
      } catch {
        setPermissionStatus((prev) => ({ ...prev, [type]: "denied" }));
        Alert.alert(
          "Permission Error",
          "Unable to request permission right now.",
        );
      }
    },
    [moveToNextStep],
  );

  const handleFinish = useCallback(async () => {
    if (!allPermissionsGranted) {
      Alert.alert(
        "Setup Incomplete",
        "Please complete all permission steps before continuing.",
      );
      return;
    }

    if (!agreed) {
      Alert.alert(
        "Agreement Required",
        "Please accept the data privacy policy to continue.",
      );
      return;
    }

    setSaving(true);
    try {
      await markOnboardingDone();
      setClosing(true); // dismiss all modals before navigating
      setDone(true);
    } catch {
      setSaving(false);
      Alert.alert("Error", "Unable to continue. Please try again.");
    }
  }, [agreed, allPermissionsGranted]);

  if (checking) return null;

  return (
    <View style={styles.root}>
      {/* Clean background — just logo and branding */}
      <View style={styles.bgCenter}>
        <View style={styles.logoShell}>
          <Image
            source={require("../assets/images/telco-mainlogo.png")}
            style={styles.logo}
            contentFit="contain"
          />
        </View>
        <Text style={styles.brandName}>POLE MASTER</Text>
        <Text style={styles.brandSub}>by TelcoVantage</Text>
        <Text style={styles.bgHint}>Setting up your account…</Text>
      </View>

      <SetupModal
        visible={activeStep === "location" && !closing}
        title="Allow Location Access"
        subtitle="The app needs your location to validate field teardown coordinates."
        icon="location-outline"
        cta="Allow location"
        onPress={() => requestPermission("location")}
        loading={permissionStatus.location === "requesting"}
        dangerNote={
          gpsBlocked
            ? "It is already past 8:00 PM in Manila. GPS-based field functions may not work until the next allowed schedule."
            : undefined
        }
      />

      <SetupModal
        visible={activeStep === "camera" && !closing}
        title="Allow Camera Access"
        subtitle="Enable camera to capture before, after, and pole tag photos."
        icon="camera-outline"
        cta="Allow camera"
        onPress={() => requestPermission("camera")}
        loading={permissionStatus.camera === "requesting"}
      />

      <SetupModal
        visible={activeStep === "storage" && !closing}
        title="Allow Storage Access"
        subtitle="Allow storage so photos can be saved locally for upload and sync."
        icon="images-outline"
        cta="Allow storage"
        onPress={() => requestPermission("storage")}
        loading={permissionStatus.storage === "requesting"}
        note="The system required to gather  media access. This app only use it for required project photos it will not get any data, image and video from your gallery it will save only to your local storage for backup purposes."
      />

      <PrivacyModal
        visible={activeStep === "privacy" && !closing}
        agreed={agreed}
        onToggleAgree={toggleAgree}
        onContinue={saving ? () => undefined : handleFinish}
        checkScale={checkScale}
        gpsBlocked={gpsBlocked}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 60,
    gap: 16,
  },

  heroCard: {
    borderRadius: 30,
    padding: 22,
    backgroundColor: "#0E1D18",
    overflow: "hidden",
  },

  heroGlowOne: {
    position: "absolute",
    top: -40,
    right: -20,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(47, 211, 151, 0.15)",
  },

  heroGlowTwo: {
    position: "absolute",
    bottom: -50,
    left: -30,
    width: 160,
    height: 160,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 22,
  },

  logoShell: {
    width: 84,
    height: 84,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.98)",
    alignItems: "center",
    justifyContent: "center",
  },

  logo: {
    width: 60,
    height: 60,
  },

  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  heroPillText: {
    color: "#E6FFF5",
    fontSize: 12,
    fontWeight: "800",
  },

  heroTitle: {
    fontSize: 28,
    lineHeight: 31,
    color: "#FFFFFF",
    fontWeight: "900",
    letterSpacing: -0.6,
  },

  heroBody: {
    marginTop: 10,
    color: "rgba(255,255,255,0.78)",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
  },

  heroInfoRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },

  heroInfoCard: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  heroInfoLabel: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  heroInfoValue: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },

  progressCard: {
    backgroundColor: CARD,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
  },

  progressHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },

  sectionEyebrow: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: MUTED,
    fontWeight: "900",
    marginBottom: 6,
  },

  progressTitle: {
    fontSize: 18,
    color: TEXT,
    fontWeight: "900",
  },

  dotsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
    marginBottom: 16,
  },

  dot: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#E6EBEF",
  },

  dotActive: {
    backgroundColor: "#85D8C1",
  },

  dotDone: {
    backgroundColor: ACCENT,
  },

  progressTrack: {
    height: 12,
    backgroundColor: "#ECF0F3",
    borderRadius: 999,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    backgroundColor: ACCENT,
    borderRadius: 999,
  },

  sectionCard: {
    backgroundColor: CARD,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
  },

  cardTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: TEXT,
  },

  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },

  permissionRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F1F4F7",
  },

  permissionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#EFFAF6",
    borderWidth: 1,
    borderColor: "#D8F3E8",
    alignItems: "center",
    justifyContent: "center",
  },

  permissionIconWrapDone: {
    backgroundColor: "#ECFDF3",
    borderColor: "#ABEFC6",
  },

  permissionIconWrapDenied: {
    backgroundColor: "#FEF3F2",
    borderColor: "#FECDCA",
  },

  permissionTextWrap: {
    flex: 1,
  },

  permissionTitle: {
    fontSize: 14,
    color: TEXT,
    fontWeight: "800",
    marginBottom: 4,
  },

  permissionDesc: {
    fontSize: 12,
    lineHeight: 18,
    color: MUTED,
    fontWeight: "500",
  },

  noticeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    padding: 14,
    borderWidth: 1,
    borderColor: "#E6ECF2",
  },

  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: "#475467",
    fontWeight: "500",
  },

  noticeTextBold: {
    color: TEXT,
    fontWeight: "900",
  },

  stepBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  stepBadgeIdle: {
    backgroundColor: "#F2F4F7",
  },

  stepBadgeSuccess: {
    backgroundColor: "#ECFDF3",
  },

  stepBadgeWarning: {
    backgroundColor: "#FFF4E5",
  },

  stepBadgeDanger: {
    backgroundColor: "#FEF3F2",
  },

  stepBadgeText: {
    fontSize: 11,
    fontWeight: "900",
  },

  stepBadgeTextIdle: {
    color: MUTED,
  },

  stepBadgeTextSuccess: {
    color: SUCCESS,
  },

  stepBadgeTextWarning: {
    color: WARNING,
  },

  stepBadgeTextDanger: {
    color: DANGER,
  },

  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(7, 12, 19, 0.56)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    zIndex: 999,
  },

  centerModalCard: {
    width: "100%",
    backgroundColor: CARD,
    borderRadius: 28,
    padding: 22,
    alignItems: "center",
  },

  modalHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#D9E0E7",
    marginBottom: 16,
  },

  permissionHeroIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "#EAFBF5",
    borderWidth: 1,
    borderColor: "#D9F3E8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  centerModalTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: TEXT,
    textAlign: "center",
  },

  centerModalText: {
    marginTop: 10,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 21,
    color: MUTED,
    fontWeight: "500",
  },

  modalNoteBox: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
    borderRadius: 18,
    backgroundColor: "#F0F9F6",
    padding: 14,
    borderWidth: 1,
    borderColor: "#D4EFE6",
  },

  modalNoteText: {
    flex: 1,
    color: "#315A4E",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },

  modalDangerBox: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
    borderRadius: 18,
    backgroundColor: "#FFF7ED",
    padding: 14,
    borderWidth: 1,
    borderColor: "#FED7AA",
  },

  modalDangerText: {
    flex: 1,
    color: "#9A3412",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },

  primaryBtn: {
    width: "100%",
    marginTop: 20,
    backgroundColor: ACCENT,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
  },

  primaryBtnDisabled: {
    backgroundColor: "#C8D0D6",
  },

  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.2,
  },

  modalBackdropBottom: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(7, 12, 19, 0.56)",
    justifyContent: "flex-end",
    zIndex: 999,
  },

  sheetCard: {
    maxHeight: "84%",
    backgroundColor: CARD,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },

  sheetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },

  sheetIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#EAFBF5",
    alignItems: "center",
    justifyContent: "center",
  },

  sheetTitle: {
    fontSize: 20,
    color: TEXT,
    fontWeight: "900",
  },

  sheetSubtitle: {
    marginTop: 3,
    color: MUTED,
    fontSize: 13,
    fontWeight: "600",
  },

  sheetScrollContent: {
    paddingBottom: 10,
  },

  privacyCardPrimary: {
    marginTop: 12,
    borderRadius: 20,
    padding: 16,
    backgroundColor: "#F7FAF9",
    borderWidth: 1,
    borderColor: BORDER,
  },

  privacyLead: {
    fontSize: 13,
    lineHeight: 21,
    color: "#475467",
    fontWeight: "500",
  },

  privacyBold: {
    color: TEXT,
    fontWeight: "900",
  },

  policyList: {
    gap: 12,
    marginTop: 16,
  },

  policyItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
  },

  policyItemWarning: {
    backgroundColor: "#FFF9F1",
    borderColor: "#FCD9BD",
  },

  policyBullet: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#EEF8F5",
    alignItems: "center",
    justifyContent: "center",
  },

  policyBulletWarning: {
    backgroundColor: "#FFF0E1",
  },

  policyText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: "#475467",
    fontWeight: "500",
  },

  agreementCard: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 20,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
  },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
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

  agreementText: {
    flex: 1,
    color: "#344054",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
  },

  bgCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0E1D18",
  },

  brandName: {
    marginTop: 16,
    fontSize: 26,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },

  brandSub: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.6)",
  },

  bgHint: {
    marginTop: 32,
    fontSize: 13,
    color: "rgba(255,255,255,0.35)",
    fontWeight: "500",
  },
});
