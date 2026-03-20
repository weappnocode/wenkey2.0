import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, Sparkles, RefreshCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

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
    const [analysisText, setAnalysisText] = useState<string | null>(null);

    useEffect(() => {
        if (open && autoAnalyze && !analysisText && !loading && contextData) {
            handleAnalyze();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, autoAnalyze, contextData]);

    const handleAnalyze = async () => {
        if (!contextData) return;

        setLoading(true);
        setAnalysisText(null);
        try {
            const { data, error } = await supabase.functions.invoke('analyze-okr', {
                body: { contextData }
            });

            if (error) throw error;

            if (data?.analysis) {
                setAnalysisText(data.analysis);
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
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col p-6">
                <DialogHeader className="pb-4 border-b shrink-0 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                Visão do Analista <Sparkles className="w-4 h-4 text-amber-500" />
                            </DialogTitle>
                            <p className="text-sm text-muted-foreground mt-1">Análise estratégica baseada na IA</p>
                        </div>
                    </div>
                    {analysisText && (
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
                                O Analista Virtual está analisando o desempenho, tendências e riscos... isso leva poucos segundos.
                            </p>
                        </div>
                    ) : analysisText ? (
                        <div className="max-w-none pb-6">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkBreaks]}
                                components={{
                                    h2: ({ children }) => (
                                        <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'inherit', marginTop: '24px', marginBottom: '8px' }}>
                                            {children}
                                        </h2>
                                    ),
                                    h3: ({ children }) => (
                                        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'inherit', marginTop: '24px', marginBottom: '8px' }}>
                                            {children}
                                        </h3>
                                    ),
                                    h4: ({ children }) => (
                                        <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#3b82f6', marginTop: '16px', marginBottom: '4px' }}>
                                            {children}
                                        </h4>
                                    ),
                                    p: ({ children }) => (
                                        <p style={{ fontSize: '14px', fontWeight: 400, color: '#111827', marginBottom: '12px', lineHeight: '1.7' }}>
                                            {children}
                                        </p>
                                    ),
                                    strong: ({ children }) => (
                                        <strong style={{ fontWeight: 700 }}>{children}</strong>
                                    ),
                                }}
                            >
                                {analysisText}
                            </ReactMarkdown>
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
