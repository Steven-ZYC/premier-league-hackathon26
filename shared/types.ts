export type Language = "zh-CN" | "zh-TW" | "en";
export type Side = "home" | "away";
export type EventType =
  | "goal"
  | "own_goal"
  | "shot_on_target"
  | "shot_off_target"
  | "shot_blocked"
  | "save"
  | "corner"
  | "yellow_card"
  | "red_card"
  | "penalty_awarded"
  | "penalty_missed"
  | "var_cancel_goal"
  | "substitution"
  | "foul"
  | "unknown"
  | "kickoff"
  | "halftime"
  | "fulltime";
export interface Team {
  name: string;
  englishName?: string;
  short: string;
  color: string;
  badge?: string;
}
export interface MatchEvent {
  id: string;
  period: 1 | 2;
  displayTime: string;
  order: number;
  activeMinute: number;
  team: Side | "unknown";
  player?: string;
  type: EventType;
  rawText: string;
  relatedEventId?: string;
  confirmed: boolean;
  warnings?: string[];
}
export interface Stats {
  goals?: number;
  shots?: number;
  shotsOnTarget?: number;
  corners?: number;
  fouls?: number;
  yellowCards?: number;
  redCards?: number;
  passes?: number;
  successfulPasses?: number;
  passAccuracy?: number;
  possession?: number;
  xg?: number;
}
export interface StatsPair {
  home: Stats;
  away: Stats;
}
export interface Match {
  id: string;
  version: string;
  title: string;
  englishTitle?: string;
  competition: string;
  englishCompetition?: string;
  date: string;
  home: Team;
  away: Team;
  events: MatchEvent[];
  coverage: "complete" | "excerpt" | "unknown";
  missingRanges?: { from: number; to: number }[];
  source: string;
  englishSource?: string;
  rawInput: string;
  demo: boolean;
  finalStats?: StatsPair;
  snapshots?: (StatsPair & { cursor: number })[];
  duration: number;
}
export type Perspective = "neutral" | Side;
export type Direction = "up" | "down" | "flat" | "insufficient";
export interface Prediction {
  direction: Direction;
  explanation: string;
  team: Side;
  cursor: number;
  version: string;
  model?: string;
  cached?: boolean;
}
