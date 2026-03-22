import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, Sparkles, RefreshCcw, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AnalysisResult {
    estatisticas: Record<string, number>;
    resumo_foco: {
        forte: string[];
        medio: string[];
        fraco: string[];
    };
    perfil_estrategico: string;
    insights: string[];
    recomendacoes: string[];
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

interface OKRAnalysisDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    contextData: AIAnalysisContextData | null;
    autoAnalyze?: boolean;
}

export function OKRAnalysisDialog({ open, onOpenChange, contextData, autoAnalyze = false }: OKRAnalysisDialogProps) {
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
            const { data, error } = await supabase.functions.invoke('analyze-okr', {
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
            let errorMessage = error.message || 'Não foi possível gerar a análise no momento.';
            if (error instanceof Error && error.message.includes('non-2xx')) {
                // Tenta extrair a mensagem real se vier no body (supabase-js behavior)
                try {
                    const errorBody = await (error as any).context?.json();
                    if (errorBody?.error) {
                        errorMessage = errorBody.error;
                    }
                } catch (_) {
                    // Ignora se não conseguir parsear
                }
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
                            <p className="text-sm text-muted-foreground mt-1">Análise Estratégica</p>
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
                                O Auditor Estratégico está classificando os OKRs e mensurando a distribuição de foco... isso leva poucos segundos.
                            </p>
                        </div>
                    ) : analysisData ? (
                        <div className="max-w-none pb-6 space-y-8 pr-2">
                            <div>
                                <h3 className="text-lg font-bold text-primary mb-2">Perfil Estratégico</h3>
                                <p className="text-sm text-foreground leading-relaxed">{analysisData.perfil_estrategico}</p>
                            </div>

                            <div>
                                <h3 className="text-lg font-bold text-primary mb-4">Estatísticas de Foco</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {Object.entries(analysisData.estatisticas).map(([categoria, percentual]) => (
                                        <div key={categoria} className="flex flex-col justify-center items-center p-4 bg-muted/20 rounded-xl border">
                                            <span className="text-2xl font-bold text-primary mb-1">{Number(percentual).toFixed(0)}%</span>
                                            <span className="text-xs font-semibold text-center text-muted-foreground leading-tight">{categoria}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="p-5 rounded-2xl border flex flex-col text-center bg-red-500/5 border-red-200">
                                    <h4 className="font-bold text-red-700 flex items-center justify-center gap-1 mb-3 text-sm">🔴 Foco Forte {">"} 20%</h4>
                                    <div className="flex flex-col gap-2">
                                        {analysisData.resumo_foco.forte?.length > 0 ? analysisData.resumo_foco.forte.map(c => <span key={c} className="text-sm font-medium">{c}</span>) : <span className="text-xs text-muted-foreground italic">Nenhuma categoria</span>}
                                    </div>
                                </div>
                                <div className="p-5 rounded-2xl border flex flex-col text-center bg-yellow-500/5 border-yellow-200">
                                    <h4 className="font-bold text-yellow-700 flex items-center justify-center gap-1 mb-3 text-sm">🟡 Foco Médio 10-20%</h4>
                                    <div className="flex flex-col gap-2">
                                        {analysisData.resumo_foco.medio?.length > 0 ? analysisData.resumo_foco.medio.map(c => <span key={c} className="text-sm font-medium">{c}</span>) : <span className="text-xs text-muted-foreground italic">Nenhuma categoria</span>}
                                    </div>
                                </div>
                                <div className="p-5 rounded-2xl border flex flex-col text-center bg-blue-500/5 border-blue-200">
                                    <h4 className="font-bold text-blue-700 flex items-center justify-center gap-1 mb-3 text-sm">🔵 Foco Fraco {"<"} 10%</h4>
                                    <div className="flex flex-col gap-2">
                                        {analysisData.resumo_foco.fraco?.length > 0 ? analysisData.resumo_foco.fraco.map(c => <span key={c} className="text-sm font-medium">{c}</span>) : <span className="text-xs text-muted-foreground italic">Nenhuma categoria</span>}
                                    </div>
                                </div>
                            </div>

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
                                    <ul className="space-y-3">
                                        {analysisData.recomendacoes?.map((rec: string, idx: number) => (
                                            <li key={idx} className="text-sm text-foreground flex items-start gap-3 bg-green-500/5 p-3 rounded-lg border border-green-100">
                                                <span className="text-green-600 font-bold mt-0.5">✓</span>
                                                <span className="leading-relaxed">{rec}</span>
                                            </li>
                                        ))}
                                    </ul>
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
                                    Inicie a análise para obter insights estratégicos sobre o desempenho esperado para este período.
                                </p>
                                <Button onClick={handleAnalyze} className="gap-2">
                                    <Sparkles className="w-4 h-4" />
                                    Gerar Análise Estratégica
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
