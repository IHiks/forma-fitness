import { useRouter } from 'expo-router';
import {
  Archive,
  Database,
  Download,
  Info,
  Moon,
  Sun,
  Sunrise,
  Trash2,
  Upload,
} from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';

import { describeImport, parseBackupText, type BackupData, type BackupSummary, type ImportMode } from '@/domain/backup';
import {
  MAX_SETTING_WEIGHT,
  MIN_SETTING_WEIGHT,
  normalizeSettingWeight,
  THEME_LABELS,
  type ThemeMode,
} from '@/domain/settings';
import { useData } from '@/state/AppProviders';
import { useTheme } from '@/theme/ThemeProvider';
import { PageHeader, Screen } from '@/ui/layout';
import { AppText, Card, Divider, SectionLabel } from '@/ui/primitives';

const THEME_ORDER: ThemeMode[] = ['system', 'dark', 'light'];

const THEME_ICONS: Record<ThemeMode, typeof Sun> = {
  system: Sunrise,
  dark: Moon,
  light: Sun,
};

export default function SettingsScreen() {
  const router = useRouter();
  const { colors, tokens, scheme } = useTheme();
  const {
    settings,
    setSetting,
    exportBackup,
    applyBackup,
    eraseAll,
    appVersion,
    weight,
    workouts,
  } = useData();

  const [startRaw, setStartRaw] = useState(
    settings.startWeightKg != null ? settings.startWeightKg.toFixed(1).replace('.', ',') : ''
  );
  const [targetRaw, setTargetRaw] = useState(
    settings.targetWeightKg != null ? settings.targetWeightKg.toFixed(1).replace('.', ',') : ''
  );
  const [busy, setBusy] = useState<null | 'export' | 'import' | 'erase'>(null);

  const commitWeight = (raw: string, key: 'startWeightKg' | 'targetWeightKg', label: string) => {
    const cleaned = raw.trim();
    if (cleaned === '') {
      void setSetting(key, null);
      return;
    }
    const value = normalizeSettingWeight(cleaned);
    if (value == null) {
      Alert.alert('Некорректный вес', `${label} — число от ${MIN_SETTING_WEIGHT} до ${MAX_SETTING_WEIGHT} кг.`);
      return;
    }
    void setSetting(key, String(value));
  };

  const onExport = async () => {
    setBusy('export');
    try {
      const data = await exportBackup(appVersion);
      const json = JSON.stringify(data, null, 2);
      const stamp = new Date().toISOString().slice(0, 10);
      const file = new File(Paths.cache, `forma-backup-${stamp}.json`);
      file.create({ overwrite: true, intermediates: true });
      file.write(json);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Сохранить резервную копию',
        });
      } else {
        Alert.alert('Экспорт', `Файл сохранён:\n${file.uri}`);
      }
    } catch (e) {
      Alert.alert('Не удалось экспортировать', e instanceof Error ? e.message : 'Попробуйте ещё раз');
    } finally {
      setBusy(null);
    }
  };

  const confirmImport = (backup: BackupData, summary: BackupSummary) => {
    const show = (mode: ImportMode) => {
      Alert.alert(
        mode === 'replace' ? 'Заменить все данные?' : 'Добавить данные из копии?',
        describeImport(summary, mode, { weight: weight.length, workouts: workouts.length }),
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: mode === 'replace' ? 'Заменить' : 'Добавить',
            style: mode === 'replace' ? 'destructive' : 'default',
            onPress: () => {
              void applyBackup(backup, mode)
                .then(() =>
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
                )
                .catch((e: unknown) =>
                  Alert.alert('Импорт не выполнен', e instanceof Error ? e.message : 'Неизвестная ошибка')
                );
            },
          },
        ]
      );
    };
    Alert.alert('Файл проверен', 'Как импортировать данные из этой копии?', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Объединить', onPress: () => show('merge') },
      { text: 'Заменить всё', onPress: () => show('replace') },
    ]);
  };

  const onImport = async () => {
    setBusy('import');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || result.assets.length === 0) return;
      const picked = result.assets[0]!;
      const file = new File(picked.uri);
      const parsed = parseBackupText(await file.text());
      if (!parsed.ok) {
        Alert.alert('Файл не подходит', parsed.errors.join('\n'));
        return;
      }
      confirmImport(parsed.backup.data, parsed.summary);
    } catch (e) {
      Alert.alert('Не удалось прочитать файл', e instanceof Error ? e.message : 'Попробуйте ещё раз');
    } finally {
      setBusy(null);
    }
  };

  const onErase = () => {
    Alert.alert(
      'Удалить все данные?',
      'Вес, тренировки, питание, привычки и настройки будут стёрты на этом устройстве. Действие необратимо — сначала сделайте резервную копию.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить всё',
          style: 'destructive',
          onPress: () => {
            setBusy('erase');
            void eraseAll()
              .then(() => setStartRaw(''))
              .then(() => setTargetRaw(''))
              .then(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined))
              .catch((e: unknown) =>
                Alert.alert('Не удалось удалить', e instanceof Error ? e.message : 'Попробуйте ещё раз')
              )
              .finally(() => setBusy(null));
          },
        },
      ]
    );
  };

  return (
    <Screen>
      <PageHeader title="Настройки" subtitle="Тема, вес и резервные копии" />

      <SectionLabel>Оформление</SectionLabel>
      <Card style={{ marginBottom: tokens.spacing.lg }}>
        <AppText variant="caption" color="tertiary" style={{ marginBottom: 10 }}>
          Тема приложения
        </AppText>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {THEME_ORDER.map((mode) => {
            const selected = settings.themeMode === mode;
            const Icon = THEME_ICONS[mode];
            return (
              <Pressable
                key={mode}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  void Haptics.selectionAsync();
                  void setSetting('themeMode', mode);
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  height: 68,
                  borderRadius: tokens.radius.md,
                  backgroundColor: selected ? colors.accentSoft : colors.card,
                  borderWidth: selected ? StyleSheet.hairlineWidth * 2 : StyleSheet.hairlineWidth,
                  borderColor: selected ? colors.accent : colors.cardBorder,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Icon color={selected ? colors.accentText : colors.textSecondary} size={18} />
                <AppText variant="caption" color={selected ? 'accent' : 'secondary'} numberOfLines={1}>
                  {THEME_LABELS[mode]}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        <AppText variant="caption" color="tertiary" style={{ marginTop: 10 }}>
          Сейчас активна {scheme === 'dark' ? 'тёмная' : 'светлая'} тема.
        </AppText>
      </Card>

      <SectionLabel>Вес</SectionLabel>
      <Card style={{ marginBottom: tokens.spacing.lg }}>
        <WeightField
          label="Стартовый вес"
          hint="С него начнётся отсчёт изменений. Можно оставить пустым."
          value={startRaw}
          onChangeText={setStartRaw}
          onCommit={() => commitWeight(startRaw, 'startWeightKg', 'Стартовый вес')}
          accessibilityLabel="Стартовый вес в килограммах"
        />
        <Divider style={{ marginVertical: 14 }} />
        <WeightField
          label="Целевой вес"
          hint="Показывается на главной как ориентир. Никаких норм и рекомендаций."
          value={targetRaw}
          onChangeText={setTargetRaw}
          onCommit={() => commitWeight(targetRaw, 'targetWeightKg', 'Целевой вес')}
          accessibilityLabel="Целевой вес в килограммах"
        />
      </Card>

      <SectionLabel>Данные</SectionLabel>
      <Card style={{ marginBottom: tokens.spacing.lg }} padded={false}>
        <Row
          icon={<Archive color={colors.textSecondary} size={17} />}
          title="Привычки"
          subtitle="Добавить, переименовать или убрать в архив"
          onPress={() => router.push('/habit/manage' as never)}
          busy={false}
        />
        <Divider style={{ marginLeft: 54 }} />
        <Row
          icon={<Download color={colors.textSecondary} size={17} />}
          title="Экспорт в JSON"
          subtitle="Файл с данными можно сохранить в «Файлы» или iCloud"
          onPress={() => void onExport()}
          busy={busy === 'export'}
        />
        <Divider style={{ marginLeft: 54 }} />
        <Row
          icon={<Upload color={colors.textSecondary} size={17} />}
          title="Импорт из файла"
          subtitle="Файл проверяется до применения; замена только по подтверждению"
          onPress={() => void onImport()}
          busy={busy === 'import'}
        />
        <Divider style={{ marginLeft: 54 }} />
        <Row
          icon={<Trash2 color={colors.danger} size={17} />}
          title="Удалить все данные"
          subtitle="Полное стирание журнала на этом устройстве"
          titleColor={colors.danger}
          onPress={onErase}
          busy={busy === 'erase'}
        />
      </Card>

      <SectionLabel>Приложение</SectionLabel>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Info color={colors.textTertiary} size={16} />
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong">Форма</AppText>
            <AppText variant="caption" color="tertiary">
              Версия {appVersion} · данные хранятся только на устройстве
            </AppText>
          </View>
        </View>
        <Divider style={{ marginVertical: 12 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Database color={colors.textTertiary} size={16} />
          <AppText variant="caption" color="tertiary" style={{ flex: 1 }}>
            {weight.length} {pluralizeRecords(weight.length, 'измерение', 'измерения', 'измерений')} ·{' '}
            {workouts.length} {pluralizeRecords(workouts.length, 'тренировка', 'тренировки', 'тренировок')}
          </AppText>
        </View>
      </Card>
    </Screen>
  );
}

function pluralizeRecords(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function WeightField({
  label,
  hint,
  value,
  onChangeText,
  onCommit,
  accessibilityLabel,
}: {
  label: string;
  hint: string;
  value: string;
  onChangeText: (t: string) => void;
  onCommit: () => void;
  accessibilityLabel: string;
}) {
  const { colors, tokens } = useTheme();
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <AppText variant="subtitle">{label}</AppText>
          <AppText variant="caption" color="tertiary" style={{ marginTop: 2 }}>
            {hint}
          </AppText>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: colors.inputBg,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.inputBorder,
            borderRadius: tokens.radius.sm,
            paddingHorizontal: 10,
            width: 96,
          }}
        >
          <TextInput
            value={value}
            onChangeText={(t) => onChangeText(t.replace(/[^0-9,.]/g, '').slice(0, 6))}
            onEndEditing={onCommit}
            onBlur={onCommit}
            keyboardType="decimal-pad"
            placeholder="—"
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel={accessibilityLabel}
            style={[tokens.type.subtitle, { color: colors.text, paddingVertical: 8, flex: 1 }]}
          />
          <AppText variant="caption" color="tertiary">
            кг
          </AppText>
        </View>
      </View>
    </View>
  );
}

function Row({
  icon,
  title,
  subtitle,
  onPress,
  busy,
  titleColor,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
  busy: boolean;
  titleColor?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        opacity: busy ? 0.5 : pressed ? 0.7 : 1,
      })}
    >
      <View style={{ width: 26, alignItems: 'center' }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong" style={titleColor ? { color: titleColor } : undefined}>
          {busy ? 'Выполняется…' : title}
        </AppText>
        <AppText variant="caption" color="tertiary">
          {subtitle}
        </AppText>
      </View>
    </Pressable>
  );
}
