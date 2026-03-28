import api from "@/lib/api";
import { projectStore } from "@/lib/store";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

export default function LoadingScreen() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    // Logo fade in
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();

    // Bouncing dots loop
    const bounceDot = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: -8,
            duration: 300,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(600 - delay),
        ])
      );

    bounceDot(dot1, 0).start();
    bounceDot(dot2, 200).start();
    bounceDot(dot3, 400).start();

    // Fetch projects then navigate
    api
      .get("/projects")
      .then(({ data }) => {
        projectStore.set(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        projectStore.set([]);
      })
      .finally(() => {
        setTimeout(() => {
          router.replace("/(tabs)" as any);
        }, 600);
      });
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoWrap,
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
      >
        <View style={styles.iconBox}>
          <Text style={styles.iconLetter}>T</Text>
        </View>

        <Text style={styles.brand}>TELCOVANTAGE</Text>
        <Text style={styles.sub}>PHILIPPINES</Text>

        <View style={styles.dotsRow}>
          <Animated.View
            style={[styles.dot, { transform: [{ translateY: dot1 }] }]}
          />
          <Animated.View
            style={[styles.dot, { transform: [{ translateY: dot2 }] }]}
          />
          <Animated.View
            style={[styles.dot, { transform: [{ translateY: dot3 }] }]}
          />
        </View>

        <Text style={styles.loadingText}>Loading your workspace...</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#06070B",
    justifyContent: "center",
    alignItems: "center",
  },
  logoWrap: {
    alignItems: "center",
    gap: 6,
  },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "#0A5C3B",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#0A5C3B",
    shadowOpacity: 0.6,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  iconLetter: {
    fontSize: 36,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -1,
  },
  brand: {
    fontSize: 22,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 4,
  },
  sub: {
    fontSize: 11,
    fontWeight: "600",
    color: "#0A5C3B",
    letterSpacing: 6,
    marginBottom: 40,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-end",
    height: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#0A5C3B",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 12,
    color: "#4B5563",
    letterSpacing: 1,
  },
});
