import { useRouter } from 'expo-router';
import { Dumbbell, Filter, Plus, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  endOfMonth,
  endOfWeek,
  formatDayFull,
  pluralize,
  startOfMonth,
  startOfWeek,
  todayKey,
} from '@/domain/dates';
import {
  distributionByMuscle,
  filterWorkouts,
  isMuscleGroup,
  MUSCLE_GROUPS,
  MUSCLE_LABELS,
  workoutStats,
  type MuscleGroup,
} from '@/domain/workouts';
import { useData } from '@/state/AppProviders';
import { useTheme } from '@/theme/ThemeProvider';
import { PageHeader, Screen } from '@/ui/layout';
import { AppText, Card, Divider, EmptyState, NumberText, Pill, SectionLabel } from '@/ui/primitives';

type Range = 'week' | 'month' | 'all';

export default function WorkoutsScreen() {
  const router = useRouter();
  const { colors, tokens } = useTheme();
  const { workouts } = useData();
  const [range, setRange] = useState<Range>('month');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);

  const today = todayKey();
  const bounds = useMemo(() => {
    if (range === 'week') return { from: startOfWeek(today), to: endOfWeek(today) };
    if (range === 'month') return { from: startOfMonth(today), to: endOfMonth(today) };
    return { from: null, to: null };
  }, [range, today]);

  const inRange = useMemo(
    () => filterWorkouts(workouts, { from: bounds.from, to: bounds.to }),
    [workouts, bounds.from, bounds.to]
  );
  const filtered = useMemo(
    () => (muscle ? inRange.filter((w) => w.muscles.includes(muscle)) : inRange),
    [inRange, muscle]
  );
  const stats = useMemo(() => workoutStats(filtered), [filtered]);
  const dist = useMemo(() => distributionByMuscle(filtered), [filtered]);
  const maxCount = dist[0]?.count ?? 1;

  const rangeLabel = range === 'week' ? 'на неделе' : range === 'month' ? 'в этом месяце' : 'за всё время';

  return (
    <Screen>
      <PageHeader
        title="Тренировки"
        subtitle={`${stats.workouts} ${pluralize(stats.workouts, 'тренировка', 'тренировки', 'тренировок')} ${rangeLabel}`}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Добавить тренировку"
            onPress={() => router.push('/workout/form' as never)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              backgroundColor: colors.accent,
              paddingHorizontal: 13,
              paddingVertical: 9,
              borderRadius: tokens.radius.pill,
              marginTop: 6,
            }}
          >
            <Plus color={colors.onAccent} size={14} strokeWidth={2.6} />
            <AppText variant="caption" color="onAccent">
              Добавить
            </AppText>
          </Pressable>
        }
      />

      <View style={{ flexDirection: 'row', gap: 6, marginBottom: tokens.spacing.lg }}>
        <Pill label="Неделя" selected={range === 'week'} onPress={() => setRange('week')} />
        <Pill label="Месяц" selected={range === 'month'} onPress={() => setRange('month')} />
        <Pill label="Всё" selected={range === 'all'} onPress={() => setRange('all')} />
      </View>

      <Card style={{ marginBottom: tokens.spacing.lg }}>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1 }}>
            <NumberText value={String(stats.workouts)} size="medium" />
            <AppText variant="caption" color="tertiary">
              {pluralize(stats.workouts, 'сессия', 'сессии', 'сессий')}
            </AppText>
          </View>
          <View style={{ flex: 1 }}>
            <NumberText value={String(stats.visits)} size="medium" />
            <AppText variant="caption" color="tertiary">
              {pluralize(stats.visits, 'день', 'дня', 'дней')}
            </AppText>
          </View>
          <View style={{ flex: 1 }}>
            <NumberText
              value={stats.minutes >= 60 ? `${Math.floor(stats.minutes / 60)}ч${stats.minutes % 60 ? ` ${stats.minutes % 60}м` : ''}` : String(stats.minutes)}
              size="medium"
            />
            <AppText variant="caption" color="tertiary">
              длительность
            </AppText>
          </View>
        </View>
      </Card>

      <SectionLabel right={<Filter color={colors.textTertiary} size={13} />}>Фильтр по группам</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: tokens.spacing.lg }}>
        {MUSCLE_GROUPS.filter((m) => workouts.some((w) => w.muscles.includes(m)) || m === muscle).map((m) => (
          <Pill
            key={m}
            label={MUSCLE_LABELS[m]}
            selected={muscle === m}
            onPress={() => setMuscle(muscle === m ? null : m)}
          />
        ))}
        {muscle ? (
          <Pill
            label="Сбросить"
            onPress={() => {
              setMuscle(null);
            }}
          />
        ) : null}
      </View>

      {dist.length > 0 ? (
        <>
          <SectionLabel>Распределение</SectionLabel>
          <Card style={{ marginBottom: tokens.spacing.lg, gap: 10 }}>
            {dist.slice(0, 8).map((d) => (
              <Pressable
                key={d.muscle}
                accessibilityRole="button"
                accessibilityLabel={`${MUSCLE_LABELS[d.muscle]}: ${d.count}, ${Math.round(d.share * 100)}%`}
                onPress={() => setMuscle(muscle === d.muscle ? null : d.muscle)}
                style={{ gap: 5 }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <AppText variant="caption" color="secondary">
                    {MUSCLE_LABELS[d.muscle]}
                  </AppText>
                  <AppText variant="caption" color="tertiary">
                    {d.count} · {Math.round(d.share * 100)}%
                  </AppText>
                </View>
                <View
                  style={{
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: colors.scheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(58,36,40,0.06)',
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      width: `${Math.max(4, (d.count / maxCount) * 100)}%`,
                      height: 5,
                      borderRadius: 3,
                      backgroundColor: colors.muscleColors[MUSCLE_GROUPS.indexOf(d.muscle) % colors.muscleColors.length],
                    }}
                  />
                </View>
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}

      <SectionLabel>{muscle ? `Группа: ${MUSCLE_LABELS[muscle]}` : 'Список'}</SectionLabel>
      {filtered.length === 0 ? (
        <Card>
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
                <Dumbbell color={colors.accentText} size={22} />
              </View>
            }
            title={muscle ? 'Ничего не найдено' : workouts.length === 0 ? 'Первая тренировка' : 'В этом периоде пусто'}
            body={
              muscle
                ? 'По выбранной группе мышц нет тренировок в этом периоде.'
                : workouts.length === 0
                  ? 'Отметьте группы мышц, длительность и добавьте заметку — всё останется на устройстве.'
                  : 'Смените период или добавьте тренировку.'
            }
          />
        </Card>
      ) : (
        <Card padded={false} style={{ marginBottom: tokens.spacing.lg }}>
          {filtered.map((w, i) => (
            <View key={w.id}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/workout/form', params: { id: String(w.id) } } as never)}
                style={({ pressed }) => ({
                  paddingHorizontal: 16,
                  paddingVertical: 13,
                  backgroundColor: pressed ? colors.cardPressed : 'transparent',
                })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyStrong" numberOfLines={1}>
                      {w.title || w.muscles.map((m) => MUSCLE_LABELS[m]).join(' · ')}
                    </AppText>
                    <AppText variant="caption" color="tertiary" style={{ marginTop: 2 }}>
                      {formatDayFull(w.date)}
                      {w.durationMin ? ` · ${w.durationMin} мин` : ''}
                    </AppText>
                  </View>
                  {isMuscleGroup(w.muscles[0]) ? (
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor:
                          colors.muscleColors[MUSCLE_GROUPS.indexOf(w.muscles[0]) % colors.muscleColors.length],
                      }}
                    />
                  ) : null}
                </View>
                {w.muscles.length > 1 || w.title ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
                    {w.muscles.map((m) => (
                      <View
                        key={m}
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: tokens.radius.pill,
                          backgroundColor: colors.scheme === 'dark' ? 'rgba(255,255,255,0.045)' : 'rgba(58,36,40,0.04)',
                        }}
                      >
                        <AppText variant="caption" color="secondary" style={{ fontSize: 11.5 }}>
                          {MUSCLE_SHORT_SAFE(m)}
                        </AppText>
                      </View>
                    ))}
                  </View>
                ) : null}
                {w.note ? (
                  <AppText variant="caption" color="tertiary" numberOfLines={2} style={{ marginTop: 6 }}>
                    {w.note}
                  </AppText>
                ) : null}
              </Pressable>
              {i < filtered.length - 1 ? <Divider style={{ marginLeft: 16 }} /> : null}
            </View>
          ))}
        </Card>
      )}

      {muscle ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setMuscle(null)}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <X color={colors.textTertiary} size={14} />
          <AppText variant="caption" color="tertiary">
            Сбросить фильтр
          </AppText>
        </Pressable>
      ) : (
        <View style={{ height: 1, backgroundColor: 'transparent' }} />
      )}
    </Screen>
  );
}

function MUSCLE_SHORT_SAFE(m: MuscleGroup): string {
  return MUSCLE_LABELS[m];
}
