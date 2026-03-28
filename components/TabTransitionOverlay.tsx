import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

type Props = {
  visible: boolean;
  onDone?: () => void;
};

export default function TabTransitionOverlay({ visible, onDone }: Props) {
  const mainOpacity = useRef(new Animated.Value(0)).current;
  const subOpacity = useRef(new Animated.Value(0)).current;

  const mainTranslateY = useRef(new Animated.Value(18)).current;
  const subTranslateY = useRef(new Animated.Value(14)).current;

  const wrapperOpacity = useRef(new Animated.Value(1)).current;
  const wrapperScale = useRef(new Animated.Value(0.95)).current;
  const wrapperTranslateY = useRef(new Animated.Value(0)).current;
  const wrapperRotateX = useRef(new Animated.Value(0)).current;

  const bgScale = useRef(new Animated.Value(0.15)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    mainOpacity.setValue(0);
    subOpacity.setValue(0);
    mainTranslateY.setValue(18);
    subTranslateY.setValue(14);

    wrapperOpacity.setValue(1);
    wrapperScale.setValue(0.95);
    wrapperTranslateY.setValue(0);
    wrapperRotateX.setValue(0);

    bgScale.setValue(0.15);
    bgOpacity.setValue(0);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(mainOpacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(mainTranslateY, {
          toValue: 0,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(wrapperScale, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      Animated.parallel([
        Animated.timing(subOpacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(subTranslateY, {
          toValue: 0,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      Animated.parallel([
        Animated.timing(bgOpacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bgScale, {
          toValue: 8,
          duration: 1000,
          easing: Easing.in(Easing.exp),
          useNativeDriver: true,
        }),
        Animated.timing(wrapperScale, {
          toValue: 3.8,
          duration: 1000,
          easing: Easing.in(Easing.exp),
          useNativeDriver: true,
        }),
        Animated.timing(wrapperTranslateY, {
          toValue: -38,
          duration: 1000,
          easing: Easing.in(Easing.exp),
          useNativeDriver: true,
        }),
        Animated.timing(wrapperRotateX, {
          toValue: 14,
          duration: 1000,
          easing: Easing.in(Easing.exp),
          useNativeDriver: true,
        }),
        Animated.timing(wrapperOpacity, {
          toValue: 0,
          duration: 780,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      onDone?.();
    });
  }, [
    visible,
    mainOpacity,
    subOpacity,
    mainTranslateY,
    subTranslateY,
    wrapperOpacity,
    wrapperScale,
    wrapperTranslateY,
    wrapperRotateX,
    bgScale,
    bgOpacity,
    onDone,
  ]);

  if (!visible) return null;

  const rotateX = wrapperRotateX.interpolate({
    inputRange: [0, 14],
    outputRange: ["0deg", "14deg"],
  });

  return (
    <View pointerEvents="auto" style={styles.overlay}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.bgCircle,
          {
            opacity: bgOpacity,
            transform: [{ scale: bgScale }],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: wrapperOpacity,
            transform: [
              { perspective: 900 },
              { translateY: wrapperTranslateY },
              { scale: wrapperScale },
              { rotateX },
            ],
          },
        ]}
      >
        <Animated.Text
          style={[
            styles.mainText,
            {
              opacity: mainOpacity,
              transform: [{ translateY: mainTranslateY }],
            },
          ]}
        >
          TELCOVANTAGE
        </Animated.Text>

        <Animated.Text
          style={[
            styles.subText,
            {
              opacity: subOpacity,
              transform: [{ translateY: subTranslateY }],
            },
          ]}
        >
          PHILIPPINES
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#ffffff",
    zIndex: 9999,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  bgCircle: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: "#0A5C3B",
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  mainText: {
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: 4,
    color: "#0A5C3B",
    textAlign: "center",
  },
  subText: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 8,
    color: "#202020",
    textAlign: "center",
  },
});
