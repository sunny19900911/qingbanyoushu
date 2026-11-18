import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download, Footprints, LoaderCircle, Utensils } from "lucide-react";
import type { AppUser, DailyEntry, RecordsResponse, UserId, WeightPoint } from "../../shared/types";
import { api } from "../api";
import { appUrl } from "../appUrl";
import { ScoreChart } from "../components/ScoreChart";
import { UserSwitcher } from "../components/UserSwitcher";
import { WeightChart } from "../components/WeightChart";
import { WellnessTrendOverview, type WellnessTrendPoint } from "../components/WellnessTrendOverview";
import { exerciseScore, estimateExercise, estimateNutrition } from "../lib/dailyInsights";

type TrendMode = "charts" | "raw";
type WeightPeriod = "7" | "30" | "all";
type TrendMetric = "weight" | "health" | "exercise";

const FOOD_COLORS = {
  vegetables: "#2eaa61",
  carbs: "#f39a3b",
  protein: "#4f91d8",
};

const EXERCISE_COLORS = {
  aerobic: "#2eaa61",
  anaerobic: "#8467c7",
};

function formatDay(date: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${date}T00:00:00+08:00`));
}

function waistValue(entry: DailyEntry): string | null {
  const match = entry.activityText?.match(/腰围\s*(\d+(?:\.\d+)?)\s*(?:cm|厘米)?/i);
  return match ? `${match[1]} cm` : null;
}

function recentCalendarDays(entries: DailyEntry[], length = 30): Array<{ date: string; entry: DailyEntry | null }> {
  const anchorDate = entries.at(-1)?.localDate;
  if (!anchorDate) return [];
  const byDate = new Map(entries.map((entry) => [entry.localDate, entry]));
  const anchor = new Date(`${anchorDate}T00:00:00Z`);
  return Array.from({ length }, (_, index) => {
    const date = new Date(anchor.getTime() - index * 86_400_000).toISOString().slice(0, 10);
    return { date, entry: byDate.get(date) ?? null };
  });
}

function pointsForPeriod(points: WeightPoint[], period: WeightPeriod): WeightPoint[] {
  if (period === "all" || points.length === 0) return points;
  const anchor = new Date(`${points.at(-1)!.date}T00:00:00Z`).getTime();
  const days = Number(period);
  return points.filter((point) => {
    const current = new Date(`${point.date}T00:00:00Z`).getTime();
    return anchor - current <= (days - 1) * 86_400_000;
  });
}

function overviewPointsForPeriod(entries: DailyEntry[], period: WeightPeriod): WellnessTrendPoint[] {
  if (!entries.length) return [];
  const byDate = new Map(entries.map((entry) => [entry.localDate, entry]));
  const sortedDates = [...byDate.keys()].sort();
  const lastDate = sortedDates.at(-1)!;
  let dates: string[];
  if (period === "all") {
    dates = sortedDates;
  } else {
    const days = Number(period);
    const anchor = new Date(`${lastDate}T00:00:00Z`);
    dates = Array.from({ length: days }, (_, index) =>
      new Date(anchor.getTime() - (days - 1 - index) * 86_400_000).toISOString().slice(0, 10),
    );
  }
  return dates.map((date) => {
    const entry = byDate.get(date) ?? null;
    const nutrition = entry ? estimateNutrition(entry) : null;
    return {
      date,
      weightKg: entry?.weightKg ?? null,
      healthScore: nutrition?.score ?? null,
      exerciseScore: entry ? exerciseScore(entry.activityText) : null,
    };
  });
}

function weightChange(points: WeightPoint[]): number | null {
  if (points.length < 2) return null;
  return Number((points.at(-1)!.value - points[0].value).toFixed(1));
}

function formatChange(value: number | null): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)} kg`;
}

function NutritionPie({ entry }: { entry: DailyEntry | null }) {
  const nutrition = entry ? estimateNutrition(entry) : null;
  if (!nutrition) {
    return <span className="trend-cell-empty">未记录</span>;
  }

  const vegetablesEnd = nutrition.vegetables;
  const carbsEnd = vegetablesEnd + nutrition.carbs;
  const background = `conic-gradient(${FOOD_COLORS.vegetables} 0 ${vegetablesEnd}%, ${FOOD_COLORS.carbs} ${vegetablesEnd}% ${carbsEnd}%, ${FOOD_COLORS.protein} ${carbsEnd}% 100%)`;

  return (
    <div className="mini-nutrition" aria-label={`健康分${nutrition.score.toFixed(1)}，蔬菜${nutrition.vegetables}%，碳水${nutrition.carbs}%，蛋白质${nutrition.protein}%`}>
      <span className="mini-nutrition__pie" style={{ background }} role="img" />
      <strong>{nutrition.score.toFixed(1)}分</strong>
    </div>
  );
}

function ExerciseBars({ entry }: { entry: DailyEntry | null }) {
  const exercise = estimateExercise(entry?.activityText ?? null);
  if (exercise.totalMinutes === 0) {
    return <span className="trend-cell-empty">{entry?.activityText ? "有记录" : "未记录"}</span>;
  }

  const items = [
    { label: "有氧", minutes: exercise.aerobicMinutes, color: EXERCISE_COLORS.aerobic },
    { label: "无氧", minutes: exercise.anaerobicMinutes, color: EXERCISE_COLORS.anaerobic },
  ];

  return (
    <div className="mini-exercise" aria-label={`有氧${exercise.aerobicMinutes}分钟，无氧${exercise.anaerobicMinutes}分钟`}>
      {items.map((item) => (
        <span className="mini-exercise__column" key={item.label}>
          <i className="mini-exercise__track">
            <b
              style={{
                background: item.color,
                height: `${item.minutes > 0 ? Math.min(100, Math.max(10, (item.minutes / 60) * 100)) : 0}%`,
              }}
            />
          </i>
          <small>{item.minutes}</small>
        </span>
      ))}
    </div>
  );
}

function TrendDayRow({ date, entry }: { date: string; entry: DailyEntry | null }) {
  return (
    <tr>
      <td className="trend-day-weight">
        <span>{formatDay(date)}</span>
        <strong>{entry?.weightKg !== null && entry?.weightKg !== undefined ? `${entry.weightKg} kg` : "未记录"}</strong>
      </td>
      <td><NutritionPie entry={entry} /></td>
      <td><ExerciseBars entry={entry} /></td>
    </tr>
  );
}

function RawRecord({ entry, expanded, onToggle }: { entry: DailyEntry; expanded: boolean; onToggle: () => void }) {
  const nutrition = estimateNutrition(entry);
  const exercise = estimateExercise(entry.activityText);
  const primaryValue = entry.weightKg !== null ? `${entry.weightKg} kg` : waistValue(entry) ?? "无体重";
  const dietText = entry.dietText ?? entry.dietScoreRaw ?? "当天没有填写饮食内容";
  const activityText = entry.activityText ?? "当天没有填写运动内容";

  return (
    <article className={expanded ? "raw-record is-expanded" : "raw-record"}>
      <button className="raw-record__toggle" type="button" onClick={onToggle} aria-expanded={expanded}>
        <span>{formatDay(entry.localDate)}</span>
        {expanded ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
      </button>
      <strong className="raw-record__primary">{primaryValue}</strong>
      <div className="raw-record__detail">
        <Utensils aria-hidden="true" />
        <div>
          <p>{dietText}</p>
          {nutrition ? (
            <div className="food-key food-key--small">
              <span><i style={{ background: FOOD_COLORS.vegetables }} />蔬菜</span>
              <span><i style={{ background: FOOD_COLORS.carbs }} />碳水</span>
              <span><i style={{ background: FOOD_COLORS.protein }} />蛋白质</span>
              <b>{nutrition.score.toFixed(1)}分</b>
            </div>
          ) : null}
        </div>
      </div>
      <div className="raw-record__detail">
        <Footprints aria-hidden="true" />
        <p>
          {activityText}
          {exercise.totalMinutes > 0 ? ` · 共${exercise.totalMinutes}分钟` : ""}
        </p>
      </div>
    </article>
  );
}

export function TrendPage({
  users,
  userId,
  onUserChange,
  refreshToken,
}: {
  users: AppUser[];
  userId: UserId;
  onUserChange: (userId: UserId) => void;
  refreshToken: number;
}) {
  const [mode, setMode] = useState<TrendMode>("charts");
  const [period, setPeriod] = useState<WeightPeriod>("30");
  const [metric, setMetric] = useState<TrendMetric>("weight");
  const [data, setData] = useState<RecordsResponse | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    api.records(userId).then(setData).catch((requestError) => setError(requestError.message));
  }, [userId, refreshToken]);

  const recentDays = useMemo(() => recentCalendarDays(data?.entries ?? [], 30), [data]);
  const overviewPoints = useMemo(
    () => overviewPointsForPeriod(data?.entries ?? [], period),
    [data, period],
  );
  const healthPoints = useMemo(
    () => (data?.entries ?? []).flatMap((entry) => {
      const nutrition = estimateNutrition(entry);
      return nutrition ? [{ date: entry.localDate, value: nutrition.score }] : [];
    }),
    [data],
  );
  const exercisePoints = useMemo(
    () => (data?.entries ?? []).flatMap((entry) => {
      const score = exerciseScore(entry.activityText);
      return score !== null ? [{ date: entry.localDate, value: score }] : [];
    }),
    [data],
  );
  const metricPoints = metric === "weight" ? data?.weights ?? [] : metric === "health" ? healthPoints : exercisePoints;
  const selectedPoints = useMemo(() => pointsForPeriod(metricPoints, period), [metricPoints, period]);
  const selectedChange = useMemo(() => weightChange(selectedPoints), [selectedPoints]);
  const selectedAverage = useMemo(
    () => selectedPoints.length
      ? Number((selectedPoints.reduce((total, point) => total + point.value, 0) / selectedPoints.length).toFixed(1))
      : null,
    [selectedPoints],
  );
  const selectedMinimum = useMemo(
    () => selectedPoints.length ? Math.min(...selectedPoints.map((point) => point.value)) : null,
    [selectedPoints],
  );
  const metricTitle = metric === "weight" ? "体重趋势（kg）" : metric === "health" ? "健康分趋势" : "运动分趋势";

  return (
    <section className="page trend-page trend-page--v2">
      <header className="page-header page-header--title">
        <h1>我的记录</h1>
        <UserSwitcher users={users} value={userId} onChange={onUserChange} />
      </header>

      <div className="trend-mode" role="group" aria-label="趋势显示方式">
        <button className={mode === "charts" ? "is-active" : ""} type="button" onClick={() => setMode("charts")}>图表分析</button>
        <button className={mode === "raw" ? "is-active" : ""} type="button" onClick={() => setMode("raw")}>原始记录</button>
      </div>

      {!data && !error ? <div className="page-loading"><LoaderCircle className="spin" />正在读取本机档案</div> : null}
      {error ? <p className="inline-error">{error}</p> : null}

      {data && mode === "charts" ? (
        <div className="trend-charts">
          <div className="period-control" role="group" aria-label="趋势时间范围">
            {(["7", "30", "all"] as const).map((value) => (
              <button
                className={period === value ? "is-active" : ""}
                key={value}
                type="button"
                onClick={() => setPeriod(value)}
              >
                {value === "all" ? "全部" : `${value}天`}
              </button>
            ))}
          </div>

          <a
            className="word-report-button"
            href={appUrl(`/api/users/${userId}/report.docx?period=${period}`)}
            download
          >
            <Download aria-hidden="true" />一键输出 Word 报告
          </a>

          {userId === "USR-DEMO-001" ? (
            <a className="inbody-entry-button" href={appUrl("inbody")}>
              查看 InBody 趋势报告 <ChevronRight aria-hidden="true" />
            </a>
          ) : null}

          <section className="wellness-overview-panel">
            <WellnessTrendOverview
              points={overviewPoints}
              periodLabel={period === "all" ? "全部记录" : `近${period}天`}
            />
          </section>

          <section className="weight-trend-panel">
            <div className="metric-tabs" role="group" aria-label="趋势指标">
              {([
                ["weight", "体重"],
                ["health", "健康分"],
                ["exercise", "运动分"],
              ] as const).map(([value, label]) => (
                <button className={metric === value ? "is-active" : ""} key={value} type="button" onClick={() => setMetric(value)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="chart-heading">
              <span>{metricTitle}</span>
              {metric === "weight" ? (
                <span>区间变化 <strong className={selectedChange !== null && selectedChange > 0 ? "is-increase" : ""}>{formatChange(selectedChange)}</strong></span>
              ) : (
                <span>平均 <strong>{selectedAverage !== null ? `${selectedAverage.toFixed(1)}分` : "—"}</strong></span>
              )}
            </div>
            {metric === "weight" ? (
              <WeightChart points={selectedPoints} compact={period !== "all"} />
            ) : (
              <ScoreChart points={selectedPoints} label={metric === "health" ? "健康分" : "运动分"} tone={metric} />
            )}
            <div className="trend-chart-meta">
              <span>记录 {selectedPoints.length} 次</span>
              {metric === "weight" ? (
                <span>最低 {selectedMinimum !== null ? `${selectedMinimum} kg` : "—"}</span>
              ) : metric === "health" ? (
                <span>满分 10 分</span>
              ) : (
                <span>60 分钟 = 10 分</span>
              )}
            </div>
          </section>

          <section className="daily-trend-section">
            <div className="daily-trend-heading">
              <h2>近30天</h2>
              <div className="daily-trend-legend" aria-label="图表颜色说明">
                <span><i style={{ background: FOOD_COLORS.vegetables }} />蔬菜</span>
                <span><i style={{ background: FOOD_COLORS.carbs }} />碳水</span>
                <span><i style={{ background: FOOD_COLORS.protein }} />蛋白质</span>
              </div>
            </div>
            <div className="daily-trend-table-wrap">
              <table className="daily-trend-table">
                <thead>
                  <tr>
                    <th scope="col">体重</th>
                    <th scope="col">饮食 <small>健康分</small></th>
                    <th scope="col">
                      运动
                      <small className="exercise-column-key">
                        <i style={{ background: EXERCISE_COLORS.aerobic }} />有氧
                        <i style={{ background: EXERCISE_COLORS.anaerobic }} />无氧
                      </small>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentDays.map(({ date, entry }) => (
                    <TrendDayRow date={date} entry={entry} key={date} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}

      {data && mode === "raw" ? (
        <div className="raw-records" aria-label="近30天原始记录">
          {recentDays.map(({ date, entry }) => entry ? (
              <RawRecord
                key={entry.entryId}
                entry={entry}
                expanded={expandedId === entry.entryId}
                onToggle={() => setExpandedId((current) => current === entry.entryId ? null : entry.entryId)}
              />
            ) : (
              <article className="raw-record raw-record--empty" key={date}>
                <span>{formatDay(date)}</span>
                <p>当天没有留下记录</p>
              </article>
            ))}
          <p className="raw-records__end">已显示近30天记录</p>
        </div>
      ) : null}
    </section>
  );
}
