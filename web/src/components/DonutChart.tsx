export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

function donutBackground(segments: DonutSegment[]): string {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  if (!total) return "#e7ece9";
  let start = 0;
  const stops = segments.map((segment) => {
    const end = start + (Math.max(0, segment.value) / total) * 100;
    const stop = `${segment.color} ${start}% ${end}%`;
    start = end;
    return stop;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

export function DonutChart({
  segments,
  centerLabel,
  centerValue,
  ariaLabel,
  size = "medium",
  showPercentages = false,
}: {
  segments: DonutSegment[];
  centerLabel?: string;
  centerValue: string;
  ariaLabel: string;
  size?: "small" | "medium" | "large";
  showPercentages?: boolean;
}) {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  let angle = -90;
  const labels = segments.map((segment) => {
    const share = total ? Math.max(0, segment.value) / total : 0;
    const middle = angle + share * 180;
    angle += share * 360;
    const radians = (middle * Math.PI) / 180;
    return {
      ...segment,
      percent: Math.round(share * 100),
      left: 50 + Math.cos(radians) * 34,
      top: 50 + Math.sin(radians) * 34,
    };
  });

  return (
    <figure className={`donut donut--${size}`} aria-label={ariaLabel}>
      <div className="donut__ring" style={{ background: donutBackground(segments) }}>
        <div className="donut__center">
          {centerLabel ? <span>{centerLabel}</span> : null}
          <strong>{centerValue}</strong>
        </div>
        {showPercentages
          ? labels.filter((segment) => segment.value > 0).map((segment) => (
              <span
                className="donut__percentage"
                key={segment.label}
                style={{ left: `${segment.left}%`, top: `${segment.top}%` }}
              >
                {segment.percent}%
              </span>
            ))
          : null}
      </div>
    </figure>
  );
}
