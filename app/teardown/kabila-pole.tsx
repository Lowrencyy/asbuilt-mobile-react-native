// Renamed to destination-pole.tsx
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

export default function KabilaPoleRedirect() {
  const params = useLocalSearchParams();
  useEffect(() => {
    router.replace({ pathname: "/teardown/destination-pole" as any, params });
  }, []);
  return <View />;
}
