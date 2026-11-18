import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type {
  ActionAcceptance,
  CoachReply,
  DailyEntry,
  ReviewQuestion,
  TrainingAssignment,
  UserId,
} from "../shared/types.js";
import {
  ACTION_STORE_PATH,
  QUESTION_STORE_PATH,
  REPLY_STORE_PATH,
  STORE_PATH,
  TRAINING_STORE_PATH,
} from "./config.js";

async function readJsonLines<T>(filePath: string): Promise<T[]> {
  try {
    const content = await readFile(filePath, "utf8");
    return content
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function readPrototypeEntries(userId?: UserId): Promise<DailyEntry[]> {
  return (await readJsonLines<DailyEntry>(STORE_PATH)).filter((entry) => !userId || entry.userId === userId);
}

export async function appendPrototypeEntry(entry: DailyEntry): Promise<void> {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
  await appendFile(STORE_PATH, `${JSON.stringify(entry)}\n`, "utf8");
}

export async function readActionAcceptances(userId?: UserId): Promise<ActionAcceptance[]> {
  return (await readJsonLines<ActionAcceptance>(ACTION_STORE_PATH)).filter(
    (event) => !userId || event.userId === userId,
  );
}

export async function appendActionAcceptance(event: ActionAcceptance): Promise<void> {
  await mkdir(path.dirname(ACTION_STORE_PATH), { recursive: true });
  await appendFile(ACTION_STORE_PATH, `${JSON.stringify(event)}\n`, "utf8");
}

export async function readReviewQuestions(
  userId?: UserId,
  filePath = QUESTION_STORE_PATH,
): Promise<ReviewQuestion[]> {
  return (await readJsonLines<ReviewQuestion>(filePath)).filter(
    (question) => !userId || question.userId === userId,
  );
}

export async function appendReviewQuestion(
  question: ReviewQuestion,
  filePath = QUESTION_STORE_PATH,
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(question)}\n`, "utf8");
}

export async function readCoachReplies(userId?: UserId): Promise<CoachReply[]> {
  return (await readJsonLines<CoachReply>(REPLY_STORE_PATH)).filter(
    (reply) => !userId || reply.userId === userId,
  );
}

export async function appendCoachReply(reply: CoachReply): Promise<void> {
  await mkdir(path.dirname(REPLY_STORE_PATH), { recursive: true });
  await appendFile(REPLY_STORE_PATH, `${JSON.stringify(reply)}\n`, "utf8");
}

export async function readTrainingAssignments(userId?: UserId): Promise<TrainingAssignment[]> {
  return (await readJsonLines<TrainingAssignment>(TRAINING_STORE_PATH)).filter(
    (assignment) => !userId || assignment.userId === userId,
  );
}

export async function appendTrainingAssignment(assignment: TrainingAssignment): Promise<void> {
  await mkdir(path.dirname(TRAINING_STORE_PATH), { recursive: true });
  await appendFile(TRAINING_STORE_PATH, `${JSON.stringify(assignment)}\n`, "utf8");
}
