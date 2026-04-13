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

import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useColorScheme } from "@/hooks/use-color-scheme";
import api from "@/lib/api";
import { pingLocationNow } from "@/lib/location-sync";
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
  const backgroundedAtRef = useRef<number | null>(null);

  useEffect(() => {
    resetPrefetchSession();
    startNetSync();

    // Fire an immediate location ping on app open if already logged in
    tokenStore.isLoggedIn().then((loggedIn) => {
      if (loggedIn) pingLocationNow();
    });

    // Always show loading on cold start (force close / fresh open)
    // setTimeout(0) defers until after the Root Layout navigator has mounted
    setTimeout(() => router.replace("/loading" as any), 0);

    // Show loading animation only when the app returns from a real background
    // (user pressed Home / switched apps). Ignore brief < 2 s background states
    // that Android sometimes fires during in-app screen transitions.
    const appStateSub = AppState.addEventListener("change", async (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;

      if (next === "background") {
        backgroundedAtRef.current = Date.now();
      }

      if (prev === "background" && next === "active") {
        const duration = backgroundedAtRef.current
          ? Date.now() - backgroundedAtRef.current
          : 0;
        if (duration < 2000) return; // brief transition — not a real background
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
    <GestureHandlerRootView style={{ flex: 1 }}>
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding" options={{ animation: "none" }} />
        <Stack.Screen name="login" />
        <Stack.Screen name="loading" />
        <Stack.Screen name="(tabs)" options={{ animation: "none" }} />
        <Stack.Screen name="projects/index" />
        <Stack.Screen name="projects/[id]" />
        <Stack.Screen name="projects/site-nodes" />
        <Stack.Screen name="projects/poles" />
        <Stack.Screen name="projects/pole-detail" />
        <Stack.Screen name="teardown/node-logs" />
        <Stack.Screen name="teardown/queue-dashboard" />
        <Stack.Screen name="teardown/log-detail" />
        <Stack.Screen name="teardown/select-pair" />
        <Stack.Screen name="teardown/destination-pole" />
        <Stack.Screen name="teardown/teardown-complete" />
        <Stack.Screen name="deliveries/[id]" />
        <Stack.Screen name="deliveries/delivery" />
        <Stack.Screen name="deliveries/deliveryreport" />
        <Stack.Screen name="deliveries/deliveryreportsummary" />
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
    </GestureHandlerRootView>
  );
}
