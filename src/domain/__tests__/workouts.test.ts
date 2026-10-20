import {
  distributionByMuscle,
  filterWorkouts,
  isMuscleGroup,
  lastWorkoutMuscles,
  MUSCLE_GROUPS,
  normalizeMuscles,
  toggleMuscle,
  validateWorkout,
  workoutStats,
  type Workout,
} from '@/domain/workouts';

function workout(
  id: number,
  date: string,
  muscles: Workout['muscles'],
  durationMin: number | null = null,
  createdAt = `${date}T09:00:00.000Z`
): Workout {
  return { id, date, title: null, muscles, durationMin, note: null, createdAt, updatedAt: createdAt };
}

describe('muscle groups', () => {
  it('has exactly 12 groups', () => {
    expect(MUSCLE_GROUPS).toHaveLength(12);
  });

  it('recognizes valid groups only', () => {
    expect(isMuscleGroup('chest')).toBe(true);
    expect(isMuscleGroup('full_body')).toBe(true);
    expect(isMuscleGroup('tail')).toBe(false);
    expect(isMuscleGroup(42)).toBe(false);
  });

  it('normalizes multi-selection: dedupes and orders canonically', () => {
    expect(normalizeMuscles(['legs', 'chest', 'legs', 'cardio', 'nope'])).toEqual([
      'chest',
      'legs',
      'cardio',
    ]);
  });

  it('toggles a group on and off without duplicates', () => {
    let sel = toggleMuscle([], 'back');
    expect(sel).toEqual(['back']);
    sel = toggleMuscle(sel, 'back');
    expect(sel).toEqual([]);

    let multi = toggleMuscle([], 'shoulders');
    multi = toggleMuscle(multi, 'biceps');
    expect(multi).toEqual(['shoulders', 'biceps']);
    multi = toggleMuscle(multi, 'shoulders');
    expect(multi).toEqual(['biceps']);
  });
});

describe('validateWorkout', () => {
  it('requires at least one muscle group', () => {
    const result = validateWorkout({ date: '2026-03-01', muscles: [] });
    expect(result.ok).toBe(false);
  });

  it('accepts a valid multi-group workout', () => {
    const result = validateWorkout({
      date: '2026-03-01',
      muscles: ['chest', 'triceps'],
      durationMin: 45,
      title: '  Верх дня  ',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.muscles).toEqual(['chest', 'triceps']);
      expect(result.value.title).toBe('Верх дня');
      expect(result.value.durationMin).toBe(45);
    }
  });

  it('rejects broken durations', () => {
    expect(validateWorkout({ date: '2026-03-01', muscles: ['legs'], durationMin: 0 }).ok).toBe(false);
    expect(validateWorkout({ date: '2026-03-01', muscles: ['legs'], durationMin: 2.5 }).ok).toBe(false);
    expect(validateWorkout({ date: '2026-03-01', muscles: ['legs'], durationMin: 601 }).ok).toBe(false);
    expect(validateWorkout({ date: '2026-03-01', muscles: ['legs'], durationMin: 600 }).ok).toBe(true);
  });
});

describe('workoutStats', () => {
  it('counts sessions, distinct days and minutes', () => {
    const stats = workoutStats([
      workout(1, '2026-03-02', ['chest'], 40),
      workout(2, '2026-03-02', ['back'], 20), // same day, second session
      workout(3, '2026-03-05', ['legs'], null),
    ]);
    expect(stats.workouts).toBe(3);
    expect(stats.visits).toBe(2);
    expect(stats.minutes).toBe(60);
  });

  it('is empty-safe', () => {
    expect(workoutStats([])).toEqual({ workouts: 0, visits: 0, minutes: 0 });
  });
});

describe('distributionByMuscle', () => {
  it('counts sessions per group, sorted by popularity', () => {
    const dist = distributionByMuscle([
      workout(1, '2026-03-01', ['chest', 'triceps']),
      workout(2, '2026-03-02', ['chest', 'back']),
    ]);
    expect(dist[0]).toEqual({ muscle: 'chest', count: 2, share: 1 });
    const triceps = dist.find((d) => d.muscle === 'triceps');
    expect(triceps?.count).toBe(1);
    expect(triceps?.share).toBe(0.5);
  });

  it('breaks ties by canonical group order', () => {
    const dist = distributionByMuscle([
      workout(1, '2026-03-01', ['cardio']),
      workout(2, '2026-03-02', ['chest']),
    ]);
    expect(dist.map((d) => d.muscle)).toEqual(['chest', 'cardio']);
  });
});

describe('filterWorkouts / lastWorkoutMuscles', () => {
  it('filters by muscle and date range inclusively', () => {
    const list = [
      workout(1, '2026-03-01', ['chest']),
      workout(2, '2026-03-10', ['legs']),
      workout(3, '2026-03-20', ['chest', 'legs']),
    ];
    expect(filterWorkouts(list, { muscle: 'chest' }).map((w) => w.id)).toEqual([1, 3]);
    expect(filterWorkouts(list, { from: '2026-03-01', to: '2026-03-10' }).map((w) => w.id)).toEqual([1, 2]);
    expect(filterWorkouts(list, { muscle: 'chest', from: '2026-03-05' }).map((w) => w.id)).toEqual([3]);
  });

  it('returns muscles of the most recent workout', () => {
    expect(lastWorkoutMuscles([workout(1, '2026-03-01', ['chest']), workout(2, '2026-03-05', ['legs', 'glutes'])])).toEqual([
      'legs',
      'glutes',
    ]);
    expect(lastWorkoutMuscles([])).toEqual([]);
  });
});
