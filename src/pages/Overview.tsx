import { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { CircularProgress } from '@/components/CircularProgress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Trophy, Users } from 'lucide-react';
import { calculateQuarterProgress } from '@/hooks/useDashboardData';

const getInitials = (name: string) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

interface Quarter {
  id: string;
  name: string;
  company_id: string;
}

interface Company {
  id: string;
  name: string;
}

interface Profile {
  id: string;
  full_name: string;
  position: string | null;
  avatar_url?: string | null;
}

interface UserRanking {
  rank: number;
  user_id: string;
  full_name: string;
  position: string | null;
  result_percent: number;
  avatar_url?: string | null;
  is_team: boolean;
}

export default function Overview() {
  const { user } = useAuth();
  const { selectedCompanyId, selectedCompany: ctxCompany } = useCompany();
  const { role, isAdmin, loading: roleLoading } = useUserRole();
  const [quarters, setQuarters] = useState<Quarter[]>([]);
  const [companies, setCompanies] = useState<Company[]>(() =>
    ctxCompany ? [{ id: ctxCompany.id, name: ctxCompany.name }] : []
  );
  // Inicializa já com a empresa do contexto (disponível via localStorage)
  const [selectedCompany, setSelectedCompany] = useState<string>(selectedCompanyId || '');
  const [selectedQuarter, setSelectedQuarter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [userRankings, setUserRankings] = useState<UserRanking[]>([]);
  const [viewType, setViewType] = useState<'all' | 'individual' | 'team'>('all');
  const [userCompanyId, setUserCompanyId] = useState<string>(selectedCompanyId || '');

  useEffect(() => {
    if (!roleLoading && user?.id) {
      initializePage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleLoading, user?.id, isAdmin]);



  const initializePage = async (attempt = 1) => {
    try {
      setLoading(true);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user?.id)
        .single();

      if (profileData?.company_id) {
        setUserCompanyId(profileData.company_id);
      }

      // Prioridade: empresa do contexto (sidebar) > empresa do perfil
      const defaultCompanyId = selectedCompanyId || profileData?.company_id;

      if (isAdmin) {
        const { data: companiesData, error: cErr } = await supabase
          .from('companies')
          .select('id, name')
          .eq('is_active', true)
          .order('name');

        if (cErr) throw cErr;

        if (companiesData && companiesData.length > 0) {
          setCompanies(companiesData);
          const companyId = defaultCompanyId || companiesData[0].id;
          setSelectedCompany(companyId);
          await loadQuarters(companyId);
        }
      } else {
        if (defaultCompanyId) {
          setSelectedCompany(defaultCompanyId);
          await loadQuarters(defaultCompanyId);
        }
      }
    } catch (error) {
      const err = error as Error;
      const isTransient = err?.message?.includes('Failed to fetch') || err?.message?.includes('AbortError');
      if (isTransient && attempt < 3) {
        console.warn(`[Overview] Erro transitório, tentando novamente (${attempt}/3)...`);
        setTimeout(() => initializePage(attempt + 1), 800 * attempt);
        return;
      }
      console.error('Erro ao inicializar página:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadQuarters = useCallback(async (companyId: string) => {
    const { data: quartersData } = await supabase
      .from('quarters')
      .select('id, name, company_id')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('start_date', { ascending: false });

    if (quartersData && quartersData.length > 0) {
      setQuarters(quartersData);
      setSelectedQuarter(quartersData[0].id);
    } else {
      setQuarters([]);
      setSelectedQuarter('');
    }
  }, []);

  const loadRankings = useCallback(async () => {
    if (!selectedCompany || !selectedQuarter) return;

    try {
      // 1. Load Rankings based on viewType
      let query = supabase
        .from('profiles')
        .select('id, full_name, position, is_active, avatar_url, is_team')
        .eq('company_id', selectedCompany)
        .eq('is_active', true);

      if (viewType !== 'all') {
        query = query.eq('is_team', viewType === 'team');
      }

      const { data: profilesData, error: profilesError } = await query;

      if (profilesError) {
        console.error('Erro ao carregar perfis para o ranking:', profilesError);
      } else if (profilesData && profilesData.length > 0) {
        const { data: userResultsData, error: userResultsError } = await supabase
          .from('quarter_results')
          .select('user_id, result_percent')
          .eq('company_id', selectedCompany)
          .eq('quarter_id', selectedQuarter)
          .not('user_id', 'is', null);

        if (userResultsError) {
          console.error('Erro ao carregar resultados de usuários:', userResultsError);
        } else {
          const userResultMap = new Map((userResultsData || []).map(r => [r.user_id, r.result_percent]));

          let userRankings: UserRanking[] = await Promise.all(profilesData.map(async profile => {
            let av = profile.avatar_url;
            if (av && !av.startsWith('http')) {
              const { data } = supabase.storage.from('avatars').getPublicUrl(av);
              av = data.publicUrl;
            }

            let resultPercent = userResultMap.get(profile.id) || 0;
            if (profile.is_team) {
              resultPercent = await calculateQuarterProgress(selectedCompany, selectedQuarter, profile.id);
            }

            return {
              rank: 0,
              user_id: profile.id,
              full_name: profile.full_name,
              position: profile.position,
              result_percent: resultPercent,
              avatar_url: av,
              is_team: profile.is_team || false
            };
          }));

          userRankings.sort((a, b) => b.result_percent - a.result_percent);
          userRankings = userRankings.map((r, index) => ({ ...r, rank: index + 1 }));
          setUserRankings(userRankings);
        }
      }
    } catch (error) {
      console.error('Erro inesperado ao carregar rankings:', error);
    }
  }, [selectedCompany, selectedQuarter]);

  useEffect(() => {
    if (selectedCompany && selectedQuarter) {
      loadRankings();
    }
  }, [selectedCompany, selectedQuarter, viewType, loadRankings]);

  useEffect(() => {
    // Apenas sincroniza quando usuário trocar a empresa ativamente no menu lateral
    if (!roleLoading && selectedCompanyId && selectedCompany !== selectedCompanyId) {
      setSelectedCompany(selectedCompanyId);
      loadQuarters(selectedCompanyId);
    }
  }, [selectedCompanyId, roleLoading, selectedCompany, loadQuarters]);

  const getRankingLabel = (rank: number): string => {
    return `${rank}º LUGAR`;
  };

  if (roleLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Visão Geral</h1>
          <p className="text-muted-foreground">
            Ranking de desempenho dos colaboradores
          </p>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 flex-wrap">
              {/* Filtro de Empresa - apenas para Admin */}
              {isAdmin && (
                <div className="flex-1 min-w-[200px]">
                  <Label>Empresa</Label>
                  <div className="h-10 px-3 flex items-center rounded-md border bg-muted/30 text-sm text-foreground">
                    {selectedCompany
                      ? (companies.find(c => c.id === selectedCompany)?.name || 'Selecionada')
                      : 'Nenhuma empresa selecionada'}
                  </div>
                </div>
              )}

              {/* Filtro de Quarter */}
              <div className="flex-1 min-w-[200px]">
                <Label>Quarter</Label>
                <Select
                  value={selectedQuarter}
                  onValueChange={setSelectedQuarter}
                  disabled={!selectedCompany || quarters.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um quarter" />
                  </SelectTrigger>
                  <SelectContent>
                    {quarters.map((quarter) => (
                      <SelectItem key={quarter.id} value={quarter.id}>
                        {quarter.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro de Tipo de Visualização */}
              <div className="flex-1 min-w-[200px]">
                <Label>Visualizar por</Label>
                <Select
                  value={viewType}
                  onValueChange={(v: 'individual' | 'team') => setViewType(v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Geral (Colaboradores e Times)</SelectItem>
                    <SelectItem value="individual">Colaboradores</SelectItem>
                    <SelectItem value="team">Times</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ranking */}
        {selectedCompany && selectedQuarter ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Ranking de Desempenho ({viewType === 'individual' ? 'Colaboradores' : 'Times'})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {userRankings.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                  {userRankings.map((ranking, index) => (
                    <Card
                      key={ranking.user_id}
                      className="overflow-hidden"
                      style={{
                        animation: `rankCardIn 0.5s ease-out ${index * 150}ms both`,
                      }}
                    >
                      <CardHeader className="pb-3 bg-muted/50">
                        <CardTitle className="text-center text-lg font-bold">
                          {getRankingLabel(ranking.rank)}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6 pb-6 flex flex-col items-center space-y-4 relative">
                        <CircularProgress
                          percentage={ranking.result_percent}
                          size={140}
                          strokeWidth={12}
                        />

                        <div className="absolute top-4 left-4">
                          <Avatar className="h-12 w-12 border-2 border-border shadow-md">
                            {ranking.avatar_url ? (
                              <AvatarImage src={ranking.avatar_url} alt={ranking.full_name} className="object-cover" />
                            ) : (
                              <AvatarFallback className="text-lg">{getInitials(ranking.full_name)}</AvatarFallback>
                            )}
                          </Avatar>
                        </div>

                        <div className="text-center space-y-1">
                          <p className="font-semibold text-base capitalize flex items-center justify-center gap-1.5">
                            {ranking.is_team && <Users className="h-4 w-4 text-primary" />}
                            {ranking.full_name.toLowerCase()}
                          </p>
                          {ranking.position && (
                            <p className="text-sm text-muted-foreground capitalize">
                              {ranking.position.toLowerCase()}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Ainda não há resultados consolidados para este quarter.</p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12 text-muted-foreground">
                <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Selecione uma empresa e um quarter para visualizar o ranking.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout >
  );
}
