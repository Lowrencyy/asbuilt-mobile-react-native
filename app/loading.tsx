import api from "@/lib/api";
import { projectStore } from "@/lib/store";
import { tokenStore } from "@/lib/token";
import { isOnboardingDone } from "./onboarding";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  View,
} from "react-native";

const { width: SW, height: SH } = Dimensions.get("window");
const scale = (n: number) => Math.round((SW / 390) * n);
const vs = (n: number) => Math.round((SH / 844) * n);

const LETTERS = "POLE MASTER".split("");
const ACCENT = "#1ED79A";
const BG_TOP = "#0A1713";
const BG_BOTTOM = "#10241D";

export default function LoadingScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>();

  const rootOpacity = useRef(new Animated.Value(1)).current;
  const bgFloat = useRef(new Animated.Value(0)).current;

  const orbScale = useRef(new Animated.Value(0.78)).current;
  const orbOpacity = useRef(new Animated.Value(0)).current;

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.72)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const logoLift = useRef(new Animated.Value(vs(16))).current;

  const ringScale = useRef(new Animated.Value(0.84)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;

  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleLift = useRef(new Animated.Value(vs(18))).current;
  const letterAnims = useRef(LETTERS.map(() => new Animated.Value(0))).current;

  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineLift = useRef(new Animated.Value(vs(12))).current;

  const loadingOpacity = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0.28)).current;
  const dot2 = useRef(new Animated.Value(0.28)).current;
  const dot3 = useRef(new Animated.Value(0.28)).current;
  const shimmerX = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    // ── Looping background animations (run immediately, independent) ──
    Animated.loop(
      Animated.sequence([
        Animated.timing(bgFloat, { toValue: 1, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bgFloat, { toValue: 0, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();

    Animated.loop(
      Animated.timing(shimmerX, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true }),
    ).start();

    // ── Intro animations — all run in parallel with staggered delays ──
    // Orbs (0ms)
    Animated.timing(orbOpacity, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.timing(orbScale,   { toValue: 1, duration: 900, easing: Easing.out(Easing.exp),   useNativeDriver: true }).start();

    // Logo (200ms delay)
    Animated.sequence([Animated.delay(200), Animated.parallel([
      Animated.timing(logoOpacity, { toValue: 1, duration: 440, easing: Easing.out(Easing.cubic),       useNativeDriver: true }),
      Animated.timing(logoScale,   { toValue: 1, duration: 760, easing: Easing.out(Easing.back(1.15)),  useNativeDriver: true }),
      Animated.timing(logoLift,    { toValue: 0, duration: 760, easing: Easing.out(Easing.cubic),       useNativeDriver: true }),
      Animated.timing(logoRotate,  { toValue: 1, duration: 760, easing: Easing.out(Easing.cubic),       useNativeDriver: true }),
      Animated.timing(ringOpacity, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic),       useNativeDriver: true }),
      Animated.timing(ringScale,   { toValue: 1, duration: 760, easing: Easing.out(Easing.back(1.05)),  useNativeDriver: true }),
    ])]).start();

    // Title block (900ms delay)
    Animated.sequence([Animated.delay(900), Animated.parallel([
      Animated.timing(titleOpacity, { toValue: 1, duration: 340, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(titleLift,    { toValue: 0, duration: 340, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ])]).start();

    // Letters stagger (1000ms delay)
    Animated.sequence([
      Animated.delay(1000),
      Animated.stagger(34, LETTERS.map((_, i) =>
        Animated.timing(letterAnims[i], { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      )),
    ]).start();

    // Tagline (1600ms delay)
    Animated.sequence([Animated.delay(1600), Animated.parallel([
      Animated.timing(taglineOpacity, { toValue: 1, duration: 340, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(taglineLift,    { toValue: 0, duration: 340, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ])]).start();

    // Loading dots (2000ms delay)
    Animated.sequence([
      Animated.delay(2000),
      Animated.timing(loadingOpacity, { toValue: 1, duration: 260, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();

    const pulseDot = (anim: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1,    duration: 420, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.28, duration: 420, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]));

    setTimeout(() => {
      pulseDot(dot1, 0).start();
      pulseDot(dot2, 130).start();
      pulseDot(dot3, 260).start();
    }, 2100);

    // ── Navigation — fully independent of animation state ──
    // Fires at 3200ms regardless of animation chain
    const navTimer = setTimeout(async () => {
      if (next) {
        router.replace(next as any);
        return;
      }
      const onboarded = await isOnboardingDone();
      if (!onboarded) {
        router.replace("/onboarding" as any);
        return;
      }
      const token = await tokenStore.get();
      if (!token) {
        router.replace("/login" as any);
        return;
      }
      api.get("/projects")
        .then(({ data }) => { projectStore.set(Array.isArray(data) ? data : []); })
        .catch(() => { projectStore.set([]); })
        .finally(() => { router.replace("/(tabs)" as any); });
    }, 3200);

    return () => clearTimeout(navTimer);
  }, []);

  const rotate = logoRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["-8deg", "0deg"],
  });

  const glowTranslateY = bgFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -vs(16)],
  });

  const glowTranslateX = bgFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, scale(10)],
  });

  const shimmerTranslate = shimmerX.interpolate({
    inputRange: [-1, 1],
    outputRange: [-scale(160), scale(160)],
  });

  return (
    <Animated.View style={[styles.container, { opacity: rootOpacity }]}>
      <View style={styles.baseGradientTop} />
      <View style={styles.baseGradientBottom} />

      <Animated.View
        style={[
          styles.glowOne,
          {
            opacity: orbOpacity,
            transform: [{ scale: orbScale }, { translateY: glowTranslateY }],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.glowTwo,
          {
            opacity: orbOpacity,
            transform: [{ scale: orbScale }, { translateX: glowTranslateX }],
          },
        ]}
      />

      <View style={styles.centerWrap}>
        <Animated.View
          style={[
            styles.ring,
            {
              opacity: ringOpacity,
              transform: [{ scale: ringScale }],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.logoShell,
            {
              opacity: logoOpacity,
              transform: [
                { translateY: logoLift },
                { scale: logoScale },
                { rotate },
              ],
            },
          ]}
        >
          <View style={styles.logoShineMask}>
            <Animated.View
              style={[
                styles.logoShine,
                {
                  transform: [
                    { translateX: shimmerTranslate },
                    { rotate: "18deg" },
                  ],
                },
              ]}
            />
          </View>

          <Image
            source={require("../assets/images/telco-mainlogo.png")}
            style={styles.logo}
            contentFit="contain"
          />
        </Animated.View>

        <Animated.View
          style={{
            opacity: titleOpacity,
            transform: [{ translateY: titleLift }],
          }}
        >
          <View style={styles.titleRow}>
            {LETTERS.map((char, i) => (
              <Animated.Text
                key={`${char}-${i}`}
                style={[
                  styles.letter,
                  char === " " && styles.letterSpace,
                  {
                    opacity: letterAnims[i],
                    transform: [
                      {
                        translateY: letterAnims[i].interpolate({
                          inputRange: [0, 1],
                          outputRange: [vs(16), 0],
                        }),
                      },
                      {
                        scale: letterAnims[i].interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.94, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {char}
              </Animated.Text>
            ))}
          </View>
        </Animated.View>

        <Animated.Text
          style={[
            styles.tagline,
            {
              opacity: taglineOpacity,
              transform: [{ translateY: taglineLift }],
            },
          ]}
        >
          Smart field operations powered by TelcoVantage Philippines
        </Animated.Text>
      </View>

      <Animated.View style={[styles.loadingWrap, { opacity: loadingOpacity }]}>
        <Text style={styles.loadingText}>Preparing workspace</Text>
        <View style={styles.dotsRow}>
          {[dot1, dot2, dot3].map((anim, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  opacity: anim,
                  transform: [
                    {
                      scale: anim.interpolate({
                        inputRange: [0.28, 1],
                        outputRange: [0.86, 1.1],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_TOP,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  baseGradientTop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG_TOP,
  },

  baseGradientBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "58%",
    backgroundColor: BG_BOTTOM,
  },

  glowOne: {
    position: "absolute",
    top: -vs(70),
    right: -scale(42),
    width: scale(300),
    height: scale(300),
    borderRadius: 999,
    backgroundColor: "rgba(30,215,154,0.14)",
  },

  glowTwo: {
    position: "absolute",
    bottom: -vs(88),
    left: -scale(62),
    width: scale(280),
    height: scale(280),
    borderRadius: 999,
    backgroundColor: "rgba(30,215,154,0.10)",
  },

  centerWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: scale(28),
  },

  ring: {
    position: "absolute",
    top: vs(2),
    width: scale(154),
    height: scale(154),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },

  logoShell: {
    width: scale(108),
    height: scale(108),
    borderRadius: scale(32),
    backgroundColor: "rgba(255,255,255,0.98)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: vs(28),
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 26,
    elevation: 18,
    overflow: "hidden",
  },

  logoShineMask: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },

  logoShine: {
    position: "absolute",
    top: -scale(12),
    bottom: -scale(12),
    width: scale(42),
    backgroundColor: "rgba(255,255,255,0.45)",
  },

  logo: {
    width: scale(72),
    height: scale(72),
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: vs(10),
    flexWrap: "wrap",
  },

  letter: {
    fontSize: scale(31),
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: scale(1.7),
  },

  letterSpace: {
    width: scale(10),
  },

  tagline: {
    fontSize: scale(12),
    fontWeight: "600",
    color: "rgba(255,255,255,0.56)",
    letterSpacing: scale(0.35),
    textAlign: "center",
    maxWidth: scale(290),
  },

  loadingWrap: {
    position: "absolute",
    bottom: vs(58),
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    fontSize: scale(12),
    fontWeight: "700",
    color: "rgba(255,255,255,0.58)",
    letterSpacing: scale(0.3),
    marginBottom: vs(12),
  },

  dotsRow: {
    flexDirection: "row",
    gap: scale(8),
    alignItems: "center",
  },

  dot: {
    width: scale(7),
    height: scale(7),
    borderRadius: 999,
    backgroundColor: ACCENT,
  },
});
