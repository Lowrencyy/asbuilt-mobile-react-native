// Renamed to pair-photo.tsx — this file redirects for backwards compatibility
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

export default function KabilaPhotosRedirect() {
  const params = useLocalSearchParams();
  useEffect(() => {
    router.replace({ pathname: "/teardown/destination-pole" as any, params });
  }, []);
  return <View />;
}
