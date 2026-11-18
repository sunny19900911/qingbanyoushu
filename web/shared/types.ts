export const USER_IDS = ["USR-SELF-001", "USR-DEMO-001"] as const;
export type UserId = (typeof USER_IDS)[number] | `USR-APP-${string}`;
export type InputMode = "voice" | "text";
export type ParseStatus = "valid" | "ambiguous" | "unparsed";

export interface AppUser {
  userId: UserId;
  displayAlias: string;
  dataCutoff: string | null;
  role?: "coach" | "learner";
  inheritedFrom?: "USR-DEMO-001";
}

export interface AccountSession {
  enabled: boolean;
  mode: "local-test" | "legacy";
  user: AppUser | null;
}

export interface DailyEntry {
  entryId: string;
  sourceId: string | null;
  userId: UserId;
  localDate: string;
  timezone: "Asia/Shanghai";
  observationMode: "imported" | InputMode;
  rawText: string | null;
  weightRaw: string | null;
  weightKg: number | null;
  activityText: string | null;
  dietScoreRaw: string | null;
  dietText: string | null;
  contextTags: string[];
  parseStatus: ParseStatus;
  locator: string | null;
  origin: "vault" | "prototype";
  createdAt: string | null;
}

export interface WeightPoint {
  date: string;
  value: number;
}

export interface UserSummary {
  firstWeight: number | null;
  latestWeight: number | null;
  minimumWeight: number | null;
  netChange: number | null;
  firstWeightDate: string | null;
  latestWeightDate: string | null;
  minimumWeightDate: string | null;
  recordCount: number;
  weightCount: number;
  dataCutoff: string | null;
}

export interface RecordsResponse {
  user: AppUser;
  summary: UserSummary;
  entries: DailyEntry[];
  weights: WeightPoint[];
}

export interface ParsedEntryPreview {
  rawText: string;
  localDate: string;
  inputMode: InputMode;
  weightKg: number | null;
  weightRaw: string | null;
  dietText: string | null;
  activityText: string | null;
  sleepText: string | null;
  contextTags: string[];
  uncertainties: string[];
  followupQuestion: string | null;
  parserMode: "deepseek" | "local";
}

export interface DailyFeedback {
  preserve: string;
  nextAction: string;
  basis: string;
  sourceIds: string[];
  disclaimer: string;
  generatorMode: "deepseek" | "local";
}

export interface ReviewResponse {
  cycleId: string | null;
  actionId: string | null;
  followUpDue: string | null;
  actionAcceptedAt: string | null;
  conclusion: string;
  introduction: string;
  keep: string[];
  obstacles: string[];
  action: string;
  adjustmentConditions: string[];
  sourceIds: string[];
  dataCutoff: string | null;
  status: string;
}

export interface ActionAcceptance {
  eventId: string;
  userId: UserId;
  cycleId: string | null;
  actionId: string | null;
  actionSnapshot: string;
  sourceIds: string[];
  dataCutoff: string | null;
  status: "accepted";
  createdAt: string;
}

export interface ReviewQuestion {
  questionId: string;
  userId: UserId;
  questionText: string;
  inputMode: InputMode;
  status: "new" | "replied";
  createdAt: string;
}

export interface ExerciseItem {
  id: string;
  name: string;
  bodyPart: "全身" | "下肢" | "胸部" | "背部" | "肩部" | "手臂" | "核心";
  muscle: string;
  level: "入门" | "熟悉动作" | "需教练确认";
  equipment: string;
  image: string;
  steps: string[];
  cue: string;
  caution: string;
}

export interface TrainingAssignment {
  assignmentId: string;
  userId: UserId;
  localDate: string;
  exerciseIds: string[];
  prescription: string;
  note: string;
  status: "assigned" | "removed";
  createdAt: string;
  exerciseItems?: ExerciseItem[];
}

export interface CoachReply {
  replyId: string;
  userId: UserId;
  questionId: string;
  replyText: string;
  coachAlias: "YC";
  createdAt: string;
}

export interface CoachStudentSummary extends AppUser {
  latestDate: string | null;
  latestWeightKg: number | null;
  recordCount: number;
  hasTrainingToday: boolean;
}

export interface CoachDashboard {
  students: CoachStudentSummary[];
  questions: Array<ReviewQuestion & { displayAlias: string }>;
}

export interface CoachFeedbackHistoryItem {
  feedbackId: string;
  userId: UserId;
  coachAlias: string;
  recordedAt: string;
  linkedDate: string;
  stage: string;
  coachMessage: string;
  observedChange: string;
  verificationStatus: string;
  sourceIds: string[];
}

export interface RuntimeConfig {
  vaultConnected: boolean;
  deepSeekEnabled: boolean;
  demoMode: true;
}

export interface InBodyMeasurement {
  sourceId: string;
  date: string;
  measuredAt: string;
  device: string;
  weightKg: number;
  fatFreeMassKg: number;
  bodyFatMassKg: number;
  skeletalMuscleKg: number;
  totalBodyWater: number;
  totalBodyWaterUnit: "kg" | "L";
  bmi: number;
  bodyFatPercent: number;
  waistHipRatio: number;
  basalMetabolicRateKcal: number;
}

export interface InBodyFinding {
  title: string;
  detail: string;
  tone: "positive" | "watch" | "neutral";
}

export interface InBodyTrendReport {
  userId: "USR-DEMO-001";
  displayAlias: "示例学员";
  dateRange: { start: string; end: string };
  dataCutoff: string;
  sourceIds: string[];
  knowledgeSourceIds: string[];
  measurements: InBodyMeasurement[];
  latestDetails: {
    inBodyScore: number;
    visceralFatLevel: number;
    smiKgM2: number;
  };
  headline: string;
  summary: string;
  findings: InBodyFinding[];
  nextActions: string[];
  adjustmentSignal: string;
  limitation: string;
}
