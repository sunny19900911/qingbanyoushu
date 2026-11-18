import type { InBodyMeasurement } from "../../shared/types";

type MetricKey = "weightKg" | "bodyFatMassKg" | "skeletalMuscleKg" | "totalBodyWater";

const SERIES: Array<{ key: MetricKey; label: string; unit: string; color: string; fill: string }> = [
  { key: "weightKg", label: "体重", unit: "kg", color: "#08763f", fill: "#e5f4eb" },
  { key: "bodyFatMassKg", label: "体脂肪量", unit: "kg", color: "#db861d", fill: "#fff2df" },
  { key: "skeletalMuscleKg", label: "骨骼肌量", unit: "kg", color: "#3c7fc4", fill: "#eaf3fc" },
  { key: "totalBodyWater", label: "身体总水分", unit: "kg / L", color: "#7559c7", fill: "#f0edfb" },
];

function formatDate(date: string): string {
  return date.slice(5).replace("-", "/");
}

function MetricChart({
  measurements,
  metric,
}: {
  measurements: InBodyMeasurement[];
  metric: (typeof SERIES)[number];
}) {
  const width = 320;
  const height = 174;
  const margin = { top: 34, right: 22, bottom: 30, left: 34 };
  const values = measurements.map((measurement) => measurement[metric.key]);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const padding = Math.max(metric.key === "weightKg" ? 2 : 0.8, (rawMax - rawMin) * 0.3);
  const min = rawMin - padding;
  const max = rawMax + padding;
  const xSpan = width - margin.left - margin.right;
  const ySpan = height - margin.top - margin.bottom;
  const points = values.map((value, index) => ({
    value,
    x: margin.left + (index / Math.max(1, values.length - 1)) * xSpan,
    y: margin.top + ((max - value) / Math.max(1, max - min)) * ySpan,
  }));
  const line = points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  const area = `${line} L${points.at(-1)!.x},${height - margin.bottom} L${points[0].x},${height - margin.bottom} Z`;

  return (
    <figure className="inbody-metric-chart">
      <figcaption>
        <strong>{metric.label}</strong>
        <span>{metric.unit}</span>
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${metric.label}三次测量趋势`}>
        <defs>
          <linearGradient id={`metric-fill-${metric.key}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={metric.fill} stopOpacity="0.95" />
            <stop offset="1" stopColor={metric.fill} stopOpacity="0.2" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((ratio) => {
          const y = margin.top + ratio * ySpan;
          return <line className="inbody-chart-grid" key={ratio} x1={margin.left} x2={width - margin.right} y1={y} y2={y} />;
        })}
        <path d={area} fill={`url(#metric-fill-${metric.key})`} />
        <path d={line} fill="none" stroke={metric.color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        {points.map((point, index) => (
          <g key={measurements[index].date}>
            <circle cx={point.x} cy={point.y} fill="#fff" r="5.5" stroke={metric.color} strokeWidth="3" />
            <text className="inbody-chart-value" x={point.x} y={Math.max(17, point.y - 12)} textAnchor="middle">
              {point.value.toFixed(1)}
            </text>
            <text className="inbody-chart-date" x={point.x} y={height - 8} textAnchor="middle">
              {formatDate(measurements[index].date)}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  );
}

export function InBodyTrendChart({ measurements }: { measurements: InBodyMeasurement[] }) {
  return (
    <div className="inbody-chart-grid-layout">
      {SERIES.map((metric) => <MetricChart key={metric.key} measurements={measurements} metric={metric} />)}
    </div>
  );
}
