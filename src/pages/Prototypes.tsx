import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Target, TrendingUp, AlertTriangle, XOctagon, Info } from 'lucide-react';
import { calculateForecast } from '@/lib/utils';
import { format } from 'date-fns';

const MOCK_START_DATE = new Date();
MOCK_START_DATE.setDate(MOCK_START_DATE.getDate() - 20); // 20 dias atrás
const MOCK_END_DATE = new Date();
MOCK_END_DATE.setDate(MOCK_END_DATE.getDate() + 70); // Daqui a 70 dias

// Quarter total ~ 90 dias
const QUARTER_PROGRESS = 20 / 90;

const mockKRs = [
    {
        id: '1',
        title: 'Atingir R$ 100.000 em vendas',
        baseline: 0,
        current: 40000,
        target: 100000,
        direction: 'increase',
        // Progresso real: 40%
        // Progresso de tempo: ~22%
        // Velocidade excelente -> deve ser "No Ritmo"
    },
    {
        id: '2',
        title: 'Reduzir churn para 2%',
        baseline: 10,
        current: 8,
        target: 2,
        direction: 'decrease',
        // Baseline = 10... Target = 2... total a reduzir = 8
        // Reduziu = 2... Ritmo = reduziu 25% da meta
        // Tempo = ~22%
        // OK, tá acompanhando certinho -> "No Ritmo"
    },
    {
        id: '3',
        title: 'Implementar 5 novas features xpto',
        baseline: 0,
        current: 0,
        target: 5,
        direction: 'increase',
        // Tempo passou 22% do quarter e fez 0 -> "Atrasado"
    },
    {
        id: '4',
        title: 'Contratar 3 desenvolvedores',
        baseline: 0,
        current: 1,
        target: 3,
        direction: 'increase',
        // Faltam 2. Tempo = 22%. Meta de atingimento pra estar safe hoje seria ~22%. 1/3 = 33%. -> "No ritmo" ou "Em Risco" devido à formula.
    }
];

export default function Prototypes() {
    return (
        <Layout>
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
                                Laboratório: Forecast de OKRs
                            </span>
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            Validando algoritmos de Projection e Run Rate baseado no tempo do Quarter.
                            <br />
                            <strong>Quarter simulado:</strong> {format(MOCK_START_DATE, 'dd/MM/yyyy')} até {format(MOCK_END_DATE, 'dd/MM/yyyy')}
                            <br />
                            <strong>Tempo decorrido:</strong> ~{(QUARTER_PROGRESS * 100).toFixed(0)}%
                        </p>
                    </div>
                </div>

                <div className="grid gap-6">
                    {mockKRs.map(kr => {
                        const forecast = calculateForecast(
                            kr.baseline,
                            kr.target,
                            kr.current,
                            kr.direction,
                            MOCK_START_DATE.toISOString(),
                            MOCK_END_DATE.toISOString()
                        );

                        const progressPercent = kr.direction === 'decrease'
                            ? ((kr.baseline - kr.current) / (kr.baseline - kr.target)) * 100
                            : ((kr.current - kr.baseline) / (kr.target - kr.baseline)) * 100;

                        return (
                            <Card key={kr.id} className="border-l-4" style={{
                                borderLeftColor: forecast.status === 'on_track' ? '#10b981' :
                                    forecast.status === 'at_risk' ? '#f59e0b' :
                                        forecast.status === 'off_track' ? '#ef4444' : '#94a3b8'
                            }}>
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <CardTitle className="text-lg flex items-center gap-2">
                                                <Target className="h-4 w-4 text-muted-foreground" />
                                                {kr.title}
                                            </CardTitle>
                                            <CardDescription className="mt-1">
                                                Baseline: {kr.baseline} | Atual: {kr.current} | Meta: {kr.target} ({kr.direction === 'increase' ? 'Aumentar' : 'Reduzir'})
                                            </CardDescription>
                                        </div>
                                        <div>
                                            <TooltipProvider delayDuration={100}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="cursor-help">
                                                            {forecast.status === 'on_track' && (
                                                                <Badge className="bg-emerald-500 hover:bg-emerald-600 font-medium px-2 py-1 flex gap-1 items-center">
                                                                    <TrendingUp className="h-3.5 w-3.5" /> No Ritmo
                                                                </Badge>
                                                            )}
                                                            {forecast.status === 'at_risk' && (
                                                                <Badge className="bg-amber-500 hover:bg-amber-600 font-medium px-2 py-1 flex gap-1 items-center">
                                                                    <AlertTriangle className="h-3.5 w-3.5" /> Em Risco
                                                                </Badge>
                                                            )}
                                                            {forecast.status === 'off_track' && (
                                                                <Badge className="bg-rose-500 hover:bg-rose-600 font-medium px-2 py-1 flex gap-1 items-center">
                                                                    <XOctagon className="h-3.5 w-3.5" /> Atrasado
                                                                </Badge>
                                                            )}
                                                            {forecast.status === 'not_applicable' && (
                                                                <Badge variant="outline" className="text-slate-500 font-medium px-2 py-1 flex gap-1 items-center">
                                                                    <Info className="h-3.5 w-3.5" /> N/A
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="left" className="w-72 p-3 space-y-2">
                                                        <p className="font-semibold text-sm">Previsão Matemática (Linear)</p>
                                                        <div className="text-xs space-y-1 text-slate-300">
                                                            <p>Mantendo o ritmo atual desde o início do Quarter, a projeção aponta que:</p>
                                                            <div className="bg-slate-800 p-2 rounded border border-slate-700 mt-2">
                                                                <span className="block mb-1">Valor final projetado: <strong className="text-white">{forecast.projectedValue.toFixed(2)}</strong></span>
                                                                <span className="block">Meta exigida: <strong className="text-white">{kr.target}</strong></span>
                                                            </div>
                                                        </div>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center justify-between mt-2 text-sm text-muted-foreground mb-1">
                                        <span>Progresso Acumulado</span>
                                        <span className="font-bold text-slate-700 dark:text-slate-200">{progressPercent.toFixed(1)}%</span>
                                    </div>
                                    <Progress value={Math.max(0, Math.min(100, progressPercent))} className="h-2" />
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            </div>
        </Layout>
    );
}
