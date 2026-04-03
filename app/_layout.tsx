import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { Modal } from "react-native";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import api from "@/lib/api";
import { startNetSync } from "@/lib/net-sync";
import { resetPrefetchSession } from "@/lib/prefetch";
import MaintenanceScreen from "./maintenance";

export const unstable_settings = {
  initialRouteName: "onboarding",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    resetPrefetchSession();
    startNetSync();

    const check = () => {
      api
        .get("/status")
        .then(({ data }) => {
          setIsMaintenance(!!data.maintenance);
          setMaintenanceMessage(data.message ?? "");
        })
        .catch(() => {});
    };

    check();
    intervalRef.current = setInterval(check, 30000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding" options={{ animation: "none" }} />
        <Stack.Screen name="login" />
        <Stack.Screen name="loading" />
        <Stack.Screen name="(tabs)" options={{ animation: "none" }} />
        <Stack.Screen name="projects/index" />
        <Stack.Screen name="projects/[id]" />
        <Stack.Screen name="teardown/node-logs" />
        <Stack.Screen name="teardown/queue-dashboard" />
        <Stack.Screen name="teardown/log-detail" />
        <Stack.Screen name="deliveries/[id]" />
        <Stack.Screen name="DailyReportScreen" />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal" }}
        />
      </Stack>

      <StatusBar style="auto" />

      <Modal visible={isMaintenance} animationType="fade" statusBarTranslucent>
        <MaintenanceScreen message={maintenanceMessage} />
      </Modal>
    </ThemeProvider>
  );
}
