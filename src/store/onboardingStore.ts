import { create } from 'zustand';
import type { TrainingGoal, ExperienceLevel, EquipmentType } from '../types/database';

type OnboardingState = {
  goal: TrainingGoal | null;
  experienceLevel: ExperienceLevel | null;
  daysPerWeek: number | null;
  equipment: EquipmentType[];
  injuriesNotes: string;

  setGoal: (goal: TrainingGoal) => void;
  setExperienceLevel: (level: ExperienceLevel) => void;
  setDaysPerWeek: (days: number) => void;
  toggleEquipment: (item: EquipmentType) => void;
  setInjuriesNotes: (notes: string) => void;
  reset: () => void;
};

const initialState = {
  goal: null,
  experienceLevel: null,
  daysPerWeek: null,
  equipment: [],
  injuriesNotes: '',
} satisfies Partial<OnboardingState>;

export const useOnboardingStore = create<OnboardingState>(set => ({
  ...initialState,

  setGoal: goal => set({ goal }),
  setExperienceLevel: experienceLevel => set({ experienceLevel }),
  setDaysPerWeek: daysPerWeek => set({ daysPerWeek }),
  toggleEquipment: item =>
    set(state => ({
      equipment: state.equipment.includes(item)
        ? state.equipment.filter(e => e !== item)
        : [...state.equipment, item],
    })),
  setInjuriesNotes: injuriesNotes => set({ injuriesNotes }),
  reset: () => set(initialState),
}));
