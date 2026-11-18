import type { DailyEntry } from "../../shared/types";

export interface NutritionEstimate {
  score: number;
  vegetables: number;
  carbs: number;
  protein: number;
}

export interface ExerciseEstimate {
  aerobicMinutes: number;
  anaerobicMinutes: number;
  totalMinutes: number;
}

const VEGETABLE_WORDS = [
  "青菜", "蔬菜", "生菜", "菠菜", "卷心菜", "卷芯菜", "黄瓜", "番茄", "西红柿", "莴笋",
  "蘑菇", "豆角", "刀豆", "茄子", "西兰花", "花菜", "白菜", "芹菜", "萝卜", "沙拉",
];

const CARB_WORDS = [
  "米饭", "白米", "紫米", "面包", "面条", "米线", "泡面", "粥", "玉米", "紫薯", "红薯",
  "地瓜", "土豆", "蒸饺", "饺子", "馒头", "包子", "手抓饼", "葱油饼", "月饼", "燕麦",
];

const PROTEIN_WORDS = [
  "鸡蛋", "蛋羹", "牛肉", "鸡肉", "猪肉", "红烧肉", "鱼", "虾", "蛤蜊", "豆浆", "牛奶",
  "豆腐", "百叶", "花生", "坚果", "禽", "肉",
];

const ANAEROBIC_WORDS = /力量|无氧|壶铃|哑铃|卧推|胸推|高位下拉|深蹲|硬拉|农夫行走|抗扭转|肌肉|撸铁|训练/;

function countWords(text: string, words: string[]): number {
  return words.reduce((total, word) => total + text.split(word).length - 1, 0);
}

function scoreFromRaw(value: string | null): number | null {
  const match = value?.match(/(?:^|[^\d])(10|[0-9](?:\.\d)?)(?:[^\d]|$)/);
  if (!match) return null;
  const score = Number(match[1]);
  return score >= 0 && score <= 10 ? score : null;
}

function fallbackSplit(score: number): Pick<NutritionEstimate, "vegetables" | "carbs" | "protein"> {
  if (score >= 8.5) return { vegetables: 48, carbs: 27, protein: 25 };
  if (score >= 7) return { vegetables: 38, carbs: 37, protein: 25 };
  return { vegetables: 30, carbs: 45, protein: 25 };
}

export function estimateNutrition(entry: DailyEntry): NutritionEstimate | null {
  const text = `${entry.dietText ?? ""} ${entry.dietScoreRaw ?? ""}`.trim();
  if (!text) return null;

  const vegetablesCount = countWords(text, VEGETABLE_WORDS);
  const carbsCount = countWords(text, CARB_WORDS);
  const proteinCount = countWords(text, PROTEIN_WORDS);
  const total = vegetablesCount + carbsCount + proteinCount;
  const recordedScore = scoreFromRaw(entry.dietScoreRaw);

  if (!total) {
    const score = recordedScore ?? 6;
    return { score, ...fallbackSplit(score) };
  }

  const vegetables = Math.round((vegetablesCount / total) * 100);
  const carbs = Math.round((carbsCount / total) * 100);
  const protein = Math.max(0, 100 - vegetables - carbs);
  const deviation = Math.abs(vegetables - 50) + Math.abs(carbs - 25) + Math.abs(protein - 25);
  const score = recordedScore ?? Math.max(0, Math.min(10, Number((10 - deviation / 12).toFixed(1))));
  return { score, vegetables, carbs, protein };
}

export function estimateExercise(activityText: string | null): ExerciseEstimate {
  if (!activityText) return { aerobicMinutes: 0, anaerobicMinutes: 0, totalMinutes: 0 };
  let aerobicMinutes = 0;
  let anaerobicMinutes = 0;
  const matches = activityText.matchAll(/([^，,；;。]{0,24}?)(\d+(?:\.\d+)?)\s*分钟/g);

  for (const match of matches) {
    const minutes = Number(match[2]);
    if (!Number.isFinite(minutes)) continue;
    if (ANAEROBIC_WORDS.test(match[1])) anaerobicMinutes += minutes;
    else aerobicMinutes += minutes;
  }

  return { aerobicMinutes, anaerobicMinutes, totalMinutes: aerobicMinutes + anaerobicMinutes };
}

export function exerciseScore(activityText: string | null): number | null {
  const { totalMinutes } = estimateExercise(activityText);
  if (totalMinutes <= 0) return null;
  return Number(Math.min(10, (totalMinutes / 60) * 10).toFixed(1));
}

export function selectInsightEntry(entries: DailyEntry[]): DailyEntry | null {
  const reversed = [...entries].reverse();
  return (
    reversed.find((entry) => estimateNutrition(entry) && estimateExercise(entry.activityText).totalMinutes > 0) ??
    reversed.find((entry) => estimateNutrition(entry)) ??
    reversed.find((entry) => estimateExercise(entry.activityText).totalMinutes > 0) ??
    reversed[0] ??
    null
  );
}
