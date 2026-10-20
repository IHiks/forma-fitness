import { useRouter } from 'expo-router';
import {
  ArrowDownRight,
  ArrowUpRight,
  Circle,
  CircleCheck,
  Dumbbell,
  Flame,
  Minus,
  Plus,
  Scale,
  Settings as SettingsIcon,
  Sparkles,
} from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { endOfWeek, formatDayLong, formatDayFull, formatSignedWeight, formatWeight, startOfWeek, todayKey, addDays, pluralize } from '@/domain/dates';
import { habitProgress, isHabitDone, nutritionState } from '@/domain/habits';
import { lastWorkoutMuscles, MUSCLE_LABELS, workoutStats } from '@/domain/workouts';
import { summarizeWeight, toStartDelta } from '@/domain/weight';
import { useData } from '@/state/AppProviders';
import { useTheme } from '@/theme/ThemeProvider';
import { HeaderIconButton, PageHeader, Screen } from '@/ui/layout';
import { AppText, Card, Chevron, EmptyState, NumberText, PrimaryButton, SectionLabel } from '@/ui/primitives';
import { WeightChart } from '@/ui/WeightChart';

function DeltaBadge({ delta, label }: { delta: number | null; label: string }) {
  const { colors } = useTheme();
  if (delta == null) {
    return (
      <View>
        <AppText variant="micro" color="tertiary" style={{ textTransform: 'uppercase' }}>
          {label}
        </AppText>
        <AppText variant="caption" color="tertiary" style={{ marginTop: 3 }}>
          —
        </AppText>
      </View>
    );
  }
  const Icon = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : Minus;
  const tint = delta === 0 ? colors.textSecondary : colors.text;
  return (
    <View>
      <AppText variant="micro" color="tertiary" style={{ textTransform: 'uppercase' }}>
        {label}
      </AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 2 }}>
        <Icon color={tint} size={13} strokeWidth={2.4} />
        <AppText variant="bodyStrong" style={{ color: tint }}>
          {formatSignedWeight(delta)} кг
        </AppText>
      </View>
    </View>
  );
}

function QuickAction({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  const { colors, tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        paddingVertical: 12,
        borderRadius: tokens.radius.md,
        backgroundColor: pressed ? colors.cardPressed : colors.scheme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(58,36,40,0.035)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.cardBorder,
      })}
    >
      {icon}
      <AppText variant="caption" color="secondary">
        {label}
      </AppText>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { colors, tokens } = useTheme();
  const { weight, workouts, habits, checks, nutrition, settings, toggleHabit } = useData();

  const today = todayKey();
  const week = { from: startOfWeek(today), to: endOfWeek(today) };

  const summary = useMemo(() => summarizeWeight(weight), [weight]);
  const weekWorkouts = useMemo(
    () => workouts.filter((w) => w.date >= week.from && w.date <= week.to),
    [workouts, week.from, week.to]
  );
  const stats = useMemo(() => workoutStats(weekWorkouts), [weekWorkouts]);
  const todayWorkouts = useMemo(() => workouts.filter((w) => w.date === today), [workouts, today]);
  const recent = useMemo(
    () => [...workouts].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).slice(0, 3),
    [workouts]
  );
  const muscles = useMemo(() => lastWorkoutMuscles(workouts), [workouts]);
  const habitState = useMemo(() => habitProgress(habits, checks, today), [habits, checks, today]);
  const nutritionToday = nutritionState(nutrition.find((n) => n.date === today));
  const hasAnyData = weight.length > 0 || workouts.length > 0 || nutrition.length > 0;
  const toStart = toStartDelta(summary, settings.startWeightKg);
  const nextWeekday = workoutStats(
    workouts.filter((w) => w.date >= addDays(today, 1) && w.date <= addDays(today, 7))
  );

  const greet = () => {
    const h = new Date().getHours();
    if (h < 5) return 'Доброй ночи';
    if (h < 12) return 'Доброе утро';
    if (h < 18) return 'Добрый день';
    return 'Добрый вечер';
  };

  const goWeight = () => router.push('/weight/add' as never);
  const goWorkout = () => router.push('/workout/form' as never);

  return (
    <Screen>
      <PageHeader
        title="Форма"
        subtitle={`${greet()} · ${formatDayFull(today)}`}
        right={
          <HeaderIconButton onPress={() => router.push('/settings' as never)} accessibilityLabel="Настройки">
            <SettingsIcon color={colors.textSecondary} size={19} strokeWidth={1.9} />
          </HeaderIconButton>
        }
      />

      {/* Weight card */}
      <Card style={{ marginBottom: tokens.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <Scale color={colors.accentText} size={15} strokeWidth={2} />
            <AppText variant="micro" color="tertiary" style={{ textTransform: 'uppercase' }}>
              Вес
            </AppText>
          </View>
          <Pressable accessibilityRole="button" onPress={goWeight} hitSlop={10}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: colors.accentSoft,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: tokens.radius.pill,
              }}
            >
              <Plus color={colors.accentText} size={13} strokeWidth={2.6} />
              <AppText variant="caption" color="accent">
                Записать
              </AppText>
            </View>
          </Pressable>
        </View>

        {summary.latest ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 10 }}>
              <View>
                <NumberText value={formatWeight(summary.latest.weightKg)} unit="кг" />
                <AppText variant="caption" color="tertiary" style={{ marginTop: -2 }}>
                  последнее измерение · {formatDayLong(summary.latest.date)}
                </AppText>
              </View>
              <View style={{ gap: 10, alignItems: 'flex-end', paddingBottom: 4 }}>
                <DeltaBadge delta={summary.changeFromPrevious} label="К прошлому" />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 18, marginTop: 14, marginBottom: 4 }}>
              <DeltaBadge delta={toStart} label={settings.startWeightKg != null ? 'От старта' : 'От первого'} />
              {settings.targetWeightKg != null ? (
                <View>
                  <AppText variant="micro" color="tertiary" style={{ textTransform: 'uppercase' }}>
                    Цель
                  </AppText>
                  <AppText variant="bodyStrong" style={{ marginTop: 3 }}>
                    {formatWeight(settings.targetWeightKg)} кг
                  </AppText>
                </View>
              ) : null}
            </View>

            <View style={{ marginTop: 10, marginHorizontal: -4 }}>
              <WeightChart
                points={weight.map((w) => ({ date: w.date, actual: w.weightKg, smoothed: null }))}
                height={110}
                showTrend={false}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/history' as never)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 6 }}
            >
              <AppText variant="caption" color="secondary">
                Дневник веса и график
              </AppText>
              <Chevron />
            </Pressable>
          </>
        ) : (
          <EmptyState
            icon={
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: colors.accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Scale color={colors.accentText} size={22} strokeWidth={1.9} />
              </View>
            }
            title="Начните с одного числа"
            body="Запишите текущий вес — и увидите динамику: от прошлого измерения, от старта и на графике."
            action={
              <PrimaryButton label="Записать вес" onPress={goWeight} icon={<Plus color={colors.onAccent} size={17} />} />
            }
          />
        )}
      </Card>

      {/* Activity card */}
      <SectionLabel
        right={
          <Pressable accessibilityRole="button" onPress={() => router.push('/workouts' as never)} hitSlop={8}>
            <AppText variant="caption" color="secondary">
              Все
            </AppText>
          </Pressable>
        }
      >
        Активность
      </SectionLabel>
      <Card style={{ marginBottom: tokens.spacing.lg }}>
        {workouts.length === 0 ? (
          <EmptyState
            icon={
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: colors.scheme === 'dark' ? 'rgba(111,184,255,0.10)' : 'rgba(47,111,184,0.09)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Dumbbell color={colors.info} size={22} strokeWidth={1.9} />
              </View>
            }
            title="Пока тихо"
            body="Добавьте первую тренировку: группы мышц, длительность и заметку."
            action={
              <PrimaryButton
                label="Записать тренировку"
                onPress={goWorkout}
                icon={<Plus color={colors.onAccent} size={17} />}
              />
            }
          />
        ) : (
          <>
            {todayWorkouts.length > 0 ? (
              <View style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                  <CircleCheck color={colors.accentText} size={16} strokeWidth={2.2} />
                  <AppText variant="micro" color="accent" style={{ textTransform: 'uppercase' }}>
                    Сегодня
                  </AppText>
                </View>
                {todayWorkouts.map((w) => (
                  <Pressable
                    key={w.id}
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: '/workout/form', params: { id: String(w.id) } } as never)}
                    style={({ pressed }) => ({
                      backgroundColor: pressed ? colors.cardPressed : 'transparent',
                      paddingVertical: 4,
                    })}
                  >
                    <AppText variant="subtitle">{w.title || w.muscles.map((m) => MUSCLE_LABELS[m]).join(' · ')}</AppText>
                    <AppText variant="caption" color="tertiary" style={{ marginTop: 2 }}>
                      {[w.durationMin ? `${w.durationMin} мин` : null, w.muscles.map((m) => MUSCLE_LABELS[m]).join(', ')]
                        .filter(Boolean)
                        .join(' · ')}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Circle color={colors.textTertiary} size={13} strokeWidth={2} />
                <AppText variant="body" color="secondary">
                  Сегодня тренировки ещё нет
                </AppText>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              <View
                style={{
                  flex: 1,
                  backgroundColor: colors.scheme === 'dark' ? 'rgba(255,255,255,0.035)' : 'rgba(58,36,40,0.03)',
                  borderRadius: tokens.radius.md,
                  padding: 12,
                }}
              >
                <NumberText value={String(stats.workouts)} size="medium" />
                <AppText variant="caption" color="tertiary">
                  {pluralize(stats.workouts, 'тренировка', 'тренировки', 'тренировок')} на этой неделе
                </AppText>
              </View>
              <View
                style={{
                  flex: 1,
                  backgroundColor: colors.scheme === 'dark' ? 'rgba(255,255,255,0.035)' : 'rgba(58,36,40,0.03)',
                  borderRadius: tokens.radius.md,
                  padding: 12,
                }}
              >
                <NumberText value={String(stats.visits)} size="medium" />
                <AppText variant="caption" color="tertiary">
                  {pluralize(stats.visits, 'посещение', 'посещения', 'посещений')}
                </AppText>
              </View>
            </View>

            {recent.length > 0 ? (
              <View style={{ gap: 10 }}>
                <AppText variant="micro" color="tertiary" style={{ textTransform: 'uppercase' }}>
                  Недавние
                </AppText>
                {recent.map((w) => (
                  <Pressable
                    key={w.id}
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: '/workout/form', params: { id: String(w.id) } } as never)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <View style={{ flex: 1 }}>
                      <AppText variant="bodyStrong" numberOfLines={1}>
                        {w.title || w.muscles.map((m) => MUSCLE_LABELS[m]).join(', ')}
                      </AppText>
                      <AppText variant="caption" color="tertiary">
                        {formatDayLong(w.date)}
                        {w.durationMin ? ` · ${w.durationMin} мин` : ''}
                      </AppText>
                    </View>
                    <Chevron />
                  </Pressable>
                ))}
              </View>
            ) : null}

            {muscles.length > 0 ? (
              <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider }}>
                <AppText variant="micro" color="tertiary" style={{ textTransform: 'uppercase' }}>
                  Последняя тренировка
                </AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {muscles.map((m) => (
                    <View
                      key={m}
                      style={{
                        paddingHorizontal: 9,
                        paddingVertical: 4,
                        borderRadius: tokens.radius.pill,
                        backgroundColor: colors.accentSoft,
                      }}
                    >
                      <AppText variant="caption" color="accent">
                        {MUSCLE_LABELS[m]}
                      </AppText>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {nextWeekday.workouts === 0 && workouts.length > 0 ? (
              <AppText variant="caption" color="tertiary" style={{ marginTop: 14 }}>
                На следующей неделе тренировок пока нет.
              </AppText>
            ) : null}
          </>
        )}
      </Card>

      {/* Nutrition & habits */}
      <SectionLabel
        right={
          <Pressable accessibilityRole="button" onPress={() => router.push('/habit/manage' as never)} hitSlop={8}>
            <AppText variant="caption" color="secondary">
              Настроить
            </AppText>
          </Pressable>
        }
      >
        Привычки и питание
      </SectionLabel>
      <Card style={{ marginBottom: tokens.spacing.lg }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Отметить питание за сегодня"
          onPress={() => router.push({ pathname: '/nutrition/day', params: { date: today } } as never)}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.7 : 1 })}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor:
                nutritionToday === 'followed'
                  ? colors.accentSoft
                  : nutritionToday === 'deviated'
                    ? colors.dangerSoft
                    : colors.scheme === 'dark'
                      ? 'rgba(255,255,255,0.045)'
                      : 'rgba(58,36,40,0.04)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Flame
              color={
                nutritionToday === 'followed'
                  ? colors.accentText
                  : nutritionToday === 'deviated'
                    ? colors.danger
                    : colors.textTertiary
              }
              size={17}
              strokeWidth={2}
            />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong">Питание</AppText>
            <AppText variant="caption" color={nutritionToday === 'none' ? 'tertiary' : 'secondary'}>
              {nutritionToday === 'followed'
                ? 'План соблюдён'
                : nutritionToday === 'deviated'
                  ? 'Был отход от плана'
                  : 'Пока не отмечено'}
            </AppText>
          </View>
          <Chevron />
        </Pressable>

        {habits.length > 0 ? (
          <View style={{ marginTop: 14, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <AppText variant="micro" color="tertiary" style={{ textTransform: 'uppercase' }}>
                Привычки сегодня
              </AppText>
              <AppText variant="caption" color="secondary">
                {habitState.done} из {habitState.total}
              </AppText>
            </View>
            {habits.map((habit) => {
              const done = isHabitDone(checks, habit.id, today);
              return (
                <Pressable
                  key={habit.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: done }}
                  accessibilityLabel={habit.title}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    void toggleHabit(habit.id, today, !done);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                >
                  {done ? (
                    <CircleCheck color={colors.accent} size={20} strokeWidth={2} />
                  ) : (
                    <Circle color={colors.calendarMuted} size={20} strokeWidth={1.8} />
                  )}
                  <AppText
                    variant="body"
                    color={done ? 'secondary' : 'text'}
                    style={done ? { textDecorationLine: 'line-through' } : undefined}
                  >
                    {habit.emoji ? `${habit.emoji}  ` : ''}
                    {habit.title}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          <QuickAction
            icon={<Sparkles color={colors.textSecondary} size={15} strokeWidth={2} />}
            label="Привычки"
            onPress={() => router.push('/habit/manage' as never)}
          />
          <QuickAction
            icon={<Plus color={colors.textSecondary} size={15} strokeWidth={2.4} />}
            label="Тренировка"
            onPress={goWorkout}
          />
        </View>
      </Card>

      {/* Weekly review */}
      <SectionLabel>Итоги недели</SectionLabel>
      <Card style={{ marginBottom: tokens.spacing.lg }}>
        <WeeklyReviewRow
          label="Тренировки"
          value={`${stats.workouts} · ${stats.visits} ${pluralize(stats.visits, 'день', 'дня', 'дней')}`}
          muted={stats.workouts === 0}
        />
        <WeeklyReviewDivider />
        <WeeklyReviewRow
          label="Вес"
          value={
            weekWorkouts.length === 0 && weight.length === 0
              ? '—'
              : `${weight.filter((w) => w.date >= week.from && w.date <= week.to).length} ${pluralize(
                  weight.filter((w) => w.date >= week.from && w.date <= week.to).length,
                  'запись',
                  'записи',
                  'записей'
                )}`
          }
          muted={weight.filter((w) => w.date >= week.from && w.date <= week.to).length === 0}
        />
        <WeeklyReviewDivider />
        <WeeklyReviewRow
          label="Привычки"
          value={
            habitState.total === 0
              ? '—'
              : `${habitState.done} из ${habitState.total} сегодня`
          }
          muted={habitState.done === 0}
        />
      </Card>

      {!hasAnyData ? (
        <View style={{ alignItems: 'center', marginTop: 6, marginBottom: 12 }}>
          <AppText variant="caption" color="tertiary" style={{ textAlign: 'center', maxWidth: 300 }}>
            Все данные хранятся только на этом iPhone. Настройки и резервная копия — в шестерёнке сверху.
          </AppText>
        </View>
      ) : null}
    </Screen>
  );
}

function WeeklyReviewRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9 }}>
      <AppText variant="body" color={muted ? 'tertiary' : 'secondary'}>
        {label}
      </AppText>
      <AppText variant="bodyStrong" color={muted ? 'tertiary' : 'text'}>
        {value}
      </AppText>
    </View>
  );
}

function WeeklyReviewDivider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider }} />;
}
