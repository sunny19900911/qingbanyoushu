import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type {
  AppUser,
  CoachFeedbackHistoryItem,
  DailyEntry,
  RecordsResponse,
  ReviewResponse,
  UserId,
  UserSummary,
} from "../shared/types.js";
import { USER_CONFIG, VAULT_ROOT } from "./config.js";
import { readPrototypeEntries } from "./prototypeStore.js";
import { accountLoginEnabled, accountUsers, inheritedHistory } from "./accounts.js";

const INVALID_WEIGHT_SOURCE_IDS = new Set(["USR-SELF-EVT-20260818-001"]);

const ZHANG_PROTOTYPE_ACTION =
  "下周先试 7 天：鲜肉月饼、手抓饼、葱油饼、面包这类饼或点心，一天只安排一餐，不在早餐和午餐重复吃；其他正餐照常，保留蛋白质和蔬菜，训练照旧。明显饿就吃正常正餐，不硬忍。每天只记“饼/点心 0、1 或 2 次＋饿/不饿”；遇到聚餐做不到就照实记，不补偿。";

const ZHANG_PROTOTYPE_ACTION_SOURCES = [
  "USR-DEMO-EVT-20260905-001",
  "USR-DEMO-EVT-20260909-001",
  "USR-DEMO-EVT-20260910-001",
  "USR-DEMO-EVT-20260911-001",
  "ZB-WX-017",
  "ZB-WX-020",
  "ZB-WX-028",
  "MC-WT-002",
];

interface ZhangTimelineBlueprint {
  sourceId: string;
  stage: string;
  coachMessage: string;
  observation: string;
}

const ZHANG_TIMELINE_BLUEPRINTS: ZhangTimelineBlueprint[] = [
  {
    sourceId: "USR-DEMO-EVT-20260304-001",
    stage: "先把起点记清楚",
    coachMessage: "先把起点记清楚，后面只和自己比，不急着用一天的数字评价自己。",
    observation: "首条可用体重为 69.6 kg，作为这段陪跑的记录起点。",
  },
  {
    sourceId: "USR-DEMO-EVT-20260305-001",
    stage: "从容易坚持的运动开始",
    coachMessage: "第一阶段先从最简单、能坚持的爬坡开始，不用一上来追求复杂动作。",
    observation: "当天记录：爬坡 30 分钟，力量＋拉伸 15 分钟。",
  },
  {
    sourceId: "USR-DEMO-EVT-20260309-001",
    stage: "周一体重上扬先别慌",
    coachMessage: "先观察周末盐分和饮水，不把一天的体重变化直接当成反弹。",
    observation: "体重为 69.9 kg；表内已有“可能周末吃得太咸了”的备注。",
  },
  {
    sourceId: "USR-DEMO-EVT-20260313-001",
    stage: "找到另一种友好的有氧",
    coachMessage: "把游泳也作为可以选择的有氧，不需要只依赖一种运动。",
    observation: "当天记录游泳 1 小时。",
  },
  {
    sourceId: "USR-DEMO-EVT-20260323-001",
    stage: "开始加入壶铃动作",
    coachMessage: "有氧先保留，同时慢慢加入壶铃，让肌肉也参与进来。",
    observation: "爬坡 30 分钟，并记录罗马尼亚硬拉、壶铃绕头和拉伸。",
  },
  {
    sourceId: "USR-DEMO-EVT-20260324-001",
    stage: "核心力量有了可见进步",
    coachMessage: "平板支撑能完成 30 秒，是很具体的进步，继续记录能力变化。",
    observation: "力量训练包含农夫走、平板支撑 3×30 秒、鸟狗式和深蹲。",
  },
  {
    sourceId: "USR-DEMO-EVT-20260325-001",
    stage: "先把全身动作做熟",
    coachMessage: "农夫行走动作简单，先把这种全身动作做熟，再考虑继续增加动作。",
    observation: "爬坡 30 分钟后继续农夫行走与拉伸。",
  },
  {
    sourceId: "USR-DEMO-EVT-20260407-001",
    stage: "稳定动作比追强度重要",
    coachMessage: "力量动作增加时，仍然把动作稳定放在强度前面。",
    observation: "跑步机 40 分钟，并完成农夫行走、罗马尼亚硬拉和弓箭步。",
  },
  {
    sourceId: "USR-DEMO-EVT-20260416-001",
    stage: "体验课不是越累越好",
    coachMessage: "体验课程重点看动作是否适合你，不用把第二天很累当成唯一标准。",
    observation: "当天记录一次 1 小时体验活动。",
  },
  {
    sourceId: "USR-DEMO-EVT-20260430-001",
    stage: "调味料也要看见",
    coachMessage: "黄瓜本身清爽，但芝麻酱也要单独看，调味料不能从记录里消失。",
    observation: "饮食记录中出现“一碗芝麻酱”。",
  },
  {
    sourceId: "USR-DEMO-EVT-20260513-001",
    stage: "坚果瓜子也要记分量",
    coachMessage: "花生和瓜子看着不像正餐，但分量大时也要单独记录。",
    observation: "晚间记录花生 100g、瓜子 100g。",
  },
  {
    sourceId: "USR-DEMO-EVT-20260601-001",
    stage: "高能量零食单独看",
    coachMessage: "不需要马上禁掉高能量零食，第一步只是把实际分量看见。",
    observation: "记录中出现五黑粉 30g、瓜子 200g 和碧根果 60g。",
  },
  {
    sourceId: "USR-DEMO-EVT-20260713-001",
    stage: "力量训练开始形成规律",
    coachMessage: "力量训练已经开始形成规律，先保持，不急着不断增加新动作。",
    observation: "跑步机 35 分钟，农夫行走、哑铃等 45 分钟。",
  },
  {
    sourceId: "USR-DEMO-EVT-20260716-001",
    stage: "“没吃饭”要拆开看",
    coachMessage: "正餐、零食和坚果都属于实际摄入，不能只用“有没有吃正餐”来判断。",
    observation: "晚间记录费列罗巧克力 1 个、瓜子 100g。",
  },
  {
    sourceId: "USR-DEMO-EVT-20260802-001",
    stage: "火锅底料也属于摄入",
    coachMessage: "火锅里的麻酱底料也要一起看，不能只观察主菜吃了什么。",
    observation: "火锅记录包含两碗麻酱底料、生日蛋糕和长寿面。",
  },
  {
    sourceId: "USR-DEMO-EVT-20260806-001",
    stage: "把糊类和酱料一起记下",
    coachMessage: "芝麻糊和酱料都如实记进去，记录真实比记录得好看更重要。",
    observation: "中午记录芝麻糊、酸奶；晚餐记录芝麻酱凉皮黄瓜。",
  },
  {
    sourceId: "USR-DEMO-EVT-20260819-001",
    stage: "核心训练继续保持",
    coachMessage: "核心训练已经能够持续做，下一步仍然先看动作质量和身体感受。",
    observation: "椭圆机 25 分钟，平板支撑和折叠身体等 40 分钟。",
  },
  {
    sourceId: "USR-DEMO-EVT-20260903-001",
    stage: "有氧和力量组合更完整",
    coachMessage: "现在的有氧与力量组合已经比较完整，先稳定这个结构。",
    observation: "椭圆机 30 分钟，农夫行走、壶铃哑铃等 35 分钟。",
  },
  {
    sourceId: "USR-DEMO-EVT-20260905-001",
    stage: "只处理一个重复叠加点",
    coachMessage: "手抓饼和葱油饼放在同一天时，下一步先只处理这个重复叠加点。",
    observation: "午餐记录手抓饼、葱油饼各 1 份和凉拌黄瓜。",
  },
];

function splitMarkdownRow(line: string): string[] {
  const cells = line.split(/(?<!\\)\|/).slice(1, -1);
  return cells.map((cell) =>
    cell
      .trim()
      .replace(/\\\|/g, "|")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/&amp;/g, "&"),
  );
}

function nullable(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function validWeight(weightRaw: string | null, normalized: string | undefined): number | null {
  if (!weightRaw || !/^\d{2,3}(?:\.\d{1,2})?$/.test(weightRaw)) {
    return null;
  }
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 30 && value <= 250 ? value : null;
}

function parseEventFile(content: string, userId: UserId): DailyEntry[] {
  const rows: DailyEntry[] = [];
  for (const line of content.split(/\r?\n/)) {
    if (!line.startsWith("| USR-")) continue;
    const cells = splitMarkdownRow(line);
    if (cells.length < 8) continue;
    const [sourceId, localDate, weightRawCell, weightKgCell, activity, dietScore, diet, locator] =
      cells;
    if (!sourceId || !localDate) continue;

    const weightRaw = nullable(weightRawCell);
    const isKnownInvalid = INVALID_WEIGHT_SOURCE_IDS.has(sourceId);
    const weightKg = isKnownInvalid ? null : validWeight(weightRaw, weightKgCell);
    const hasAnyValue = Boolean(weightRaw || activity || dietScore || diet);

    rows.push({
      entryId: sourceId,
      sourceId,
      userId,
      localDate,
      timezone: "Asia/Shanghai",
      observationMode: "imported",
      rawText: null,
      weightRaw,
      weightKg,
      activityText: nullable(activity),
      dietScoreRaw: nullable(dietScore),
      dietText: nullable(diet),
      contextTags: [],
      parseStatus: isKnownInvalid ? "ambiguous" : hasAnyValue ? "valid" : "unparsed",
      locator: nullable(locator),
      origin: "vault",
      createdAt: null,
    });
  }
  return rows;
}

function parseFrontmatterValue(content: string, key: string): string | null {
  const match = content.match(new RegExp(`^${key}:[ \\t]*["']?([^"'\\r\\n]+?)["']?[ \\t]*$`, "m"));
  return match?.[1]?.trim() ?? null;
}

function stripKnowledgeMarkup(value: string): string {
  return value
    .replace(/\[@[^\]]+\]/g, "")
    .replace(/`confidence:[^`]+`[；;]?/g, "")
    .replace(/`reasoning_summary:[^`]+`/g, "")
    .replace(/\*\*(?:原文事实|AI 推断(?:（待商定行动）)?|安全边界（作者观点）)\*\*[：:]?/g, "")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSection(content: string, heading: string): string {
  const marker = `## ${heading}`;
  const start = content.indexOf(marker);
  if (start < 0) return "";
  const bodyStart = start + marker.length;
  const next = content.indexOf("\n## ", bodyStart);
  return content.slice(bodyStart, next < 0 ? content.length : next).trim();
}

function extractBullets(section: string): string[] {
  return section
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("- "))
    .map((line) => stripKnowledgeMarkup(line.trim().slice(2)))
    .filter(Boolean);
}

function extractSourceIds(value: string): string[] {
  const ids = [...value.matchAll(/@([A-Z][A-Z0-9-]+)/g)].map((match) => match[1]);
  return [...new Set(ids)];
}

function parseCoachFeedbackTable(
  content: string,
  userId: UserId,
): CoachFeedbackHistoryItem[] {
  const section = extractSection(content, "阶段—反馈—变化线索");
  const parentId = parseFrontmatterValue(content, "feedback_id") ?? "FDB-UNKNOWN";
  const coachAlias = parseFrontmatterValue(content, "coach_alias") ?? "教练";
  const recordedAt = parseFrontmatterValue(content, "recorded_at") ?? "";
  const defaultVerification = parseFrontmatterValue(content, "verification_status") ?? "unverified";
  const rows: CoachFeedbackHistoryItem[] = [];

  for (const line of section.split(/\r?\n/)) {
    if (!line.trim().startsWith("|")) continue;
    const cells = splitMarkdownRow(line);
    if (cells.length < 4 || cells[0] === "阶段线索" || cells.every((cell) => /^:?-+:?$/.test(cell))) {
      continue;
    }
    const [stage, coachMessage, observedChange, verificationStatus] = cells;
    if (!stage || !coachMessage) continue;
    rows.push({
      feedbackId: `${parentId}-${String(rows.length + 1).padStart(2, "0")}`,
      userId,
      coachAlias,
      recordedAt,
      linkedDate: recordedAt,
      stage: stripKnowledgeMarkup(stage),
      coachMessage: stripKnowledgeMarkup(coachMessage),
      observedChange: stripKnowledgeMarkup(observedChange),
      verificationStatus: stripKnowledgeMarkup(verificationStatus) || defaultVerification,
      sourceIds: extractSourceIds(line),
    });
  }
  return rows;
}

async function latestMarkdownFile(directory: string): Promise<string> {
  const files = (await readdir(directory)).filter((name) => name.endsWith(".md")).sort();
  if (!files.length) throw new Error(`No markdown files in ${directory}`);
  return path.join(directory, files.at(-1)!);
}

export async function vaultConnected(): Promise<boolean> {
  try {
    await access(path.join(VAULT_ROOT, "AGENTS.md"));
    return true;
  } catch {
    return false;
  }
}

export async function listUsers(): Promise<AppUser[]> {
  if (accountLoginEnabled) return accountUsers();
  return Promise.all(
    (Object.keys(USER_CONFIG) as UserId[]).map(async (userId) => {
      const content = await readFile(USER_CONFIG[userId].profilePath, "utf8");
      return {
        userId,
        displayAlias: USER_CONFIG[userId].displayAlias,
        dataCutoff: parseFrontmatterValue(content, "data_cutoff"),
      };
    }),
  );
}

export async function loadVaultEntries(userId: UserId): Promise<DailyEntry[]> {
  if (userId.startsWith("USR-APP-")) return (await inheritedHistory(userId)).entries;
  const directory = USER_CONFIG[userId].eventDirectory;
  const files = (await readdir(directory)).filter((file) => file.endsWith(".md")).sort();
  const batches = await Promise.all(
    files.map(async (file) => parseEventFile(await readFile(path.join(directory, file), "utf8"), userId)),
  );
  return batches.flat().sort((a, b) => a.localDate.localeCompare(b.localDate));
}

export async function loadAllEntries(userId: UserId): Promise<DailyEntry[]> {
  const [vaultEntries, prototypeEntries] = await Promise.all([
    loadVaultEntries(userId),
    readPrototypeEntries(userId),
  ]);
  return [...vaultEntries, ...prototypeEntries].sort((a, b) => {
    const dateCompare = a.localDate.localeCompare(b.localDate);
    if (dateCompare !== 0) return dateCompare;
    return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
  });
}

function summarize(entries: DailyEntry[]): UserSummary {
  const weights = entries.filter((entry) => entry.weightKg !== null);
  const first = weights[0] ?? null;
  const latest = weights.at(-1) ?? null;
  const minimum = weights.reduce<DailyEntry | null>((best, entry) => {
    if (!best || (entry.weightKg ?? Infinity) < (best.weightKg ?? Infinity)) return entry;
    return best;
  }, null);

  return {
    firstWeight: first?.weightKg ?? null,
    latestWeight: latest?.weightKg ?? null,
    minimumWeight: minimum?.weightKg ?? null,
    netChange:
      first?.weightKg !== null && first?.weightKg !== undefined && latest?.weightKg !== null && latest?.weightKg !== undefined
        ? Number((latest.weightKg - first.weightKg).toFixed(2))
        : null,
    firstWeightDate: first?.localDate ?? null,
    latestWeightDate: latest?.localDate ?? null,
    minimumWeightDate: minimum?.localDate ?? null,
    recordCount: entries.length,
    weightCount: weights.length,
    dataCutoff: entries.at(-1)?.localDate ?? null,
  };
}

export async function getRecords(userId: UserId): Promise<RecordsResponse> {
  const [users, entries] = await Promise.all([listUsers(), loadAllEntries(userId)]);
  const user = users.find((item) => item.userId === userId)!;
  const summary = summarize(entries);
  return {
    user: { ...user, dataCutoff: summary.dataCutoff ?? user.dataCutoff },
    summary,
    entries,
    weights: entries
      .filter((entry): entry is DailyEntry & { weightKg: number } => entry.weightKg !== null)
      .map((entry) => ({ date: entry.localDate, value: entry.weightKg })),
  };
}

export async function getReview(userId: UserId): Promise<ReviewResponse> {
  if (userId.startsWith("USR-APP-")) return {
    cycleId: null, actionId: null, followUpDue: null, actionAcceptedAt: null,
    conclusion: "先记录自己的饮食、体重和训练，再与教练商量调整。", introduction: "新账号先从一次真实记录开始。",
    keep: [], obstacles: [], action: "记录今天的实际情况，有疑问就发给 YC。", adjustmentConditions: [],
    sourceIds: [], dataCutoff: null, status: "collecting",
  };
  const cyclePath = await latestMarkdownFile(USER_CONFIG[userId].cycleDirectory);
  const content = await readFile(cyclePath, "utf8");
  const facts = extractBullets(extractSection(content, "已知事实与判断"));
  const keep = extractBullets(extractSection(content, "建议保留")).slice(0, 3);
  const actionHeading = [...content.matchAll(/^## (ACT-[^\r\n]+)/gm)].at(0)?.[1] ?? "";
  const actionSection = actionHeading ? extractSection(content, actionHeading) : "";
  const action =
    extractBullets(actionSection).find((line) => line.length > 25 && !line.startsWith("行动名称")) ??
    extractBullets(actionSection)[0] ??
    "本轮行动待确认";
  const adjustmentSection = extractSection(content, "调整与停止条件");
  const adjustmentText = stripKnowledgeMarkup(adjustmentSection);
  const adjustmentConditions = adjustmentText
    .split(/[；。]\s*/)
    .map((item) => item.trim().replace(/^[-–—>\s]+/, ""))
    .filter((item) => item.length >= 8)
    .slice(0, 3);

  const conclusion =
    (userId === "USR-SELF-001"
      ? facts.find((item) => item.includes("长期减重成果"))
      : facts.find((item) => item.includes("整体持平"))) ??
    facts.find((item) => item.includes("当前优先问题")) ??
    facts[0] ??
    "当前资料不足，需要继续记录。";

  const obstacles = facts
    .filter((item) => item !== conclusion)
    .filter((item) => /当前优先问题|信息不足|记录不足|记录较少|缺少|不能作等量比较|值得优先观察/.test(item))
    .sort((left, right) => Number(/当前优先问题/.test(right)) - Number(/当前优先问题/.test(left)))
    .slice(0, 3);

  const methodCardIds = [...content.matchAll(/^\s+- (MC-WT-\d+)/gm)].map((match) => match[1]);
  const publicEvidenceIds = extractSourceIds(`${actionSection}\n${adjustmentSection}`).filter((id) =>
    id.startsWith("EVID-"),
  );
  const profile = await readFile(USER_CONFIG[userId].profilePath, "utf8");

  return {
    cycleId: parseFrontmatterValue(content, "cycle_id"),
    actionId:
      userId === "USR-DEMO-001"
        ? "ACT-ZLS-PROTOTYPE-20260916-001"
        : parseFrontmatterValue(content, "action_ids") ?? content.match(/^\s+-\s+(ACT-[A-Z0-9-]+)/m)?.[1] ?? null,
    followUpDue: parseFrontmatterValue(content, "follow_up_due"),
    actionAcceptedAt: null,
    conclusion,
    introduction:
      userId === "USR-SELF-001"
        ? "从年初至今，长期变化仍然清楚；近期记录较少，本轮先恢复可比较的数据，再决定是否调整饮食或活动。"
        : "两个完整周的均重接近。最近记录里鲜肉月饼和饼类多次在同一天重复出现；与其重做整套饮食，下周只处理这个重复叠加点。",
    keep,
    obstacles,
    action: userId === "USR-DEMO-001" ? ZHANG_PROTOTYPE_ACTION : action,
    adjustmentConditions,
    sourceIds:
      userId === "USR-DEMO-001"
        ? ZHANG_PROTOTYPE_ACTION_SOURCES
        : [...new Set([...methodCardIds, ...publicEvidenceIds])],
    dataCutoff: parseFrontmatterValue(content, "data_cutoff") ?? parseFrontmatterValue(profile, "data_cutoff"),
    status: parseFrontmatterValue(content, "status") ?? "proposed",
  };
}

export async function getCoachFeedbackHistory(
  userId: UserId,
): Promise<CoachFeedbackHistoryItem[]> {
  if (userId.startsWith("USR-APP-")) return (await inheritedHistory(userId)).feedback;
  const directory = USER_CONFIG[userId].coachFeedbackDirectory;
  let files: string[];
  try {
    files = (await readdir(directory)).filter((name) => name.endsWith(".md")).sort().reverse();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const groups = await Promise.all(
    files.map(async (file) =>
      parseCoachFeedbackTable(await readFile(path.join(directory, file), "utf8"), userId),
    ),
  );
  const compiled = groups.flat();
  if (userId !== "USR-DEMO-001" || !compiled.length) return compiled;

  const entries = await loadVaultEntries(userId);
  const eventById = new Map(entries.map((entry) => [entry.sourceId, entry]));
  const coachAlias = compiled[0]?.coachAlias ?? "YC";
  const recordedAt = compiled[0]?.recordedAt ?? "2026-09-17T18:16:00+08:00";
  return ZHANG_TIMELINE_BLUEPRINTS.flatMap((item, index) => {
    const event = eventById.get(item.sourceId);
    if (!event) return [];
    return [{
      feedbackId: `FDB-ZLS-TIMELINE-${String(index + 1).padStart(2, "0")}`,
      userId,
      coachAlias,
      recordedAt,
      linkedDate: event.localDate,
      stage: item.stage,
      coachMessage: item.coachMessage,
      observedChange: item.observation,
      verificationStatus: "prototype-linked",
      sourceIds: ["OWNER-ZLS-20260917-001", item.sourceId],
    }];
  });
}

export interface KnowledgeCardContext {
  methodCardId: string;
  title: string;
  content: string;
  sourceIds: string[];
}

export async function loadKnowledgeCards(ids: string[]): Promise<KnowledgeCardContext[]> {
  const directory = path.join(VAULT_ROOT, "wiki", "method-cards");
  const files = await readdir(directory);
  const results: KnowledgeCardContext[] = [];
  for (const id of ids) {
    const file = files.find((name) => name.startsWith(`${id}--`) && name.endsWith(".md"));
    if (!file) continue;
    const content = await readFile(path.join(directory, file), "utf8");
    const title = content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? id;
    results.push({
      methodCardId: id,
      title,
      content: stripKnowledgeMarkup(content.replace(/^---[\s\S]*?---/, "")).slice(0, 2400),
      sourceIds: extractSourceIds(content),
    });
  }
  return results;
}
