import { useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";

export interface WellnessTrendPoint {
  date: string;
  weightKg: number | null;
  healthScore: number | null;
  exerciseScore: number | null;
}

interface PositionedPoint extends WellnessTrendPoint {
  x: number;
  weightY: number | null;
  healthY: number | null;
  exerciseY: number | null;
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(
    new Date(`${date}T00:00:00+08:00`),
  );
}

function linePath(points: PositionedPoint[], key: "weightY" | "healthY" | "exerciseY"): string {
  let drawing = false;
  return points.map((point) => {
    const y = point[key];
    if (y === null) {
      drawing = false;
      return "";
    }
    const command = drawing ? "L" : "M";
    drawing = true;
    return `${command}${point.x.toFixed(1)},${y.toFixed(1)}`;
  }).filter(Boolean).join(" ");
}

function trianglePoints(x: number, y: number): string {
  return `${x},${y - 4} ${x - 4},${y + 3.5} ${x + 4},${y + 3.5}`;
}

export function WellnessTrendOverview({
  points,
  periodLabel,
}: {
  points: WellnessTrendPoint[];
  periodLabel: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, points.length - 1));
  const width = 360;
  const height = 262;
  const margin = { top: 42, right: 40, bottom: 38, left: 42 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const layout = useMemo(() => {
    const weights = points.flatMap((point) => point.weightKg === null ? [] : [point.weightKg]);
    const rawMin = weights.length ? Math.min(...weights) : 0;
    const rawMax = weights.length ? Math.max(...weights) : 1;
    const padding = Math.max(0.5, (rawMax - rawMin) * 0.12);
    const weightMin = Math.floor((rawMin - padding) * 2) / 2;
    const weightMax = Math.ceil((rawMax + padding) * 2) / 2 || weightMin + 1;
    const xAt = (index: number) => margin.left + (points.length <= 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
    const weightY = (value: number) => margin.top + ((weightMax - value) / Math.max(0.5, weightMax - weightMin)) * plotHeight;
    const scoreY = (score: number) => margin.top + ((100 - score * 10) / 100) * plotHeight;
    const positioned: PositionedPoint[] = points.map((point, index) => ({
      ...point,
      x: xAt(index),
      weightY: point.weightKg === null ? null : weightY(point.weightKg),
      healthY: point.healthScore === null ? null : scoreY(point.healthScore),
      exerciseY: point.exerciseScore === null ? null : scoreY(point.exerciseScore),
    }));
    return { positioned, weightMin, weightMax };
  }, [points, plotHeight, plotWidth]);

  if (!points.length) {
    return <div className="chart-empty">这个时间段还没有可绘制的数据</div>;
  }

  const safeIndex = Math.min(selectedIndex, points.length - 1);
  const selected = points[safeIndex];
  const weightTicks = Array.from({ length: 4 }, (_, index) =>
    layout.weightMax - ((layout.weightMax - layout.weightMin) * index) / 3,
  );
  const dateLabelIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];

  async function downloadPng() {
    const source = svgRef.current;
    if (!source) return;
    const clone = source.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", "720");
    clone.setAttribute("height", "524");
    const background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    background.setAttribute("width", "100%");
    background.setAttribute("height", "100%");
    background.setAttribute("fill", "#ffffff");
    clone.insertBefore(background, clone.firstChild);
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 720;
      canvas.height = 524;
      const context = canvas.getContext("2d");
      context?.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((png) => {
        if (!png) return;
        const downloadUrl = URL.createObjectURL(png);
        const anchor = document.createElement("a");
        anchor.href = downloadUrl;
        anchor.download = `${periodLabel}-健康趋势.png`;
        anchor.click();
        URL.revokeObjectURL(downloadUrl);
      }, "image/png");
    };
    image.src = url;
  }

  return (
    <div className="wellness-overview">
      <div className="wellness-overview__heading">
        <div>
          <span>长期趋势总览</span>
          <small>体重下降、健康与运动达成度上升，表示向当前目标方向移动</small>
        </div>
        <button type="button" onClick={() => void downloadPng()}>
          <Download aria-hidden="true" />导出 PNG
        </button>
      </div>
      <div className="wellness-legend" aria-label="趋势图图例">
        <span><i className="is-weight" />体重 kg 左轴</span>
        <span><i className="is-health" />健康达成度 右轴</span>
        <span><i className="is-exercise" />运动达成度 右轴</span>
      </div>
      <svg
        ref={svgRef}
        className="wellness-trend-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-labelledby="wellness-chart-title wellness-chart-description"
      >
        <title id="wellness-chart-title">{periodLabel}体重健康和运动趋势</title>
        <desc id="wellness-chart-description">左轴显示实际体重，右轴显示健康和运动达成度。曲线叠加不表示因果关系。</desc>
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = margin.top + ((100 - tick) / 100) * plotHeight;
          return (
            <g key={`score-${tick}`}>
              <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} className="overview-grid" />
              <text x={width - margin.right + 6} y={y + 4} className="overview-axis overview-axis--right">{tick}%</text>
            </g>
          );
        })}
        {weightTicks.map((tick) => {
          const y = margin.top + ((layout.weightMax - tick) / Math.max(0.5, layout.weightMax - layout.weightMin)) * plotHeight;
          return <text key={`weight-${tick}`} x={margin.left - 7} y={y + 4} textAnchor="end" className="overview-axis">{tick.toFixed(1)}</text>;
        })}
        <text x={margin.left} y={18} className="overview-axis-title">体重 kg</text>
        <text x={width - margin.right} y={18} textAnchor="end" className="overview-axis-title">达成度</text>
        <path d={linePath(layout.positioned, "weightY")} className="overview-line overview-line--weight" />
        <path d={linePath(layout.positioned, "healthY")} className="overview-line overview-line--health" />
        <path d={linePath(layout.positioned, "exerciseY")} className="overview-line overview-line--exercise" />
        {layout.positioned.map((point, index) => (
          <g key={point.date} onMouseEnter={() => setSelectedIndex(index)}>
            {point.weightY !== null ? <circle cx={point.x} cy={point.weightY} r="3.2" className="overview-marker overview-marker--weight" /> : null}
            {point.healthY !== null ? <rect x={point.x - 3.2} y={point.healthY - 3.2} width="6.4" height="6.4" className="overview-marker overview-marker--health" /> : null}
            {point.exerciseY !== null ? <polygon points={trianglePoints(point.x, point.exerciseY)} className="overview-marker overview-marker--exercise" /> : null}
          </g>
        ))}
        <line
          x1={layout.positioned[safeIndex].x}
          x2={layout.positioned[safeIndex].x}
          y1={margin.top}
          y2={height - margin.bottom}
          className="overview-selection"
        />
        {dateLabelIndexes.map((index) => (
          <text
            key={`date-${index}`}
            x={layout.positioned[index].x}
            y={height - 12}
            textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
            className="overview-axis"
          >
            {formatDate(points[index].date)}
          </text>
        ))}
      </svg>
      <input
        className="wellness-overview__range"
        type="range"
        min="0"
        max={Math.max(0, points.length - 1)}
        value={safeIndex}
        onChange={(event) => setSelectedIndex(Number(event.target.value))}
        aria-label="选择趋势日期"
      />
      <p className="wellness-selected-detail" aria-live="polite">
        <strong>{formatDate(selected.date)}</strong>
        <span>体重 {selected.weightKg === null ? "未记录" : `${selected.weightKg.toFixed(1)} kg`}</span>
        <span>健康分 {selected.healthScore === null ? "未记录" : `${selected.healthScore.toFixed(1)}/10`}</span>
        <span>运动分 {selected.exerciseScore === null ? "未记录" : `${selected.exerciseScore.toFixed(1)}/10`}</span>
      </p>
      <p className="wellness-overview__note">三条趋势用于同期观察，不表示彼此存在因果关系。</p>
    </div>
  );
}
