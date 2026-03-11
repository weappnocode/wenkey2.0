import { useMemo, useState, useEffect, type ReactNode, type CSSProperties } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Layout } from '@/components/Layout';
import { CircularProgress } from '@/components/CircularProgress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Target, Calendar, TrendingUp, Award, Trophy, Users } from 'lucide-react';
import { toTitleCase } from '@/lib/utils';
import { ActiveQuarterInfo } from '@/components/ActiveQuarterInfo';
import { DashboardProgressChart } from '@/components/DashboardProgressChart';
import { OKRAnalysisDialog, type AIAnalysisContextData } from '@/components/OKRAnalysisDialog';
import { useDashboardData, UserRanking } from '@/hooks/useDashboardData';
import { getPerformanceColor } from '@/lib/performanceColors';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const { user } = useAuth();
  const { role } = useUserRole();
  const { selectedCompanyId } = useCompany();

  // Use the new hook for all data fetching and caching
  const { data, isLoading } = useDashboardData();

  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisContext, setAnalysisContext] = useState<AIAnalysisContextData | null>(null);

  useEffect(() => {
    if (data?.active_quarter && data.metrics.objectiveRankings.length > 0) {
      const sessionKey = `okr-ai-analysis-shown-${data.active_quarter.id}`;
      if (!sessionStorage.getItem(sessionKey)) {
        const summaryContext: AIAnalysisContextData = {
          quarter: data.active_quarter.name,
          quarter_status: 'ongoing',
          objetivos: [
            {
              nome_objetivo: "Resumo Geral do Quarter",
              descricao_objetivo: "Visão consolidada dos principais Key Results e Objetivos",
              key_results: data.metrics.okrRankings.slice(0, 10).map(kr => ({
                titulo: kr.title,
                meta: 'Definida',
                resultado_atual: kr.result_pct + '%',
                percentual_atingimento: kr.result_pct,
                historico_checkins: []
              }))
            }
          ]
        };

        setAnalysisContext(summaryContext);
        setAnalysisOpen(true);
        sessionStorage.setItem(sessionKey, 'true');
      }
    }
  }, [data]);

  const getProgressStyle = (pct: number): ProgressStyle => ({
    '--progress-color': getPerformanceColor(pct),
  });

  const topRankings = useMemo(() =>
    data?.metrics.userRankings.slice(0, 5) || [],
    [data?.metrics.userRankings]
  );

  // 1. Not Logged In
  if (!user) {
    return (
      <Layout>
        <div className="py-24 text-center text-muted-foreground">
          Faça login para visualizar o dashboard.
        </div>
      </Layout>
    );
  }

  // 2. Loading State
  if (isLoading) {
    return (
      <Layout>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-muted-foreground">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/30 border-t-primary"></div>
          <p>Carregando dashboard...</p>
        </div>
      </Layout>
    );
  }

  // 3. No Company Selected or No Data
  if (!selectedCompanyId || !data) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground gap-4">
          {!selectedCompanyId ? (
            <>
              <Target className="w-12 h-12 text-muted-foreground/50" />
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-foreground">Nenhuma empresa selecionada</h3>
                <p>Utilize o menu lateral para selecionar uma empresa.</p>
              </div>
            </>
          ) : (
            <p>Carregando dados da empresa...</p>
          )}
        </div>
      </Layout>
    );
  }

  const { metrics, userProfile, active_quarter } = data;

  return (
    <Layout>
      <OKRAnalysisDialog
        open={analysisOpen}
        onOpenChange={setAnalysisOpen}
        contextData={analysisContext}
        autoAnalyze={true}
      />
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{toTitleCase('Dashboard')}</p>
            <h1 className="text-3xl font-bold tracking-tight text-black">{toTitleCase('Bem-vindo')}, {toTitleCase(userProfile?.full_name ?? 'Usuário')}</h1>
            <p className="text-muted-foreground">
              {toTitleCase('Acompanhe a evolução dos objetivos e resultados-chave da empresa.')}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border w-full h-full">
            {active_quarter ? (
              <ActiveQuarterInfo quarter={active_quarter} />
            ) : (
              <div className="flex flex-col items-center justify-center w-full h-full min-h-[120px] p-6 text-center text-muted-foreground">
                <Calendar className="w-8 h-8 mb-2 opacity-20" />
                <p>Nenhum quarter com período ativo.</p>
                <p className="text-xs mt-1">Crie um novo quarter nas configurações se você for administrador.</p>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <DashboardProgressChart />
          <Card className="md:col-span-2 xl:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <p className="text-base text-black">{toTitleCase('OKRs por Objetivo')}</p>
                <p className="text-sm text-muted-foreground mt-1">Key Results por objetivo</p>
              </div>
              <div className="rounded-full bg-muted p-3 text-primary">
                <TrendingUp className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              {metrics.objectiveRankings.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum objetivo.</p>
              ) : (
                <div className="animate-in zoom-in-95 fade-in duration-700 fill-mode-both" style={{ animationDelay: '100ms' }}>
                  <ResponsiveContainer width="100%" height={100}>
                    <BarChart data={metrics.objectiveRankings.map(o => ({
                      name: toTitleCase(o.objective_title),
                      krs: o.kr_count,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 90%)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                      <YAxis hide allowDecimals={false} />
                      <RechartsTooltip
                        contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                        formatter={(value: number) => [value, 'Key Results']}
                      />
                      <Bar dataKey="krs" fill="hsl(221 83% 53%)" radius={[4, 4, 0, 0]} barSize={28} label={{ position: 'top', fontSize: 11, fontWeight: 600, fill: 'hsl(221 83% 53%)' }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Progresso do Quarter Atual
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Percentual consolidado considerando todos os check-ins.
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-2 animate-in zoom-in duration-500 fade-in fill-mode-both">
                <CircularProgress percentage={metrics.currentQuarterProgress} size={160} strokeWidth={12} />
                <p className="text-sm text-muted-foreground">Resultado consolidado</p>
              </div>

              {metrics.objectiveRankings.length > 0 && (
                <div className="mt-4 pt-4 border-t flex flex-wrap gap-6 justify-center overflow-x-auto pb-1 custom-scrollbar">
                  {metrics.objectiveRankings.map((objective, index) => {
                    const colorClass = getPerformanceColor(objective.result_pct);
                    return (
                      <div key={index} className="flex flex-col items-center gap-2 min-w-[100px] animate-in zoom-in duration-500 fade-in fill-mode-both" style={{ animationDelay: `${(index + 1) * 150}ms` }}>
                        <CircularProgress percentage={objective.result_pct} size={90} strokeWidth={8} textClassName="text-base" />
                        <span
                          className={`text-[10px] font-medium text-center uppercase tracking-wider ${colorClass}`}
                          style={{ maxWidth: '100px', lineHeight: '1.1' }}
                        >
                          {objective.objective_title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="flex flex-col overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Ranking 5 Primeiros no Quarter
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Colaboradores com melhor desempenho no quarter atual.
              </p>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar">
              {topRankings.length === 0 ? (
                <p className="text-center text-muted-foreground">Nenhum resultado disponível.</p>
              ) : (
                <div className="space-y-3 px-3 py-3">
                  {topRankings.map((ranking, index) => (
                    <div
                      key={ranking.user_id}
                      className={`flex items-center justify-between rounded-2xl border px-4 py-3.5 animate-in slide-in-from-right-4 fade-in duration-500 fill-mode-both ${ranking.user_id === user?.id ? 'ring-2 ring-primary border-primary/30 shadow-lg shadow-primary/20 bg-primary/10 scale-[1.02]' : 'hover:bg-muted/50 shadow-sm'}`}
                      style={{ animationDelay: `${index * 150}ms` }}
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-normal px-1.5 py-0.5 flex justify-center text-xs min-w-[28px]">
                          #{ranking.rank}
                        </Badge>
                        <Avatar className="h-9 w-9">
                          {ranking.avatar_url ? (
                            <AvatarImage src={ranking.avatar_url} alt={ranking.full_name} />
                          ) : (
                            <AvatarFallback className="text-xs">{getInitials(ranking.full_name)}</AvatarFallback>
                          )}
                        </Avatar>
                        <div>
                          <p className="text-sm font-normal leading-tight flex items-center gap-1.5">
                            {ranking.is_team && <Users className="h-3 w-3 text-primary" />}
                            {ranking.full_name}
                          </p>
                          <p className="text-xs text-muted-foreground">{ranking.sector ?? 'Sem setor'}</p>
                        </div>
                      </div>
                      <span className="text-base font-semibold pr-4 text-primary">{ranking.result_pct}%</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>


        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              {toTitleCase('OKRs em Destaque')}
            </CardTitle>
            <p className="text-base text-muted-foreground">{toTitleCase('Key Results ordenados pelo percentual de atingimento.')}</p>
          </CardHeader>
          <CardContent className="h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {metrics.okrRankings.length === 0 ? (
              <p className="text-center text-muted-foreground">Nenhum dado cadastrado.</p>
            ) : (
              <div className="space-y-4">
                {metrics.okrRankings.map((okr, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        {okr.code && <span className="text-xs text-muted-foreground">{okr.code}</span>}
                        <span className="text-base font-normal">
                          {toTitleCase(okr.title)}
                          {okr.owner_name && (
                            <span className="ml-2 text-sm text-muted-foreground font-normal inline-flex items-center gap-1.5 align-middle">
                              -
                              <Avatar className="h-4 w-4">
                                {okr.owner_avatar_url ? (
                                  <AvatarImage src={okr.owner_avatar_url} alt={okr.owner_name || ''} />
                                ) : (
                                  <AvatarFallback className="text-[8px]">{getInitials(okr.owner_name || '')}</AvatarFallback>
                                )}
                              </Avatar>
                              {okr.owner_is_team && <Users className="h-3 w-3 text-primary" />}
                              {toTitleCase(okr.owner_name)} ({toTitleCase(okr.owner_sector ?? 'Sem setor')})
                            </span>
                          )}
                        </span>
                      </div>
                      <span className="text-base font-normal">{okr.result_pct}%</span>
                    </div>
                    <Progress
                      value={okr.result_pct}
                      className="h-2"
                      style={getProgressStyle(okr.result_pct)}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout >
  );
}

type ProgressStyle = CSSProperties & {
  '--progress-color'?: string;
};

const getInitials = (name: string) => {
  if (!name) return '';
  return name
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};


function KpiCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: number | string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <p className="text-base text-black">{title}</p>
          <h3 className="text-2xl font-normal text-black">{value}</h3>
        </div>
        <div className="rounded-full bg-muted p-3 text-primary">{icon}</div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-black">{description}</p>
      </CardContent>
    </Card>
  );
}

function RankingList({
  title,
  icon,
  data,
  emptyMessage,
  currentUserId,
}: {
  title: string;
  icon: ReactNode;
  data: UserRanking[];
  emptyMessage: string;
  currentUserId?: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {data.length === 0 ? (
          <p className="text-center text-muted-foreground">{emptyMessage}</p>
        ) : (
          <div className="space-y-4 px-3 py-3">
            {data.map(ranking => (
              <div key={ranking.user_id} className={`flex items-center justify-between rounded-2xl border px-6 py-4 transition-all duration-200 ${ranking.user_id === currentUserId ? 'ring-2 ring-primary border-primary/30 shadow-lg bg-primary/10' : 'hover:bg-muted/50 shadow-sm'}`}>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="font-normal px-1.5 h-6 min-w-[2rem] flex justify-center text-[11px]">
                    #{ranking.rank}
                  </Badge>
                  <Avatar className="h-8 w-8">
                    {ranking.avatar_url ? (
                      <AvatarImage src={ranking.avatar_url} alt={ranking.full_name} />
                    ) : (
                      <AvatarFallback className="text-[10px]">{getInitials(ranking.full_name)}</AvatarFallback>
                    )}
                  </Avatar>
                  <div>
                    <p className="text-base font-normal leading-tight text-black flex items-center gap-1.5">
                      {ranking.is_team && <Users className="h-4 w-4 text-primary" />}
                      {toTitleCase(ranking.full_name)}
                    </p>
                    <p className="text-sm text-black">{toTitleCase(ranking.sector ?? 'Sem setor')}</p>
                  </div>
                </div>
                <span className="text-lg font-bold pr-2 text-primary">{ranking.result_pct}%</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
