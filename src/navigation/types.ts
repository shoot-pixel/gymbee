import type { NavigatorScreenParams } from '@react-navigation/native';
import type { WorkoutVariantType } from '../types/database';
import type { SingleWorkoutPayload, WeeklyPlanPayload } from '../services/api/queries/workoutShares';

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
  BodyProfile: undefined;
  ExperienceLevel: undefined;
  DaysPerWeek: undefined;
  Equipment: undefined;
  Injuries: undefined;
  BuildFirstWeek: undefined;
};

// ---- Today tab ----
export type TodayStackParamList = {
  Today: undefined;
  ProgramDetail: { programId: string };
  /** `date` (yyyy-MM-dd) is the calendar day this program day is being viewed
   * for — used to grey out "Start Workout" when the viewed day hasn't
   * arrived yet. Omitted when there's no specific date in view (e.g. reached
   * outside a weekday/calendar context), in which case the screen has no
   * future-day check to make. */
  DayDetail: { programDayId: string; date?: string };
  ExerciseDetail: { exerciseId: string };
  TrainingDayDetail: { weeklyScheduleId: string; workoutTemplateId: string; dayOfWeek: number };
  LogFood: undefined;
};

// ---- Programs tab ----
export type ProgramsStackParamList = {
  Calendar: undefined;
  ProgramDetail: { programId: string };
  /** `date` (yyyy-MM-dd) is the calendar day this program day is being viewed
   * for — used to grey out "Start Workout" when the viewed day hasn't
   * arrived yet. Omitted when there's no specific date in view (e.g. reached
   * outside a weekday/calendar context), in which case the screen has no
   * future-day check to make. */
  DayDetail: { programDayId: string; date?: string };
  ExercisePicker: { selectMode?: boolean; templateId?: string; programDayId?: string } | undefined;
  AddExercise: { selectMode?: boolean; templateId?: string; programDayId?: string } | undefined;
  Library: { pickMode?: boolean } | undefined;
  TemplateEditor: { templateId?: string; scheduleAfterSave?: boolean } | undefined;
  ScheduledWorkoutDetail: { scheduledWorkoutId: string };
  GenerateProgram: { daysPerWeek: number; weeksCount: number; focusNotes?: string; emphasisMuscleGroups?: string[] };
  AssignTrainingDay: { initialDayOfWeek?: number } | undefined;
  AssignCardioDay: { initialDayOfWeek?: number } | undefined;
  TrainingDayDetail: { weeklyScheduleId: string; workoutTemplateId: string; dayOfWeek: number };
  WorkoutLogDetail: { workoutLogIds: string[]; title?: string | null; dateLabel?: string };
  /** Recipient picker for sending a workout/weekly-plan share — reached from
   * a workout screen's "Share this workout" action or Calendar's "Share my
   * week." Carries the already-built snapshot directly (not an id): nothing
   * exists in the DB yet at this point, the data is already in memory on
   * the sender's device. */
  ShareWorkout:
    | { shareType: 'single_workout'; title: string; payload: SingleWorkoutPayload }
    | { shareType: 'weekly_plan'; title: string; payload: WeeklyPlanPayload };
};

// ---- Log tab ----
export type LogStackParamList = {
  LogLanding: undefined;
  PreWorkoutReview: { programDayId?: string; scheduledWorkoutId?: string };
  ChooseVariant: { programDayId?: string; scheduledWorkoutId?: string };
  ActiveWorkoutOverview:
    | { programDayId?: string; scheduledWorkoutId?: string; templateId?: string; variantType?: WorkoutVariantType }
    | undefined;
  ActiveExercise: { exerciseId: string };
  ExercisePicker: { selectMode?: boolean; templateId?: string; programDayId?: string } | undefined;
  AddExercise: { selectMode?: boolean; templateId?: string; programDayId?: string } | undefined;
  ExerciseDetail: { exerciseId: string };
  WorkoutSummary: undefined;
  Library: { pickMode?: boolean } | undefined;
  TemplateEditor: { templateId?: string; scheduleAfterSave?: boolean } | undefined;
  /** No scheduledWorkoutId — v1 has no one-off cardio scheduling, only
   * recurring (weekly_schedule) and AI-program (program_days) cardio days.
   * `date` (yyyy-MM-dd) is which calendar day this session is being logged
   * for — omitted when logging from a "start now" entry point, in which
   * case it defaults to today. */
  LogCardio: { programDayId?: string; date?: string } | undefined;
};

// ---- Progress tab ----
export type ProgressStackParamList = {
  ProgressDashboard: undefined;
  PRDetail: { exerciseId: string };
  BodyMetrics: undefined;
  WeeklyReview: undefined;
  ProgressTimeline: undefined;
};

// ---- Community tab ----
export type CommunityStackParamList = {
  Leaderboard: undefined;
  Posts: undefined;
  FriendProfile: { userId: string };
  FriendRequests: undefined;
  PostDetail: { postId: string };
  UploadPhotoPost: {
    mode: 'progress' | 'before_after';
    /** Pre-attached when reached via the Social tab's new-post FAB, which
     * already captured/picked the photo itself — the screen skips straight
     * to caption/tags instead of showing its own picker again. */
    initialPhoto?: { uri: string; contentType: string };
  };
  /** GymBee's relationship model is a mutual "Friends" graph (see
   * FriendsListScreen) — a single label, not separate Followers/Following
   * lists that would just show identical content under different names. */
  FriendsList: { userId: string; title: 'Friends' };
  Messages: undefined;
  Conversation: { conversationId: string };
  /** Reached by tapping a shared-workout card inside Conversation — fetches
   * by id (the share already exists in the DB by this point), unlike
   * ShareWorkout above which carries data that doesn't exist yet. */
  SharedWorkoutReview: { shareId: string };
  AtMyGym: undefined;
  /** Reposition (and optionally upload) the signed-in athlete's own profile
   * photo. `pickedUri`/`contentType` are only present when reached right
   * after picking a brand new photo (not yet uploaded) — omitted when
   * reframing the photo already saved on the profile. */
  AvatarPosition: { pickedUri?: string; contentType?: string } | undefined;
};

// ---- Profile (pushed from the header menu, not a tab) ----
export type ProfileStackParamList = {
  Settings: undefined;
  NotificationSettings: undefined;
  Account: undefined;
  Privacy: undefined;
  BlockedUsers: undefined;
  /** status/message are only ever populated when this screen is reached via
   * the soset://whoop-callback deep link — see RootNavigator's `linking`
   * config. The Integrations screen still re-derives the real connection
   * state from the database on focus; these params only drive the one-time
   * confirmation toast. */
  Integrations: { status?: 'success' | 'error'; message?: string } | undefined;
  Equipment: undefined;
  PostDetail: { postId: string };
  FriendsList: { userId: string; title: 'Friends' };
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
  /** Registered at the root (not nested in any one stack) so every gated
   * feature — AI Chat, Whoop, analytics, the widget, program regen — can
   * reach it the same way regardless of which stack it's pushed from:
   * rootNavigation.navigate('Paywall'). `trigger` only affects the copy
   * shown, purely for context ("why am I seeing this") — not enforcement,
   * which always happens server-side via is_premium. */
  Paywall: { trigger?: 'ai_chat' | 'whoop' | 'analytics' | 'widget' | 'program_regen' | 'adaptive_coaching' } | undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
