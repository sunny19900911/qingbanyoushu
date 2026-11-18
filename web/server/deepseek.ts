import { z } from "zod";
import type {
  DailyEntry,
  DailyFeedback,
  InputMode,
  ParsedEntryPreview,
  ReviewResponse,
} from "../shared/types.js";
import type { KnowledgeCardContext } from "./vaultRepository.js";
import { parseLocally } from "./localParser.js";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-flash";

const parsedSchema = z.object({
  weightKg: z.number().min(30).max(250).nullable(),
  weightRaw: z.string().nullable(),
  dietText: z.string().nullable(),
  activityText: z.string().nullable(),
  sleepText: z.string().nullable(),
  contextTags: z.array(z.string()).max(8),
  uncertainties: z.array(z.string()).max(4),
  followupQuestion: z.string().nullable(),
});

const feedbackSchema = z.object({
  preserve: z.string().min(4).max(120),
  nextAction: z.string().min(4).max(160),
  basis: z.string().min(2).max(120),
  sourceIds: z.array(z.string()).min(1).max(4),
});

interface DeepSeekResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export class ModelServiceError extends Error {
  constructor(public readonly status: number) { super(`Model service HTTP ${status}`); }
}

export async function callJson(messages: Array<{ role: "system" | "user"; content: string }>): Promise<unknown | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) return null;

  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      response_format: { type: "json_object" },
      stream: false,
      temperature: 0.1,
      max_tokens: 900,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    throw new ModelServiceError(response.status);
  }

  const body = (await response.json()) as DeepSeekResponse;
  const content = body.choices?.[0]?.message?.content;
  if (!content) return null;
  return JSON.parse(content);
}

export function deepSeekEnabled(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY?.trim());
}

export async function parseDailyInput(
  rawText: string,
  inputMode: InputMode,
): Promise<ParsedEntryPreview> {
  try {
    const payload = await callJson([
      {
        role: "system",
        content:
          "你是体重管理记录解析器。只提取用户明确说出的事实，不诊断、不补造、不评价自律。输出严格 JSON，字段为 weightKg, weightRaw, dietText, activityText, sleepText, contextTags, uncertainties, followupQuestion。信息缺失用 null。只有一个会改变存档或建议的关键歧义时才填写 followupQuestion，否则必须为 null。",
      },
      {
        role: "user",
        content: `请解析下面这条去标识化的今日记录：\n${rawText}`,
      },
    ]);
    const parsed = parsedSchema.parse(payload);
    const local = parseLocally(rawText, inputMode);
    return { ...local, ...parsed, parserMode: "deepseek" };
  } catch {
    return parseLocally(rawText, inputMode);
  }
}

function localFeedback(
  entry: Pick<ParsedEntryPreview, "activityText" | "dietText" | "contextTags">,
  review: ReviewResponse,
): DailyFeedback {
  const hasNightContext = entry.contextTags.some((tag) => ["加班", "睡不着", "焦虑", "想吃"].includes(tag));
  const preserve = entry.activityText
    ? "你记录了实际完成的活动，这比按计划推测更有助于后续复盘。"
    : entry.dietText
      ? "你留下了具体的饮食事实，后续可以结合连续记录判断，而不用凭印象归因。"
      : "今天完成了一次记录，这条事实已经进入你的连续档案。";
  const nextAction = hasNightContext
    ? "今晚如果再次想吃东西，先标记是饿、馋、睡不着还是加班，再决定是否进食。"
    : review.action;
  return {
    preserve,
    nextAction,
    basis: review.sourceIds.join(" · ") || "当前行动周期",
    sourceIds: review.sourceIds.length ? review.sourceIds.slice(0, 3) : ["MC-WT-002"],
    disclaimer: "用于行为复盘，不构成医疗诊断或治疗建议。",
    generatorMode: "local",
  };
}

export async function generateDailyFeedback(input: {
  entry: ParsedEntryPreview;
  recentEntries: DailyEntry[];
  review: ReviewResponse;
  knowledgeCards: KnowledgeCardContext[];
}): Promise<DailyFeedback> {
  const fallback = localFeedback(input.entry, input.review);
  try {
    const recentSummary = input.recentEntries.slice(-7).map((entry) => ({
      date: entry.localDate,
      weightKg: entry.weightKg,
      activity: entry.activityText,
      diet: entry.dietText,
    }));
    const cards = input.knowledgeCards.map((card) => ({
      methodCardId: card.methodCardId,
      title: card.title,
      content: card.content,
      sourceIds: card.sourceIds.filter((id) => id.startsWith("EVID-") || id.startsWith("ZB-")),
    }));
    const payload = await callJson([
      {
        role: "system",
        content:
          "你生成每日体重管理轻反馈。输出严格 JSON：preserve, nextAction, basis, sourceIds。只依据提供的当前用户记录和方法卡；每天只保留一个值得保留的行为和一个小动作；不得诊断、不得把缺失当失败、不得承诺减重效果。basis 必须简短，sourceIds 只能从提供的卡片中选择。",
      },
      {
        role: "user",
        content: JSON.stringify({ today: input.entry, recent: recentSummary, knowledgeCards: cards }),
      },
    ]);
    const parsed = feedbackSchema.parse(payload);
    const allowedSourceIds = new Set(
      input.knowledgeCards.flatMap((card) => [card.methodCardId, ...card.sourceIds]),
    );
    if (parsed.sourceIds.some((sourceId) => !allowedSourceIds.has(sourceId))) {
      throw new Error("DeepSeek returned an unknown source_id");
    }
    return {
      ...parsed,
      disclaimer: "用于行为复盘，不构成医疗诊断或治疗建议。",
      generatorMode: "deepseek",
    };
  } catch {
    return fallback;
  }
}
