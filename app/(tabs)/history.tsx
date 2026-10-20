import { useRouter } from 'expo-router';
import { ArrowDownRight, ArrowUpRight, Minus, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import {
  addDays,
  formatDayFull,
  formatSignedWeight,
  startOfWeek,
  todayKey,
} from '@/domain/dates';
import {
  normalizeWeightSeries,
  PERIOD_LABELS,
  periodStart,
  roundWeight,
  selectSeriesForPeriod,
  summarizeWeight,
  toStartDelta,
  trendFromSeries,
  weeklyAverages,
  type Period,
} from '@/domain/weight';
import { useData } from '@/state/AppProviders';
import { useTheme } from '@/theme/ThemeProvider';
import { PageHeader, Screen } from '@/ui/layout';
import { AppText, Card, Divider, EmptyState, NumberText, Pill, SectionLabel } from '@/ui/primitives';
import { WeightChart } from '@/ui/WeightChart';

const PERIODS: Period[] = ['7d', '30d', '3m', 'year', 'all'];

export default function HistoryScreen() {
  const router = useRouter();
  const { colors, tokens } = useTheme();
  const { weight, settings, deleteWeight } = useData();
  const [period, setPeriod] = useState<Period>('30d');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const today = todayKey();
  const summary = useMemo(() => summarizeWeight(weight), [weight]);
  const series = useMemo(() => normalizeWeightSeries(weight), [weight]);
  const start = periodStart(period, today, addDays);
  const visible = useMemo(() => selectSeriesForPeriod(series, start), [series, start]);
  const trend = useMemo(() => trendFromSeries(visible), [visible]);
  const weeks = useMemo(() => weeklyAverages(weight, (d) => startOfWeek(d), 3), [weight]);

  /** Change inside the selected period (first vs last visible measurement). */
  const periodDelta = useMemo(() => {
    if (visible.length < 2) return null;
    return roundWeight(visible.at(-1)!.weightKg - visible[0]!.weightKg);
  }, [visible]);

  const display = useMemo(() => [...weight].reverse(), [weight]);
  const onDelete = (id: number, date: string) => {
    Alert.alert('Удалить измерение?', `${formatDayFull(date)} · ${weight.find((w) => w.id === id)?.weightKg.toFixed(1).replace('.', ',')} кг`, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: () => void deleteWeight(id) },
    ]);
  };

  return (
    <Screen>
      <PageHeader
        title="История"
        subtitle={weight.length > 0 ? `${weight.length} ${weight.length === 1 ? 'измерение' : 'измерений'}` : 'Дневник веса'}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Добавить вес"
            onPress={() => router.push('/weight/add' as never)}
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
              Вес
            </AppText>
          </Pressable>
        }
      />

      {weight.length === 0 ? (
        <Card style={{ marginTop: 8 }}>
          <EmptyState
            title="Дневник пока пуст"
            body="Как только появятся измерения, здесь будет интерактивный график, динамика и средние по неделям."
          />
        </Card>
      ) : (
        <>
          <Card style={{ marginBottom: tokens.spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <View>
                <NumberText value={summary.latest ? summary.latest.weightKg.toFixed(1).replace('.', ',') : '—'} unit="кг" />
                <AppText variant="caption" color="tertiary">
                  {summary.latest ? formatDayFull(summary.latest.date) : ''}
                </AppText>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                <AppText variant="micro" color="tertiary" style={{ textTransform: 'uppercase' }}>
                  От старта
                </AppText>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  {(() => {
                    const d = toStartDelta(summary, settings.startWeightKg);
                    if (d == null) return <AppText variant="bodyStrong" color="tertiary">—</AppText>;
                    const Icon = d > 0 ? ArrowUpRight : d < 0 ? ArrowDownRight : Minus;
                    return (
                      <>
                        <Icon color={colors.textSecondary} size={14} strokeWidth={2.4} />
                        <AppText variant="subtitle">{formatSignedWeight(d)} кг</AppText>
                      </>
                    );
                  })()}
                </View>
                <AppText variant="caption" color="tertiary">
                  {settings.startWeightKg != null
                    ? `стартовый вес ${settings.startWeightKg.toFixed(1).replace('.', ',')} кг`
                    : summary.first
                      ? `первое ${summary.first.weightKg.toFixed(1).replace('.', ',')} кг`
                      : ''}
                </AppText>
              </View>
            </View>

            <WeightChart points={trend} height={170} />

            <View style={{ flexDirection: 'row', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
              {PERIODS.map((p) => (
                <Pill key={p} label={PERIOD_LABELS[p]} selected={period === p} onPress={() => setPeriod(p)} />
              ))}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 14, height: 2.4, borderRadius: 2, backgroundColor: colors.chartLine }} />
                  <AppText variant="caption" color="tertiary">
                    Замеры
                  </AppText>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 14, borderTopWidth: 1.8, borderStyle: 'dashed', borderColor: colors.chartTrend }} />
                  <AppText variant="caption" color="tertiary">
                    Сглаженный тренд
                  </AppText>
                </View>
              </View>
            </View>

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginTop: 14,
                paddingTop: 12,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.divider,
              }}
            >
              <View>
                <AppText variant="micro" color="tertiary" style={{ textTransform: 'uppercase' }}>
                  За период
                </AppText>
                <AppText variant="bodyStrong" style={{ marginTop: 2 }}>
                  {periodDelta == null ? 'мало данных' : `${formatSignedWeight(periodDelta)} кг`}
                </AppText>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <AppText variant="micro" color="tertiary" style={{ textTransform: 'uppercase' }}>
                  Замеров
                </AppText>
                <AppText variant="bodyStrong" style={{ marginTop: 2 }}>
                  {visible.length}
                </AppText>
              </View>
            </View>
          </Card>

          {weeks.length > 0 ? (
            <>
              <SectionLabel>Средние по неделям</SectionLabel>
              <Card style={{ marginBottom: tokens.spacing.lg }} padded={false}>
                {weeks
                  .slice(-4)
                  .reverse()
                  .map((w, i, arr) => (
                    <View key={w.weekStart}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 }}>
                        <View>
                          <AppText variant="bodyStrong">Неделя с {formatDayFull(w.weekStart)}</AppText>
                          <AppText variant="caption" color="tertiary">
                            {w.count} {w.count === 1 ? 'замер' : w.count < 5 ? 'замера' : 'замеров'}
                          </AppText>
                        </View>
                        <AppText variant="numberM">{w.average.toFixed(1).replace('.', ',')} кг</AppText>
                      </View>
                      {i < arr.length - 1 ? <Divider /> : null}
                    </View>
                  ))}
              </Card>
            </>
          ) : (
            <AppText variant="caption" color="tertiary" style={{ marginBottom: tokens.spacing.lg }}>
              Средние по неделям появятся, когда в неделе будет хотя бы 3 измерения.
            </AppText>
          )}

          <SectionLabel>Все измерения</SectionLabel>
          <Card padded={false} style={{ marginBottom: tokens.spacing.lg }}>
            {display.map((entry, i) => {
              const isSelected = selectedId === entry.id;
              const prev = series.findIndex((s) => s.date === entry.date);
              const diff = prev > 0 ? roundWeight(entry.weightKg - series[prev - 1]!.weightKg) : null;
              return (
                <View key={entry.id}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${formatDayFull(entry.date)}, ${entry.weightKg.toFixed(1)} кг`}
                    onPress={() => setSelectedId(isSelected ? null : entry.id)}
                    onLongPress={() => onDelete(entry.id, entry.date)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 16,
                      paddingVertical: 13,
                      backgroundColor: pressed ? colors.cardPressed : isSelected ? colors.cardHighlight : 'transparent',
                    })}
                  >
                    <View style={{ flex: 1 }}>
                      <AppText variant="bodyStrong">{formatDayFull(entry.date)}</AppText>
                      {entry.note ? (
                        <AppText variant="caption" color="tertiary" numberOfLines={1}>
                          {entry.note}
                        </AppText>
                      ) : null}
                    </View>
                    {diff != null ? (
                      <AppText variant="caption" color={diff === 0 ? 'tertiary' : 'secondary'} style={{ marginRight: 12 }}>
                        {formatSignedWeight(diff)}
                      </AppText>
                    ) : null}
                    <AppText variant="numberM">{entry.weightKg.toFixed(1).replace('.', ',')}</AppText>
                  </Pressable>
                  {isSelected ? (
                    <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 14 }}>
                      <Pill
                        label="Изменить"
                        onPress={() =>
                          router.push({ pathname: '/weight/add', params: { date: entry.date } } as never)
                        }
                      />
                      <Pill label="Удалить" onPress={() => onDelete(entry.id, entry.date)} />
                    </View>
                  ) : null}
                  {i < display.length - 1 ? <Divider style={{ marginLeft: 16 }} /> : null}
                </View>
              );
            })}
          </Card>
          <AppText variant="caption" color="tertiary" style={{ textAlign: 'center' }}>
            Нажмите на запись, чтобы изменить или удалить
          </AppText>
        </>
      )}
    </Screen>
  );
}
