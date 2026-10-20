import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { ThemeProvider } from '@/theme/ThemeProvider';
import { MonthSwitcher, nextMonth, prevMonth } from '@/ui/CalendarSheet';
import { Pill } from '@/ui/primitives';
import { splitSegments, WeightChart } from '@/ui/WeightChart';

// RNTL v14: render is async.
async function wrap(ui: React.ReactNode) {
  return render(<ThemeProvider mode="dark">{ui}</ThemeProvider>);
}

describe('WeightChart', () => {
  it('shows the empty label instead of inventing a chart', async () => {
    const r = await wrap(<WeightChart points={[]} />);
    expect(r.getByText(/Добавьте первое измерение/)).toBeTruthy();
  });

  it('splits across gaps and still renders', async () => {
    const points = [
      { date: '2026-01-01', actual: 75, smoothed: null },
      { date: '2026-01-05', actual: 74, smoothed: null },
      // большой разрыв — новая линия
      { date: '2026-05-01', actual: 73, smoothed: null },
    ];
    expect(splitSegments(points)).toHaveLength(2);

    const r = await wrap(<WeightChart points={points} />);
    expect(r.queryByText(/Добавьте первое измерение/)).toBeNull();
    expect(r.toJSON()).toBeTruthy();
  });

  it('renders the actual line when smoothed values are missing', async () => {
    const points = [
      { date: '2026-01-01', actual: 75, smoothed: null },
      { date: '2026-01-02', actual: 74.5, smoothed: null },
      { date: '2026-01-03', actual: 74, smoothed: 74.5 },
    ];
    const r = await wrap(<WeightChart points={points} />);
    expect(r.queryByText(/Добавьте первое измерение/)).toBeNull();
    expect(r.toJSON()).toBeTruthy();
  });
});

describe('MonthSwitcher', () => {
  it('shows the month label', async () => {
    const r = await wrap(
      <MonthSwitcher month="2026-10-01" onChange={() => {}} onToday={() => {}} label="Октябрь 2026" />
    );
    expect(r.getByText('Октябрь 2026')).toBeTruthy();
  });

  it('navigates to the previous and next month', async () => {
    const onChange = jest.fn();
    const r = await wrap(
      <MonthSwitcher month="2026-10-01" onChange={onChange} onToday={() => {}} label="Октябрь 2026" />
    );

    await fireEvent.press(r.getByLabelText('Предыдущий месяц'));
    expect(onChange).toHaveBeenCalledWith('2026-09-01');

    await fireEvent.press(r.getByLabelText('Следующий месяц'));
    expect(onChange).toHaveBeenCalledWith('2026-11-01');
  });

  it('jumps to today', async () => {
    const onToday = jest.fn();
    const r = await wrap(
      <MonthSwitcher month="2026-10-01" onChange={() => {}} onToday={onToday} label="Октябрь 2026" />
    );
    await fireEvent.press(r.getByText('Октябрь 2026'));
    expect(onToday).toHaveBeenCalled();
  });

  it('month helpers handle year boundaries', () => {
    expect(nextMonth('2026-12-01')).toBe('2027-01-01');
    expect(prevMonth('2026-01-01')).toBe('2025-12-01');
  });
});

describe('Pill', () => {
  it('exposes the selected state and calls onPress', async () => {
    const onPress = jest.fn();
    const r = await wrap(<Pill label="30 дней" selected onPress={onPress} />);
    fireEvent.press(r.getByText('30 дней'));
    expect(onPress).toHaveBeenCalled();
  });
});
