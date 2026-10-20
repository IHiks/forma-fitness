// Calendar aggregation (pure): indicators for weight / workout / nutrition / habits.

import { habitProgress, nutritionState, type Habit, type HabitCheck, type NutritionDay } from './habits';
import type { WeightEntry } from './weight';
import type { Workout } from './workouts';

export type DayMarkers = {
  weight: boolean;
  workouts: number;
  nutrition: 'none' | 'followed' | 'deviated';
  habitsDone: number;
  habitsTotal: number;
  /** True if anything was recorded for the day (any marker other than implicit "none"). */
  hasAny: boolean;
};

export type DayDetails = {
  weight: WeightEntry | null;
  workouts: Workout[];
  nutrition: NutritionDay | null;
  habits: Habit[];
  habitChecks: HabitCheck[];
  markers: DayMarkers;
};

export type CalendarMarkerMap = Map<string, DayMarkers>;

export function buildCalendarMarkers(input: {
  weight: readonly WeightEntry[];
  workouts: readonly Workout[];
  nutrition: readonly NutritionDay[];
  habits: readonly Habit[];
  checks: readonly HabitCheck[];
}): CalendarMarkerMap {
  const map: CalendarMarkerMap = new Map();
  const get = (day: string): DayMarkers => {
    const existing = map.get(day);
    if (existing) return existing;
    const fresh: DayMarkers = {
      weight: false,
      workouts: 0,
      nutrition: 'none',
      habitsDone: 0,
      habitsTotal: 0,
      hasAny: false,
    };
    map.set(day, fresh);
    return fresh;
  };

  for (const w of input.weight) get(w.date).weight = true;
  for (const w of input.workouts) get(w.date).workouts += 1;
  for (const n of input.nutrition) {
    const state = nutritionState(n);
    if (state !== 'none') get(n.date).nutrition = state;
  }

  const days = new Set<string>();
  for (const c of input.checks) days.add(c.date);
  for (const n of input.nutrition) days.add(n.date);
  for (const day of days) {
    const progress = habitProgress(input.habits, input.checks, day);
    const m = get(day);
    m.habitsDone = progress.done;
    m.habitsTotal = progress.total;
  }

  for (const m of map.values()) {
    m.hasAny =
      m.weight || m.workouts > 0 || m.nutrition !== 'none' || (m.habitsTotal > 0 && m.habitsDone > 0);
  }
  return map;
}

export function getDayDetails(
  day: string,
  input: {
    weight: readonly WeightEntry[];
    workouts: readonly Workout[];
    nutrition: readonly NutritionDay[];
    habits: readonly Habit[];
    checks: readonly HabitCheck[];
  }
): DayDetails {
  const weight = input.weight.find((w) => w.date === day) ?? null;
  const workouts = input.workouts.filter((w) => w.date === day);
  const nutrition = input.nutrition.find((n) => n.date === day) ?? null;
  const habits = input.habits.filter((h) => !h.archived);
  const habitChecks = input.checks.filter((c) => c.date === day);
  const markers = buildCalendarMarkers(input).get(day) ?? {
    weight: weight != null,
    workouts: workouts.length,
    nutrition: nutritionState(nutrition ?? undefined),
    habitsDone: habits.filter((h) => habitChecks.some((c) => c.habitId === h.id && c.done)).length,
    habitsTotal: habits.length,
    hasAny: false,
  };
  return { weight, workouts, nutrition, habits, habitChecks, markers };
}
