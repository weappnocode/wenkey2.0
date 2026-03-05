import { useMemo } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

interface DataPoint {
    label: string;
    value: number | null;
    hasData: boolean;
}

interface ObjectiveLineChartProps {
    checkins: { id: string; checkin_date: string }[];
    averages: Record<string, { average: number; hasData: boolean }>;
}

export function ObjectiveLineChart({
    checkins,
    averages,
}: ObjectiveLineChartProps) {
    const chartData = useMemo(() => {
        return checkins
            .map((checkin) => {
                const stat = averages[checkin.id];
                const [, month, dayPart] = checkin.checkin_date.split('-');
                const day = dayPart?.replace(/[^0-9]/g, '');
                return {
                    label: `${day}/${month}`,
                    // Use null for missing data so the tick stays but no line is drawn
                    value: stat?.hasData ? stat.average : null,
                    hasData: !!stat?.hasData,
                };
            });
    }, [checkins, averages]);

    // Check if there is at least one point with actual data
    const hasAnyData = chartData.some((d) => d.hasData);

    if (!hasAnyData) {
        return (
            <div className="flex items-center justify-center h-[60px] text-xs text-muted-foreground">
                Sem dados
            </div>
        );
    }

    return (
        <div
            className="w-full h-full pt-2"
            style={{
                paddingLeft: `calc(50% / ${checkins.length} - 10px)`,
                paddingRight: `calc(50% / ${checkins.length} - 10px)`,
            }}
        >
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                    <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }}
                        axisLine={false}
                        tickLine={false}
                        dy={5}
                    />
                    <YAxis hide domain={[0, 100]} />
                    <Tooltip
                        formatter={(value: number) => [`${value}%`, 'Média']}
                        contentStyle={{
                            fontSize: '11px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0',
                            background: '#fff',
                        }}
                    />
                    <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={(props: { cx: number; cy: number; index: number }) => {
                            const point = chartData[props.index];
                            if (!point?.hasData) return <></>;
                            return (
                                <circle
                                    cx={props.cx}
                                    cy={props.cy}
                                    r={4}
                                    fill="#fff"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                />
                            );
                        }}
                        activeDot={{ r: 5, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                        connectNulls={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
