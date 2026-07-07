import type { AiUsageChartData, AiUsagePeriod } from '../../shared/types/ai-usage';

interface AiUsageChartProps {
  chartData: AiUsageChartData | null;
  period: AiUsagePeriod;
  onPeriodChange: (period: AiUsagePeriod) => void;
}

const PERIODS: Array<{ id: AiUsagePeriod; label: string }> = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];

// Distinct colors for provider lines on dark background
const LINE_COLORS = [
  '#7F77DD', // purple (accent)
  '#5DCAA5', // green
  '#EF9F27', // amber
  '#E06C75', // red
  '#61AFEF', // blue
  '#C678DD', // magenta
  '#56B6C2', // cyan
  '#D19A66', // orange
];

const CHART_HEIGHT = 160;
const LABEL_HEIGHT = 20;
const Y_AXIS_WIDTH = 50;
const CHART_WIDTH = 560;
const DOT_RADIUS = 3;

function formatYValue(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(0) + 'K';
  return v.toFixed(0);
}

export function AiUsageChart({ chartData, period, onPeriodChange }: AiUsageChartProps) {
  const hasData = chartData && chartData.labels.length > 0 && chartData.series.length > 0;

  // Compute max token value across all series
  let maxTokens = 0;
  if (hasData) {
    for (const s of chartData.series) {
      for (const v of s.data) {
        if (v > maxTokens) maxTokens = v;
      }
    }
  }
  if (maxTokens === 0) maxTokens = 100;

  const pointCount = hasData ? chartData.labels.length : 0;
  const barsWidth = CHART_WIDTH - Y_AXIS_WIDTH;

  // Grid lines
  const gridLines = [0.25, 0.5, 0.75, 1].map((frac) => ({
    y: CHART_HEIGHT * (1 - frac),
    label: formatYValue(maxTokens * frac),
  }));

  function getX(i: number): number {
    if (pointCount <= 1) return Y_AXIS_WIDTH + barsWidth / 2;
    return Y_AXIS_WIDTH + (i / (pointCount - 1)) * barsWidth;
  }

  function getY(tokens: number): number {
    return CHART_HEIGHT * (1 - tokens / maxTokens);
  }

  return (
    <div className="bg-app-surface rounded-lg p-3 border border-border">
      {/* Header: title + period selector */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] text-text-muted font-medium">Tokens Over Time</span>
        <div className="flex items-center gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => onPeriodChange(p.id)}
              className={`
                px-2 h-[22px] rounded text-[10px] font-medium transition-colors duration-150
                ${period === p.id
                  ? 'bg-app-active text-accent-light'
                  : 'text-text-dim hover:bg-app-hover hover:text-text-muted'
                }
              `}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <div className="flex items-center justify-center h-[160px] text-[12px] text-text-dim">
          No usage data yet
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <svg
              width={CHART_WIDTH}
              height={CHART_HEIGHT + LABEL_HEIGHT + 8}
              className="block"
            >
              {/* Y-axis grid lines */}
              {gridLines.map((line) => (
                <g key={line.y}>
                  <line
                    x1={Y_AXIS_WIDTH}
                    y1={line.y}
                    x2={CHART_WIDTH}
                    y2={line.y}
                    stroke="var(--color-border)"
                    strokeWidth={0.5}
                    strokeDasharray="3,3"
                  />
                  <text
                    x={Y_AXIS_WIDTH - 4}
                    y={line.y + 3}
                    textAnchor="end"
                    fill="var(--color-text-dim)"
                    fontSize={9}
                    fontFamily="inherit"
                  >
                    {line.label}
                  </text>
                </g>
              ))}

              {/* Baseline */}
              <line
                x1={Y_AXIS_WIDTH}
                y1={CHART_HEIGHT}
                x2={CHART_WIDTH}
                y2={CHART_HEIGHT}
                stroke="var(--color-border)"
                strokeWidth={0.5}
              />

              {/* X-axis labels */}
              {chartData.labels.map((label, i) => {
                const showLabel = pointCount <= 15 || i % Math.ceil(pointCount / 15) === 0;
                if (!showLabel) return null;
                return (
                  <text
                    key={i}
                    x={getX(i)}
                    y={CHART_HEIGHT + LABEL_HEIGHT - 4}
                    textAnchor="middle"
                    fill="var(--color-text-dim)"
                    fontSize={9}
                    fontFamily="inherit"
                  >
                    {label}
                  </text>
                );
              })}

              {/* Lines + dots per provider */}
              {chartData.series.map((series, si) => {
                const color = LINE_COLORS[si % LINE_COLORS.length];
                const points = series.data.map((v, i) => `${getX(i)},${getY(v)}`).join(' ');

                return (
                  <g key={series.provider}>
                    {/* Line */}
                    <polyline
                      points={points}
                      fill="none"
                      stroke={color}
                      strokeWidth={2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />

                    {/* Dots */}
                    {series.data.map((v, i) => (
                      <circle
                        key={i}
                        cx={getX(i)}
                        cy={getY(v)}
                        r={DOT_RADIUS}
                        fill={color}
                        className="hover:r-[5px]"
                      >
                        <title>
                          {series.provider} — {chartData.labels[i]}: {v.toLocaleString()} tokens
                        </title>
                      </circle>
                    ))}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 mt-2">
            {chartData.series.map((series, si) => (
              <div key={series.provider} className="flex items-center gap-1.5">
                <div
                  className="w-[10px] h-[3px] rounded-full"
                  style={{ backgroundColor: LINE_COLORS[si % LINE_COLORS.length] }}
                />
                <span className="text-[10px] text-text-muted">{series.provider}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
