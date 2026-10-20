import { useRouter } from 'expo-router';
import { Archive, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { MAX_HABIT_TITLE } from '@/domain/habits';
import { useData } from '@/state/AppProviders';
import { useTheme } from '@/theme/ThemeProvider';
import { SheetHeader } from '@/ui/layout';
import { AppText, Card, Divider, Pill, PrimaryButton } from '@/ui/primitives';

/** Управление привычками: добавление, переименование, архивирование. */
export default function HabitManageModal() {
  const router = useRouter();
  const { colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { habits, habitsArchived, checks, addHabit, renameHabit, archiveHabit, unarchiveHabit, deleteHabit } = useData();

  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const active = habits;
  const archived = habitsArchived;

  const checkCount = (habitId: number) => checks.filter((c) => c.habitId === habitId && c.done).length;

  const onAdd = async () => {
    setError(null);
    setSaving(true);
    try {
      const result = await addHabit(title);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      void Haptics.selectionAsync();
      setTitle('');
    } finally {
      setSaving(false);
    }
  };

  const onRename = async (id: number) => {
    setError(null);
    setSaving(true);
    try {
      const result = await renameHabit(id, title);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      void Haptics.selectionAsync();
      setTitle('');
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  };

  const onArchive = (id: number, habitTitle: string) => {
    Alert.alert(
      'Убрать в архив?',
      `«${habitTitle}» исчезнет из списка на главной. Отметки за прошлые дни сохранятся.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'В архив',
          onPress: () => {
            void Haptics.selectionAsync();
            void archiveHabit(id).then(() => {
              if (editingId === id) {
                setEditingId(null);
                setTitle('');
              }
            });
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <View
        style={{
          flex: 1,
          paddingHorizontal: tokens.spacing.xl,
          paddingTop: 14,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <SheetHeader title="Привычки" onClose={() => router.back()} />

        <AppText variant="body" color="secondary" style={{ marginBottom: tokens.spacing.lg }}>
          Привычки подсвечиваются на главной и в календаре. Никаких целей и штрафов — только ваш список.
        </AppText>

        <View style={{ gap: 8 }}>
          <TextInput
            value={title}
            onChangeText={(t) => {
              setError(null);
              setTitle(t.slice(0, MAX_HABIT_TITLE + 10));
            }}
            placeholder={editingId != null ? 'Новое название' : 'Новая привычка, например «Прогулка»'}
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel="Название привычки"
            returnKeyType="done"
            onSubmitEditing={() => {
              if (editingId != null) void onRename(editingId);
              else void onAdd();
            }}
            style={{
              height: 50,
              borderRadius: tokens.radius.md,
              backgroundColor: colors.inputBg,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: error ? colors.danger : colors.inputBorder,
              paddingHorizontal: 14,
              color: colors.text,
              ...tokens.type.body,
            }}
          />
          {error ? (
            <AppText variant="caption" color="danger">
              {error}
            </AppText>
          ) : null}
          <PrimaryButton
            label={editingId != null ? 'Сохранить название' : 'Добавить привычку'}
            icon={editingId != null ? <Pencil size={16} color={colors.onAccent} /> : <Plus size={16} color={colors.onAccent} strokeWidth={2.6} />}
            loading={saving}
            onPress={() => (editingId != null ? void onRename(editingId) : void onAdd())}
          />
          {editingId != null ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setEditingId(null);
                setTitle('');
              }}
              style={{ alignSelf: 'center', paddingVertical: 6 }}
            >
              <AppText variant="caption" color="secondary">
                Отменить переименование
              </AppText>
            </Pressable>
          ) : null}
        </View>

        <View style={{ height: tokens.spacing.xl }} />

        {active.length === 0 ? (
          <Card>
            <AppText variant="body" color="secondary" style={{ textAlign: 'center' }}>
              Активных привычек нет. Добавьте первую выше.
            </AppText>
          </Card>
        ) : (
          <Card padded={false}>
            {active.map((h, i) => (
              <View key={h.id}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyStrong" numberOfLines={2}>
                      {h.emoji ? `${h.emoji}  ` : ''}
                      {h.title}
                    </AppText>
                    <AppText variant="caption" color="tertiary">
                      {checkCount(h.id)} {checkCount(h.id) === 1 ? 'отметка' : 'отметок'}
                    </AppText>
                  </View>
                  <Pill
                    label="Изменить"
                    onPress={() => {
                      setEditingId(h.id);
                      setTitle(h.title);
                    }}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Убрать в архив: ${h.title}`}
                    onPress={() => onArchive(h.id, h.title)}
                    hitSlop={8}
                    style={({ pressed }) => ({
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: pressed ? colors.cardPressed : 'transparent',
                    })}
                  >
                    <Archive color={colors.textTertiary} size={17} />
                  </Pressable>
                </View>
                {i < active.length - 1 ? <Divider style={{ marginLeft: 16 }} /> : null}
              </View>
            ))}
          </Card>
        )}

        {archived.length > 0 ? (
          <>
            <AppText
              variant="micro"
              color="tertiary"
              style={{
                textTransform: 'uppercase',
                marginTop: tokens.spacing.xl,
                marginBottom: tokens.spacing.sm,
              }}
            >
              В архиве
            </AppText>
            <Card padded={false}>
              {archived.map((h, i) => (
                <View key={h.id}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingHorizontal: 16,
                      paddingVertical: 11,
                    }}
                  >
                    <AppText
                      variant="body"
                      color="tertiary"
                      style={{ flex: 1, textDecorationLine: 'line-through' }}
                      numberOfLines={1}
                    >
                      {h.emoji ? `${h.emoji}  ` : ''}
                      {h.title}
                    </AppText>
                    <Pill label="Вернуть" onPress={() => void unarchiveHabit(h.id)} />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Удалить привычку: ${h.title}`}
                      onPress={() =>
                        Alert.alert(
                          'Удалить привычку?',
                          `«${h.title}» и её отметки будут удалены навсегда.`,
                          [
                            { text: 'Отмена', style: 'cancel' },
                            {
                              text: 'Удалить',
                              style: 'destructive',
                              onPress: () => void deleteHabit(h.id),
                            },
                          ]
                        )
                      }
                      hitSlop={8}
                    >
                      <Trash2 color={colors.textTertiary} size={16} />
                    </Pressable>
                  </View>
                  {i < archived.length - 1 ? <Divider style={{ marginLeft: 16 }} /> : null}
                </View>
              ))}
            </Card>
          </>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}
