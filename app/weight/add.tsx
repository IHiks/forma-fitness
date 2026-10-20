import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarDays, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { formatDayFull, todayKey } from '@/domain/dates';
import { parseWeightInput, roundWeight, validateWeight } from '@/domain/weight';
import { useData } from '@/state/AppProviders';
import { useTheme } from '@/theme/ThemeProvider';
import { SheetHeader } from '@/ui/layout';
import { CalendarSheet } from '@/ui/CalendarSheet';
import { AppText, GhostButton, PrimaryButton } from '@/ui/primitives';

export default function WeightEntryModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const { colors, tokens } = useTheme();
  const { weight, saveWeight, deleteWeight } = useData();

  const initialDate = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : todayKey();
  const existing = useMemo(() => weight.find((w) => w.date === initialDate) ?? null, [weight, initialDate]);

  const [date, setDate] = useState(initialDate);
  const [raw, setRaw] = useState(existing ? existing.weightKg.toFixed(1).replace('.', ',') : '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // If the user picks another date that already has a record, prefill it (and ask to edit).
  // Done during render (React-endorsed pattern) instead of an effect.
  const [prevDate, setPrevDate] = useState(date);
  if (prevDate !== date) {
    setPrevDate(date);
    const entry = weight.find((w) => w.date === date);
    if (entry) setRaw(entry.weightKg.toFixed(1).replace('.', ','));
  }

  const currentEntry = weight.find((w) => w.date === date) ?? null;

  const step = (delta: number) => {
    const parsed = parseWeightInput(raw) ?? currentEntry?.weightKg ?? 0;
    if (!parsed) return;
    const next = Math.min(400, Math.max(20, roundWeight(parsed + delta)));
    setRaw(next.toFixed(1).replace('.', ','));
    void Haptics.selectionAsync();
  };

  const onSubmit = async () => {
    Keyboard.dismiss();
    const result = validateWeight(raw, date);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaving(true);
    try {
      await saveWeight({ date: result.value.date, weightKg: result.value.weightKg, note: null });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!currentEntry) return;
    Alert.alert('Удалить запись?', `Вес за ${formatDayFull(currentEntry.date)} будет удалён.`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          void deleteWeight(currentEntry.id).then(() => router.back());
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <View style={{ flex: 1, paddingHorizontal: tokens.spacing.xl, paddingTop: 14 }}>
        <SheetHeader
          title={currentEntry ? 'Изменить вес' : 'Новый вес'}
          onClose={() => router.back()}
          onSave={onSubmit}
          saveDisabled={!raw.trim()}
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

        {currentEntry && currentEntry.date !== initialDate ? (
          <AppText variant="caption" color="accent" style={{ textAlign: 'center', marginTop: 10 }}>
            За эту дату уже есть запись — сохранение изменит её
          </AppText>
        ) : null}
        {currentEntry && currentEntry.date === initialDate ? (
          <AppText variant="caption" color="tertiary" style={{ textAlign: 'center', marginTop: 10 }}>
            Запись за эту дату уже существует — вы её редактируете
          </AppText>
        ) : null}

        <View style={{ flex: 1, justifyContent: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Минус 0,1 кг"
              onPress={() => step(-0.1)}
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: colors.card,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.cardBorder,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppText variant="title" color="secondary">
                −
              </AppText>
            </Pressable>

            <View style={{ alignItems: 'center', marginHorizontal: 18 }}>
              <TextInput
                value={raw}
                onChangeText={(t) => {
                  setError(null);
                  setRaw(t.replace(/[^0-9,.]/g, '').slice(0, 6));
                }}
                keyboardType="decimal-pad"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={onSubmit}
                placeholder="0,0"
                placeholderTextColor={colors.textTertiary}
                accessibilityLabel="Вес в килограммах"
                style={[
                  tokens.type.display,
                  {
                    color: error ? colors.danger : colors.text,
                    fontSize: 64,
                    lineHeight: 72,
                    textAlign: 'center',
                    minWidth: 150,
                    padding: 0,
                  },
                ]}
                maxLength={6}
              />
              <AppText variant="caption" color="tertiary" style={{ marginTop: -6 }}>
                килограммы
              </AppText>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Плюс 0,1 кг"
              onPress={() => step(0.1)}
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: colors.card,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.cardBorder,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppText variant="title" color="secondary">
                +
              </AppText>
            </Pressable>
          </View>

          {error ? (
            <AppText variant="caption" color="danger" style={{ textAlign: 'center', marginTop: 14 }}>
              {error}
            </AppText>
          ) : (
            <AppText variant="caption" color="tertiary" style={{ textAlign: 'center', marginTop: 14 }}>
              Точность 0,1 кг
            </AppText>
          )}

          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 24 }}>
            {[-1, -0.5, 0.5, 1].map((d) => (
              <Pressable
                key={d}
                accessibilityRole="button"
                onPress={() => step(d)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: tokens.radius.pill,
                  backgroundColor: colors.card,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: colors.cardBorder,
                }}
              >
                <AppText variant="caption" color="secondary">
                  {d > 0 ? '+' : '−'}
                  {String(Math.abs(d)).replace('.', ',')}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>

        <PrimaryButton label={currentEntry ? 'Сохранить изменения' : 'Сохранить'} onPress={onSubmit} loading={saving} />
        {currentEntry ? (
          <View style={{ alignItems: 'center', marginTop: 6, marginBottom: 10 }}>
            <GhostButton
              label="Удалить запись"
              icon={<Trash2 color={colors.danger} size={15} />}
              destructive
              onPress={onDelete}
            />
          </View>
        ) : (
          <View style={{ height: 16 }} />
        )}
      </View>

      <CalendarSheet
        visible={calendarOpen}
        selected={date}
        maxDate={todayKey()}
        markedDates={new Set(weight.map((w) => w.date))}
        onClose={() => setCalendarOpen(false)}
        onSelect={(d) => {
          setDate(d);
          setCalendarOpen(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}
