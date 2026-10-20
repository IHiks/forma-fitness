// Nutrition & habits domain logic (pure).

export type Habit = {
  id: number;
  title: string;
  emoji: string | null;
  position: number;
  archived: boolean;
  createdAt: string;
};

export type HabitCheck = {
  habitId: number;
  date: string;
  done: boolean;
};

export type NutritionDay = {
  date: string;
  /** null = not marked; true = followed the plan; false = explicitly deviated. */
  planFollowed: boolean | null;
  note: string | null;
  updatedAt: string;
};

export const DEFAULT_HABITS = [
  { title: 'Вода 1,5–2 л', emoji: '💧' },
  { title: 'Овощи или фрукты', emoji: '🥦' },
  { title: 'Без еды за 2 часа до сна', emoji: '🌙' },
] as const;

export const MAX_HABIT_TITLE = 60;

export function validateHabitTitle(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = raw.trim().replace(/\s+/g, ' ');
  if (value.length === 0) return { ok: false, error: 'Название не может быть пустым' };
  if (value.length > MAX_HABIT_TITLE) return { ok: false, error: `Максимум ${MAX_HABIT_TITLE} символов` };
  return { ok: true, value };
}

export function isHabitDone(checks: readonly HabitCheck[], habitId: number, date: string): boolean {
  return checks.some((c) => c.habitId === habitId && c.date === date && c.done);
}

export type DayHabitProgress = { done: number; total: number; ratio: number };

export function habitProgress(
  habits: readonly Habit[],
  checks: readonly HabitCheck[],
  date: string
): DayHabitProgress {
  const active = habits.filter((h) => !h.archived);
  const done = active.filter((h) => isHabitDone(checks, h.id, date)).length;
  return { done, total: active.length, ratio: active.length ? done / active.length : 0 };
}

/** Nutrition mark: none / followed / deviated. Distinguishes "no record" from an explicit state. */
export function nutritionState(day: NutritionDay | undefined): 'none' | 'followed' | 'deviated' {
  if (!day || day.planFollowed == null) return 'none';
  return day.planFollowed ? 'followed' : 'deviated';
}

export type WeeklyReview = {
  weightEntries: number;
  workouts: number;
  habitDone: number;
  habitPossible: number;
};

export function weeklyReview(input: {
  weightEntries: number;
  workouts: number;
  habitDone: number;
  habitPossible: number;
}): WeeklyReview {
  return {
    weightEntries: input.weightEntries,
    workouts: input.workouts,
    habitDone: input.habitDone,
    habitPossible: input.habitPossible,
  };
}
