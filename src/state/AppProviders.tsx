import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { openAppDatabase } from '@/db/expoDatabase';
import {
  createRepositories,
  eraseJournal,
  exportData,
  importData,
  type Repositories,
} from '@/db/repositories';
import type { SQLiteDatabase } from '@/db/sqlite';
import type { BackupData, ImportMode } from '@/domain/backup';
import type { Habit, HabitCheck, NutritionDay } from '@/domain/habits';
import { validateHabitTitle } from '@/domain/habits';
import type { ThemeMode } from '@/domain/settings';
import type { WeightEntry } from '@/domain/weight';
import type { Workout, WorkoutInput } from '@/domain/workouts';
import { validateWorkout } from '@/domain/workouts';
import { ThemeProvider } from '@/theme/ThemeProvider';

type SettingsState = {
  themeMode: ThemeMode;
  startWeightKg: number | null;
  targetWeightKg: number | null;
};

type DataState = {
  ready: boolean;
  bootError: string | null;
  weight: WeightEntry[];
  workouts: Workout[];
  nutrition: NutritionDay[];
  habits: Habit[];
  habitsArchived: Habit[];
  checks: HabitCheck[];
  settings: SettingsState;
};

type DataContextValue = DataState & {
  reload: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  saveWeight: (input: { date: string; weightKg: number; note?: string | null }) => Promise<void>;
  deleteWeight: (id: number) => Promise<void>;
  saveWorkout: (
    input: WorkoutInput,
    id?: number
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  deleteWorkout: (id: number) => Promise<void>;
  saveNutrition: (input: { date: string; planFollowed: boolean | null; note?: string | null }) => Promise<void>;
  toggleHabit: (habitId: number, date: string, done: boolean) => Promise<void>;
  addHabit: (title: string, emoji?: string | null) => Promise<{ ok: true } | { ok: false; error: string }>;
  renameHabit: (id: number, title: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  archiveHabit: (id: number) => Promise<void>;
  unarchiveHabit: (id: number) => Promise<void>;
  deleteHabit: (id: number) => Promise<void>;
  setSetting: (key: 'themeMode' | 'startWeightKg' | 'targetWeightKg', value: string | null) => Promise<void>;
  exportBackup: (appVersion: string) => Promise<BackupData & { appVersion: string }>;
  applyBackup: (backup: BackupData, mode: ImportMode) => Promise<void>;
  eraseAll: () => Promise<void>;
  appVersion: string;
};

const DataContext = createContext<DataContextValue | null>(null);

const EMPTY: DataState = {
  ready: false,
  bootError: null,
  weight: [],
  workouts: [],
  nutrition: [],
  habits: [],
  habitsArchived: [],
  checks: [],
  settings: { themeMode: 'system', startWeightKg: null, targetWeightKg: null },
};

const APP_VERSION = '1.0.0';

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DataState>(EMPTY);
  const dbRef = useRef<{ db: SQLiteDatabase; repos: Repositories } | null>(null);

  const loadAll = useCallback(async (opts: { ensureDefaults?: boolean } = {}) => {
    const current = dbRef.current;
    if (!current) return;
    if (opts.ensureDefaults) await current.repos.habits.ensureDefaults();
    const [weight, workouts, nutrition, habitsAll, checks, settings] = await Promise.all([
      current.repos.weight.list(),
      current.repos.workouts.list(),
      current.repos.nutrition.list(),
      current.repos.habits.list(true),
      current.repos.habits.checks(),
      current.repos.settings.snapshot(),
    ]);
    setState({
      ready: true,
      bootError: null,
      weight,
      workouts,
      nutrition,
      habits: habitsAll.filter((h) => !h.archived),
      habitsArchived: habitsAll.filter((h) => h.archived),
      checks,
      settings,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const opened = await openAppDatabase();
        if (cancelled) {
          await opened.db.closeAsync();
          return;
        }
        dbRef.current = { db: opened.db, repos: createRepositories(opened.db) };
        await loadAll({ ensureDefaults: true });
      } catch (e) {
        if (cancelled) return;
        setState((s) => ({
          ...s,
          ready: false,
          bootError: e instanceof Error ? e.message : 'Не удалось открыть базу данных',
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAll]);

  const reload = useCallback(async () => {
    await loadAll();
  }, [loadAll]);

  const refreshSettings = useCallback(async () => {
    const current = dbRef.current;
    if (!current) return;
    const settings = await current.repos.settings.snapshot();
    setState((s) => ({ ...s, settings }));
  }, []);

  const value = useMemo<DataContextValue>(() => {
    const require = () => {
      const current = dbRef.current;
      if (!current) throw new Error('База данных ещё не готова');
      return current;
    };

    return {
      ...state,
      appVersion: APP_VERSION,
      reload,
      refreshSettings,
      saveWeight: async (input) => {
        await require().repos.weight.save(input);
        await loadAll();
      },
      deleteWeight: async (id) => {
        await require().repos.weight.remove(id);
        await loadAll();
      },
      saveWorkout: async (input, id) => {
        const validated = validateWorkout(input);
        if (!validated.ok) return { ok: false, error: validated.error };
        const { repos } = require();
        if (id == null) await repos.workouts.create(validated.value);
        else await repos.workouts.update(id, validated.value);
        await loadAll();
        return { ok: true };
      },
      deleteWorkout: async (id) => {
        await require().repos.workouts.remove(id);
        await loadAll();
      },
      saveNutrition: async (input) => {
        await require().repos.nutrition.save(input);
        await loadAll();
      },
      toggleHabit: async (habitId, date, done) => {
        await require().repos.habits.setCheck(habitId, date, done);
        await loadAll();
      },
      addHabit: async (title, emoji) => {
        const valid = validateHabitTitle(title);
        if (!valid.ok) return { ok: false, error: valid.error };
        await require().repos.habits.create({ title: valid.value, emoji: emoji ?? null });
        await loadAll();
        return { ok: true };
      },
      renameHabit: async (id, title) => {
        const valid = validateHabitTitle(title);
        if (!valid.ok) return { ok: false, error: valid.error };
        await require().repos.habits.rename(id, valid.value);
        await loadAll();
        return { ok: true };
      },
      archiveHabit: async (id) => {
        await require().repos.habits.archive(id);
        await loadAll();
      },
      deleteHabit: async (id) => {
        await require().repos.habits.remove(id);
        await loadAll();
      },
      unarchiveHabit: async (id) => {
        await require().repos.habits.unarchive(id);
        await loadAll();
      },
      setSetting: async (key, val) => {
        await require().repos.settings.set(key, val);
        await refreshSettings();
      },
      exportBackup: async (version) => {
        const { repos } = require();
        return exportData(repos, version);
      },
      applyBackup: async (backup, mode) => {
        const { db, repos } = require();
        await importData(db, repos, backup, mode);
        await loadAll({ ensureDefaults: true });
      },
      eraseAll: async () => {
        const { db } = require();
        await eraseJournal(db);
        await loadAll({ ensureDefaults: true });
      },
    };
  }, [state, loadAll, refreshSettings, reload]);

  return (
    <DataContext.Provider value={value}>
      <ThemeProvider mode={state.settings.themeMode}>{children}</ThemeProvider>
    </DataContext.Provider>
  );
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside AppProviders');
  return ctx;
}
