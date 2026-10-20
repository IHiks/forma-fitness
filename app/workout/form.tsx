import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarDays, Check, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { formatDayFull, todayKey } from '@/domain/dates';
import {
  MAX_DURATION_MIN,
  MUSCLE_GROUPS,
  MUSCLE_LABELS,
  normalizeMuscles,
  toggleMuscle,
  validateWorkout,
  type MuscleGroup,
} from '@/domain/workouts';
import { useData } from '@/state/AppProviders';
import { useTheme } from '@/theme/ThemeProvider';
import { CalendarSheet } from '@/ui/CalendarSheet';
import { SheetHeader } from '@/ui/layout';
import { AppText, Divider, GhostButton, PrimaryButton } from '@/ui/primitives';

export default function WorkoutFormModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; date?: string }>();
  const { colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { workouts, saveWorkout, deleteWorkout } = useData();

  const editingId = params.id ? Number(params.id) : null;
  const existing = useMemo(
    () => (editingId != null ? workouts.find((w) => w.id === editingId) ?? null : null),
    [workouts, editingId]
  );

  const [date, setDate] = useState(
    existing?.date ?? (params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : todayKey())
  );
  const [muscles, setMuscles] = useState<MuscleGroup[]>(existing ? normalizeMuscles(existing.muscles) : []);
  const [duration, setDuration] = useState(existing?.durationMin ? String(existing.durationMin) : '');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Re-sync the form when the edited workout changes (React-endorsed render-time pattern).
  const [prevExistingId, setPrevExistingId] = useState(existing?.id ?? null);
  if ((existing?.id ?? null) !== prevExistingId) {
    setPrevExistingId(existing?.id ?? null);
    if (existing) {
      setDate(existing.date);
      setMuscles(normalizeMuscles(existing.muscles));
      setDuration(existing.durationMin ? String(existing.durationMin) : '');
      setTitle(existing.title ?? '');
      setNote(existing.note ?? '');
    }
  }

  const onSubmit = async () => {
    setError(null);
    const durationValue = duration.trim() === '' ? null : Number(duration.trim());
    if (durationValue != null && (!Number.isInteger(durationValue) || durationValue <= 0)) {
      setError('Длительность — целое число минут');
      return;
    }
    if (durationValue != null && durationValue > MAX_DURATION_MIN) {
      setError(`Максимум ${MAX_DURATION_MIN} минут`);
      return;
    }
    setSaving(true);
    const result = await saveWorkout(
      {
        date,
        title: title.trim() || null,
        muscles,
        durationMin: durationValue,
        note: note.trim() || null,
      },
      editingId ?? undefined
    );
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const onDelete = () => {
    if (!existing) return;
    Alert.alert('Удалить тренировку?', `${formatDayFull(existing.date)} — действие нельзя отменить.`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => void deleteWorkout(existing.id).then(() => router.back()),
      },
    ]);
  };

  const validation = validateWorkout({ date, muscles, durationMin: null });
  const canSave = validation.ok;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: tokens.spacing.xl,
          paddingTop: 14,
          paddingBottom: insets.bottom + 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <SheetHeader
          title={existing ? 'Изменить тренировку' : 'Новая тренировка'}
          onClose={() => router.back()}
          onSave={onSubmit}
          saveDisabled={!canSave}
          saving={saving}
        />

        <Pressable
          accessibilityRole="button"
          onPress={() => setCalendarOpen(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            alignSelf: 'flex-start',
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: tokens.radius.pill,
            backgroundColor: colors.card,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.cardBorder,
            marginBottom: tokens.spacing.xl,
          }}
        >
          <CalendarDays color={colors.textSecondary} size={15} />
          <AppText variant="bodyStrong">{formatDayFull(date)}</AppText>
        </Pressable>

        <AppText variant="micro" color="tertiary" style={{ textTransform: 'uppercase', marginBottom: 10 }}>
          Группы мышц
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          {MUSCLE_GROUPS.map((m) => {
            const selected = muscles.includes(m);
            return (
              <Pressable
                key={m}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={MUSCLE_LABELS[m]}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setMuscles(toggleMuscle(muscles, m));
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: tokens.radius.pill,
                  backgroundColor: selected ? colors.accent : colors.card,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: selected ? colors.accent : colors.cardBorder,
                }}
              >
                {selected ? <Check color={colors.onAccent} size={12} strokeWidth={3} /> : null}
                <AppText
                  variant="caption"
                  color={selected ? 'onAccent' : 'secondary'}
                  style={{ fontFamily: tokens.fontFamily.semibold }}
                >
                  {MUSCLE_LABELS[m]}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        <AppText variant="caption" color={muscles.length === 0 ? 'tertiary' : 'accent'}>
          {muscles.length === 0
            ? 'Выберите одну или несколько групп'
            : `Выбрано: ${muscles.length} · ${muscles.map((m) => MUSCLE_LABELS[m]).join(', ')}`}
        </AppText>

        <View style={{ height: tokens.spacing.xl }} />
        <FieldLabel>Длительность, мин</FieldLabel>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          {[30, 45, 60, 90].map((min) => (
            <Pressable
              key={min}
              accessibilityRole="button"
              onPress={() => setDuration(String(min))}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: tokens.radius.pill,
                backgroundColor: duration === String(min) ? colors.accentSoft : colors.card,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: duration === String(min) ? colors.accent : colors.cardBorder,
              }}
            >
              <AppText variant="caption" color={duration === String(min) ? 'accent' : 'secondary'}>
                {min}
              </AppText>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={duration}
          onChangeText={(t) => setDuration(t.replace(/[^0-9]/g, '').slice(0, 3))}
          keyboardType="number-pad"
          placeholder="Например, 55"
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel="Длительность в минутах"
          style={[
            tokens.type.body,
            {
              backgroundColor: colors.inputBg,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.inputBorder,
              borderRadius: tokens.radius.md,
              paddingHorizontal: 14,
              paddingVertical: 13,
              color: colors.text,
            },
          ]}
        />

        <View style={{ height: tokens.spacing.lg }} />
        <FieldLabel>Название (необязательно)</FieldLabel>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Например, Жим + тяга"
          placeholderTextColor={colors.textTertiary}
          maxLength={80}
          accessibilityLabel="Название тренировки"
          style={[
            tokens.type.body,
            {
              backgroundColor: colors.inputBg,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.inputBorder,
              borderRadius: tokens.radius.md,
              paddingHorizontal: 14,
              paddingVertical: 13,
              color: colors.text,
            },
          ]}
        />

        <View style={{ height: tokens.spacing.lg }} />
        <FieldLabel>Заметка</FieldLabel>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Самочувствие, веса, что изменить"
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={1000}
          accessibilityLabel="Заметка к тренировке"
          style={[
            tokens.type.body,
            {
              backgroundColor: colors.inputBg,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.inputBorder,
              borderRadius: tokens.radius.md,
              paddingHorizontal: 14,
              paddingVertical: 13,
              minHeight: 92,
              textAlignVertical: 'top',
              color: colors.text,
            },
          ]}
        />

        {error ? (
          <AppText variant="caption" color="danger" style={{ marginTop: 12 }}>
            {error}
          </AppText>
        ) : null}

        <View style={{ height: tokens.spacing.xl }} />
        <PrimaryButton label={existing ? 'Сохранить' : 'Добавить тренировку'} onPress={onSubmit} disabled={!canSave} />

        {existing ? (
          <>
            <Divider style={{ marginVertical: 14 }} />
            <View style={{ alignItems: 'center' }}>
              <GhostButton
                label="Удалить тренировку"
                icon={<Trash2 color={colors.danger} size={15} />}
                destructive
                onPress={onDelete}
              />
            </View>
          </>
        ) : null}
      </ScrollView>

      <CalendarSheet
        visible={calendarOpen}
        selected={date}
        maxDate={todayKey()}
        onClose={() => setCalendarOpen(false)}
        onSelect={(d) => {
          setDate(d);
          setCalendarOpen(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <AppText variant="micro" color="tertiary" style={{ textTransform: 'uppercase', marginBottom: 8 }}>
      {children}
    </AppText>
  );
}
