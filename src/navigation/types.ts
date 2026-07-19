import type { NavigatorScreenParams } from '@react-navigation/native';

// ---- Auth ----
export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
};

// ---- Onboarding ----
export type OnboardingStackParamList = {
  Goals: undefined;
  ExperienceLevel: undefined;
  DaysPerWeek: undefined;
  Equipment: undefined;
  Injuries: undefined;
  GeneratingProgram: undefined;
};

// ---- Today tab ----
export type TodayStackParamList = {
  Today: undefined;
  ProgramDetail: { programId: string };
  DayDetail: { programDayId: string };
  ExerciseDetail: { exerciseId: string };
};

// ---- Programs tab ----
export type ProgramsStackParamList = {
  Calendar: undefined;
  ProgramDetail: { programId: string };
  DayDetail: { programDayId: string };
};

// ---- Log tab ----
export type LogStackParamList = {
  LogWorkout: { programDayId?: string } | undefined;
  ExercisePicker: { selectMode?: boolean } | undefined;
  ExerciseDetail: { exerciseId: string };
};

// ---- Progress tab ----
export type ProgressStackParamList = {
  ProgressDashboard: undefined;
  PRDetail: { exerciseId: string };
  BodyMetrics: undefined;
};

// ---- Community tab ----
export type CommunityStackParamList = {
  Leaderboard: undefined;
  ActivityFeed: undefined;
  FriendProfile: { userId: string };
};

// ---- Profile (pushed from Today header, not a tab) ----
export type ProfileStackParamList = {
  Profile: undefined;
  Settings: undefined;
  Account: undefined;
};

export type MainTabParamList = {
  TodayTab: NavigatorScreenParams<TodayStackParamList>;
  ProgramsTab: NavigatorScreenParams<ProgramsStackParamList>;
  LogTab: NavigatorScreenParams<LogStackParamList>;
  ProgressTab: NavigatorScreenParams<ProgressStackParamList>;
  CommunityTab: NavigatorScreenParams<CommunityStackParamList>;
};

// ---- Root ----
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Onboarding: NavigatorScreenParams<OnboardingStackParamList>;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
  Chat: { conversationId?: string } | undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
