import { Tabs, usePathname, useRouter } from "expo-router";
import * as NavigationBar from "expo-navigation-bar";
import React, { useCallback, useEffect, useState } from "react";
import { AppState, Dimensions, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SW } = Dimensions.get("window");
// Compact tab bar on narrow screens (< 360px wide, e.g. small Android phones)
const TAB_HEIGHT    = SW < 360 ? 60 : 74;
const TAB_RADIUS    = SW < 360 ? 16 : 22;
const TAB_FONT_SIZE = SW < 360 ?  9 : 10;


import { AnimatedTabButton } from "@/components/AnimatedTabButton";
import TabTransitionOverlay from "@/components/TabTransitionOverlay";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { isPrefetchDone, markPrefetchDone, prefetchAll } from "@/lib/prefetch";
import { processSyncQueue } from "@/lib/sync-queue";
import { tokenStore } from "@/lib/token";

export default function TabLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const androidBottom = Platform.OS === "android" ? insets.bottom : 0;

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const hideNav = () => {
      NavigationBar.setVisibilityAsync("hidden");
      NavigationBar.setBehaviorAsync("overlay-swipe");
    };

    hideNav();

    // Re-hide when app comes back to foreground (Android resets it)
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") hideNav();
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (isPrefetchDone()) return;
    tokenStore.isLoggedIn().then((loggedIn) => {
      if (!loggedIn) {
        router.replace("/login" as any);
      } else {
        markPrefetchDone();
        Promise.allSettled([prefetchAll(), processSyncQueue()]);
      }
    });
  }, []);

  const [pendingRoute, setPendingRoute] = useState<string | null>(null);
  const [showTransition, setShowTransition] = useState(false);
  const [transitionKey, setTransitionKey] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const startTabTransition = useCallback(
    (route: string) => {
      if (pathname === route || isAnimating) return;

      setPendingRoute(route);
      setTransitionKey((prev) => prev + 1);
      setShowTransition(true);
      setIsAnimating(true);
    },
    [pathname, isAnimating],
  );

  const handleTransitionDone = useCallback(() => {
    const route = pendingRoute;

    setShowTransition(false);
    setPendingRoute(null);
    setIsAnimating(false);

    if (route) {
      router.push(route as any);
    }
  }, [pendingRoute, router]);

  return (
    <>
      <Tabs
        safeAreaInsets={Platform.OS === "android" ? { bottom: 0 } : undefined}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#0A5C3B",
          tabBarInactiveTintColor: "#281C59",
          tabBarShowLabel: true,
          tabBarLabelStyle: {
            fontSize: TAB_FONT_SIZE,
            fontWeight: "700",
            marginBottom: 6,
          },
          tabBarStyle: Platform.OS === "android" ? {
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: TAB_HEIGHT + androidBottom,
            paddingTop: 8,
            paddingBottom: androidBottom + 8,
            borderTopLeftRadius: TAB_RADIUS,
            borderTopRightRadius: TAB_RADIUS,
            backgroundColor: "#ffffff",
            borderTopWidth: 0,
            elevation: 8,
          } : {
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 16,
            height: TAB_HEIGHT,
            paddingTop: 8,
            paddingBottom: 8,
            borderRadius: TAB_RADIUS,
            backgroundColor: "#ffffff",
            borderTopWidth: 0,
            shadowColor: "#000",
            shadowOpacity: 0.06,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
            elevation: 8,
          },
          tabBarItemStyle: {
            borderRadius: 16,
            marginHorizontal: 4,
            marginVertical: 4,
          },
          tabBarIconStyle: {
            marginTop: 4,
          },
        }}
      >
        <Tabs.Screen name="home" options={{ href: null }} />

        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarButton: (props) => (
              <AnimatedTabButton
                {...props}
                onPress={() => startTabTransition("/(tabs)")}
              />
            ),
            tabBarIcon: ({ color, focused }) => (
              <IconSymbol
                size={focused ? 24 : 22}
                name="house.fill"
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="tasks"
          options={{
            title: "TD Logs",
            tabBarButton: (props) => (
              <AnimatedTabButton
                {...props}
                onPress={() => startTabTransition("/(tabs)/tasks")}
              />
            ),
            tabBarIcon: ({ color, focused }) => (
              <IconSymbol
                size={focused ? 24 : 22}
                name="checklist"
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="daily-report"
          options={{
            title: "Daily Report",
            tabBarButton: (props) => (
              <AnimatedTabButton
                {...props}
                onPress={() => startTabTransition("/(tabs)/daily-report")}
              />
            ),
            tabBarIcon: ({ color, focused }) => (
              <IconSymbol
                size={focused ? 24 : 22}
                name="doc.text.fill"
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="delivery"
          options={{
            title: "Delivery",
            tabBarButton: (props) => (
              <AnimatedTabButton
                {...props}
                onPress={() => startTabTransition("/(tabs)/delivery")}
              />
            ),
            tabBarIcon: ({ color, focused }) => (
              <IconSymbol
                size={focused ? 24 : 22}
                name="shippingbox.fill"
                color={color}
              />
            ),
          }}
        />



        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarButton: (props) => (
              <AnimatedTabButton
                {...props}
                onPress={() => startTabTransition("/(tabs)/profile")}
              />
            ),
            tabBarIcon: ({ color, focused }) => (
              <IconSymbol
                size={focused ? 24 : 22}
                name="person.fill"
                color={color}
              />
            ),
          }}
        />
      </Tabs>

      <TabTransitionOverlay
        key={transitionKey}
        visible={showTransition}
        onDone={handleTransitionDone}
      />
    </>
  );
}

