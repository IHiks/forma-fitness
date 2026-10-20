import { useRouter } from 'expo-router';
import { Circle, CircleCheck, Dumbbell, Flame, Plus, Scale } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { buildCalendarMarkers, getDayDetails } from '@/domain/calendar';
import {
  formatDayFull,
  formatMonthYear,
  formatWeight,
  monthGrid,
  startOfMonth,
  todayKey,
  WEEKDAYS_SHORT,
  type DayKey,
} from '@/domain/dates';
import { isHabitDone, nutritionState } from '@/domain/habits';
import { MUSCLE_LABELS } from '@/domain/workouts';
import { useData } from '@/state/AppProviders';
import { useTheme } from '@/theme/ThemeProvider';
import { MonthSwitcher } from '@/ui/CalendarSheet';
import { PageHeader, Screen } from '@/ui/layout';
import { AppText, Card, Divider, Pill, SectionLabel } from '@/ui/primitives';

export default function CalendarScreen() {
  const router = useRouter();
  const { colors, tokens } = useTheme();
  const { weight, workouts, nutrition, habits, checks, toggleHabit } = useData();

  const today = todayKey();
  const [month, setMonth] = useState<DayKey>(startOfMonth(today));
  const [selected, setSelected] = useState<DayKey>(today);

  const markers = useMemo(
    () => buildCalendarMarkers({ weight, workouts, nutrition, habits, checks }),
    [weight, workouts, nutrition, habits, checks]
  );

  const grid = useMemo(() => monthGrid(month), [month]);
  const monthIndex = Number(month.slice(5, 7)) - 1;
  const monthPrefix = month.slice(0, 7);

  const details = useMemo(
    () => getDayDetails(selected, { weight, workouts, nutrition, habits, checks }),
    [selected, weight, workouts, nutrition, habits, checks]
  );

  const monthStats = useMemo(() => {
    const days = [...markers.entries()].filter(([d]) => d.startsWith(monthPrefix));
    return {
      workouts: days.reduce((s, [, m]) => s + m.workouts, 0),
      weight: days.filter(([, m]) => m.weight).length,
      habits: days.filter(([, m]) => m.habitsDone > 0).length,
    };
  }, [markers, monthPrefix]);

  return (
    <Screen>
      <PageHeader title="Календарь" subtitle="Вес, тренировки, питание и привычки по дням" />

      <Card style={{ marginBottom: tokens.spacing.lg }}>
        <MonthSwitcher
          month={month}
          onChange={(next) => {
            setMonth(next);
            setSelected(next);
          }}
          onToday={() => {
            setMonth(startOfMonth(today));
            setSelected(today);
          }}
          label={formatMonthYear(month)}
        />

        <View style={{ flexDirection: 'row', marginBottom: 4 }}>
          {WEEKDAYS_SHORT.map((d) => (
            <View key={d} style={{ flex: 1, alignItems: 'center' }}>
              <AppText variant="micro" color="tertiary">
                {d}
              </AppText>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {grid.map((day) => {
            const inMonth = Number(day.slice(5, 7)) - 1 === monthIndex;
            const isSelected = day === selected;
            const isToday = day === today;
            const m = markers.get(day);
            const hasAny = m?.hasAny ?? false;
            return (
              <Pressable
                key={day}
                accessibilityRole="button"
                accessibilityLabel={`${formatDayFull(day)}${hasAny ? ', есть записи' : ', записей нет'}`}
                accessibilityState={{ selected: isSelected }}
                onPress={() => setSelected(day)}
                style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4 }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isSelected ? colors.accent : 'transparent',
                    borderWidth: isToday && !isSelected ? StyleSheet.hairlineWidth * 2 : 0,
                    borderColor: colors.accent,
                  }}
                >
                  <AppText
                    variant="bodyStrong"
                    color={isSelected ? 'onAccent' : inMonth ? 'text' : 'tertiary'}
                    style={{ opacity: inMonth || isSelected ? 1 : 0.45 }}
                  >
                    {String(Number(day.slice(8, 10)))}
                  </AppText>
                </View>
                <View style={{ flexDirection: 'row', gap: 2.5, height: 6, marginTop: 3, alignItems: 'center' }}>
                  {m?.weight ? (
                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isSelected ? colors.onAccent : colors.muscleColors[1] }} />
                  ) : null}
                  {m && m.workouts > 0 ? (
                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isSelected ? colors.onAccent : colors.muscleColors[0] }} />
                  ) : null}
                  {m && m.nutrition !== 'none' ? (
                    <View
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: isSelected
                          ? colors.onAccent
                          : m.nutrition === 'followed'
                            ? colors.accent
                            : colors.danger,
                      }}
                    />
                  ) : null}
                  {m && m.habitsDone > 0 && m.habitsTotal > 0 ? (
                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isSelected ? colors.onAccent : colors.muscleColors[4] }} />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Divider style={{ marginTop: 8, marginBottom: 12 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <LegendDot color={colors.muscleColors[1] ?? colors.accent} label="вес" />
          <LegendDot color={colors.muscleColors[0] ?? colors.accent} label="тренировка" />
          <LegendDot color={colors.accent} label="питание" />
          <LegendDot color={colors.muscleColors[4] ?? colors.accent} label="привычки" />
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: tokens.spacing.lg }}>
        <StatChip label="тренировок" value={String(monthStats.workouts)} />
        <StatChip label="дней с весом" value={String(monthStats.weight)} />
        <StatChip label="дней с привычками" value={String(monthStats.habits)} />
      </View>

      <SectionLabel
        right={
          <Pressable accessibilityRole="button" onPress={() => setSelected(today)} hitSlop={8}>
            <AppText variant="caption" color="secondary">
              Сегодня
            </AppText>
          </Pressable>
        }
      >
        {formatDayFull(selected)}
      </SectionLabel>

      <Card style={{ marginBottom: tokens.spacing.lg }}>
        {!details.markers.hasAny ? (
          <View style={{ alignItems: 'center', paddingVertical: 18 }}>
            <AppText variant="body" color="secondary" style={{ textAlign: 'center' }}>
              За этот день записей нет
            </AppText>
            <AppText variant="caption" color="tertiary" style={{ textAlign: 'center', marginTop: 4 }}>
              Это отличается от «ничего не делал»: просто нет данных.
            </AppText>
          </View>
        ) : (
          <>
            <Row
              icon={<Scale color={colors.muscleColors[1]} size={16} />}
              label="Вес"
              value={details.weight ? `${formatWeight(details.weight.weightKg)} кг` : '—'}
              muted={!details.weight}
              onPress={() =>
                router.push({ pathname: '/weight/add', params: { date: selected } } as never)
              }
            />
            <Divider />
            <Row
              icon={<Dumbbell color={colors.muscleColors[0]} size={16} />}
              label="Тренировки"
              value={
                details.workouts.length === 0
                  ? '—'
                  : details.workouts.map((w) => w.title || w.muscles.map((m) => MUSCLE_LABELS[m]).join(', ')).join('; ')
              }
              muted={details.workouts.length === 0}
              onPress={() => router.push({ pathname: '/workout/form', params: { date: selected } } as never)}
            />
            <Divider />
            <Row
              icon={<Flame color={nutritionState(details.nutrition ?? undefined) === 'deviated' ? colors.danger : colors.accent} size={16} />}
              label="Питание"
              value={
                nutritionState(details.nutrition ?? undefined) === 'followed'
                  ? 'план соблюдён'
                  : nutritionState(details.nutrition ?? undefined) === 'deviated'
                    ? 'отход от плана'
                    : '—'
              }
              muted={nutritionState(details.nutrition ?? undefined) === 'none'}
              onPress={() => router.push({ pathname: '/nutrition/day', params: { date: selected } } as never)}
            />
          </>
        )}

        {habits.length > 0 ? (
          <>
            <Divider />
            <View style={{ paddingTop: 12 }}>
              <AppText variant="micro" color="tertiary" style={{ textTransform: 'uppercase', marginBottom: 8 }}>
                Привычки
              </AppText>
              {habits.map((h) => {
                const done = isHabitDone(checks, h.id, selected);
                return (
                  <Pressable
                    key={h.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: done }}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      void toggleHabit(h.id, selected, !done);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 6 }}
                  >
                    {done ? (
                      <CircleCheck color={colors.accent} size={18} />
                    ) : (
                      <Circle color={colors.calendarMuted} size={18} />
                    )}
                    <AppText variant="body" color={done ? 'secondary' : 'text'}>
                      {h.emoji ? `${h.emoji}  ` : ''}
                      {h.title}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
      </Card>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pill
          label="+ Вес"
          onPress={() => router.push({ pathname: '/weight/add', params: { date: selected } } as never)}
        />
        <Pill
          label="+ Тренировка"
          onPress={() => router.push({ pathname: '/workout/form', params: { date: selected } } as never)}
        />
        <Pill
          label="+ Питание"
          onPress={() => router.push({ pathname: '/nutrition/day', params: { date: selected } } as never)}
        />
      </View>
    </Screen>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color }} />
      <AppText variant="caption" color="tertiary" style={{ fontSize: 11 }}>
        {label}
      </AppText>
    </View>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  const { colors, tokens } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.card,
        borderRadius: tokens.radius.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.cardBorder,
        paddingVertical: 11,
        paddingHorizontal: 10,
        alignItems: 'center',
      }}
    >
      <AppText variant="numberM">{value}</AppText>
      <AppText variant="caption" color="tertiary" style={{ textAlign: 'center', fontSize: 11 }}>
        {label}
      </AppText>
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  muted,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  muted?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 11,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ width: 20, alignItems: 'center' }}>{icon}</View>
      <AppText variant="body" color={muted ? 'tertiary' : 'secondary'} style={{ width: 92 }}>
        {label}
      </AppText>
      <AppText variant="bodyStrong" color={muted ? 'tertiary' : 'text'} style={{ flex: 1 }} numberOfLines={2}>
        {value}
      </AppText>
      <Plus color={colors.textTertiary} size={14} />
    </Pressable>
  );
}
