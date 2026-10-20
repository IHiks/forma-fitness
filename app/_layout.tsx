import { Text, View } from 'react-native';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProviders, useData } from '@/state/AppProviders';
import { useTheme } from '@/theme/ThemeProvider';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function ReadyGate({ children }: { children: React.ReactNode }) {
  const { ready, bootError } = useData();
  const { colors, tokens } = useTheme();

  useEffect(() => {
    if (ready || bootError) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready, bootError]);

  if (bootError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 28 }}>
        <Text style={[tokens.type.headline, { color: colors.text }]}>Не удалось открыть данные</Text>
        <Text style={[tokens.type.body, { color: colors.textSecondary, marginTop: 8 }]}>{bootError}</Text>
        <Text style={[tokens.type.caption, { color: colors.textTertiary, marginTop: 16 }]}>
          Перезапустите приложение. Если ошибка повторяется — данные на устройстве не изменены.
        </Text>
      </View>
    );
  }
  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return <>{children}</>;
}

function RootStack() {
  const { colors, scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="weight/add"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="workout/form"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="nutrition/day"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="habit/manage"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProviders>
          <ReadyGate>
            <RootStack />
          </ReadyGate>
        </AppProviders>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
