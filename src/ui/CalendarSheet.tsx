import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  addDays,
  formatMonthYear,
  monthGrid,
  startOfMonth,
  todayKey,
  WEEKDAYS_SHORT,
  type DayKey,
} from '@/domain/dates';
import { useTheme } from '@/theme/ThemeProvider';

import { AppText, Chevron, Pill } from './primitives';

/**
 * Month calendar in a native modal sheet. Days without records are visually distinct
 * from explicitly marked days; future dates can be disabled.
 */
export function CalendarSheet({
  visible,
  selected,
  onSelect,
  onClose,
  markedDates,
  minDate,
  maxDate,
  title = 'Выберите дату',
}: {
  visible: boolean;
  selected: DayKey;
  onSelect: (day: DayKey) => void;
  onClose: () => void;
  markedDates?: ReadonlySet<DayKey>;
  minDate?: DayKey;
  maxDate?: DayKey;
  title?: string;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState<DayKey>(startOfMonth(selected));
  const today = todayKey();

  // React-endorsed "adjust state during render": when the sheet opens (or the
  // target selection changes while closed), jump to the selected month.
  const [prevOpen, setPrevOpen] = useState({ visible, selected });
  if (visible && (prevOpen.visible !== visible || prevOpen.selected !== selected)) {
    setPrevOpen({ visible, selected });
    setMonth(startOfMonth(selected));
  } else if (prevOpen.visible !== visible) {
    setPrevOpen({ visible, selected });
  }

  const grid = useMemo(() => monthGrid(`${month}`), [month]);
  const monthLabel = formatMonthYear(month);
  const currentMonthIndex = Number(month.slice(5, 7)) - 1;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 18 + insets.top * 0.2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 }}>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={10}>
            <AppText variant="bodyStrong" color="secondary">
              Закрыть
            </AppText>
          </Pressable>
          <AppText variant="subtitle">{title}</AppText>
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => {
              setMonth(startOfMonth(today));
              onSelect(today);
            }}
          >
            <AppText variant="bodyStrong" color="accent">
              Сегодня
            </AppText>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 26, marginTop: 22 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Предыдущий месяц"
            onPress={() => setMonth(addDays(startOfMonth(month), -1))}
            hitSlop={12}
          >
            <ChevronLeft color={colors.textSecondary} size={22} />
          </Pressable>
          <AppText variant="headline" style={{ minWidth: 170, textAlign: 'center' }}>
            {monthLabel}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Следующий месяц"
            onPress={() => setMonth(nextMonth(month))}
            hitSlop={12}
          >
            <ChevronRight color={colors.textSecondary} size={22} />
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginTop: 18 }}>
          {WEEKDAYS_SHORT.map((d) => (
            <View key={d} style={{ flex: 1, alignItems: 'center' }}>
              <AppText variant="micro" color="tertiary">
                {d}
              </AppText>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, marginTop: 6 }}>
          {grid.map((day) => {
            const inMonth = Number(day.slice(5, 7)) - 1 === currentMonthIndex;
            const isSelected = day === selected;
            const isToday = day === today;
            const marked = markedDates?.has(day) ?? false;
            const disabled = (minDate != null && day < minDate) || (maxDate != null && day > maxDate);
            return (
              <Pressable
                key={day}
                accessibilityRole="button"
                accessibilityLabel={`${day}${marked ? ', есть записи' : ''}`}
                accessibilityState={{ selected: isSelected, disabled }}
                disabled={disabled}
                onPress={() => onSelect(day)}
                style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 5 }}
              >
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isSelected ? colors.accent : 'transparent',
                    borderWidth: isToday && !isSelected ? StyleSheet.hairlineWidth * 2 : 0,
                    borderColor: colors.accent,
                  }}
                >
                  <AppText
                    variant="bodyStrong"
                    color={isSelected ? 'onAccent' : disabled ? 'tertiary' : inMonth ? 'text' : 'tertiary'}
                    style={{ opacity: inMonth || isSelected ? 1 : 0.55 }}
                  >
                    {String(Number(day.slice(8, 10)))}
                  </AppText>
                </View>
                <View
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    marginTop: 3,
                    backgroundColor: marked ? (isSelected ? colors.accent : colors.accentText) : 'transparent',
                    opacity: disabled ? 0.3 : 1,
                  }}
                />
              </Pressable>
            );
          })}
        </View>

        <View style={{ paddingHorizontal: 20, marginTop: 8, flexDirection: 'row', justifyContent: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accentText }} />
            <AppText variant="caption" color="tertiary">
              есть записи
            </AppText>
          </View>
        </View>

        <View style={{ flex: 1 }} />
        <View style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 16 }}>
          <Pill label="Готово" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

export function MonthSwitcher({
  month,
  onChange,
  onToday,
  label,
}: {
  month: DayKey;
  onChange: (next: DayKey) => void;
  onToday: () => void;
  label: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Предыдущий месяц"
        onPress={() => onChange(prevMonth(month))}
        hitSlop={12}
      >
        <ChevronLeft color={colors.textSecondary} size={21} />
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onToday} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center' }}>
        <AppText variant="headline">{label}</AppText>
        <Chevron />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Следующий месяц"
        onPress={() => onChange(nextMonth(month))}
        hitSlop={12}
      >
        <ChevronRight color={colors.textSecondary} size={21} />
      </Pressable>
    </View>
  );
}

export function nextMonth(day: DayKey): DayKey {
  const [y, m] = day.split('-').map(Number) as [number, number];
  const year = m === 12 ? y + 1 : y;
  const month = m === 12 ? 1 : m + 1;
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

export function prevMonth(day: DayKey): DayKey {
  const [y, m] = day.split('-').map(Number) as [number, number];
  const year = m === 1 ? y - 1 : y;
  const month = m === 1 ? 12 : m - 1;
  return `${year}-${String(month).padStart(2, '0')}-01`;
}
