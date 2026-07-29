import type { ReadinessBand } from '../coaching';

export type WidgetPlanKind = 'training' | 'cardio' | 'completed' | 'rest' | 'none';

export type WidgetPlan = {
  kind: WidgetPlanKind;
  /** "Today" | "Today · Done" | "Next" (peeking past a rest day). */
  label: string;
  title: string | null;
  meta: string | null;
};

/**
 * Exactly mirrors WidgetPayload in ios/Shared/WidgetPayload.swift — field
 * names and nesting must match, since it's serialized with
 * `JSON.stringify` on this side and decoded with Swift's synthesized
 * `Codable` conformance (no key-mapping) on the other.
 */
export type WidgetPayload = {
  /** Date.prototype.toISOString() — includes milliseconds. */
  updatedAt: string;
  /** yyyy-MM-dd, the local calendar day this payload was computed for. */
  dateKey: string;
  headline: string;
  summary: string;
  band: ReadinessBand | null;
  isRestDay: boolean;
  plan: WidgetPlan;
  sessionsThisWeek: number | null;
  weeklyTarget: number | null;
};
