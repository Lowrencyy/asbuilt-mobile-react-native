import { Tabs, usePathname, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";


import { AnimatedTabButton } from "@/components/AnimatedTabButton";
import TabTransitionOverlay from "@/components/TabTransitionOverlay";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { isPrefetchDone, markPrefetchDone, prefetchAll } from "@/lib/prefetch";
import { processSyncQueue } from "@/lib/sync-queue";
import { tokenStore } from "@/lib/token";

export default function TabLayout() {
  const router = useRouter();
  const pathname = usePathname();

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
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#0A5C3B",
          tabBarInactiveTintColor: "#9AA3B2",
          tabBarShowLabel: true,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: "700",
            marginBottom: 6,
          },
          tabBarStyle: {
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 16,
            height: 74,
            borderRadius: 22,
            backgroundColor: "#ffffff",
            borderTopWidth: 0,
            paddingTop: 8,
            paddingBottom: 8,
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
            title: "Tasks",
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

