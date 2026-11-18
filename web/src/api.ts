import type {
  ActionAcceptance,
  AccountSession,
  AppUser,
  CoachDashboard,
  CoachFeedbackHistoryItem,
  CoachReply,
  DailyEntry,
  DailyFeedback,
  ExerciseItem,
  InputMode,
  InBodyTrendReport,
  ParsedEntryPreview,
  RecordsResponse,
  ReviewQuestion,
  ReviewResponse,
  RuntimeConfig,
  TrainingAssignment,
  UserId,
} from "../shared/types";

import { appUrl } from "./appUrl";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(appUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || "请求失败，请稍后再试");
  }
  return (await response.json()) as T;
}

export const api = {
  session: () => request<AccountSession>("/api/auth/session"),
  testLogin: (userId: UserId) => request<AccountSession>("/api/auth/test-login", { method: "POST", body: JSON.stringify({ userId }) }),
  loginCode: (phone: string) => request<{ testCode: string }>("/api/auth/code", { method: "POST", body: JSON.stringify({ phone }) }),
  phoneLogin: (phone: string, code: string, displayAlias: string, inheritHistory: boolean) => request<AccountSession>("/api/auth/phone", { method: "POST", body: JSON.stringify({ phone, code, displayAlias, inheritHistory }) }),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  removeUser: (userId: UserId) => request<{ ok: boolean }>(`/api/coach/users/${userId}/remove`, { method: "POST" }),
  removeTraining: (userId: UserId) => request<{ ok: boolean }>(`/api/coach/users/${userId}/remove-training`, { method: "POST" }),
  config: () => request<RuntimeConfig>("/api/config"),
  users: () => request<AppUser[]>("/api/users"),
  records: (userId: UserId) => request<RecordsResponse>(`/api/users/${userId}/records`),
  review: (userId: UserId) => request<ReviewResponse>(`/api/users/${userId}/review`),
  coachFeedback: (userId: UserId) =>
    request<CoachFeedbackHistoryItem[]>(`/api/users/${userId}/coach-feedback`),
  inBody: (userId: UserId) => request<InBodyTrendReport>(`/api/users/${userId}/inbody`),
  acceptAction: (userId: UserId) =>
    request<ActionAcceptance>("/api/actions/accept", {
      method: "POST",
      body: JSON.stringify({ userId }),
    }),
  questions: (userId: UserId) => request<ReviewQuestion[]>(`/api/users/${userId}/questions`),
  coachQuestions: () => request<ReviewQuestion[]>("/api/coach/questions"),
  exercises: () => request<{ categories: string[]; exercises: ExerciseItem[] }>("/api/exercises"),
  training: (userId: UserId) => request<TrainingAssignment | null>(`/api/users/${userId}/training`),
  coachReplies: (userId: UserId) => request<CoachReply[]>(`/api/users/${userId}/coach-replies`),
  coachDashboard: () => request<CoachDashboard>("/api/coach/dashboard"),
  replyQuestion: (userId: UserId, questionId: string, replyText: string) =>
    request<CoachReply>("/api/coach/replies", {
      method: "POST",
      body: JSON.stringify({ userId, questionId, replyText }),
    }),
  assignTraining: (
    userId: UserId,
    exerciseIds: string[],
    prescription: string,
    note: string,
    userIds?: UserId[],
  ) => request<TrainingAssignment>("/api/coach/training-assignments", {
    method: "POST",
    body: JSON.stringify({ userId, userIds, exerciseIds, prescription, note }),
  }),
  submitQuestion: (userId: UserId, questionText: string, inputMode: InputMode) =>
    request<ReviewQuestion>("/api/questions", {
      method: "POST",
      body: JSON.stringify({ userId, questionText, inputMode }),
    }),
  parse: (userId: UserId, rawText: string, inputMode: InputMode) =>
    request<ParsedEntryPreview>("/api/parse", {
      method: "POST",
      body: JSON.stringify({ userId, rawText, inputMode }),
    }),
  saveEntry: (userId: UserId, entry: ParsedEntryPreview) =>
    request<DailyEntry>("/api/entries", {
      method: "POST",
      body: JSON.stringify({ userId, entry }),
    }),
  feedback: (userId: UserId, entry: ParsedEntryPreview) =>
    request<DailyFeedback>("/api/feedback", {
      method: "POST",
      body: JSON.stringify({ userId, entry }),
    }),
};
