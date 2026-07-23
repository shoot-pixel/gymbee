/**
 * Static feature flags. No remote config backend exists yet — this module is
 * the seed for one; swap the object literal for a fetched/cached config
 * without touching any call site that reads `featureFlags`.
 */
export type FeatureFlags = {
  aiCoaching: boolean;
  recoveryAdaptation: boolean;
  wearableIntegrations: boolean;
  videoAnalysis: boolean;
  voiceCoaching: boolean;
  predictivePersonalRecords: boolean;
  coachingMemory: boolean;
  exerciseIntelligence: boolean;
  communityChallenges: boolean;
};

export const featureFlags: FeatureFlags = {
  aiCoaching: true,
  recoveryAdaptation: true,
  wearableIntegrations: true,
  videoAnalysis: false,
  voiceCoaching: false,
  predictivePersonalRecords: true,
  coachingMemory: true,
  exerciseIntelligence: true,
  communityChallenges: false,
};
