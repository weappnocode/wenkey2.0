import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, RefreshCcw, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

export interface RecomendacaoItem {
    categoria: string;
    percentual: number;
    sugestoes: string[];
}

export interface AnalysisResult {
    estatisticas: Record<string, number>;
    resumo_foco: {
        forte: string[];
        medio: string[];
        fraco: string[];
        ausentes?: string[];
    };
    perfil_estrategico: string;
    insights: string[];
    recomendacoes: RecomendacaoItem[] | string[];
}

export interface ObjectiveData {
    nome_objetivo: string;
    descricao_objetivo?: string;
    key_results: {
        titulo: string;
        meta: number | string;
        resultado_atual: number | string;
        percentual_atingimento: number | string;
        historico_checkins: { data: string; valor: number | string }[];
    }[];
}

export interface AIAnalysisContextData {
    quarter: string;
    quarter_status: 'ongoing' | 'closed';
    data_checkin_atual?: string;
    data_ultimo_checkin_quarter?: string;
    objetivos: ObjectiveData[];
}

interface FocusDistributionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    contextData: AIAnalysisContextData | null;
    autoAnalyze?: boolean;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#d0ed57'];

export function FocusDistributionDialog({ open, onOpenChange, contextData, autoAnalyze = false }: FocusDistributionDialogProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [analysisData, setAnalysisData] = useState<AnalysisResult | null>(null);

    useEffect(() => {
        if (open && autoAnalyze && !analysisData && !loading && contextData) {
            handleAnalyze();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, autoAnalyze, contextData]);

    const handleAnalyze = async () => {
        if (!contextData) return;

        setLoading(true);
        setAnalysisData(null);
        try {
            const { data, error } = await supabase.functions.invoke('focus-distribution', {
                body: { contextData }
            });

            if (error) throw error;

            if (data?.analysis) {
                setAnalysisData(data.analysis);
            } else if (data?.error) {
                throw new Error(data.error);
            } else {
                throw new Error('Retorno inválido da IA');
            }
        } catch (error: any) {
            let errorMessage = error.message || 'Não foi possível gerar a distribuição no momento.';
            if (error instanceof Error && error.message.includes('non-2xx')) {
                try {
                    const errorBody = await (error as any).context?.json();
                    if (errorBody?.error) {
                        errorMessage = errorBody.error;
                    }
                } catch (_) {}
            }

            console.error('Erro na análise da IA:', error);
            toast({
                title: 'Erro na Análise',
                description: errorMessage,
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const prepareChartData = () => {
        if (!analysisData || !analysisData.estatisticas) return [];
        return Object.entries(analysisData.estatisticas).map(([name, value]) => ({
            name,
            value: Number(value) || 0
        }));
    };

    const chartData = prepareChartData();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[850px] max-h-[90vh] flex flex-col p-8">
                <DialogHeader className="pb-4 border-b shrink-0 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Target className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                Distribuição de Foco <Sparkles className="w-4 h-4 text-amber-500" />
                            </DialogTitle>
                            <p className="text-sm text-muted-foreground mt-1">Análise Estratégica AI para Liderança</p>
                        </div>
                    </div>
                    {analysisData && (
                        <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={loading} className="gap-2 shrink-0">
                            <RefreshCcw className="w-4 h-4" />
                            Analisar Novamente
                        </Button>
                    )}
                </DialogHeader>

                <div className="flex-1 pr-2 mt-4 overflow-y-auto custom-scrollbar min-h-0">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center space-y-4">
                            <div className="relative">
                                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                                <Sparkles className="w-4 h-4 text-amber-500 absolute -top-1 -right-1 animate-pulse" />
                            </div>
                            <p className="text-sm text-muted-foreground max-w-[250px]">
                                O Auditor Estratégico está classificando os OKRs e gerando a distribuição de foco...
                            </p>
                        </div>
                    ) : analysisData ? (
                        <div className="max-w-none pb-6 space-y-8 pr-2">
                            <div>
                                <h3 className="text-lg font-bold text-primary mb-2">Perfil Estratégico</h3>
                                <p className="text-sm text-foreground leading-relaxed">{analysisData.perfil_estrategico || 'Nenhum perfil estratégico gerado.'}</p>
                            </div>

                            <div>
                                <h3 className="text-lg font-bold text-primary mb-4">Estatísticas de Foco (Distribuição)</h3>
                                <div className="h-[380px] w-full bg-muted/10 rounded-xl border p-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                                            <Pie
                                                data={chartData}
                                                cx="50%"
                                                cy="45%"
                                                labelLine={false}
                                                outerRadius={110}
                                                innerRadius={50}
                                                fill="#8884d8"
                                                dataKey="value"
                                                label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                                                    const RADIAN = Math.PI / 180;
                                                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                                    return percent > 0.05 ? (
                                                        <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700}>
                                                            {`${(percent * 100).toFixed(0)}%`}
                                                        </text>
                                                    ) : null;
                                                }}
                                            >
                                                {chartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip formatter={(value, name) => [`${value}%`, name]} />
                                            <Legend
                                                layout="vertical"
                                                align="right"
                                                verticalAlign="middle"
                                                iconType="circle"
                                                iconSize={10}
                                                formatter={(value) => <span style={{ fontSize: '12px' }}>{value}</span>}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                           <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                <div className="p-4 rounded-2xl border flex flex-col text-center bg-red-500/5 border-red-200">
                                    <h4 className="font-bold text-red-700 flex items-center justify-center gap-1 mb-3 text-sm">🔴 Forte &gt; 20%</h4>
                                    <div className="flex flex-col gap-1">
                                        {analysisData.resumo_foco?.forte?.length > 0 ? analysisData.resumo_foco.forte.map(c => <span key={c} className="text-xs font-medium">{c}</span>) : <span className="text-xs text-muted-foreground italic">Nenhuma</span>}
                                    </div>
                                </div>
                                <div className="p-4 rounded-2xl border flex flex-col text-center bg-yellow-500/5 border-yellow-200">
                                    <h4 className="font-bold text-yellow-700 flex items-center justify-center gap-1 mb-3 text-sm">🟡 Médio 10-20%</h4>
                                    <div className="flex flex-col gap-1">
                                        {analysisData.resumo_foco?.medio?.length > 0 ? analysisData.resumo_foco.medio.map(c => <span key={c} className="text-xs font-medium">{c}</span>) : <span className="text-xs text-muted-foreground italic">Nenhuma</span>}
                                    </div>
                                </div>
                                <div className="p-4 rounded-2xl border flex flex-col text-center bg-blue-500/5 border-blue-200">
                                    <h4 className="font-bold text-blue-700 flex items-center justify-center gap-1 mb-3 text-sm">🔵 Fraco &lt; 10%</h4>
                                    <div className="flex flex-col gap-1">
                                        {analysisData.resumo_foco?.fraco?.length > 0 ? analysisData.resumo_foco.fraco.map(c => <span key={c} className="text-xs font-medium">{c}</span>) : <span className="text-xs text-muted-foreground italic">Nenhuma</span>}
                                    </div>
                                </div>
                                <div className="p-4 rounded-2xl border flex flex-col text-center bg-gray-500/5 border-gray-200">
                                    <h4 className="font-bold text-gray-500 flex items-center justify-center gap-1 mb-3 text-sm">⚪ Ausente 0%</h4>
                                    <div className="flex flex-col gap-1">
                                        {analysisData.resumo_foco?.ausentes?.length > 0 ? analysisData.resumo_foco.ausentes.map(c => <span key={c} className="text-xs font-medium text-muted-foreground">{c}</span>) : <span className="text-xs text-muted-foreground italic">Nenhuma</span>}
                                    </div>
                                </div>
                            </div>                         </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-amber-500" /> Insights Críticos
                                    </h3>
                                    <ul className="space-y-3">
                                        {analysisData.insights?.map((insight: string, idx: number) => (
                                            <li key={idx} className="text-sm text-foreground flex items-start gap-3 bg-muted/10 p-3 rounded-lg border">
                                                <span className="text-amber-500 mt-0.5">•</span>
                                                <span className="leading-relaxed">{insight}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div>
                                    <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
                                        <Target className="w-5 h-5 text-green-600" /> Recomendações Práticas
                                    </h3>
                                    {Array.isArray(analysisData.recomendacoes) && analysisData.recomendacoes.length > 0 && typeof analysisData.recomendacoes[0] === 'object' ? (
                                        <div className="space-y-4">
                                            {(analysisData.recomendacoes as RecomendacaoItem[]).map((rec, idx) => (
                                                <div key={idx} className="rounded-xl border border-green-100 bg-green-500/5 overflow-hidden">
                                                    <div className="flex items-center justify-between px-4 py-2 bg-green-500/10 border-b border-green-100">
                                                        <span className="text-sm font-bold text-green-800">{rec.categoria}</span>
                                                        <span className="text-xs font-semibold text-green-700 bg-green-200 px-2 py-0.5 rounded-full">{rec.percentual}%</span>
                                                    </div>
                                                    <ul className="px-4 py-3 space-y-2">
                                                        {rec.sugestoes?.map((s, i) => (
                                                            <li key={i} className="text-sm text-foreground flex items-start gap-2">
                                                                <span className="text-green-600 font-bold mt-0.5">✓</span>
                                                                <span>{s}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <ul className="space-y-3">
                                            {(analysisData.recomendacoes as string[])?.map((rec: string, idx: number) => (
                                                <li key={idx} className="text-sm text-foreground flex items-start gap-3 bg-green-500/5 p-3 rounded-lg border border-green-100">
                                                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                                                    <span className="leading-relaxed">{rec}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                                <Sparkles className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold">Pronto para Analisar</h3>
                                <p className="text-sm text-muted-foreground max-w-[300px] mt-2 mb-6">
                                    Inicie a análise para obter a Distribuição de Foco Estratégico deste ciclo.
                                </p>
                                <Button onClick={handleAnalyze} className="gap-2">
                                    <Sparkles className="w-4 h-4" />
                                    Gerar Distribuição de Foco
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
