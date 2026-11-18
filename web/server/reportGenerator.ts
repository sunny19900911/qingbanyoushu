import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import { Resvg } from "@resvg/resvg-js";
import type {
  CoachFeedbackHistoryItem,
  DailyEntry,
  RecordsResponse,
  ReviewResponse,
} from "../shared/types.js";
import { estimateExercise, estimateNutrition, exerciseScore } from "../src/lib/dailyInsights.js";

export type ReportPeriod = "7" | "30" | "all";

interface ReportDay {
  date: string;
  entry: DailyEntry | null;
  weightKg: number | null;
  healthScore: number | null;
  exerciseScore: number | null;
}

const GREEN = "147A46";
const DARK_GREEN = "0F633A";
const LIGHT_GREEN = "EAF5EE";
const ORANGE = "E58B35";
const PURPLE = "7559B6";
const TEXT = "26332C";
const MUTED = "68756E";
const BORDER = "D9E2DC";

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${date}T00:00:00+08:00`));
}

function reportDays(entries: DailyEntry[], period: ReportPeriod): ReportDay[] {
  if (!entries.length) return [];
  const byDate = new Map(entries.map((entry) => [entry.localDate, entry]));
  const sortedDates = [...byDate.keys()].sort();
  const end = sortedDates.at(-1)!;
  const dates = period === "all"
    ? sortedDates
    : Array.from({ length: Number(period) }, (_, index) => addDays(end, index - Number(period) + 1));
  return dates.map((date) => {
    const entry = byDate.get(date) ?? null;
    const nutrition = entry ? estimateNutrition(entry) : null;
    return {
      date,
      entry,
      weightKg: entry?.weightKg ?? null,
      healthScore: nutrition?.score ?? null,
      exerciseScore: entry ? exerciseScore(entry.activityText) : null,
    };
  });
}

function average(values: Array<number | null>): number | null {
  const actual = values.filter((value): value is number => value !== null);
  return actual.length ? Number((actual.reduce((sum, value) => sum + value, 0) / actual.length).toFixed(1)) : null;
}

function xmlEscape(value: string): string {
  return value.replace(/[<>&'"]/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;",
  })[character]!);
}

function makePath(
  days: ReportDay[],
  xAt: (index: number) => number,
  valueAt: (day: ReportDay) => number | null,
  yAt: (value: number) => number,
): string {
  let drawing = false;
  return days.map((day, index) => {
    const value = valueAt(day);
    if (value === null) {
      drawing = false;
      return "";
    }
    const command = drawing ? "L" : "M";
    drawing = true;
    return `${command}${xAt(index).toFixed(1)},${yAt(value).toFixed(1)}`;
  }).filter(Boolean).join(" ");
}

async function trendChartPng(days: ReportDay[], periodLabel: string): Promise<Buffer> {
  const width = 1200;
  const height = 590;
  const margin = { top: 105, right: 100, bottom: 75, left: 105 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const weights = days.flatMap((day) => day.weightKg === null ? [] : [day.weightKg]);
  const rawMin = weights.length ? Math.min(...weights) : 0;
  const rawMax = weights.length ? Math.max(...weights) : 1;
  const padding = Math.max(0.5, (rawMax - rawMin) * 0.12);
  const weightMin = Math.floor((rawMin - padding) * 2) / 2;
  const weightMax = Math.ceil((rawMax + padding) * 2) / 2 || weightMin + 1;
  const xAt = (index: number) => margin.left + (days.length <= 1 ? plotWidth / 2 : (index / (days.length - 1)) * plotWidth);
  const weightY = (value: number) => margin.top + ((weightMax - value) / Math.max(0.5, weightMax - weightMin)) * plotHeight;
  const scoreY = (value: number) => margin.top + ((100 - value * 10) / 100) * plotHeight;
  const weightPath = makePath(days, xAt, (day) => day.weightKg, weightY);
  const healthPath = makePath(days, xAt, (day) => day.healthScore, scoreY);
  const exercisePath = makePath(days, xAt, (day) => day.exerciseScore, scoreY);
  const grid = [0, 25, 50, 75, 100].map((tick) => {
    const y = margin.top + ((100 - tick) / 100) * plotHeight;
    return `<line x1="${margin.left}" x2="${width - margin.right}" y1="${y}" y2="${y}" stroke="#E6ECE8" stroke-width="1"/><text x="${width - margin.right + 16}" y="${y + 7}" font-size="20" fill="#6F7A74">${tick}%</text>`;
  }).join("");
  const weightTicks = Array.from({ length: 4 }, (_, index) => weightMax - ((weightMax - weightMin) * index) / 3)
    .map((tick) => {
      const y = weightY(tick);
      return `<text x="${margin.left - 18}" y="${y + 7}" text-anchor="end" font-size="20" fill="#6F7A74">${tick.toFixed(1)}</text>`;
    }).join("");
  const dateIndexes = [...new Set([0, Math.floor((days.length - 1) / 2), days.length - 1])];
  const dates = dateIndexes.map((index) => `<text x="${xAt(index)}" y="${height - 24}" text-anchor="${index === 0 ? "start" : index === days.length - 1 ? "end" : "middle"}" font-size="20" fill="#6F7A74">${xmlEscape(days[index].date.slice(5).replace("-", "/"))}</text>`).join("");
  const weightMarkers = days.map((day, index) => day.weightKg === null ? "" : `<circle cx="${xAt(index)}" cy="${weightY(day.weightKg)}" r="6" fill="#FFFFFF" stroke="#${GREEN}" stroke-width="4"/>`).join("");
  const healthMarkers = days.map((day, index) => day.healthScore === null ? "" : `<rect x="${xAt(index) - 6}" y="${scoreY(day.healthScore) - 6}" width="12" height="12" fill="#FFF7ED" stroke="#${ORANGE}" stroke-width="3"/>`).join("");
  const exerciseMarkers = days.map((day, index) => {
    if (day.exerciseScore === null) return "";
    const x = xAt(index);
    const y = scoreY(day.exerciseScore);
    return `<polygon points="${x},${y - 8} ${x - 8},${y + 6} ${x + 8},${y + 6}" fill="#F4F0FF" stroke="#${PURPLE}" stroke-width="3"/>`;
  }).join("");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="#FFFFFF"/>
      <text x="${margin.left}" y="42" font-family="Microsoft YaHei, sans-serif" font-size="28" font-weight="700" fill="#${TEXT}">${xmlEscape(periodLabel)}长期趋势总览</text>
      <g font-family="Microsoft YaHei, sans-serif">
        <line x1="575" x2="620" y1="34" y2="34" stroke="#${GREEN}" stroke-width="5"/><text x="633" y="42" font-size="20" fill="#${MUTED}">体重 kg 左轴</text>
        <line x1="786" x2="831" y1="34" y2="34" stroke="#${ORANGE}" stroke-width="5" stroke-dasharray="12 8"/><text x="844" y="42" font-size="20" fill="#${MUTED}">健康达成度</text>
        <line x1="1002" x2="1047" y1="34" y2="34" stroke="#${PURPLE}" stroke-width="5" stroke-dasharray="4 8"/><text x="1060" y="42" font-size="20" fill="#${MUTED}">运动达成度</text>
        <text x="${margin.left}" y="82" font-size="21" font-weight="700" fill="#${MUTED}">体重 kg</text>
        <text x="${width - margin.right}" y="82" text-anchor="end" font-size="21" font-weight="700" fill="#${MUTED}">达成度</text>
        ${grid}${weightTicks}
        <path d="${weightPath}" fill="none" stroke="#${GREEN}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="${healthPath}" fill="none" stroke="#${ORANGE}" stroke-width="5" stroke-dasharray="12 8" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="${exercisePath}" fill="none" stroke="#${PURPLE}" stroke-width="5" stroke-dasharray="4 8" stroke-linecap="round" stroke-linejoin="round"/>
        ${weightMarkers}${healthMarkers}${exerciseMarkers}${dates}
      </g>
    </svg>`;
  return Buffer.from(new Resvg(svg, {
    background: "#FFFFFF",
    fitTo: { mode: "width", value: width },
  }).render().asPng());
}

function textParagraph(text: string, options?: { bold?: boolean; color?: string; size?: number; spacingAfter?: number }) {
  return new Paragraph({
    spacing: { after: options?.spacingAfter ?? 130, line: 340 },
    children: [new TextRun({
      text,
      bold: options?.bold,
      color: options?.color ?? TEXT,
      size: options?.size ?? 21,
      font: "Microsoft YaHei",
    })],
  });
}

function bullet(text: string, color = TEXT) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 80, line: 320 },
    children: [new TextRun({ text, color, size: 20, font: "Microsoft YaHei" })],
  });
}

function heading(text: string, level: typeof HeadingLevel.HEADING_1 | typeof HeadingLevel.HEADING_2) {
  return new Paragraph({
    heading: level,
    keepNext: true,
    spacing: { before: level === HeadingLevel.HEADING_1 ? 280 : 180, after: 120 },
    children: [new TextRun({ text, bold: true, color: "000000", font: "Microsoft YaHei" })],
  });
}

function tableCell(text: string, header = false, width?: number) {
  return new TableCell({
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    shading: header ? { fill: DARK_GREEN, type: ShadingType.CLEAR } : undefined,
    margins: { top: 120, bottom: 120, left: 130, right: 130 },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({
        text,
        bold: header,
        color: header ? "FFFFFF" : TEXT,
        size: header ? 19 : 20,
        font: "Microsoft YaHei",
      })],
    })],
  });
}

function sourceIds(days: ReportDay[], review: ReviewResponse, feedback: CoachFeedbackHistoryItem[]): string[] {
  return [...new Set([
    ...days.flatMap((day) => day.entry?.sourceId ? [day.entry.sourceId] : []),
    ...review.sourceIds,
    ...feedback.flatMap((item) => item.sourceIds),
  ])];
}

export async function generateWellnessReport(input: {
  records: RecordsResponse;
  review: ReviewResponse;
  feedback: CoachFeedbackHistoryItem[];
  period: ReportPeriod;
}): Promise<{ buffer: Buffer; filename: string }> {
  const days = reportDays(input.records.entries, input.period);
  const periodLabel = input.period === "all" ? "全部记录" : `近${input.period}天`;
  const validEntries = days.flatMap((day) => day.entry ? [day.entry] : []);
  const weightDays = days.filter((day): day is ReportDay & { weightKg: number } => day.weightKg !== null);
  const firstWeight = weightDays[0]?.weightKg ?? null;
  const latestWeight = weightDays.at(-1)?.weightKg ?? null;
  const weightChange = firstWeight !== null && latestWeight !== null ? Number((latestWeight - firstWeight).toFixed(1)) : null;
  const minimumWeight = weightDays.length ? Math.min(...weightDays.map((day) => day.weightKg)) : null;
  const healthAverage = average(days.map((day) => day.healthScore));
  const exerciseAverage = average(days.map((day) => day.exerciseScore));
  const exercise = validEntries.map((entry) => estimateExercise(entry.activityText));
  const aerobicMinutes = exercise.reduce((sum, item) => sum + item.aerobicMinutes, 0);
  const anaerobicMinutes = exercise.reduce((sum, item) => sum + item.anaerobicMinutes, 0);
  const fullExerciseDays = days.filter((day) => day.exerciseScore !== null && day.exerciseScore >= 10).length;
  const nutritions = validEntries.flatMap((entry) => {
    const nutrition = estimateNutrition(entry);
    return nutrition ? [nutrition] : [];
  });
  const vegetableAverage = average(nutritions.map((item) => item.vegetables));
  const carbAverage = average(nutritions.map((item) => item.carbs));
  const proteinAverage = average(nutritions.map((item) => item.protein));
  const chart = await trendChartPng(days, periodLabel);
  const ids = sourceIds(days, input.review, input.feedback);
  const weightStatement = weightChange === null
    ? "本阶段体重记录不足，暂时不能判断变化方向。"
    : Math.abs(weightChange) < 0.3
      ? `本阶段体重整体平稳，首末记录相差 ${Math.abs(weightChange).toFixed(1)} kg。`
      : weightChange < 0
        ? `本阶段体重整体下降 ${Math.abs(weightChange).toFixed(1)} kg。`
        : `本阶段体重上升 ${weightChange.toFixed(1)} kg，需要结合饮食、活动和短期水分波动继续观察。`;
  const conclusion = `${weightStatement}${healthAverage === null ? "" : `健康分平均 ${healthAverage.toFixed(1)} 分。`}${exerciseAverage === null ? "" : `运动分平均 ${exerciseAverage.toFixed(1)} 分。`}`;
  const recentFeedback = input.feedback
    .filter((item) => days.some((day) => day.date === item.linkedDate))
    .slice(-4);
  const representativeEntries = validEntries
    .filter((entry) => entry.weightKg !== null || entry.dietText || entry.activityText)
    .slice(-5)
    .reverse();
  const tableBorders = {
    top: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
    left: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
    right: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
    insideVertical: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
  } as const;
  const endDate = days.at(-1)?.date ?? input.records.summary.dataCutoff ?? new Date().toISOString().slice(0, 10);
  const startDate = days[0]?.date ?? endDate;

  const document = new Document({
    creator: "科学减重原型",
    title: `${input.records.user.displayAlias}${periodLabel}阶段复盘`,
    description: "体重 饮食 运动趋势与下一阶段行动",
    styles: {
      default: {
        document: {
          run: { font: "Microsoft YaHei", size: 21, color: TEXT },
          paragraph: { spacing: { line: 340, after: 120 } },
        },
        title: { run: { font: "Microsoft YaHei", size: 36, bold: true, color: "000000" } },
        heading1: { run: { font: "Microsoft YaHei", size: 27, bold: true, color: "000000" } },
        heading2: { run: { font: "Microsoft YaHei", size: 23, bold: true, color: "000000" } },
      },
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1040, right: 1040, bottom: 1000, left: 1040 },
        },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "示例学员阶段复盘  ·  ", color: MUTED, size: 17, font: "Microsoft YaHei" }),
              new TextRun({ children: [PageNumber.CURRENT], color: MUTED, size: 17, font: "Microsoft YaHei" }),
            ],
          })],
        }),
      },
      children: [
        new Paragraph({
          style: "Title",
          spacing: { after: 100 },
          children: [new TextRun({ text: `${input.records.user.displayAlias}阶段复盘与下阶段行动`, bold: true, color: "000000", font: "Microsoft YaHei" })],
        }),
        textParagraph(`${periodLabel}  ${formatDate(startDate)}至${formatDate(endDate)}`, { color: MUTED, size: 19, spacingAfter: 260 }),
        textParagraph("本报告用于帮助你看清当前变化、保留有效做法，并只选择一两项值得尝试的调整。重点不是评价自律，而是判断现有方案是否适合并能否持续。", { spacingAfter: 220 }),
        textParagraph(conclusion, { bold: true, color: GREEN, size: 24, spacingAfter: 260 }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: tableBorders,
          rows: [
            new TableRow({ children: ["起始体重", "当前体重", "阶段变化", "记录天数"].map((value) => tableCell(value, true)) }),
            new TableRow({ children: [
              tableCell(firstWeight === null ? "未记录" : `${firstWeight.toFixed(1)} kg`),
              tableCell(latestWeight === null ? "未记录" : `${latestWeight.toFixed(1)} kg`),
              tableCell(weightChange === null ? "—" : `${weightChange > 0 ? "+" : ""}${weightChange.toFixed(1)} kg`),
              tableCell(`${validEntries.length} 天`),
            ] }),
            new TableRow({ children: ["最低体重", "健康分均值", "运动分均值", "运动满分天数"].map((value) => tableCell(value, true)) }),
            new TableRow({ children: [
              tableCell(minimumWeight === null ? "未记录" : `${minimumWeight.toFixed(1)} kg`),
              tableCell(healthAverage === null ? "未记录" : `${healthAverage.toFixed(1)} / 10`),
              tableCell(exerciseAverage === null ? "未记录" : `${exerciseAverage.toFixed(1)} / 10`),
              tableCell(`${fullExerciseDays} 天`),
            ] }),
          ],
        }),
        heading("长期趋势总览", HeadingLevel.HEADING_1),
        new Paragraph({
          keepNext: true,
          spacing: { after: 70 },
          children: [new ImageRun({ data: chart, type: "png", transformation: { width: 635, height: 312 } })],
        }),
        textParagraph("体重使用左轴真实公斤数；健康与运动使用右轴达成度。悬殊量纲放在同一时间轴上便于观察，但曲线叠加不代表因果关系。", { color: MUTED, size: 18, spacingAfter: 180 }),
        heading("饮食与运动结构", HeadingLevel.HEADING_1),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: tableBorders,
          rows: [
            new TableRow({ children: ["观察项目", "本阶段结果", "阅读方式"].map((value) => tableCell(value, true)) }),
            new TableRow({ children: [
              tableCell("饮食构成"),
              tableCell(vegetableAverage === null ? "记录不足" : `蔬菜 ${vegetableAverage.toFixed(0)}%  碳水 ${carbAverage?.toFixed(0)}%  蛋白质 ${proteinAverage?.toFixed(0)}%`),
              tableCell("用于发现长期结构，不要求每一天完全一致"),
            ] }),
            new TableRow({ children: [
              tableCell("运动时间"),
              tableCell(`有氧 ${aerobicMinutes} 分钟  无氧 ${anaerobicMinutes} 分钟`),
              tableCell("单日总运动达到 60 分钟记为运动分 10 分"),
            ] }),
          ],
        }),
        heading("教练观察", HeadingLevel.HEADING_1),
        textParagraph(input.review.introduction || input.review.conclusion),
        ...(input.review.keep.length ? input.review.keep.slice(0, 2).map((item) => bullet(`值得保留：${item}`)) : [bullet("继续保留已经能够稳定做到的正餐和运动记录。")]),
        ...(recentFeedback.length
          ? recentFeedback.map((item) => bullet(`${formatDate(item.linkedDate)}  ${item.coachMessage}  对应记录：${item.observedChange}`))
          : [bullet("本阶段暂无与日期直接对应的教练反馈，后续根据实际记录继续补充。")]),
        heading("下一阶段行动", HeadingLevel.HEADING_1),
        textParagraph(input.review.action, { bold: true, color: GREEN, size: 23, spacingAfter: 180 }),
        textParagraph("回访时只确认三件事：是否愿意尝试、实际做了几天、最大的阻力是什么。根据真实反馈决定保留、简化或更换行动。", { color: DARK_GREEN, spacingAfter: 180 }),
        heading("最近代表性记录", HeadingLevel.HEADING_1),
        ...(representativeEntries.length ? [new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: tableBorders,
          rows: [
            new TableRow({ children: [tableCell("日期", true, 1500), tableCell("体重", true, 1200), tableCell("饮食与运动原始记录", true, 6000)] }),
            ...representativeEntries.map((entry) => new TableRow({ children: [
              tableCell(entry.localDate, false, 1500),
              tableCell(entry.weightKg === null ? "—" : `${entry.weightKg.toFixed(1)} kg`, false, 1200),
              tableCell([entry.dietText, entry.activityText].filter(Boolean).join("；") || "仅记录体重", false, 6000),
            ] })),
          ],
        })] : [textParagraph("本阶段没有可展示的代表性原始记录。", { color: MUTED })]),
        new Paragraph({ children: [new PageBreak()] }),
        heading("资料范围与来源", HeadingLevel.HEADING_1),
        textParagraph(`本报告版本为 prototype-1，数据范围为 ${startDate} 至 ${endDate}。健康分与运动分只在有记录的日期计算；缺失日期不按 0 分处理。`, { color: MUTED, size: 18 }),
        textParagraph(`来源标识：${ids.length ? ids.join("、") : "当前原型记录暂无 source_id"}`, { color: MUTED, size: 17 }),
        textParagraph("报告用于日常记录和教练回访，不替代医疗诊断。若出现疾病或用药影响、孕哺期、未成年人减重、疑似进食障碍或明显不适，应转由专业人员评估。", { color: MUTED, size: 17 }),
      ],
    }],
  });

  return {
    buffer: await Packer.toBuffer(document),
    filename: `${input.records.user.displayAlias}-${periodLabel}-阶段复盘-${endDate}.docx`,
  };
}
