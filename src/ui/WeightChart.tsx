import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { daysBetween } from '@/domain/dates';
import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './primitives';

export type ChartSeriesPoint = {
  date: string;
  actual: number;
  smoothed: number | null;
};

const GAP_DAYS = 21;

const CHART_WIDTH = 320;
const PADDING = { left: 6, right: 6, top: 12, bottom: 10 } as const;

/** Splits consecutive points into segments, breaking where the time gap is too large. */
export function splitSegments<T extends { date: string }>(
  points: readonly T[],
  maxGapDays = GAP_DAYS
): T[][] {
  const segments: T[][] = [];
  let current: T[] = [];
  for (const p of points) {
    const prev = current.at(-1);
    if (prev && daysBetween(prev.date, p.date) > maxGapDays) {
      if (current.length) segments.push(current);
      current = [];
    }
    current.push(p);
  }
  if (current.length) segments.push(current);
  return segments;
}

export function WeightChart({
  points,
  height = 150,
  showTrend = true,
  emptyLabel = 'Добавьте первое измерение — здесь появится график',
}: {
  points: readonly ChartSeriesPoint[];
  height?: number;
  showTrend?: boolean;
  emptyLabel?: string;
}) {
  const { colors } = useTheme();
  const width = CHART_WIDTH; // viewBox width; scaled to container via preserveAspectRatio=none? no: fixed aspect

  const model = useMemo(() => {
    if (points.length === 0) return null;
    const actual = points.map((p) => p.actual);
    const smoothed = points.map((p) => p.smoothed).filter((v): v is number => v != null);
    const values = showTrend ? [...actual, ...smoothed] : actual;
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (max - min < 1) {
      // Keep a sensible scale for very small ranges (±0.5 kg)
      const mid = (max + min) / 2;
      min = mid - 0.5;
      max = mid + 0.5;
    }
    const span = max - min;
    min = min - span * 0.12;
    max = max + span * 0.12;

    const innerW = width - PADDING.left - PADDING.right;
    const innerH = height - PADDING.top - PADDING.bottom;
    const firstDay = points[0]!.date;
    const totalDays = Math.max(1, daysBetween(firstDay, points.at(-1)!.date));
    const x = (date: string) => PADDING.left + (daysBetween(firstDay, date) / totalDays) * innerW;
    const y = (v: number) => PADDING.top + (1 - (v - min) / (max - min)) * innerH;

    return { x, y, actualSegments: splitSegments(points) };
  }, [points, height, showTrend, width]);

  if (!model) {
    return (
      <View style={[styles.empty, { height }]}>
        <AppText variant="caption" color="tertiary" style={{ textAlign: 'center' }}>
          {emptyLabel}
        </AppText>
      </View>
    );
  }

  const { x, y, actualSegments } = model;
  const trendPoints = points.filter((p) => p.smoothed != null);
  const trendSegments = splitSegments(trendPoints);

  const linePath = (seg: ChartSeriesPoint[], getY: (p: ChartSeriesPoint) => number | null) => {
    let d = '';
    let started = false;
    for (const p of seg) {
      const py = getY(p);
      if (py == null) continue;
      d += `${started ? ' L' : 'M'} ${x(p.date).toFixed(2)} ${y(py).toFixed(2)}`;
      started = true;
    }
    return d;
  };

  const areaPath = (seg: ChartSeriesPoint[]) => {
    if (seg.length < 2) return '';
    const baseline = height - PADDING.bottom;
    let d = `M ${x(seg[0]!.date).toFixed(2)} ${baseline}`;
    for (const p of seg) d += ` L ${x(p.date).toFixed(2)} ${y(p.actual).toFixed(2)}`;
    d += ` L ${x(seg.at(-1)!.date).toFixed(2)} ${baseline} Z`;
    return d;
  };

  const last = points.at(-1)!;
  const gridLines = [0.2, 0.5, 0.8];

  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.chartFillFrom} />
            <Stop offset="1" stopColor={colors.chartFillTo} />
          </LinearGradient>
        </Defs>

        {gridLines.map((g) => (
          <Line
            key={g}
            x1={PADDING.left}
            x2={width - PADDING.right}
            y1={PADDING.top + (height - PADDING.top - PADDING.bottom) * g}
            y2={PADDING.top + (height - PADDING.top - PADDING.bottom) * g}
            stroke={colors.chartGrid}
            strokeWidth={1}
          />
        ))}

        {actualSegments.length === 1 ? (
          <Path d={areaPath(actualSegments[0]!)} fill="url(#weightFill)" />
        ) : (
          actualSegments.map((seg, i) => <Path key={`a${i}`} d={areaPath(seg)} fill="url(#weightFill)" />)
        )}

        {actualSegments.map((seg, i) => (
          <Path
            key={`l${i}`}
            d={linePath(seg, (p) => p.actual)}
            stroke={colors.chartLine}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}

        {showTrend &&
          trendSegments
            .filter((seg) => seg.length >= 2)
            .map((seg, i) => (
              <Path
                key={`t${i}`}
                d={linePath(seg, (p) => p.smoothed)}
                stroke={colors.chartTrend}
                strokeWidth={1.8}
                strokeDasharray="5 4"
                strokeLinecap="round"
                fill="none"
              />
            ))}

        {points.length <= 40
          ? points.map((p) => (
              <Circle key={p.date} cx={x(p.date)} cy={y(p.actual)} r={2.6} fill={colors.chartLine} />
            ))
          : null}

        <Circle cx={x(last.date)} cy={y(last.actual)} r={4.5} fill={colors.card} />
        <Circle cx={x(last.date)} cy={y(last.actual)} r={3.2} fill={colors.chartLine} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  axis: { position: 'absolute', left: 0, top: 0, bottom: 0, justifyContent: 'space-between', opacity: 0.0 },
  axisText: { fontSize: 10 },
});
