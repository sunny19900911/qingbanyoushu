import path from "node:path";
import { fileURLToPath } from "node:url";
import type { UserId } from "../shared/types.js";

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(serverDirectory, "..");

export const VAULT_ROOT = process.env.WEIGHT_VAULT_PATH?.trim()
  ? path.resolve(process.env.WEIGHT_VAULT_PATH.trim())
  : "E:\\104-周博减重知识库";

export const STORE_PATH = process.env.PROTOTYPE_STORE_PATH?.trim()
  ? path.resolve(PROJECT_ROOT, process.env.PROTOTYPE_STORE_PATH.trim())
  : path.join(PROJECT_ROOT, "runtime", "prototype-entries.jsonl");

export const ACTION_STORE_PATH = process.env.PROTOTYPE_ACTION_STORE_PATH?.trim()
  ? path.resolve(PROJECT_ROOT, process.env.PROTOTYPE_ACTION_STORE_PATH.trim())
  : path.join(PROJECT_ROOT, "runtime", "action-events.jsonl");

export const QUESTION_STORE_PATH = process.env.PROTOTYPE_QUESTION_STORE_PATH?.trim()
  ? path.resolve(PROJECT_ROOT, process.env.PROTOTYPE_QUESTION_STORE_PATH.trim())
  : path.join(PROJECT_ROOT, "runtime", "review-questions.jsonl");

export const REPLY_STORE_PATH = process.env.PROTOTYPE_REPLY_STORE_PATH?.trim()
  ? path.resolve(PROJECT_ROOT, process.env.PROTOTYPE_REPLY_STORE_PATH.trim())
  : path.join(PROJECT_ROOT, "runtime", "coach-replies.jsonl");

export const TRAINING_STORE_PATH = process.env.PROTOTYPE_TRAINING_STORE_PATH?.trim()
  ? path.resolve(PROJECT_ROOT, process.env.PROTOTYPE_TRAINING_STORE_PATH.trim())
  : path.join(PROJECT_ROOT, "runtime", "training-assignments.jsonl");

export const USER_CONFIG: Record<
  UserId,
  {
    displayAlias: string;
    eventDirectory: string;
    profilePath: string;
    cycleDirectory: string;
    coachFeedbackDirectory: string;
  }
> = {
  "USR-SELF-001": {
    displayAlias: "YC",
    eventDirectory: path.join(
      VAULT_ROOT,
      "raw",
      "users",
      "01-YC",
      "USR-SELF-001",
      "events",
    ),
    profilePath: path.join(
      VAULT_ROOT,
      "wiki",
      "users",
      "01-YC",
      "USR-SELF-001",
      "profile.md",
    ),
    cycleDirectory: path.join(
      VAULT_ROOT,
      "wiki",
      "users",
      "01-YC",
      "USR-SELF-001",
      "cycles",
    ),
    coachFeedbackDirectory: path.join(
      VAULT_ROOT,
      "wiki",
      "users",
      "01-YC",
      "USR-SELF-001",
      "coach-feedback",
    ),
  },
  "USR-DEMO-001": {
    displayAlias: "示例学员",
    eventDirectory: path.join(
      VAULT_ROOT,
      "raw",
      "users",
      "02-示例学员用户",
      "USR-DEMO-001",
      "events",
    ),
    profilePath: path.join(
      VAULT_ROOT,
      "wiki",
      "users",
      "02-示例学员用户",
      "USR-DEMO-001",
      "profile.md",
    ),
    cycleDirectory: path.join(
      VAULT_ROOT,
      "wiki",
      "users",
      "02-示例学员用户",
      "USR-DEMO-001",
      "cycles",
    ),
    coachFeedbackDirectory: path.join(
      VAULT_ROOT,
      "wiki",
      "users",
      "02-示例学员用户",
      "USR-DEMO-001",
      "coach-feedback",
    ),
  },
};

export function isUserId(value: unknown): value is UserId {
  return value === "USR-SELF-001" || value === "USR-DEMO-001" ||
    (typeof value === "string" && /^USR-APP-[a-f0-9-]{36}$/.test(value));
}
