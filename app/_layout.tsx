import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus, Modal } from "react-native";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import api from "@/lib/api";
import { startNetSync } from "@/lib/net-sync";
import { resetPrefetchSession } from "@/lib/prefetch";
import { tokenStore } from "@/lib/token";
import MaintenanceScreen from "./maintenance";

export const unstable_settings = {
  initialRouteName: "loading",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    resetPrefetchSession();
    startNetSync();

    // Always show loading on cold start (force close / fresh open)
    // setTimeout(0) defers until after the Root Layout navigator has mounted
    setTimeout(() => router.replace("/loading" as any), 0);

    // Show loading animation every time the app comes back to the foreground
    const appStateSub = AppState.addEventListener("change", async (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (prev.match(/inactive|background/) && next === "active") {
        const token = await tokenStore.get();
        if (token) {
          router.replace("/loading" as any);
        }
      }
    });

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
    intervalRef.current = setInterval(check, 5 * 60 * 1000); // every 5 minutes

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      appStateSub.remove();
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
