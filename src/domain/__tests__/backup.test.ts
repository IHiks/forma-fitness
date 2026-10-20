import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  describeImport,
  parseBackupText,
  validateBackup,
} from '@/domain/backup';

const iso = '2026-03-01T10:00:00.000Z';

function minimalBackup() {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    app: { name: 'Форма', version: '1.0.0' },
    exportedAt: iso,
    data: {
      settings: { themeMode: 'dark', startWeightKg: 80, targetWeightKg: 72, weightUnit: 'kg' },
      weight: [{ date: '2026-03-01', weightKg: 74.5, note: null, createdAt: iso, updatedAt: iso }],
      workouts: [
        {
          date: '2026-03-02',
          title: 'Верх',
          muscles: ['chest', 'triceps'],
          durationMin: 45,
          note: null,
          createdAt: iso,
          updatedAt: iso,
        },
      ],
      habits: [{ title: 'Вода', emoji: '💧', position: 0, archived: false, createdAt: iso }],
      habitChecks: [{ habitIndex: 0, date: '2026-03-01', done: true }],
      nutrition: [{ date: '2026-03-01', planFollowed: true, note: null, updatedAt: iso }],
    },
  };
}

describe('validateBackup', () => {
  it('accepts a well-formed backup and summarizes it', () => {
    const result = validateBackup(minimalBackup());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary).toEqual({
        weight: 1,
        workouts: 1,
        habits: 1,
        nutrition: 1,
        exportedAt: iso,
        appVersion: '1.0.0',
      });
      expect(result.backup.data.workouts[0]!.muscles).toEqual(['chest', 'triceps']);
    }
  });

  it('rejects non-objects and foreign files', () => {
    expect(validateBackup('просто строка').ok).toBe(false);
    expect(validateBackup(null).ok).toBe(false);
    const foreign = validateBackup({ format: 'other-app', version: 1, data: {} });
    expect(foreign.ok).toBe(false);
    if (!foreign.ok) expect(foreign.errors[0]).toContain('Форма');
  });

  it('rejects an unsupported version', () => {
    const result = validateBackup({ ...minimalBackup(), version: 99 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain('99');
  });

  it('rejects broken records with readable paths', () => {
    const backup = minimalBackup();
    backup.data.weight[0]!.weightKg = 5; // вне диапазона
    const result = validateBackup(backup);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('weight[0].weightKg');
  });

  it('rejects duplicate weight dates', () => {
    const backup = minimalBackup();
    backup.data.weight.push({ ...backup.data.weight[0]! });
    const result = validateBackup(backup);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('повторная запись');
  });

  it('rejects unknown muscle groups', () => {
    const backup = minimalBackup();
    backup.data.workouts[0]!.muscles = ['chest', 'хвост'] as never;
    const result = validateBackup(backup);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('неизвестные группы');
  });

  it('rejects habit checks pointing outside the habit list', () => {
    const backup = minimalBackup();
    backup.data.habitChecks.push({ habitIndex: 5, date: '2026-03-01', done: true });
    const result = validateBackup(backup);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('несуществующую привычку');
  });

  it('rejects invalid dates', () => {
    const backup = minimalBackup();
    backup.data.weight[0]!.date = '2026-02-30';
    const result = validateBackup(backup);
    expect(result.ok).toBe(false);
  });
});

describe('parseBackupText', () => {
  it('parses valid JSON through validation', () => {
    const result = parseBackupText(JSON.stringify(minimalBackup()));
    expect(result.ok).toBe(true);
  });

  it('reports broken JSON without throwing', () => {
    const result = parseBackupText('{не json');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain('JSON');
  });
});

describe('describeImport', () => {
  it('shows current and incoming counts plus the mode wording', () => {
    const text = describeImport(
      { weight: 10, workouts: 4, habits: 3, nutrition: 5, exportedAt: iso, appVersion: '1.0.0' },
      'replace',
      { weight: 2, workouts: 1 }
    );
    expect(text).toContain('заменены');
    expect(text).toContain('Вес: 10 (сейчас 2)');
    expect(text).toContain('Тренировки: 4 (сейчас 1)');

    const mergeText = describeImport(
      { weight: 10, workouts: 4, habits: 3, nutrition: 5, exportedAt: null, appVersion: null },
      'merge',
      { weight: 0, workouts: 0 }
    );
    expect(mergeText).toContain('добавлены');
  });
});
