import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarDays, Check, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { formatDayFull, todayKey } from '@/domain/dates';
import { useData } from '@/state/AppProviders';
import { useTheme } from '@/theme/ThemeProvider';
import { CalendarSheet } from '@/ui/CalendarSheet';
import { SheetHeader } from '@/ui/layout';
import { AppText, PrimaryButton } from '@/ui/primitives';

type Mark = true | false | null;

/** Отметка о питании за день. Никаких норм калорий — только «план / отход / не отмечено». */
export default function NutritionDayModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const { colors, tokens } = useTheme();
  const { nutrition, saveNutrition } = useData();

  const initialDate =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : todayKey();

  const existing = useMemo(
    () => nutrition.find((n) => n.date === initialDate) ?? null,
    [nutrition, initialDate]
  );

  const [date, setDate] = useState(initialDate);
  const [mark, setMark] = useState<Mark>(existing ? existing.planFollowed : null);
  const [note, setNote] = useState(existing?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const currentDay = useMemo(
    () => nutrition.find((n) => n.date === date) ?? null,
    [nutrition, date]
  );

  const pickDate = (next: string) => {
    setDate(next);
    const entry = nutrition.find((n) => n.date === next);
    setMark(entry ? entry.planFollowed : null);
    setNote(entry?.note ?? '');
    setCalendarOpen(false);
  };

  const setMarked = (value: true | false) => {
    void Haptics.selectionAsync();
    setMark((prev) => (prev === value ? null : value));
  };

  const onSubmit = async () => {
    setSaving(true);
    try {
      await saveNutrition({ date, planFollowed: mark, note: note.trim() || null });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      Alert.alert('Не удалось сохранить', e instanceof Error ? e.message : 'Попробуйте ещё раз');
    } finally {
      setSaving(false);
    }
  };

  const isRecordedToday = currentDay && (currentDay.planFollowed != null || currentDay.note);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <View style={{ flex: 1, paddingHorizontal: tokens.spacing.xl, paddingTop: 14 }}>
        <SheetHeader
          title={isRecordedToday ? 'Питание за день' : 'Отметить питание'}
          onClose={() => router.back()}
          onSave={onSubmit}
          saving={saving}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Выбрать дату"
          onPress={() => setCalendarOpen(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            alignSelf: 'center',
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: tokens.radius.pill,
            backgroundColor: colors.card,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.cardBorder,
          }}
        >
          <CalendarDays color={colors.textSecondary} size={15} />
          <AppText variant="bodyStrong">{formatDayFull(date)}</AppText>
        </Pressable>

        <View style={{ marginTop: tokens.spacing.xxl, gap: 10 }}>
          <AppText variant="micro" color="tertiary" style={{ textTransform: 'uppercase' }}>
            Отметка
          </AppText>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <MarkButton
              label="План соблюдён"
              icon={<Check size={17} color={mark === true ? colors.onAccent : colors.accent} strokeWidth={2.6} />}
              selected={mark === true}
              onPress={() => setMarked(true)}
            />
            <MarkButton
              label="Отход от плана"
              icon={<X size={17} color={mark === false ? '#FFFFFF' : colors.danger} strokeWidth={2.8} />}
              selected={mark === false}
              tone="danger"
              onPress={() => setMarked(false)}
            />
          </View>
          <AppText variant="caption" color="tertiary">
            Пусто — значит за этот день отметки нет. Это не то же самое, что «ничего не отмечено из-за
            пропуска».
          </AppText>
        </View>

        <View style={{ marginTop: tokens.spacing.xxl, gap: 8 }}>
          <AppText variant="micro" color="tertiary" style={{ textTransform: 'uppercase' }}>
            Заметка
          </AppText>
          <TextInput
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={500}
            placeholder="Например: обед вне плана, перекус перед тренировкой"
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel="Заметка о питании"
            style={{
              minHeight: 96,
              borderRadius: tokens.radius.md,
              backgroundColor: colors.inputBg,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.inputBorder,
              padding: 12,
              color: colors.text,
              textAlignVertical: 'top',
              ...tokens.type.body,
            }}
          />
        </View>

        <View style={{ flex: 1 }} />
        <PrimaryButton
          label={isRecordedToday ? 'Сохранить изменения' : 'Сохранить'}
          onPress={onSubmit}
          loading={saving}
        />
        <View style={{ height: 16 }} />
      </View>

      <CalendarSheet
        visible={calendarOpen}
        selected={date}
        maxDate={todayKey()}
        markedDates={new Set(nutrition.filter((n) => n.planFollowed != null).map((n) => n.date))}
        onClose={() => setCalendarOpen(false)}
        onSelect={pickDate}
      />
    </KeyboardAvoidingView>
  );
}

function MarkButton({
  label,
  icon,
  selected,
  onPress,
  tone = 'accent',
}: {
  label: string;
  icon: React.ReactNode;
  selected: boolean;
  onPress: () => void;
  tone?: 'accent' | 'danger';
}) {
  const { colors, tokens } = useTheme();
  const bg = selected ? (tone === 'danger' ? colors.danger : colors.accent) : colors.card;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        height: 52,
        borderRadius: tokens.radius.md,
        backgroundColor: bg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: selected ? bg : colors.cardBorder,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {icon}
      <AppText
        variant="subtitle"
        color={selected ? (tone === 'danger' ? 'danger' : 'onAccent') : 'secondary'}
        style={selected && tone === 'danger' ? { color: '#FFFFFF' } : undefined}
      >
        {label}
      </AppText>
    </Pressable>
  );
}
