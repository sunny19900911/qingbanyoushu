import type { WeightPoint } from "../../shared/types";

export function MiniSparkline({ points }: { points: WeightPoint[] }) {
  const recent = points.slice(-14);
  if (!recent.length) return <div className="mini-sparkline mini-sparkline--empty" />;

  const values = recent.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 0.8);
  const coordinates = recent.map((point, index) => {
    const x = recent.length === 1 ? 88 : 6 + (index / (recent.length - 1)) * 164;
    const y = 46 - ((point.value - min) / spread) * 34;
    return [x, y] as const;
  });
  const line = coordinates.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `6,50 ${line} 170,50`;

  return (
    <svg className="mini-sparkline" viewBox="0 0 176 54" role="img" aria-label="近14次体重趋势">
      <polygon points={area} fill="#eaf6ef" />
      <polyline points={line} fill="none" stroke="#08763f" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      {coordinates.map(([x, y], index) => <circle key={`${x}-${y}`} cx={x} cy={y} r={index === coordinates.length - 1 ? 3.8 : 2.2} fill="#08763f" />)}
    </svg>
  );
}
