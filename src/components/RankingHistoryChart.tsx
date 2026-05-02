import React, { useState, useMemo, useEffect } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import { useRankingHistory } from '@/hooks/useRankingHistory';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, TrendingUp, Award, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const COLORS = [
    '#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed',
    '#db2777', '#0891b2', '#4f46e5', '#ea580c', '#65a30d',
    '#059669', '#f43f5e', '#8b5cf6', '#06b6d4', '#f59e0b',
];

export const RankingHistoryChart: React.FC = () => {
    const { data: history, isLoading } = useRankingHistory();
    const [viewMode, setViewMode] = useState<'performance' | 'ranking'>('performance');
    const [isAnimating, setIsAnimating] = useState(false);
    const [maxIndex, setMaxIndex] = useState<number | null>(null);

    const processedData = useMemo(() => {
        if (!history || history.length === 0) return [];

        let currentData = history;
        if (viewMode === 'ranking') {
            // Calculate ranks for each point
            currentData = history.map(point => {
                const newPoint = { ...point };
                const users = Object.keys(point)
                    .filter(k => k !== 'date' && k !== 'checkin_id')
                    .map(k => ({ name: k, value: point[k] as number }))
                    .sort((a, b) => b.value - a.value);

                users.forEach((u, index) => {
                    newPoint[u.name] = index + 1; // Rank 1, 2, 3...
                });
                return newPoint;
            });
        }

        if (maxIndex !== null) {
            return currentData.slice(0, maxIndex + 1);
        }

        return currentData;
    }, [history, viewMode, maxIndex]);

    const userNames = useMemo(() => {
        if (!history || history.length === 0) return [];
        return Array.from(
            new Set(
                history.flatMap((point) => 
                    Object.keys(point).filter(k => k !== 'date' && k !== 'checkin_id')
                )
            )
        );
    }, [history]);

    useEffect(() => {
        let interval: any;
        if (isAnimating && history && history.length > 0) {
            interval = setInterval(() => {
                setMaxIndex(prev => {
                    if (prev === null) return 0;
                    if (prev >= history.length - 1) {
                        setIsAnimating(false);
                        return prev;
                    }
                    return prev + 1;
                });
            }, 800); // Velocidade da animação (ms por ponto)
        }
        return () => clearInterval(interval);
    }, [isAnimating, history]);

    const handlePlay = () => {
        setMaxIndex(0);
        setIsAnimating(true);
    };

    const handleReset = () => {
        setMaxIndex(null);
        setIsAnimating(false);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[450px] gap-3">
                <Loader2 className="w-10 h-10 animate-spin text-primary opacity-50" />
                <p className="text-sm text-muted-foreground animate-pulse">Calculando trajetórias...</p>
            </div>
        );
    }

    if (!history || history.length === 0) {
        return (
            <div className="flex items-center justify-center h-[450px] text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                Sem dados de evolução disponíveis para este quarter.
            </div>
        );
    }

    const formatXAxis = (tickItem: string) => {
        try {
            return format(new Date(tickItem + 'T12:00:00'), 'dd/MM', { locale: ptBR });
        } catch (e) {
            return tickItem;
        }
    };

    return (
        <div className="w-full flex flex-col gap-6">
            <div className="flex items-center justify-between px-2">
                <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-semibold text-foreground">Visualização de Dados</h3>
                    <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">Alternar entre atingimento real e posição no ranking</p>
                        <span className="w-1 h-1 bg-muted-foreground/30 rounded-full" />
                        <button 
                            onClick={maxIndex !== null ? handleReset : handlePlay}
                            className="text-xs font-medium text-primary hover:underline flex items-center gap-1 transition-all"
                        >
                            {maxIndex !== null ? (
                                <><RotateCcw className="w-3 h-3" /> Resetar Visualização</>
                            ) : (
                                <><Play className="w-3 h-3" /> Iniciar Animação</>
                            )}
                        </button>
                    </div>
                </div>
                <div className="flex bg-muted p-1 rounded-lg border shadow-sm">
                    <Button 
                        variant={viewMode === 'performance' ? 'secondary' : 'ghost'} 
                        size="sm" 
                        onClick={() => setViewMode('performance')}
                        className="h-8 text-xs gap-2"
                        disabled={isAnimating}
                    >
                        <TrendingUp className="w-3.5 h-3.5" />
                        Performance
                    </Button>
                    <Button 
                        variant={viewMode === 'ranking' ? 'secondary' : 'ghost'} 
                        size="sm" 
                        onClick={() => setViewMode('ranking')}
                        className="h-8 text-xs gap-2"
                        disabled={isAnimating}
                    >
                        <Award className="w-3.5 h-3.5" />
                        Ranking
                    </Button>
                </div>
            </div>

            <div className="w-full h-[450px] bg-white rounded-xl p-4 border shadow-sm relative group">
                {isAnimating && (
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 bg-primary/90 text-white px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg animate-bounce">
                        Reproduzindo Evolução...
                    </div>
                )}
                
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={processedData}
                        margin={{ top: 20, right: 20, left: 0, bottom: 0 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis 
                            dataKey="date" 
                            tickFormatter={formatXAxis}
                            tick={{ fontSize: 11, fill: '#94a3b8' }}
                            axisLine={false}
                            tickLine={false}
                            dy={10}
                        />
                        <YAxis 
                            tick={{ fontSize: 11, fill: '#94a3b8' }}
                            axisLine={false}
                            tickLine={false}
                            domain={viewMode === 'ranking' ? [1, 'auto'] : [0, 100]}
                            reversed={viewMode === 'ranking'}
                            tickFormatter={(value) => viewMode === 'ranking' ? `${value}º` : `${value}%`}
                        />
                        <Tooltip 
                            contentStyle={{ 
                                borderRadius: '12px', 
                                border: '1px solid #e2e8f0', 
                                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                                fontSize: '12px',
                                padding: '12px'
                            }}
                            cursor={{ stroke: '#e2e8f0', strokeWidth: 2 }}
                            formatter={(value: number, name: string) => [
                                viewMode === 'ranking' ? `${value}º lugar` : `${value}%`, 
                                name
                            ]}
                            labelFormatter={(label: string) => {
                                 try {
                                    return format(new Date(label + 'T12:00:00'), "EEEE, d 'de' MMMM", { locale: ptBR });
                                } catch (e) {
                                    return label;
                                }
                            }}
                        />
                        <Legend 
                            iconType="circle"
                            wrapperStyle={{ paddingTop: '30px', fontSize: '11px', color: '#64748b' }}
                        />
                        {userNames.map((user, index) => (
                            <Line
                                key={user}
                                type="monotone"
                                dataKey={user}
                                stroke={COLORS[index % COLORS.length]}
                                strokeWidth={viewMode === 'ranking' ? 3 : 2}
                                dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                                activeDot={{ r: 6, strokeWidth: 2, fill: COLORS[index % COLORS.length] }}
                                animationDuration={isAnimating ? 300 : 1000}
                                connectNulls
                                isAnimationActive={!isAnimating} // Desativa animação interna do Recharts durante o Play para fluidez
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
            
            <div className="flex flex-col gap-2 px-4">
                {viewMode === 'ranking' && (
                    <p className="text-[10px] text-center text-muted-foreground uppercase tracking-widest">
                        As linhas representam a posição de cada colaborador. Quanto mais alta a linha, melhor o ranking (1º lugar no topo).
                    </p>
                )}
                {maxIndex !== null && (
                    <p className="text-[10px] text-center text-primary font-bold uppercase tracking-widest">
                        Visualizando até o {maxIndex + 1}º check-in do trimestre.
                    </p>
                )}
            </div>
        </div>
    );
};
