import type { WeightPoint } from "../../shared/types";

interface ChartPoint extends WeightPoint {
  x: number;
  y: number;
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(
    new Date(`${date}T00:00:00+08:00`),
  );
}

export function ScoreChart({
  points,
  label,
  tone,
}: {
  points: WeightPoint[];
  label: string;
  tone: "health" | "exercise";
}) {
  const width = 348;
  const height = 238;
  const margin = { top: 24, right: 18, bottom: 34, left: 34 };

  if (!points.length) {
    return <div className="chart-empty">这个时间段还没有可评分的记录</div>;
  }

  const xSpan = width - margin.left - margin.right;
  const ySpan = height - margin.top - margin.bottom;
  const normalized: ChartPoint[] = points.map((point, index) => ({
    ...point,
    x: margin.left + (points.length === 1 ? xSpan / 2 : (index / (points.length - 1)) * xSpan),
    y: margin.top + ((10 - point.value) / 10) * ySpan,
  }));
  const path = normalized.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `${path} L${normalized.at(-1)!.x},${height - margin.bottom} L${normalized[0].x},${height - margin.bottom} Z`;
  const labelIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  const highlightIndexes = [...new Set([0, points.length - 1])];

  return (
    <svg className={`weight-chart score-chart score-chart--${tone}`} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label}趋势图`}>
      <title>{label}趋势</title>
      {[10, 7.5, 5, 2.5, 0].map((tick) => {
        const y = margin.top + ((10 - tick) / 10) * ySpan;
        return (
          <g key={tick}>
            <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} className="chart-grid" />
            <text x={margin.left - 8} y={y + 4} textAnchor="end" className="chart-axis">
              {tick.toFixed(tick % 1 === 0 ? 0 : 1)}
            </text>
          </g>
        );
      })}
      <path d={area} className="chart-area" />
      <path d={path} className="chart-line" />
      {normalized.map((point, index) => (
        <circle key={`${point.date}-${index}`} cx={point.x} cy={point.y} r={index === normalized.length - 1 ? 4.5 : 2.5} className="chart-dot" />
      ))}
      {highlightIndexes.map((index) => {
        const point = normalized[index];
        const anchor = index === 0 ? "start" : "end";
        return (
          <text key={`value-${index}`} x={point.x} y={Math.max(14, point.y - 10)} textAnchor={anchor} className="chart-value">
            {point.value.toFixed(1)}
          </text>
        );
      })}
      {labelIndexes.map((index) => {
        const point = normalized[index];
        const anchor = index === 0 ? "start" : index === points.length - 1 ? "end" : "middle";
        return (
          <text key={`date-${index}`} x={point.x} y={height - 10} textAnchor={anchor} className="chart-axis chart-date">
            {formatDate(point.date)}
          </text>
        );
      })}
    </svg>
  );
}
