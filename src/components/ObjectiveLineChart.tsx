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
    value: number;
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
                    value: stat?.hasData ? stat.average : 0,
                    hasData: !!stat?.hasData,
                } as DataPoint;
            });
    }, [checkins, averages]);

    // Filtra apenas pontos com dados para a linha
    const pointsWithData = chartData.filter((d) => d.hasData);

    if (pointsWithData.length === 0) {
        return (
            <div className="flex items-center justify-center h-[60px] text-xs text-muted-foreground">
                Sem dados
            </div>
        );
    }

    return (
        <div className="w-[180px] h-[60px]">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <XAxis
                        dataKey="label"
                        tick={{ fontSize: 9, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
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
