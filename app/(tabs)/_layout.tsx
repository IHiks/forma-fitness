import { Tabs } from 'expo-router';
import { CalendarDays, Dumbbell, History, Sparkles } from 'lucide-react-native';
import { Platform, StyleSheet } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

export default function TabsLayout() {
  const { colors, tokens } = useTheme();
  const inactive = colors.textTertiary;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: inactive,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.divider,
          borderTopWidth: StyleSheet.hairlineWidth,
          ...(Platform.OS === 'ios'
            ? { position: 'absolute' as const, elevation: 0 }
            : { height: 62 }),
        },
        tabBarLabelStyle: {
          fontFamily: tokens.fontFamily.semibold,
          fontSize: 10.5,
          letterSpacing: 0.2,
          marginTop: -2,
        },
        sceneStyle: { backgroundColor: colors.bg },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Главная',
          tabBarIcon: ({ color, focused }) => (
            <Sparkles color={color} size={22} strokeWidth={focused ? 2.2 : 1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Календарь',
          tabBarIcon: ({ color, focused }) => (
            <CalendarDays color={color} size={22} strokeWidth={focused ? 2.2 : 1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: 'Тренировки',
          tabBarIcon: ({ color, focused }) => (
            <Dumbbell color={color} size={22} strokeWidth={focused ? 2.2 : 1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'История',
          tabBarIcon: ({ color, focused }) => (
            <History color={color} size={22} strokeWidth={focused ? 2.2 : 1.8} />
          ),
        }}
      />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}
