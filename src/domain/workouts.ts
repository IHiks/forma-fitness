// Muscle groups and workouts domain logic (pure).

export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'legs',
  'glutes',
  'abs',
  'forearms',
  'cardio',
  'full_body',
  'other',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Грудь',
  back: 'Спина',
  shoulders: 'Плечи',
  biceps: 'Бицепс',
  triceps: 'Трицепс',
  legs: 'Ноги',
  glutes: 'Ягодицы',
  abs: 'Пресс',
  forearms: 'Предплечья',
  cardio: 'Кардио',
  full_body: 'Всё тело',
  other: 'Другое',
};

export const MUSCLE_SHORT: Record<MuscleGroup, string> = {
  chest: 'Грудь',
  back: 'Спина',
  shoulders: 'Плечи',
  biceps: 'Бицепс',
  triceps: 'Трицепс',
  legs: 'Ноги',
  glutes: 'Ягодицы',
  abs: 'Пресс',
  forearms: 'Предплечья',
  cardio: 'Кардио',
  full_body: 'Всё тело',
  other: 'Другое',
};

export function isMuscleGroup(value: unknown): value is MuscleGroup {
  return typeof value === 'string' && (MUSCLE_GROUPS as readonly string[]).includes(value);
}

/** Validates and de-duplicates a selection; order follows the canonical muscle order. */
export function normalizeMuscles(input: readonly unknown[]): MuscleGroup[] {
  const set = new Set(input.filter(isMuscleGroup));
  return MUSCLE_GROUPS.filter((m) => set.has(m));
}

export function toggleMuscle(current: readonly MuscleGroup[], muscle: MuscleGroup): MuscleGroup[] {
  return normalizeMuscles(
    current.includes(muscle) ? current.filter((m) => m !== muscle) : [...current, muscle]
  );
}

export type Workout = {
  id: number;
  date: string; // YYYY-MM-DD
  title: string | null;
  muscles: MuscleGroup[];
  durationMin: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkoutInput = {
  date: string;
  title?: string | null;
  muscles: readonly MuscleGroup[];
  durationMin?: number | null;
  note?: string | null;
};

export const MAX_DURATION_MIN = 600;

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function validateWorkout(input: WorkoutInput): ValidationResult<{
  date: string;
  title: string | null;
  muscles: MuscleGroup[];
  durationMin: number | null;
  note: string | null;
}> {
  const muscles = normalizeMuscles(input.muscles);
  if (muscles.length === 0) return { ok: false, error: 'Выберите хотя бы одну группу мышц' };

  const duration = input.durationMin;
  if (duration != null) {
    if (!Number.isInteger(duration) || duration <= 0) {
      return { ok: false, error: 'Длительность должна быть целым числом минут' };
    }
    if (duration > MAX_DURATION_MIN) {
      return { ok: false, error: `Слишком долго: максимум ${MAX_DURATION_MIN} мин` };
    }
  }

  const title = input.title?.trim() ? input.title.trim().slice(0, 80) : null;
  const note = input.note?.trim() ? input.note.trim().slice(0, 1000) : null;

  return {
    ok: true,
    value: { date: input.date, title, muscles, durationMin: duration ?? null, note },
  };
}

export type WeekStats = {
  workouts: number;
  visits: number; // distinct training days
  minutes: number;
};

export function workoutStats(workouts: readonly Workout[]): WeekStats {
  const days = new Set(workouts.map((w) => w.date));
  return {
    workouts: workouts.length,
    visits: days.size,
    minutes: workouts.reduce((sum, w) => sum + (w.durationMin ?? 0), 0),
  };
}

export type MuscleDistribution = {
  muscle: MuscleGroup;
  count: number;
  share: number;
};

/** Distribution by training sessions, not by number of selected groups. */
export function distributionByMuscle(workouts: readonly Workout[]): MuscleDistribution[] {
  if (workouts.length === 0) return [];
  const counts = new Map<MuscleGroup, number>();
  for (const w of workouts) {
    for (const m of normalizeMuscles(w.muscles)) {
      counts.set(m, (counts.get(m) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([muscle, count]) => ({ muscle, count, share: count / workouts.length }))
    .sort((a, b) => b.count - a.count || MUSCLE_GROUPS.indexOf(a.muscle) - MUSCLE_GROUPS.indexOf(b.muscle));
}

/** Groups from the most recent workout (used on the home screen). */
export function lastWorkoutMuscles(workouts: readonly Workout[]): MuscleGroup[] {
  const sorted = [...workouts].sort((a, b) =>
    b.date === a.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)
  );
  return normalizeMuscles(sorted[0]?.muscles ?? []);
}

export function filterWorkouts(
  workouts: readonly Workout[],
  filter: { muscle?: MuscleGroup | null; from?: string | null; to?: string | null }
): Workout[] {
  return workouts.filter((w) => {
    if (filter.muscle && !w.muscles.includes(filter.muscle)) return false;
    if (filter.from && w.date < filter.from) return false;
    if (filter.to && w.date > filter.to) return false;
    return true;
  });
}
