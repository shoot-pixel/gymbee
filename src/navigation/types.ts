import type { NavigatorScreenParams } from '@react-navigation/native';
import type { WorkoutVariantType } from '../types/database';

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
  ExercisePicker: { selectMode?: boolean; templateId?: string } | undefined;
  Library: { pickMode?: boolean } | undefined;
  TemplateEditor: { templateId?: string; scheduleAfterSave?: boolean } | undefined;
  ScheduledWorkoutDetail: { scheduledWorkoutId: string };
};

// ---- Log tab ----
export type LogStackParamList = {
  LogLanding: undefined;
  PreWorkoutReview: { programDayId?: string; scheduledWorkoutId?: string };
  ChooseVariant: { programDayId?: string; scheduledWorkoutId?: string };
  LogWorkout:
    | { programDayId?: string; scheduledWorkoutId?: string; templateId?: string; variantType?: WorkoutVariantType }
    | undefined;
  ExercisePicker: { selectMode?: boolean; templateId?: string } | undefined;
  ExerciseDetail: { exerciseId: string };
  WorkoutSummary: undefined;
  Library: { pickMode?: boolean } | undefined;
  TemplateEditor: { templateId?: string; scheduleAfterSave?: boolean } | undefined;
};

// ---- Progress tab ----
export type ProgressStackParamList = {
  ProgressDashboard: undefined;
  PRDetail: { exerciseId: string };
  BodyMetrics: undefined;
  WeeklyReview: undefined;
  ProgressTimeline: undefined;
  UploadPhotoPost: { mode: 'progress' | 'before_after' };
};

// ---- Community tab ----
export type CommunityStackParamList = {
  Leaderboard: undefined;
  Posts: undefined;
  MyPosts: undefined;
  FriendProfile: { userId: string };
  PostDetail: { postId: string };
};

// ---- Profile (pushed from Today header, not a tab) ----
export type ProfileStackParamList = {
  Profile: undefined;
  Settings: undefined;
  Account: undefined;
  BlockedUsers: undefined;
  PostDetail: { postId: string };
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
