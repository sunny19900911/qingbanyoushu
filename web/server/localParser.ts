import type { InputMode, ParsedEntryPreview } from "../shared/types.js";

const CONTEXT_KEYWORDS: Array<[RegExp, string]> = [
  [/加班|工作到很晚/, "加班"],
  [/睡不着|失眠|晚睡|熬夜/, "睡不着"],
  [/焦虑|着急|压力/, "焦虑"],
  [/嘴馋|想吃/, "想吃"],
  [/很饿|饥饿|饿了/, "饥饿"],
  [/出差|高铁|机场|酒店/, "出差"],
  [/聚餐|应酬|外食/, "外食"],
  [/例假|经期|生理期/, "经期"],
];

const ACTIVITY_WORDS = "走|步行|快走|跑步|爬坡|游泳|乒乓|羽毛球|椭圆机|力量|训练|瑜伽|骑行|跳舞|散步";

function shanghaiDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function findWeight(rawText: string): { weightKg: number | null; weightRaw: string | null; issue: string | null } {
  const explicit = rawText.match(/(?:体重|早上|今早|晨重)?\s*(\d{2,3}(?:\.\d{1,2})?)\s*(?:公斤|千克|kg|KG)/);
  if (!explicit) return { weightKg: null, weightRaw: null, issue: null };
  const weightRaw = explicit[1];
  const value = Number(weightRaw);
  if (!Number.isFinite(value) || value < 30 || value > 250) {
    return { weightKg: null, weightRaw, issue: `体重“${weightRaw} kg”需要确认` };
  }
  return { weightKg: value, weightRaw, issue: null };
}

function findActivity(rawText: string): string | null {
  const sentences = rawText.split(/[。；;，,]/).map((item) => item.trim());
  const matches = sentences.filter((sentence) => new RegExp(ACTIVITY_WORDS).test(sentence));
  return matches.length ? matches.join("；") : null;
}

function findDiet(rawText: string): string | null {
  const sentences = rawText.split(/[。；;，,]/).map((item) => item.trim()).filter(Boolean);
  const matches: string[] = [];
  sentences.forEach((sentence, index) => {
    const describesEating = /早餐|早饭|早上吃|午餐|午饭|中午吃|晚餐|晚饭|晚上吃|夜宵|加餐|吃了|喝了/.test(sentence);
    const onlyDescribesUrge = /(?:想|打算|准备)(?:吃|喝)/.test(sentence) && !/(?:已经|刚刚|刚才|实际)(?:吃|喝)/.test(sentence);
    if (describesEating && !onlyDescribesUrge) {
      matches.push(sentence);
      return;
    }

    const followsDiet = index > 0 && matches.includes(sentences[index - 1]);
    const isPortionDetail = /剩了|剩下|没吃完|吃完了|半份|一半|几口|少量|份量|分量/.test(sentence);
    if (followsDiet && isPortionDetail) matches.push(sentence);
  });
  return matches.length ? matches.join("；") : null;
}

function findSleep(rawText: string): string | null {
  const explicit = rawText.match(/(?:睡觉|入睡|上床|睡到|睡了)[^。；;]{0,24}/);
  return explicit?.[0]?.trim() ?? null;
}

export function parseLocally(rawText: string, inputMode: InputMode): ParsedEntryPreview {
  const normalized = rawText.replace(/\s+/g, " ").trim();
  const weight = findWeight(normalized);
  const contextTags = CONTEXT_KEYWORDS.filter(([pattern]) => pattern.test(normalized)).map(([, tag]) => tag);
  const uncertainties = weight.issue ? [weight.issue] : [];

  return {
    rawText: normalized,
    localDate: shanghaiDate(),
    inputMode,
    weightKg: weight.weightKg,
    weightRaw: weight.weightRaw,
    dietText: findDiet(normalized),
    activityText: findActivity(normalized),
    sleepText: findSleep(normalized),
    contextTags: [...new Set(contextTags)],
    uncertainties,
    followupQuestion: weight.issue ? "你刚才说的体重是多少公斤？" : null,
    parserMode: "local",
  };
}
