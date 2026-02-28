import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip
} from 'recharts';
import { Sparkles, BrainCircuit, Activity, AlertTriangle, TrendingUp, Cpu, Zap } from 'lucide-react';

const radarData = [
    { subject: 'Vendas', A: 85, fullMark: 100 },
    { subject: 'Marketing', A: 65, fullMark: 100 },
    { subject: 'Produto', A: 90, fullMark: 100 },
    { subject: 'Suporte', A: 45, fullMark: 100 },
    { subject: 'RH', A: 70, fullMark: 100 },
    { subject: 'Financeiro', A: 80, fullMark: 100 },
];

const areaData = [
    { name: 'Sem 1', confidence: 40, risk: 60 },
    { name: 'Sem 2', confidence: 55, risk: 45 },
    { name: 'Sem 3', confidence: 50, risk: 50 },
    { name: 'Sem 4', confidence: 65, risk: 35 },
    { name: 'Sem 5', confidence: 80, risk: 20 },
    { name: 'Sem 6', confidence: 85, risk: 15 },
];

export default function Prototypes() {
    return (
        <Layout>
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
                            <BrainCircuit className="h-8 w-8 text-indigo-500" />
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
                                Wenkey Intelligence
                            </span>
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            Amostra de visão preditiva usando IA para analisar a saúde dos seus OKRs.
                        </p>
                    </div>
                    <Badge variant="outline" className="border-indigo-500 text-indigo-500 flex items-center gap-1.5 px-3 py-1">
                        <Sparkles className="h-4 w-4" />
                        Beta Lab
                    </Badge>
                </div>

                {/* AI Insights Panel (Hero) */}
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl blur opacity-25 transition duration-1000 group-hover:duration-200"></div>
                    <Card className="relative bg-card/80 backdrop-blur-xl border-border shadow-2xl overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <Sparkles className="h-5 w-5 text-purple-500" />
                                Insights Gerados
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-rose-500 mb-2">
                                        <AlertTriangle className="h-5 w-5" />
                                        <h3 className="font-semibold">Risco Detectado</h3>
                                    </div>
                                    <p className="text-sm text-muted-foreground leading-relaxed h-20">
                                        O Key Result <strong className="text-foreground">"Reduzir Churn para 2%"</strong> do time de Suporte estagnou nas últimas 3 semanas. Sugerimos uma reunião de alinhamento imediata.
                                    </p>
                                    <Button variant="link" className="px-0 h-auto text-rose-500">Ver detalhes →</Button>
                                </div>
                                <div className="space-y-2 border-l border-border pl-6">
                                    <div className="flex items-center gap-2 text-emerald-500 mb-2">
                                        <TrendingUp className="h-5 w-5" />
                                        <h3 className="font-semibold">Alta Performance</h3>
                                    </div>
                                    <p className="text-sm text-muted-foreground leading-relaxed h-20">
                                        O time de Produto tem <strong>94% de chance</strong> de entregar o App Mobile antes do prazo baseado na velocidade atual de check-ins.
                                    </p>
                                    <Button variant="link" className="px-0 h-auto text-emerald-500">Parabenizar time →</Button>
                                </div>
                                <div className="space-y-2 border-l border-border pl-6">
                                    <div className="flex items-center gap-2 text-indigo-500 mb-2">
                                        <Zap className="h-5 w-5" />
                                        <h3 className="font-semibold">Ação Recomendada</h3>
                                    </div>
                                    <p className="text-sm text-muted-foreground leading-relaxed h-20">
                                        25% dos usuários ainda não fizeram check-in na segunda metade do trimestre. Deseja enviar um lembrete automático gamificado?
                                    </p>
                                    <Button variant="outline" size="sm" className="w-full mt-2 border-indigo-200 text-indigo-600 hover:bg-indigo-500 hover:text-white transition-colors">
                                        Disparar Lembrete
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Radar Health */}
                    <Card className="border-border/50 shadow-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Activity className="h-5 w-5 text-blue-500" />
                                Saúde por Departamento
                            </CardTitle>
                            <CardDescription>Consistência de engajamento vs Progresso real</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                                        <PolarGrid stroke="#e2e8f0" />
                                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 13 }} />
                                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                        <Radar name="Saúde" dataKey="A" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.4} />
                                        <RechartsTooltip
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            itemStyle={{ color: '#8b5cf6', fontWeight: 'bold' }}
                                        />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Prediction Area */}
                    <Card className="border-border/50 shadow-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Cpu className="h-5 w-5 text-teal-500" />
                                Trajetória de Risco (Semanal)
                            </CardTitle>
                            <CardDescription>Cálculo preditivo de atingimento do Quarter</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px] w-full mt-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={areaData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorConf" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={(val) => `${val}%`} />
                                        <RechartsTooltip
                                            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Area type="monotone" dataKey="risk" stroke="#f43f5e" fillOpacity={1} fill="url(#colorRisk)" name="Risco Relativo" stackId="1" />
                                        <Area type="monotone" dataKey="confidence" stroke="#10b981" fillOpacity={1} fill="url(#colorConf)" name="Confiança Otimizada" stackId="1" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </Layout>
    );
}
