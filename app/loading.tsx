import api from "@/lib/api";
import { projectStore } from "@/lib/store";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
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

export default function LoadingScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>();

  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const letterAnims = useRef(LETTERS.map(() => new Animated.Value(0))).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // 1. Logo fades + scales in
    const logoAnim = Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
    ]);

    // 2. Letters appear one by one
    const letterAnim = Animated.stagger(
      70,
      LETTERS.map((_, i) =>
        Animated.timing(letterAnims[i], {
          toValue: 1,
          duration: 260,
          delay: i === 0 ? 0 : 0,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    );

    // 3. Tagline fades in
    const taglineAnim = Animated.timing(taglineOpacity, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });

    // 4. Dots pulse loop
    const pulseDot = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.3,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );

    // Run sequence: logo → letters → tagline, then dots loop + navigate
    Animated.sequence([
      logoAnim,
      Animated.delay(100),
      letterAnim,
      Animated.delay(150),
      taglineAnim,
      Animated.delay(600),
    ]).start(() => {
      // Start dots pulsing
      pulseDot(dot1, 0).start();
      pulseDot(dot2, 160).start();
      pulseDot(dot3, 320).start();

      // Navigate after dots show briefly
      setTimeout(() => {
        if (next) {
          router.replace(next as any);
        } else {
          router.replace("/(tabs)" as any);
        }
      }, 800);
    });

    // Prefetch projects in parallel (only when going to tabs)
    if (!next) {
      api
        .get("/projects")
        .then(({ data }) => {
          projectStore.set(Array.isArray(data) ? data : []);
        })
        .catch(() => {
          projectStore.set([]);
        });
    }
  }, []);

  return (
    <View style={styles.container}>
      {/* Glow blobs */}
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      {/* Logo */}
      <Animated.View
        style={[
          styles.logoWrap,
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
      >
        <Image
          source={require("../assets/images/telco-mainlogo.png")}
          style={styles.logo}
          contentFit="contain"
        />
      </Animated.View>

      {/* POLE MASTER letters */}
      <View style={styles.letterRow}>
        {LETTERS.map((char, i) => (
          <Animated.Text
            key={i}
            style={[
              styles.letter,
              char === " " && styles.letterSpace,
              {
                opacity: letterAnims[i],
                transform: [
                  {
                    translateY: letterAnims[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: [vs(20), 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {char === " " ? " " : char}
          </Animated.Text>
        ))}
      </View>

      {/* Tagline */}
      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
        Powered by TelcoVantage Philippines
      </Animated.Text>

      {/* Pulsing dots */}
      <View style={styles.dotsRow}>
        {[dot1, dot2, dot3].map((anim, i) => (
          <Animated.View key={i} style={[styles.dot, { opacity: anim }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1C16",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  glowTop: {
    position: "absolute",
    top: -vs(60),
    right: -scale(40),
    width: scale(280),
    height: scale(280),
    borderRadius: 999,
    backgroundColor: "rgba(11, 122, 90, 0.18)",
  },

  glowBottom: {
    position: "absolute",
    bottom: -vs(80),
    left: -scale(60),
    width: scale(260),
    height: scale(260),
    borderRadius: 999,
    backgroundColor: "rgba(11, 122, 90, 0.12)",
  },

  logoWrap: {
    width: scale(96),
    height: scale(96),
    borderRadius: scale(26),
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: vs(28),
    shadowColor: "#0B7A5A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 16,
  },

  logo: {
    width: scale(66),
    height: scale(66),
  },

  letterRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: vs(10),
  },

  letter: {
    fontSize: scale(32),
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: scale(2),
  },

  letterSpace: {
    width: scale(10),
  },

  tagline: {
    fontSize: scale(12),
    fontWeight: "500",
    color: "rgba(255,255,255,0.45)",
    letterSpacing: scale(0.4),
    marginBottom: vs(52),
  },

  dotsRow: {
    position: "absolute",
    bottom: vs(52),
    flexDirection: "row",
    gap: scale(8),
    alignItems: "center",
  },

  dot: {
    width: scale(7),
    height: scale(7),
    borderRadius: 999,
    backgroundColor: "#2ECC90",
  },
});
