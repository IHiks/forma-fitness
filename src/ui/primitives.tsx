import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../theme/ThemeProvider';

type TextVariant =
  | 'display'
  | 'title'
  | 'headline'
  | 'subtitle'
  | 'body'
  | 'bodyStrong'
  | 'caption'
  | 'micro'
  | 'numberXL'
  | 'numberL'
  | 'numberM';

export function AppText({
  variant = 'body',
  color = 'text',
  style,
  children,
  numberOfLines,
  ...rest
}: {
  variant?: TextVariant;
  color?: 'text' | 'secondary' | 'tertiary' | 'accent' | 'danger' | 'onAccent';
  style?: StyleProp<TextStyle>;
  children: React.ReactNode;
  numberOfLines?: number;
  accessibilityRole?: 'header' | 'text';
}) {
  const { colors, tokens } = useTheme();
  const colorValue =
    color === 'secondary'
      ? colors.textSecondary
      : color === 'tertiary'
        ? colors.textTertiary
        : color === 'accent'
          ? colors.accentText
          : color === 'danger'
            ? colors.danger
            : color === 'onAccent'
              ? colors.onAccent
              : colors.text;
  return (
    <Text
      {...rest}
      numberOfLines={numberOfLines}
      style={[tokens.type[variant], { color: colorValue }, style]}
      maxFontSizeMultiplier={1.35}
    >
      {children}
    </Text>
  );
}

export function NumberText({
  value,
  unit,
  size = 'large',
  color = 'text',
  style,
}: {
  value: string;
  unit?: string;
  size?: 'large' | 'medium';
  color?: 'text' | 'secondary' | 'accent' | 'danger' | 'onAccent';
  style?: StyleProp<TextStyle>;
}) {
  const { colors, tokens } = useTheme();
  const valueColor =
    color === 'secondary'
      ? colors.textSecondary
      : color === 'accent'
        ? colors.accentText
        : color === 'danger'
          ? colors.danger
          : color === 'onAccent'
            ? colors.onAccent
            : colors.text;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
      <Text
        allowFontScaling={false}
        style={[size === 'large' ? tokens.type.numberXL : tokens.type.numberL, { color: valueColor }, style]}
      >
        {value}
      </Text>
      {unit ? (
        <Text
          allowFontScaling={false}
          style={[tokens.type.caption, { color: colors.textTertiary, marginLeft: 5, marginBottom: 5 }]}
        >
          {unit}
        </Text>
      ) : null}
    </View>
  );
}

export function Card({
  children,
  style,
  padded = true,
  onPress,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const { colors, tokens } = useTheme();
  const base: ViewStyle = {
    backgroundColor: colors.card,
    borderRadius: tokens.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
    padding: padded ? tokens.spacing.lg : 0,
    overflow: 'hidden',
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [base, pressed && { backgroundColor: colors.cardPressed }, style]}
    >
      {children}
    </Pressable>
  );
}

export function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: tokens.spacing.md,
        marginTop: tokens.spacing.sm,
      }}
    >
      <AppText variant="micro" color="tertiary" style={{ textTransform: 'uppercase' }}>
        {children}
      </AppText>
      {right}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  icon,
  style,
  tone = 'accent',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'accent' | 'danger' | 'neutral';
}) {
  const { colors, tokens } = useTheme();
  const bg = disabled
    ? colors.scheme === 'dark'
      ? 'rgba(76,227,154,0.25)'
      : 'rgba(217,79,122,0.35)'
    : tone === 'accent'
      ? colors.accent
      : tone === 'danger'
        ? colors.danger
        : colors.inputBg;
  const fg = tone === 'neutral' ? colors.text : tone === 'danger' ? '#FFFFFF' : colors.onAccent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={disabled || loading}
      onPress={() => {
        if (Platform.OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      style={({ pressed }) => [
        {
          height: 54,
          borderRadius: tokens.radius.md,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          opacity: pressed ? 0.88 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon}
          <Text
            style={[
              tokens.type.subtitle,
              { color: disabled ? (colors.scheme === 'dark' ? '#6E7A75' : '#FFFFFF') : fg },
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  icon,
  destructive,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: React.ReactNode;
  destructive?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, tokens } = useTheme();
  const color = destructive ? colors.danger : colors.textSecondary;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        {
          height: 44,
          paddingHorizontal: tokens.spacing.md,
          borderRadius: tokens.radius.sm,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 6,
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      {icon}
      <Text style={[tokens.type.caption, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function Pill({
  label,
  selected,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const { colors, tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        paddingHorizontal: 13,
        paddingVertical: 7,
        borderRadius: tokens.radius.pill,
        backgroundColor: selected ? colors.accent : colors.scheme === 'dark' ? 'rgba(255,255,255,0.055)' : 'rgba(58,36,40,0.045)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: selected ? colors.accent : colors.cardBorder,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text
        style={[
          tokens.type.caption,
          {
            color: selected ? colors.onAccent : colors.textSecondary,
            fontFamily: tokens.fontFamily.semibold,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider }, style]} />;
}

export function Chevron({ size = 18 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <Text allowFontScaling={false} style={{ color: colors.textTertiary, fontSize: size, marginTop: -2 }}>
      ›
    </Text>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  const { tokens } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: tokens.spacing.xxl, paddingHorizontal: tokens.spacing.lg }}>
      {icon}
      <AppText variant="headline" style={{ textAlign: 'center', marginTop: tokens.spacing.md }}>
        {title}
      </AppText>
      <AppText variant="body" color="secondary" style={{ textAlign: 'center', marginTop: 6, maxWidth: 290 }}>
        {body}
      </AppText>
      {action ? <View style={{ marginTop: tokens.spacing.xl, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  );
}
