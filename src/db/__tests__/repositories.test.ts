import { eraseJournal, exportData, importData, weekRange, currentCounts } from '@/db/repositories';
import { startOfWeek, todayKey } from '@/domain/dates';

import { createTestDb, reopenTestDb } from '@/__tests__/helpers/testDb';

describe('weight repository', () => {
  it('adds a measurement and rounds to 0.1 kg', async () => {
    const { repos } = await createTestDb();
    const saved = await repos.weight.save({ date: '2026-03-01', weightKg: 74.44 });
    expect(saved.weightKg).toBe(74.4);
    expect(await repos.weight.count()).toBe(1);
  });

  it('edits in place: one row per date', async () => {
    const { repos } = await createTestDb();
    const first = await repos.weight.save({ date: '2026-03-01', weightKg: 75 });
    const second = await repos.weight.save({ date: '2026-03-01', weightKg: 74.2 });
    expect(second.id).toBe(first.id);
    expect(await repos.weight.count()).toBe(1);
    expect((await repos.weight.getByDate('2026-03-01'))?.weightKg).toBe(74.2);
  });

  it('rejects invalid dates and out-of-range weights', async () => {
    const { repos } = await createTestDb();
    await expect(repos.weight.save({ date: '2026-02-30', weightKg: 70 })).rejects.toThrow();
    await expect(repos.weight.save({ date: '2026-03-01', weightKg: 5 })).rejects.toThrow();
  });

  it('deletes by id', async () => {
    const { repos } = await createTestDb();
    const saved = await repos.weight.save({ date: '2026-03-01', weightKg: 75 });
    await repos.weight.remove(saved.id);
    expect(await repos.weight.count()).toBe(0);
  });
});

describe('workout repository (multi-group)', () => {
  it('stores several muscle groups per workout', async () => {
    const { repos } = await createTestDb();
    const id = await repos.workouts.create({
      date: '2026-03-02',
      title: 'Верх',
      muscles: ['chest', 'triceps', 'back'],
      durationMin: 45,
      note: null,
    });
    const list = await repos.workouts.list();
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe(id);
    expect(list[0]!.muscles).toEqual(['chest', 'back', 'triceps']); // канонический порядок
    expect(list[0]!.durationMin).toBe(45);
  });

  it('replaces groups on update', async () => {
    const { repos } = await createTestDb();
    const id = await repos.workouts.create({
      date: '2026-03-02',
      title: null,
      muscles: ['chest'],
      durationMin: null,
      note: null,
    });
    await repos.workouts.update(id, {
      date: '2026-03-02',
      title: null,
      muscles: ['legs', 'glutes'],
      durationMin: 60,
      note: null,
    });
    const updated = await repos.workouts.getById(id);
    expect(updated?.muscles).toEqual(['legs', 'glutes']);
    expect(updated?.durationMin).toBe(60);
  });

  it('counts several sessions on one day as separate workouts', async () => {
    const { repos } = await createTestDb();
    await repos.workouts.create({ date: '2026-03-02', title: null, muscles: ['chest'], durationMin: null, note: null });
    await repos.workouts.create({ date: '2026-03-02', title: null, muscles: ['back'], durationMin: null, note: null });
    expect(await repos.workouts.count()).toBe(2);
  });

  it('rejects a workout without muscle groups', async () => {
    const { repos } = await createTestDb();
    await expect(
      repos.workouts.create({ date: '2026-03-02', title: null, muscles: [], durationMin: null, note: null })
    ).rejects.toThrow();
  });
});

describe('nutrition repository', () => {
  it('distinguishes followed / deviated / cleared', async () => {
    const { repos } = await createTestDb();
    await repos.nutrition.save({ date: '2026-03-01', planFollowed: true, note: null });
    expect(await repos.nutrition.state('2026-03-01')).toBe('followed');

    await repos.nutrition.save({ date: '2026-03-01', planFollowed: false, note: null });
    expect(await repos.nutrition.state('2026-03-01')).toBe('deviated');

    // Сброс отметки без заметки удаляет запись — «нет записи», а не «не отмечено».
    await repos.nutrition.save({ date: '2026-03-01', planFollowed: null, note: null });
    expect(await repos.nutrition.state('2026-03-01')).toBe('none');
    expect(await repos.nutrition.getByDate('2026-03-01')).toBeNull();
  });

  it('keeps a note-only day as a record', async () => {
    const { repos } = await createTestDb();
    await repos.nutrition.save({ date: '2026-03-01', planFollowed: null, note: 'праздник' });
    expect(await repos.nutrition.getByDate('2026-03-01')).not.toBeNull();
    expect(await repos.nutrition.state('2026-03-01')).toBe('none');
  });
});

describe('habits repository', () => {
  it('seeds defaults once and keeps checks per date', async () => {
    const { repos } = await createTestDb();
    await repos.habits.ensureDefaults();
    await repos.habits.ensureDefaults(); // повторный вызов не дублирует
    const habits = await repos.habits.list();
    expect(habits.length).toBeGreaterThan(0);

    const first = habits[0]!;
    await repos.habits.setCheck(first.id, '2026-03-01', true);
    expect((await repos.habits.checks()).filter((c) => c.date === '2026-03-01')).toHaveLength(1);

    await repos.habits.setCheck(first.id, '2026-03-01', false);
    expect((await repos.habits.checks()).filter((c) => c.date === '2026-03-01')).toHaveLength(0);
  });

  it('archives and restores habits', async () => {
    const { repos } = await createTestDb();
    const id = await repos.habits.create({ title: 'Прогулка', emoji: null });
    await repos.habits.archive(id);
    expect(await repos.habits.list()).toHaveLength(0);
    expect(await repos.habits.list(true)).toHaveLength(1);
    await repos.habits.unarchive(id);
    expect(await repos.habits.list()).toHaveLength(1);
  });

  it('deletes a habit together with its checks', async () => {
    const { repos } = await createTestDb();
    const id = await repos.habits.create({ title: 'Прогулка', emoji: null });
    await repos.habits.setCheck(id, '2026-03-01', true);
    await repos.habits.remove(id);
    expect(await repos.habits.list(true)).toHaveLength(0);
    expect(await repos.habits.checks()).toHaveLength(0);
  });
});

describe('settings repository', () => {
  it('persists values and returns a typed snapshot', async () => {
    const { repos } = await createTestDb();
    await repos.settings.set('themeMode', 'dark');
    await repos.settings.set('startWeightKg', '80.5');
    const snapshot = await repos.settings.snapshot();
    expect(snapshot).toEqual({ themeMode: 'dark', startWeightKg: 80.5, targetWeightKg: null });
  });

  it('treats a stored garbage theme as system', async () => {
    const { repos } = await createTestDb();
    await repos.settings.set('themeMode', 'neon');
    expect((await repos.settings.snapshot()).themeMode).toBe('system');
  });

  it('clears a value when set to null', async () => {
    const { repos } = await createTestDb();
    await repos.settings.set('startWeightKg', '80');
    await repos.settings.set('startWeightKg', null);
    expect((await repos.settings.snapshot()).startWeightKg).toBeNull();
  });
});

describe('persistence across restart (sql.js snapshot)', () => {
  it('data and settings survive reopening the database', async () => {
    const first = await createTestDb();
    await first.repos.weight.save({ date: '2026-03-01', weightKg: 74.5 });
    await first.repos.settings.set('themeMode', 'light');
    await first.repos.workouts.create({
      date: '2026-03-02',
      title: null,
      muscles: ['legs'],
      durationMin: 30,
      note: null,
    });

    const second = await reopenTestDb(first);
    expect((await second.repos.weight.list())[0]?.weightKg).toBe(74.5);
    expect((await second.repos.settings.snapshot()).themeMode).toBe('light');
    expect(await second.repos.workouts.count()).toBe(1);
  });
});

describe('export / import round trip', () => {
  it('restores everything through replace mode', async () => {
    const source = await createTestDb();
    await source.repos.weight.save({ date: '2026-03-01', weightKg: 74.5 });
    await source.repos.workouts.create({
      date: '2026-03-02',
      title: 'Ноги',
      muscles: ['legs', 'glutes'],
      durationMin: 50,
      note: null,
    });
    const habitId = await source.repos.habits.create({ title: 'Вода', emoji: '💧' });
    await source.repos.habits.setCheck(habitId, '2026-03-01', true);
    await source.repos.nutrition.save({ date: '2026-03-01', planFollowed: false, note: null });
    await source.repos.settings.set('startWeightKg', '78');

    const backup = await exportData(source.repos, '1.0.0');

    const target = await createTestDb();
    await target.repos.weight.save({ date: '2020-01-01', weightKg: 90 }); // будет заменено
    await importData(target.db, target.repos, backup, 'replace');

    const weights = await target.repos.weight.list();
    expect(weights).toHaveLength(1);
    expect(weights[0]!.date).toBe('2026-03-01');
    expect(weights[0]!.weightKg).toBe(74.5);

    const workouts = await target.repos.workouts.list();
    expect(workouts[0]!.muscles).toEqual(['legs', 'glutes']);
    expect(workouts[0]!.durationMin).toBe(50);

    const habits = await target.repos.habits.list();
    const water = habits.find((h) => h.title === 'Вода');
    expect(water).toBeDefined();
    expect((await target.repos.habits.checks()).some((c) => c.habitId === water!.id && c.date === '2026-03-01')).toBe(true);

    expect(await target.repos.nutrition.state('2026-03-01')).toBe('deviated');
    expect((await target.repos.settings.snapshot()).startWeightKg).toBe(78);
  });

  it('merge mode adds records without wiping existing data', async () => {
    const source = await createTestDb();
    await source.repos.weight.save({ date: '2026-03-01', weightKg: 74.5 });
    const backup = await exportData(source.repos, '1.0.0');

    const target = await createTestDb();
    await target.repos.weight.save({ date: '2026-01-01', weightKg: 80 });
    await importData(target.db, target.repos, backup, 'merge');

    const dates = (await target.repos.weight.list()).map((w) => w.date);
    expect(dates).toContain('2026-01-01');
    expect(dates).toContain('2026-03-01');
  });

  it('re-importing the same backup does not duplicate habits', async () => {
    const source = await createTestDb();
    await source.repos.habits.create({ title: 'Вода', emoji: null });
    const backup = await exportData(source.repos, '1.0.0');

    const target = await createTestDb();
    await importData(target.db, target.repos, backup, 'merge');
    await importData(target.db, target.repos, backup, 'merge');
    expect((await target.repos.habits.list()).filter((h) => h.title === 'Вода')).toHaveLength(1);
  });

  it('currentCounts reports the numbers for the confirmation dialog', async () => {
    const { repos } = await createTestDb();
    await repos.weight.save({ date: '2026-03-01', weightKg: 74.5 });
    expect(await currentCounts(repos)).toEqual({ weight: 1, workouts: 0 });
  });
});

describe('eraseJournal', () => {
  it('clears data but keeps settings', async () => {
    const { db, repos } = await createTestDb();
    await repos.weight.save({ date: '2026-03-01', weightKg: 74.5 });
    const habitId = await repos.habits.create({ title: 'Вода', emoji: null });
    await repos.habits.setCheck(habitId, '2026-03-01', true);
    await repos.settings.set('themeMode', 'dark');

    await eraseJournal(db);

    expect(await repos.weight.count()).toBe(0);
    expect(await repos.habits.list(true)).toHaveLength(0);
    expect(await repos.habits.checks()).toHaveLength(0);
    expect((await repos.settings.snapshot()).themeMode).toBe('dark');
  });
});

describe('weekRange', () => {
  it('matches the domain week helpers', () => {
    const today = todayKey();
    expect(weekRange(today).from).toBe(startOfWeek(today));
    expect(weekRange(today).to >= today).toBe(true);
  });
});
