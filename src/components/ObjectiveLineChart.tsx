import { useMemo } from 'react';

interface ObjectiveLineChartProps {
    checkins: { id: string; checkin_date: string }[];
    averages: Record<string, { average: number; hasData: boolean }>;
    showDates?: boolean;
}

export function ObjectiveLineChart({
    checkins,
    averages,
    showDates = false,
}: ObjectiveLineChartProps) {
    const points = useMemo(() => {
        const count = checkins.length || 1;
        const colWidthPercent = 100 / count;
        return checkins.map((checkin, index) => {
            const stat = averages[checkin.id];
            return {
                id: checkin.id,
                // Positions the dot at the center of each column (e.g. 50% for 1 col, 25%/75% for 2, etc.)
                xPercent: index * colWidthPercent + colWidthPercent / 2,
                value: stat?.hasData ? stat.average : null,
                hasData: !!stat?.hasData,
            };
        });
    }, [checkins, averages]);

    const hasAnyData = points.some((p) => p.hasData);

    if (!hasAnyData) {
        return (
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                Sem dados
            </div>
        );
    }

    const svgHeight = showDates ? 80 : 60;
    const padTop = 20; // Space for labels
    const padBottom = showDates ? 24 : 8; // Extra space for dates
    const chartHeight = svgHeight - padTop - padBottom;

    // Map value (0-100) to Y coordinate (inverted: 0% at bottom, 100% at top)
    const toY = (val: number) => padTop + chartHeight * (1 - val / 100);

    // Filter points that have data for the line
    const dataPoints = points.filter(p => p.hasData && p.value !== null);

    // Create polyline segments
    const lineSegments: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 0; i < dataPoints.length - 1; i++) {
        const p1 = dataPoints[i];
        const p2 = dataPoints[i + 1];
        lineSegments.push({
            x1: p1.xPercent,
            y1: toY(p1.value as number),
            x2: p2.xPercent,
            y2: toY(p2.value as number)
        });
    }

    return (
        <div className="w-full h-full relative" style={{ minHeight: `${svgHeight}px` }}>
            <svg
                width="100%"
                height={svgHeight}
                style={{ display: 'block', overflow: 'visible' }}
                preserveAspectRatio="none"
            >
                {/* Connecting Lines */}
                {lineSegments.map((seg, i) => (
                    <line
                        key={i}
                        x1={`${seg.x1}%`}
                        y1={seg.y1}
                        x2={`${seg.x2}%`}
                        y2={seg.y2}
                        stroke="#3b82f6"
                        strokeWidth={2}
                        strokeLinecap="round"
                    />
                ))}

                {/* Points and Labels */}
                {points.map((p) => {
                    if (!p.hasData || p.value === null) return null;
                    const cy = toY(p.value);
                    const checkin = checkins.find(c => c.id === p.id);
                    return (
                        <g key={p.id}>
                            <text
                                x={`${p.xPercent}%`}
                                y={cy - 10}
                                textAnchor="middle"
                                fontSize={13}
                                fontWeight={700}
                                fill="#3b82f6"
                                className="select-none"
                            >
                                {Math.round(p.value)}%
                            </text>
                            <circle
                                cx={`${p.xPercent}%`}
                                cy={cy}
                                r={4.5}
                                fill="#fff"
                                stroke="#3b82f6"
                                strokeWidth={2.5}
                            />
                            {showDates && checkin && (
                                <text
                                    x={`${p.xPercent}%`}
                                    y={svgHeight - 10}
                                    textAnchor="middle"
                                    fontSize={11}
                                    fontWeight={600}
                                    fill="#64748b"
                                    className="select-none"
                                >
                                    {formatDate(checkin.checkin_date)}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

function formatDate(dateString: string) {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
}

