import { buildCalendarMarkers, getDayDetails } from '@/domain/calendar';
import { habitProgress, isHabitDone, nutritionState, weeklyReview } from '@/domain/habits';
import type { Habit, HabitCheck, NutritionDay } from '@/domain/habits';
import type { WeightEntry } from '@/domain/weight';
import type { Workout } from '@/domain/workouts';

const habit = (id: number, title: string, archived = false): Habit => ({
  id,
  title,
  emoji: null,
  position: id,
  archived,
  createdAt: '2026-01-01T00:00:00.000Z',
});

const check = (habitId: number, date: string, done = true): HabitCheck => ({ habitId, date, done });

const weight = (date: string, weightKg: number): WeightEntry => ({
  id: date.length,
  date,
  weightKg,
  note: null,
  createdAt: `${date}T08:00:00.000Z`,
  updatedAt: `${date}T08:00:00.000Z`,
});

const workout = (id: number, date: string, muscles: Workout['muscles']): Workout => ({
  id,
  date,
  title: null,
  muscles,
  durationMin: null,
  note: null,
  createdAt: `${date}T09:00:00.000Z`,
  updatedAt: `${date}T09:00:00.000Z`,
});

describe('buildCalendarMarkers', () => {
  it('distinguishes "no record" from an explicit "deviated" day', () => {
    const markers = buildCalendarMarkers({
      weight: [],
      workouts: [],
      nutrition: [
        { date: '2026-03-01', planFollowed: false, note: null, updatedAt: '' },
        { date: '2026-03-02', planFollowed: null, note: 'просто заметка', updatedAt: '' },
      ],
      habits: [],
      checks: [],
    });
    expect(markers.get('2026-03-01')?.nutrition).toBe('deviated');
    expect(markers.get('2026-03-01')?.hasAny).toBe(true);
    expect(markers.get('2026-03-02')?.nutrition).toBe('none');
    expect(markers.get('2026-03-02')?.hasAny).toBe(false);
    expect(markers.has('2026-03-05')).toBe(false); // день без записей вообще не создаётся
  });

  it('counts multiple workouts per day and marks weight', () => {
    const markers = buildCalendarMarkers({
      weight: [weight('2026-03-01', 74)],
      workouts: [workout(1, '2026-03-01', ['chest']), workout(2, '2026-03-01', ['back'])],
      nutrition: [],
      habits: [],
      checks: [],
    });
    const m = markers.get('2026-03-01')!;
    expect(m.weight).toBe(true);
    expect(m.workouts).toBe(2);
    expect(m.hasAny).toBe(true);
  });

  it('tracks habit progress and ignores archived habits', () => {
    const habits = [habit(1, 'Вода'), habit(2, 'Овощи'), habit(3, 'Старая', true)];
    const markers = buildCalendarMarkers({
      weight: [],
      workouts: [],
      nutrition: [],
      habits,
      checks: [check(1, '2026-03-01'), check(3, '2026-03-01')],
    });
    const m = markers.get('2026-03-01')!;
    expect(m.habitsDone).toBe(1);
    expect(m.habitsTotal).toBe(2);
    expect(m.hasAny).toBe(true);
  });

  it('a day with only unchecked habits has no markers', () => {
    const markers = buildCalendarMarkers({
      weight: [],
      workouts: [],
      nutrition: [],
      habits: [habit(1, 'Вода')],
      checks: [check(1, '2026-03-01', false)],
    });
    expect(markers.get('2026-03-01')?.hasAny).toBe(false);
  });
});

describe('getDayDetails', () => {
  it('returns only the records of the requested day', () => {
    const details = getDayDetails('2026-03-02', {
      weight: [weight('2026-03-01', 75), weight('2026-03-02', 74.5)],
      workouts: [workout(1, '2026-03-01', ['chest']), workout(2, '2026-03-02', ['legs'])],
      nutrition: [],
      habits: [habit(1, 'Вода')],
      checks: [check(1, '2026-03-02')],
    });
    expect(details.weight?.weightKg).toBe(74.5);
    expect(details.workouts.map((w) => w.id)).toEqual([2]);
    expect(details.habitChecks).toHaveLength(1);
    expect(details.markers.hasAny).toBe(true);
  });

  it('returns empty details for a day without records', () => {
    const details = getDayDetails('2026-03-09', {
      weight: [],
      workouts: [],
      nutrition: [],
      habits: [],
      checks: [],
    });
    expect(details.weight).toBeNull();
    expect(details.workouts).toEqual([]);
    expect(details.markers.hasAny).toBe(false);
  });
});

describe('nutrition / habits helpers', () => {
  it('nutritionState separates none/followed/deviated', () => {
    expect(nutritionState(undefined)).toBe('none');
    expect(nutritionState({ date: '', planFollowed: null, note: null, updatedAt: '' })).toBe('none');
    expect(nutritionState({ date: '', planFollowed: true, note: null, updatedAt: '' })).toBe('followed');
    expect(nutritionState({ date: '', planFollowed: false, note: null, updatedAt: '' })).toBe('deviated');
  });

  it('isHabitDone ignores undone checks', () => {
    const checks = [check(1, '2026-03-01', false)];
    expect(isHabitDone(checks, 1, '2026-03-01')).toBe(false);
    expect(isHabitDone([check(1, '2026-03-01')], 1, '2026-03-01')).toBe(true);
  });

  it('habitProgress counts only active habits', () => {
    const progress = habitProgress(
      [habit(1, 'Вода'), habit(2, 'Старая', true)],
      [check(1, '2026-03-01')],
      '2026-03-01'
    );
    expect(progress).toEqual({ done: 1, total: 1, ratio: 1 });
  });

  it('weeklyReview passes through the real counts', () => {
    expect(weeklyReview({ weightEntries: 3, workouts: 2, habitDone: 5, habitPossible: 7 })).toEqual({
      weightEntries: 3,
      workouts: 2,
      habitDone: 5,
      habitPossible: 7,
    });
  });
});

describe('type sanity', () => {
  it('NutritionDay accepts a plain day', () => {
    const day: NutritionDay = { date: '2026-03-01', planFollowed: true, note: null, updatedAt: 'x' };
    expect(day.planFollowed).toBe(true);
  });
});
