import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './primitives';

export function Screen({
  children,
  scroll = true,
  contentStyle,
  bottomInset = true,
}: {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  bottomInset?: boolean;
}) {
  const { colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const pad = {
    paddingHorizontal: tokens.spacing.xl,
    paddingTop: insets.top + tokens.spacing.sm,
    paddingBottom: bottomInset ? 112 + insets.bottom : insets.bottom + tokens.spacing.xl,
  };
  if (!scroll) {
    return <View style={[{ flex: 1, backgroundColor: colors.bg }, pad, contentStyle]}>{children}</View>;
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[pad, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      automaticallyAdjustKeyboardInsets
    >
      {children}
    </ScrollView>
  );
}

export function PageHeader({
  title,
  subtitle,
  right,
  large = true,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  large?: boolean;
}) {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: tokens.spacing.xl }}>
      <View style={{ flex: 1 }}>
        <AppText variant={large ? 'display' : 'title'} accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="tertiary" style={{ marginTop: 4 }}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>{right}</View> : null}
    </View>
  );
}

export function HeaderIconButton({
  onPress,
  children,
  accessibilityLabel,
}: {
  onPress: () => void;
  children: ReactNode;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: pressed ? colors.cardPressed : colors.card,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.cardBorder,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
      })}
    >
      {children}
    </Pressable>
  );
}

/** Compact modal header with Cancel / title / Save. */
export function SheetHeader({
  title,
  onClose,
  onSave,
  saveLabel = 'Сохранить',
  saveDisabled,
  saving,
}: {
  title: string;
  onClose: () => void;
  onSave?: () => void;
  saveLabel?: string;
  saveDisabled?: boolean;
  saving?: boolean;
}) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: tokens.spacing.lg,
        minHeight: 36,
      }}
    >
      <Pressable accessibilityRole="button" onPress={onClose} hitSlop={10}>
        <AppText variant="bodyStrong" color="secondary">
          Отмена
        </AppText>
      </Pressable>
      <AppText variant="subtitle" numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>
        {title}
      </AppText>
      {onSave ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !!saveDisabled, busy: !!saving }}
          onPress={onSave}
          disabled={saveDisabled || saving}
          hitSlop={10}
        >
          <AppText variant="bodyStrong" color={saveDisabled ? 'tertiary' : 'accent'}>
            {saving ? 'Сохранение…' : saveLabel}
          </AppText>
        </Pressable>
      ) : (
        <View style={{ width: 56 }} />
      )}
    </View>
  );
}
