import api, { setAuthToken } from "@/lib/api";
import { resetPrefetchSession } from "@/lib/prefetch";
import { tokenStore } from "@/lib/token";
import { startLocationSync } from "@/lib/location-sync";
import { isOnboardingDone } from "./onboarding";
import TabTransitionOverlay from "@/components/TabTransitionOverlay";
import { AntDesign, FontAwesome, Ionicons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  FadeInDown,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export default function LoginScreen() {
  const { fromOnboarding } = useLocalSearchParams<{ fromOnboarding?: string }>();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showTransition, setShowTransition] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [hasSavedSession, setHasSavedSession] = useState(false);
  const autoPromptDone = useRef(false);

  const screenOpacity = useSharedValue(1);
  const screenTranslateY = useSharedValue(0);
  const screenStyle = useAnimatedStyle(() => ({
    flex: 1,
    opacity: screenOpacity.value,
    transform: [{ translateY: screenTranslateY.value }],
  }));

  // Check biometric capability and saved session on mount
  useEffect(() => {
    (async () => {
      // Skip the file-system check when navigating directly from onboarding
      // to avoid a race condition where the flag hasn't flushed yet
      if (fromOnboarding !== "1") {
        const onboardingDone = await isOnboardingDone();
        if (!onboardingDone) {
          router.replace("/onboarding" as any);
          return;
        }
      }

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const canUseBiometric = hasHardware && isEnrolled;
      setBiometricAvailable(canUseBiometric);

      const savedToken = await tokenStore.get();
      setHasSavedSession(!!savedToken);
    })();
  }, [fromOnboarding]);

  // Auto-prompt fingerprint once when screen loads if session exists
  useFocusEffect(
    useCallback(() => {
      Keyboard.dismiss();
      screenOpacity.value = withTiming(1, { duration: 300 });
      screenTranslateY.value = withTiming(0, { duration: 300 });

      if (!autoPromptDone.current) {
        autoPromptDone.current = true;
        // Small delay so the screen renders first
        setTimeout(() => triggerBiometric(false), 400);
      }
    }, [biometricAvailable, hasSavedSession]),
  );

  function navigateToDashboard() {
    setShowTransition(true);
  }

  async function triggerBiometric(isManual: boolean) {
    const savedToken = await tokenStore.get();
    if (!savedToken) {
      if (isManual) Alert.alert("No saved session", "Please log in with your email and password first.");
      return;
    }

    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !isEnrolled) {
      if (isManual) Alert.alert("Biometrics unavailable", "No fingerprint or face ID set up on this device.");
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Use fingerprint to sign in",
      cancelLabel: "Use password",
      fallbackLabel: "Use password",
      disableDeviceFallback: false,
    });

    if (result.success) {
      setAuthToken(savedToken);
      resetPrefetchSession();
      await startLocationSync();
      Keyboard.dismiss();
      screenOpacity.value = withTiming(0, { duration: 350 });
      screenTranslateY.value = withTiming(-40, { duration: 350 });
      setTimeout(navigateToDashboard, 380);
    }
  }

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Required", "Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post("/login", { email, password });

      const token = data.token ?? data.access_token ?? data.data?.token;
      if (!token) throw new Error("No token in response");

      const user = data.user ?? data.data?.user ?? null;
      await tokenStore.set(token);
      if (user) await tokenStore.setUser(user);
      setAuthToken(token);
      resetPrefetchSession();
      await startLocationSync();
      setHasSavedSession(true);

      Keyboard.dismiss();
      screenOpacity.value = withTiming(0, { duration: 350 });
      screenTranslateY.value = withTiming(-40, { duration: 350 });
      setTimeout(navigateToDashboard, 380);
    } catch (err: any) {
      console.log("STATUS:", err.response?.status);
      console.log("RESPONSE DATA:", JSON.stringify(err.response?.data));
      console.log("ERROR:", err.message);
      const message =
        err.response?.data?.message ??
        err.response?.data?.error ??
        err.message ??
        "Login failed. Check your credentials.";
      const statusPart = err.response?.status ? `[${err.response.status}] ` : "";
      Alert.alert("Login Failed", `${statusPart}${message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <Animated.View style={screenStyle}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.flex}
          >
            <View style={styles.inner}>
              {/* Brand */}
              <Animated.View entering={ZoomIn.delay(100).springify()} style={styles.brand}>
                <Image
                  source={require("@/assets/images/telcovantage-logo.png")}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </Animated.View>

              {/* Title */}
              <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.titleWrap}>
                <Text style={styles.title}>Login to your Account</Text>
              </Animated.View>

              {/* Fingerprint button — show if biometric available + has saved session */}
              {biometricAvailable && hasSavedSession && (
                <Animated.View entering={FadeInDown.delay(250).springify()} style={styles.biometricWrap}>
                  <TouchableOpacity
                    style={styles.biometricBtn}
                    onPress={() => triggerBiometric(true)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="finger-print" size={32} color="#0A5C3B" />
                  </TouchableOpacity>
                  <Text style={styles.biometricLabel}>Tap to sign in with fingerprint</Text>
                </Animated.View>
              )}

              {/* Email */}
              <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="#9ca3af"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </Animated.View>

              {/* Password */}
              <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.inputWrap}>
                <View>
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="#9ca3af"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Text style={styles.eyeText}>{showPassword ? "HIDE" : "SHOW"}</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>

              {/* Sign In */}
              <Animated.View entering={FadeInDown.delay(500).springify()} style={styles.btnWrap}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={loading}
                  onPress={handleLogin}
                  style={styles.signInBtn}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.signInText}>Sign In</Text>
                  )}
                </TouchableOpacity>
              </Animated.View>

              {/* Divider */}
              <Animated.View entering={FadeInDown.delay(600).springify()} style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>Do you have Admin Concern?</Text>
                <View style={styles.dividerLine} />
              </Animated.View>

              {/* Social buttons */}
              <Animated.View entering={FadeInDown.delay(700).springify()} style={styles.socialRow}>
                {[
                  { icon: <AntDesign name="google" size={20} color="#DB4437" /> },
                  { icon: <FontAwesome name="facebook" size={20} color="#1877F2" /> },
                  { icon: <FontAwesome name="twitter" size={20} color="#1DA1F2" /> },
                ].map((item, i) => (
                  <Pressable key={i} style={styles.socialBtn}>
                    {item.icon}
                  </Pressable>
                ))}
              </Animated.View>

              {/* Footer */}
              <Animated.View entering={FadeInDown.delay(800).springify()} style={styles.footerRow}>
                <Text style={styles.footerText}>Do you have problem upon Login?</Text>
              </Animated.View>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </TouchableWithoutFeedback>

      <TabTransitionOverlay
        visible={showTransition}
        onDone={() => router.replace("/(tabs)" as any)}
      />


    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  flex: { flex: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: "center",
  },
  brand: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoImage: {
    width: 200,
    height: 80,
  },
  titleWrap: { marginBottom: 24 },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1f2937",
    textAlign: "center",
  },
  biometricWrap: {
    alignItems: "center",
    marginBottom: 24,
  },
  biometricBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    borderColor: "#0A5C3B",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0faf5",
    marginBottom: 8,
  },
  biometricLabel: {
    fontSize: 12,
    color: "#0A5C3B",
    fontWeight: "600",
  },
  inputWrap: { marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 16,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#fff",
  },
  eyeBtn: {
    position: "absolute",
    right: 20,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  eyeText: { fontSize: 11, fontWeight: "700", color: "#9ca3af" },
  btnWrap: { marginBottom: 24 },
  signInBtn: {
    backgroundColor: "#0A5C3B",
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
  },
  signInText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 2,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#e5e7eb" },
  dividerText: { fontSize: 11, color: "#111827", marginHorizontal: 12 },
  socialRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginBottom: 40,
  },
  socialBtn: {
    width: 48,
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  footerRow: { flexDirection: "row", justifyContent: "center" },
  footerText: { fontSize: 13, color: "#111827" },
});
