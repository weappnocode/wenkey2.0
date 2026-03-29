import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import { leadershipRadarApi, LeadershipRadar } from '@/services/leadershipRadarApi';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Zap, AlertTriangle, CheckCircle, Clock, Mail, RefreshCw, BarChart2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CheckinScheduleCards } from '@/components/LeadershipRadar/CheckinScheduleCards';

export default function LeadershipRadarTab() {
    const { toast } = useToast();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { selectedCompanyId } = useCompany();
    const { data: dashboardData } = useDashboardData();
    const activeQuarter = dashboardData?.active_quarter;

    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [radar, setRadar] = useState<LeadershipRadar | null>(null);

    const loadLatestRadar = async () => {
        if (!user || (!selectedCompanyId && !activeQuarter)) return;
        setLoading(true);
        try {
            const history = await leadershipRadarApi.getRadarHistory(1);
            if (history && history.length > 0) {
                // Fetch full details of the latest
                const fullRadar = await leadershipRadarApi.getRadarById(history[0].id);
                setRadar(fullRadar);
            } else {
                setRadar(null);
            }
        } catch (err: any) {
            console.error("Failed to load radar history:", err);
            // Non-blocking error for initial load
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLatestRadar();
    }, [user, selectedCompanyId, activeQuarter]);

    const handleGenerate = async () => {
        if (!selectedCompanyId || !activeQuarter) {
            toast({ title: "Aviso", description: "Empresa ou Quarter ativo não encontrados.", variant: "destructive" });
            return;
        }

        setGenerating(true);
        try {
            const newRadar = await leadershipRadarApi.generateRadar(
                selectedCompanyId,
                activeQuarter.id,
                user?.id,
                'company' // or 'manager' based on role
            );
            setRadar(newRadar);
            toast({ title: "Radar Gerado!", description: "O resumo executivo foi criado e enviado por e-mail." });
        } catch (err: any) {
            toast({ title: "Erro na Geração", description: err.message || "Falha ao gerar o radar.", variant: "destructive" });
        } finally {
            setGenerating(false);
        }
    };

    const handleResendEmail = async () => {
        if (!radar) return;
        try {
            toast({ title: "Enviando...", description: "Reenviando radar por e-mail." });
            const success = await leadershipRadarApi.resendRadarEmail(radar.id);
            if (success) {
                toast({ title: "Sucesso!", description: "Email reenviado com sucesso." });
                setRadar({ ...radar, emailed_at: new Date().toISOString() });
            } else {
                toast({ title: "Aviso", description: "Ocorreu um problema no webhook de envio.", variant: "destructive" });
            }
        } catch (err: any) {
            toast({ title: "Erro", description: err.message, variant: "destructive" });
        }
    };

    const renderEmptyState = () => (
        <Card className="flex flex-col items-center justify-center p-12 bg-slate-50 border-dashed dark:bg-slate-900/50">
            <Zap className="h-12 w-12 text-indigo-400 mb-4" />
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Nenhum radar gerado ainda</h3>
            <p className="text-slate-500 text-center max-w-md mt-2 mb-6">
                O Radar da Liderança utiliza inteligência artificial para criar um briefing executivo focado nos resultados do quarter atual.
            </p>
            <Button onClick={handleGenerate} disabled={generating || !activeQuarter} className="bg-indigo-600 hover:bg-indigo-700">
                {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                {generating ? "Analisando OKRs..." : "Gerar Primeiro Radar"}
            </Button>
            {!activeQuarter && (
                <p className="text-xs text-red-500 mt-4">Você precisa de um Quarter ativo para gerar relatórios.</p>
            )}
        </Card>
    );

    const renderKPIs = (metrics: any) => {
        if (!metrics) return null;
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card className="bg-emerald-50/50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900">
                    <CardContent className="p-4 flex flex-col items-center justify-center">
                        <CheckCircle className="h-6 w-6 text-emerald-500 mb-2" />
                        <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{metrics.healthy_pct}%</span>
                        <span className="text-xs text-emerald-600 font-medium">Saudáveis</span>
                    </CardContent>
                </Card>
                <Card className="bg-amber-50/50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900">
                    <CardContent className="p-4 flex flex-col items-center justify-center">
                        <AlertTriangle className="h-6 w-6 text-amber-500 mb-2" />
                        <span className="text-2xl font-bold text-amber-700 dark:text-amber-400">{metrics.attention_pct}%</span>
                        <span className="text-xs text-amber-600 font-medium">Em Atenção</span>
                    </CardContent>
                </Card>
                <Card className="bg-red-50/50 border-red-100 dark:bg-red-950/20 dark:border-red-900">
                    <CardContent className="p-4 flex flex-col items-center justify-center">
                        <AlertTriangle className="h-6 w-6 text-red-500 mb-2" />
                        <span className="text-2xl font-bold text-red-700 dark:text-red-400">{metrics.risk_pct}%</span>
                        <span className="text-xs text-red-600 font-medium">Em Risco</span>
                    </CardContent>
                </Card>
                <Card className="bg-slate-50/50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700">
                    <CardContent className="p-4 flex flex-col items-center justify-center">
                        <Clock className="h-6 w-6 text-slate-500 mb-2" />
                        <span className="text-2xl font-bold text-slate-700 dark:text-slate-300">{metrics.delayed_checkins || 0}</span>
                        <span className="text-xs text-slate-600 font-medium">Check-ins Atrasados</span>
                    </CardContent>
                </Card>
            </div>
        );
    };

    if (loading) {
        return <div className="flex h-40 flex-col items-center justify-center gap-4 text-slate-500"><Loader2 className="h-8 w-8 animate-spin" /><p>Carregando relatórios...</p></div>;
    }

    if (!radar) {
        return renderEmptyState();
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header / Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">Visão: {activeQuarter?.name}</Badge>
                        <Badge variant={radar.status_geral === 'saudavel' ? 'default' : radar.status_geral === 'risco' ? 'destructive' : 'secondary'}>
                            {radar.status_geral.toUpperCase()}
                        </Badge>
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{radar.title}</h2>
                    <p className="text-xs text-slate-500 mt-1">Gerado em {new Date(radar.generated_at).toLocaleString()}</p>
                </div>
                
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating}>
                        {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Atualizar
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleResendEmail}>
                        <Mail className="mr-2 h-4 w-4" />
                        Reenviar Email
                    </Button>
                </div>
            </div>

            {/* KPIs */}
            {renderKPIs(radar.metrics_snapshot)}

            {/* Content Structure */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-l-4 border-l-indigo-500 shadow-md bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Zap className="h-5 w-5 text-indigo-500" />
                                Visão Geral
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm">
                                {radar.visao_geral}
                            </p>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-md flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                                    <CheckCircle className="h-4 w-4" />
                                    Avanços Relevantes
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-3">
                                    {(radar.avancos || []).map((av: any, i: number) => (
                                        <li key={i} className="text-sm border-b pb-2 last:border-0 last:pb-0">
                                            <p className="font-semibold text-slate-800 dark:text-slate-200">{av.descricao || av.area}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{av.impacto || av.resumo}</p>
                                        </li>
                                    ))}
                                    {(radar.avancos || []).length === 0 && <span className="text-xs text-slate-400">Sem destaques no momento.</span>}
                                </ul>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-md flex items-center gap-2 text-red-600 dark:text-red-400">
                                    <AlertTriangle className="h-4 w-4" />
                                    Riscos e Alertas
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-3">
                                    {(radar.riscos || []).map((rk: any, i: number) => (
                                        <li key={i} className="text-sm border-b pb-2 last:border-0 last:pb-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="font-semibold text-slate-800 dark:text-slate-200 leading-tight">{rk.foco || rk.area}</p>
                                                {rk.gravidade && (
                                                    <Badge variant={rk.gravidade === 'alta' ? 'destructive' : 'secondary'} className="text-[10px] uppercase px-1">
                                                        {rk.gravidade}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{rk.motivo || rk.resumo}</p>
                                        </li>
                                    ))}
                                    {(radar.riscos || []).length === 0 && <span className="text-xs text-slate-400">Nenhum risco crítico mapeado.</span>}
                                </ul>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <div className="space-y-6">
                    <Card className="bg-indigo-50 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-md flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
                                <Zap className="h-4 w-4" />
                                Plano de Ação & Recomendações
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-3">
                                {(radar.recomendacoes || []).map((rec: any, i: number) => (
                                    <li key={i} className="flex gap-2 text-sm bg-white dark:bg-slate-900 p-3 rounded-lg border shadow-sm">
                                        <div className="mt-0.5"><div className="w-2 h-2 rounded-full bg-indigo-500" /></div>
                                        <div>
                                            <p className="font-medium text-slate-800 dark:text-slate-200 leading-tight">{rec.acao}</p>
                                            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 uppercase font-semibold">Prioridade: {rec.prioridade}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-md gap-2">
                                Termômetro das Áreas
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {(radar.areas_destaque || []).map((ad: any, i: number) => (
                                    <div key={i} className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded border border-slate-100 dark:border-slate-700">
                                        <div>
                                            <p className="text-sm font-semibold">{ad.area}</p>
                                            <p className="text-xs text-slate-500 line-clamp-1" title={ad.resumo}>{ad.resumo}</p>
                                        </div>
                                        <Badge variant={ad.status === 'saudavel' ? 'outline' : 'secondary'} className={
                                            ad.status === 'saudavel' ? 'text-emerald-600 bg-emerald-50 border-emerald-200' :
                                            ad.status === 'risco' ? 'text-red-600 bg-red-50 border-red-200' : 'text-amber-600 bg-amber-50 border-amber-200'
                                        }>
                                            {ad.status}
                                        </Badge>
                                    </div>
                                ))}
                                {(radar.areas_destaque || []).length === 0 && <span className="text-xs text-slate-400">Dados de área insuficientes.</span>}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* ─── Configurações de Agendamento ─── */}
            {selectedCompanyId && (
                <CheckinScheduleCards
                    companyId={selectedCompanyId}
                    nextCheckinDate={activeQuarter?.end_date ?? null}
                />
            )}
            
        </div>
    );
}
