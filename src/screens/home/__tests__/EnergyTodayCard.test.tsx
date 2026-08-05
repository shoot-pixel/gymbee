import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { EnergyTodayCard } from '../EnergyTodayCard';
import type { DailyEnergyTotals } from '../../../utils/energyBalance';

const BASE_TOTALS: DailyEnergyTotals = {
  caloriesIn: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  bmr: 1780,
  baseOut: 2280,
  workoutOut: 0,
  caloriesOut: 2280,
  targetIntake: 1780,
  net: -2280,
  remaining: 1780,
  hasEnoughProfileData: true,
};

const MACRO_TARGETS = { proteinTargetG: 160, carbsTargetG: 180, fatTargetG: 60 };

describe('EnergyTodayCard', () => {
  it('shows the empty state and wires the CTA to onLogMeal when nothing is logged', async () => {
    const onLogMeal = jest.fn();
    const { getByText } = await render(
      <EnergyTodayCard
        entries={[]}
        totals={BASE_TOTALS}
        goal="cut"
        macroTargets={MACRO_TARGETS}
        insightHeadline=""
        insightBody="Nothing logged yet today — snap a photo of your next meal and I'll take it from there."
        onLogMeal={onLogMeal}
      />,
    );

    expect(getByText('Nothing logged yet today')).toBeTruthy();
    fireEvent.press(getByText('Log a meal'));
    expect(onLogMeal).toHaveBeenCalledTimes(1);
  });

  it('shows net, macros and the meal list once entries exist', async () => {
    const totals: DailyEnergyTotals = {
      ...BASE_TOTALS,
      caloriesIn: 950,
      proteinG: 66,
      carbsG: 110,
      fatG: 25,
      net: 950 - 2280,
      remaining: 1780 - 950,
    };
    const { getByText } = await render(
      <EnergyTodayCard
        entries={[
          { id: 'e1', name: 'Greek yogurt & granola', calories: 410, protein_g: 28, carbs_g: 52, fat_g: 9 },
          { id: 'e2', name: 'Turkey sandwich', calories: 540, protein_g: 38, carbs_g: 58, fat_g: 16 },
        ]}
        totals={totals}
        goal="cut"
        macroTargets={MACRO_TARGETS}
        insightHeadline="On pace for your cut"
        insightBody="You're at a 1330 cal deficit today."
        onLogMeal={jest.fn()}
      />,
    );

    expect(getByText('On pace for your cut')).toBeTruthy();
    expect(getByText('Greek yogurt & granola')).toBeTruthy();
    expect(getByText('Turkey sandwich')).toBeTruthy();
    expect(getByText('66g / 160g')).toBeTruthy();
  });

  it('caveats the estimate when profile data is incomplete', async () => {
    const totals: DailyEnergyTotals = { ...BASE_TOTALS, caloriesIn: 400, hasEnoughProfileData: false };
    const { getByText } = await render(
      <EnergyTodayCard
        entries={[{ id: 'e1', name: 'Snack', calories: 400, protein_g: 10, carbs_g: 40, fat_g: 15 }]}
        totals={totals}
        goal="maintain"
        macroTargets={MACRO_TARGETS}
        insightHeadline=""
        insightBody=""
        onLogMeal={jest.fn()}
      />,
    );

    expect(getByText(/Using an estimated baseline/)).toBeTruthy();
  });

  it('truncates the meal list at three entries with a "+N more" line', async () => {
    const totals: DailyEnergyTotals = { ...BASE_TOTALS, caloriesIn: 1000 };
    const { getByText } = await render(
      <EnergyTodayCard
        entries={[
          { id: 'e1', name: 'Meal 1', calories: 100, protein_g: 1, carbs_g: 1, fat_g: 1 },
          { id: 'e2', name: 'Meal 2', calories: 100, protein_g: 1, carbs_g: 1, fat_g: 1 },
          { id: 'e3', name: 'Meal 3', calories: 100, protein_g: 1, carbs_g: 1, fat_g: 1 },
          { id: 'e4', name: 'Meal 4', calories: 100, protein_g: 1, carbs_g: 1, fat_g: 1 },
        ]}
        totals={totals}
        goal="bulk"
        macroTargets={MACRO_TARGETS}
        insightHeadline=""
        insightBody=""
        onLogMeal={jest.fn()}
      />,
    );

    expect(getByText('Meal 1')).toBeTruthy();
    expect(getByText('Meal 3')).toBeTruthy();
    expect(() => getByText('Meal 4')).toThrow();
    expect(getByText('+ 1 more')).toBeTruthy();
  });
});
