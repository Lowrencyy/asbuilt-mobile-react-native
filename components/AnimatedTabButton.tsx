import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import React from "react";
import { Pressable } from "react-native";

export function AnimatedTabButton({
  children,
  onPress,
  style,
  accessibilityState,
  accessibilityLabel,
  testID,
  onLongPress,
}: BottomTabBarButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={style}
    >
      {children}
    </Pressable>
  );
}
