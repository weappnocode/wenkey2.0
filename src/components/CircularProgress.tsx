import { getPerformanceColor } from "@/lib/performanceColors";

interface CircularProgressProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  textClassName?: string;
}

export function CircularProgress({
  percentage,
  size = 160,
  strokeWidth = 10,
  textClassName = "text-3xl"
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  // Reuse the same palette used pelas barras lineares
  const color = getPerformanceColor(percentage);

  // Unique filter ID to avoid conflicts when multiple instances exist
  const filterId = `glow-${size}-${Math.round(percentage)}`;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        {/* Shadow filter for the colored arc */}
        <defs>
          <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={color} floodOpacity="0.45" />
          </filter>
        </defs>
        {/* Background circle */}
        <circle
          className="text-muted"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle with shadow */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          filter={`url(#${filterId})`}
          style={{
            transition: 'stroke-dashoffset 0.5s ease-in-out',
          }}
        />
      </svg>
      {/* Percentage text with shadow */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`${textClassName} font-bold`}
          style={{
            color,
            textShadow: `0 1px 6px ${color}66`,
          }}
        >
          {Math.round(percentage)}%
        </span>
        <span className="text-xs text-muted-foreground">Alvo: 100%</span>
      </div>
    </div>
  );
}
