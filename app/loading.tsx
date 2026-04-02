import api from "@/lib/api";
import { projectStore } from "@/lib/store";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";

const { width: SW, height: SH } = Dimensions.get("window");
const scale = (size: number) => Math.round((SW / 390) * size);
const vs = (size: number) => Math.round((SH / 844) * size);

const TEXT = "POLE MASTER".split("");

export default function LoadingScreen() {
  const letterAnims = useRef(TEXT.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animations = letterAnims.map((anim, index) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 260,
        delay: index * 90,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );

    Animated.stagger(90, animations).start();

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
        }, 1400);
      });
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.textRow}>
        {TEXT.map((char, index) => (
          <Animated.Text
            key={`${char}-${index}`}
            style={[
              styles.letter,
              {
                opacity: letterAnims[index],
                transform: [
                  {
                    translateY: letterAnims[index].interpolate({
                      inputRange: [0, 1],
                      outputRange: [vs(16), 0],
                    }),
                  },
                  {
                    scale: letterAnims[index].interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.9, 1],
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: scale(24),
  },
  textRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    rowGap: vs(8),
  },
  letter: {
    fontSize: scale(28),
    fontWeight: "800",
    color: "#0A5C3B",
    letterSpacing: scale(1.2),
  },
});
