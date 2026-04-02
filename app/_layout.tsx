import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useRef, useState } from 'react';
import { Modal } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { resetPrefetchSession } from '@/lib/prefetch';
import { startNetSync } from '@/lib/net-sync';
import api from '@/lib/api';
import MaintenanceScreen from './maintenance';

export const unstable_settings = {
  initialRouteName: 'login',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    resetPrefetchSession();
    startNetSync();

    const check = () => {
      api.get('/status').then(({ data }) => {
        setIsMaintenance(!!data.maintenance);
        setMaintenanceMessage(data.message ?? '');
      }).catch(() => {});
    };

    check();
    intervalRef.current = setInterval(check, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="loading" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: "none" }} />
        <Stack.Screen name="projects/index" options={{ headerShown: false }} />
        <Stack.Screen name="teardown/node-logs" options={{ headerShown: false }} />
        <Stack.Screen name="projects/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="deliveries/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="DailyReportScreen" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
      <Modal visible={isMaintenance} animationType="fade" statusBarTranslucent>
        <MaintenanceScreen message={maintenanceMessage} />
      </Modal>
    </ThemeProvider>
  );
}
