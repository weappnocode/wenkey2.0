import { useState, useEffect, useRef, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { ChevronDown, ChevronUp, Pencil, Target, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CreateObjectiveDialog } from '@/components/CreateObjectiveDialog';
import { AddKRDialog } from '@/components/AddKRDialog';
import { EditObjectiveDialog } from '@/components/EditObjectiveDialog';
import { EditKRDialog } from '@/components/EditKRDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { toTitleCase, calculateForecast } from '@/lib/utils';
import { TrendingUp, AlertTriangle, XOctagon, Info } from 'lucide-react';

interface Quarter {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  company_id: string;
}

interface Profile {
  id: string;
  company_id: string;
  full_name: string;
  sector: string | null;
}

interface Company {
  id: string;
  name: string;
}

interface ObjectiveWithProgress {
  id: string;
  title: string;
  description: string | null;
  status: string;
  quarter_id: string;
  company_id: string;
  user_id: string;
  archived: boolean;
  percent_obj: number;
  progress: number;
  key_results: KeyResultWithProgress[];
}

interface KeyResultWithProgress {
  id: string;
  objective_id: string;
  title: string;
  code: string | null;
  target: number | null;
  current: number;
  percent_kr: number;
  attainment_kr: number | null;
  progress: number;
  owner_name: string | null;
  baseline: number | null;
  direction: string | null;
  forecast: {
    status: 'on_track' | 'at_risk' | 'off_track' | 'not_applicable';
    projectedValue: number;
    message: string;
  };
}

export default function Objectives() {
  const { user, profile: authProfile } = useAuth();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { role, loading: roleLoading } = useUserRole();
  const { toast } = useToast();

  const isAdmin = role === 'admin';
  const isUser = role === 'user';

  // ── filter state ──
  // Inicializa já com a empresa do contexto (disponível sincronamente via localStorage)
  const [companies, setCompanies] = useState<Company[]>(() =>
    selectedCompany ? [{ id: selectedCompany.id, name: selectedCompany.name }] : []
  );
  const [quarters, setQuarters] = useState<Quarter[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [filterCompanyId, setFilterCompanyId] = useState<string>(selectedCompanyId || '');
  const [selectedQuarterId, setSelectedQuarterId] = useState<string>('');
  const [filterUserId, setFilterUserId] = useState<string>('');

  // ── data state ──
  const [objectives, setObjectives] = useState<ObjectiveWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedObjectives, setExpandedObjectives] = useState<Set<string>>(new Set());

  // ── deletion state ──
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [objectiveToDelete, setObjectiveToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [krToDelete, setKrToDelete] = useState<string | null>(null);
  const [isDeletingKr, setIsDeletingKr] = useState(false);

  // ── refs to prevent stale closures in realtime callbacks ──
  const filterRef = useRef({ companyId: '', quarterId: '', userId: '' });

  // Keep ref in sync with state
  useEffect(() => {
    filterRef.current = {
      companyId: filterCompanyId,
      quarterId: selectedQuarterId,
      userId: filterUserId,
    };
  }, [filterCompanyId, selectedQuarterId, filterUserId]);

  // ── helper: load objectives using current ref values ──
  const loadObjectivesFromRef = useCallback(async () => {
    const { companyId, quarterId, userId } = filterRef.current;
    if (!user || !companyId || !quarterId || !userId) return;

    try {
      let query = supabase
        .from('objectives')
        .select('id, title, description, status, quarter_id, company_id, user_id, archived, percent_obj')
        .eq('company_id', companyId)
        .eq('quarter_id', quarterId)
        .eq('archived', false)
        .neq('status', 'rascunho');

      if (userId !== 'all') {
        query = query.eq('user_id', userId);
      }

      const { data: objectivesData } = await query.order('created_at', { ascending: false });

      if (!objectivesData || objectivesData.length === 0) {
        setObjectives([]);
        return;
      }

      const objectiveIds = objectivesData.map(obj => obj.id);

      const { data: krsData } = await supabase
        .from('key_results')
        .select('id, objective_id, title, code, target, current, baseline, direction, percent_kr, checkin_results(percentual_atingido, created_at)')
        .in('objective_id', objectiveIds);

      const krsWithProgress: KeyResultWithProgress[] = (krsData || []).map((kr: any) => {
        const results = kr.checkin_results || [];
        const latestResult = [...results].sort((a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];

        return {
          id: kr.id,
          objective_id: kr.objective_id,
          title: String(kr.title || ''),
          code: kr.code ?? null,
          target: kr.target ?? null,
          current: kr.current ?? 0,
          percent_kr: kr.percent_kr ?? 0,
          attainment_kr: typeof latestResult?.percentual_atingido === 'number' ? latestResult.percentual_atingido : null,
          progress: Math.round(kr.percent_kr || 0),
          owner_name: null,
          baseline: kr.baseline ?? null,
          direction: kr.direction ?? null,
          forecast: { status: 'not_applicable', projectedValue: 0, message: '' }
        };
      });

      const activeQuarter = quarters.find(q => q.id === filterRef.current.quarterId);

      const objsWithProgress: ObjectiveWithProgress[] = objectivesData.map(obj => {
        const objKrs = krsWithProgress.filter(kr => kr.objective_id === obj.id);

        // Calcular o forecast para cada KR
        objKrs.forEach(kr => {
          if (activeQuarter) {
            kr.forecast = calculateForecast(
              kr.baseline,
              kr.target,
              kr.current,
              kr.direction,
              activeQuarter.start_date,
              activeQuarter.end_date
            );
          }
        });

        objKrs.sort((a, b) => b.progress - a.progress);
        return {
          ...obj,
          progress: Math.round(obj.percent_obj || 0),
          key_results: objKrs,
        };
      });

      setObjectives(objsWithProgress);
    } catch (err) {
      console.error('Erro ao carregar objetivos:', err);
    }
  }, [user?.id]);

  // ── master initialization ──
  const authProfileId = authProfile?.id;
  const authProfileCompanyId = authProfile?.company_id;

  useEffect(() => {
    if (!user || !authProfileId || roleLoading) return;

    const companyId = selectedCompanyId || authProfileCompanyId;
    if (!companyId) {
      setLoading(false);
      return;
    }

    const initialize = async (attempt = 1) => {
      setLoading(true);
      try {
        // 1. Companies list
        // Pre-populate with current selected company so the dropdown is never blank
        if (selectedCompany) {
          setCompanies(prev => {
            const alreadyHas = prev.some(c => c.id === selectedCompany.id);
            return alreadyHas ? prev : [selectedCompany, ...prev];
          });
        }
        setFilterCompanyId(companyId);

        if (isAdmin) {
          const { data, error } = await supabase.from('companies').select('id, name').order('name');
          if (error) throw error;
          setCompanies(data || []);
        } else {
          setCompanies(authProfileCompanyId ? [{ id: authProfileCompanyId, name: selectedCompany?.name || '' }] : []);
        }

        // 2. Quarters
        const { data: qData, error: qError } = await supabase
          .from('quarters')
          .select('id, name, start_date, end_date, company_id')
          .eq('company_id', companyId)
          .order('start_date', { ascending: false });

        if (qError) throw qError;

        const quarters = qData || [];
        setQuarters(quarters);

        let quarterId = '';
        if (quarters.length > 0) {
          const today = new Date().toISOString().split('T')[0];
          const current = quarters.find(q => q.start_date <= today && q.end_date >= today);
          quarterId = current ? current.id : quarters[0].id;
        }
        setSelectedQuarterId(quarterId);

        // 3. Users
        const { data: uData, error: uError } = await supabase
          .from('profiles')
          .select('id, company_id, full_name, sector')
          .eq('company_id', companyId)
          .eq('is_active', true)
          .order('full_name');

        if (uError) throw uError;
        setUsers(uData || []);

        const userId = isUser ? user.id : 'all';
        setFilterUserId(userId);

        // 4. Update ref immediately so objectives load correctly
        filterRef.current = { companyId, quarterId, userId };

        // 5. Load objectives
        if (companyId && quarterId && userId) {
          await loadObjectivesFromRef();
        }
      } catch (err: any) {
        const isTransient = err?.message?.includes('Failed to fetch') || err?.message?.includes('AbortError');
        if (isTransient && attempt < 3) {
          // Retry after a short delay for transient network errors
          console.warn(`[Objectives] Erro transitório, tentando novamente (${attempt}/3)...`);
          setTimeout(() => initialize(attempt + 1), 800 * attempt);
          return;
        }
        console.error('Erro na inicialização:', err);
      } finally {
        setLoading(false);
      }
    };

    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authProfileId, authProfileCompanyId, selectedCompanyId, roleLoading, isAdmin]);

  // ── reload objectives when user manually changes Quarter or User filter ──
  useEffect(() => {
    if (!loading && selectedQuarterId && filterUserId && filterCompanyId) {
      filterRef.current = { companyId: filterCompanyId, quarterId: selectedQuarterId, userId: filterUserId };
      loadObjectivesFromRef();
    }
  }, [selectedQuarterId, filterUserId]);

  // ── realtime subscription (uses ref to avoid stale closure) ──
  useEffect(() => {
    if (!selectedQuarterId) return;

    const channelName = `objectives-rt-${selectedQuarterId}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'objectives', filter: `quarter_id=eq.${selectedQuarterId}` }, () => loadObjectivesFromRef())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'key_results' }, () => loadObjectivesFromRef())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checkin_results' }, () => loadObjectivesFromRef())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedQuarterId, loadObjectivesFromRef]);

  // ── handlers ──
  const handleCompanyChange = useCallback(async (companyId: string) => {
    setFilterCompanyId(companyId);
    setSelectedQuarterId('');
    setFilterUserId('');
    setObjectives([]);

    const { data: qData } = await supabase
      .from('quarters')
      .select('id, name, start_date, end_date, company_id')
      .eq('company_id', companyId)
      .order('start_date', { ascending: false });

    const qs = qData || [];
    setQuarters(qs);

    let quarterId = '';
    if (qs.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      const cur = qs.find(q => q.start_date <= today && q.end_date >= today);
      quarterId = cur ? cur.id : qs[0].id;
    }
    setSelectedQuarterId(quarterId);

    const { data: uData } = await supabase
      .from('profiles')
      .select('id, company_id, full_name, sector')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('full_name');

    setUsers(uData || []);
    const userId = isUser ? user!.id : 'all';
    setFilterUserId(userId);

    filterRef.current = { companyId, quarterId, userId };
    await loadObjectivesFromRef();
  }, [isUser, user, loadObjectivesFromRef]);

  const toggleObjective = (objectiveId: string) => {
    setExpandedObjectives(prev => {
      const next = new Set(prev);
      if (next.has(objectiveId)) {
        next.delete(objectiveId);
      } else {
        next.add(objectiveId);
      }
      return next;
    });
  };

  const handleDeleteClick = (objectiveId: string) => {
    setObjectiveToDelete(objectiveId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!objectiveToDelete || !isAdmin) return;
    setIsDeleting(true);
    try {
      const { error: krError } = await supabase.from('key_results').delete().eq('objective_id', objectiveToDelete);
      if (krError) throw krError;
      const { error: objError } = await supabase.from('objectives').delete().eq('id', objectiveToDelete);
      if (objError) throw objError;
      toast({ title: 'Sucesso', description: 'Objetivo excluído com sucesso!' });
      setDeleteDialogOpen(false);
      setObjectiveToDelete(null);
      await loadObjectivesFromRef();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao excluir objetivo', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteKrConfirm = async () => {
    if (!krToDelete || !isAdmin) return;
    setIsDeletingKr(true);
    try {
      const { error } = await supabase.from('key_results').delete().eq('id', krToDelete);
      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Key Result excluído com sucesso!' });
      setKrToDelete(null);
      await loadObjectivesFromRef();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao excluir Key Result', variant: 'destructive' });
    } finally {
      setIsDeletingKr(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
      'ativo': { label: 'Ativo', variant: 'default' },
      'concluído': { label: 'Concluído', variant: 'secondary' },
      'arquivado': { label: 'Arquivado', variant: 'destructive' },
      'not_started': { label: 'Não Iniciado', variant: 'secondary' },
    };
    const statusInfo = statusMap[status] || { label: status, variant: 'secondary' as const };
    return <Badge variant={statusInfo.variant}>{toTitleCase(statusInfo.label)}</Badge>;
  };

  const getProgressColor = (pct: number) => {
    if (pct >= 80) return 'hsl(142, 76%, 36%)';
    if (pct >= 50) return 'hsl(48, 96%, 53%)';
    return 'hsl(0, 84%, 60%)';
  };

  // ── loading / guard states ──
  if (loading || roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando objetivos...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!authProfile) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Sessão não encontrada</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Faça login novamente para continuar.</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">{toTitleCase('Objetivos e Key Results')}</h1>
          {isAdmin && selectedQuarterId && (
            <CreateObjectiveDialog
              onSuccess={loadObjectivesFromRef}
              currentQuarterId={selectedQuarterId}
              currentCompanyId={filterCompanyId}
              currentUserId={filterUserId === 'all' ? (user?.id || '') : filterUserId}
            />
          )}
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle>{toTitleCase('Filtros')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {/* Empresa */}
              <div className="space-y-2">
                <Label>{toTitleCase('Empresa')}</Label>
                {isAdmin ? (
                  <Select value={filterCompanyId} onValueChange={handleCompanyChange}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder={toTitleCase('Selecione uma empresa')} />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {companies.map(c => (
                        <SelectItem key={c.id} value={c.id}>{toTitleCase(c.name)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="h-10 px-3 flex items-center rounded-md border bg-muted/30 text-sm text-foreground">
                    {selectedCompany?.name ? toTitleCase(selectedCompany.name) : toTitleCase('Nenhuma empresa')}
                  </div>
                )}
              </div>

              {/* Quarter */}
              <div className="space-y-2">
                <Label>{toTitleCase('Quarter')}</Label>
                <Select
                  value={selectedQuarterId}
                  onValueChange={setSelectedQuarterId}
                  disabled={!filterCompanyId || quarters.length === 0}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder={toTitleCase('Selecione um quarter')} />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {quarters.map(q => (
                      <SelectItem key={q.id} value={q.id}>{toTitleCase(q.name)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Usuário */}
              <div className="space-y-2">
                <Label>{toTitleCase('Usuário')}</Label>
                {isUser ? (
                  <div className="h-10 px-3 py-2 rounded-md border bg-muted/40 flex items-center text-sm text-muted-foreground">
                    {toTitleCase(authProfile?.full_name || 'Usuário atual')}
                  </div>
                ) : (
                  <Select
                    value={filterUserId}
                    onValueChange={setFilterUserId}
                    disabled={!filterCompanyId || users.length === 0}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder={toTitleCase('Selecione um usuário')} />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="all">{toTitleCase('Todos os Usuários')}</SelectItem>
                      {users.map(u => (
                        <SelectItem key={u.id} value={u.id}>{toTitleCase(u.full_name)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Objetivos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              {toTitleCase('Objetivos Cadastrados')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {objectives.length === 0 ? (
              <div className="text-center py-12">
                <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-black text-lg">
                  {toTitleCase('Nenhum objetivo cadastrado ainda. Crie seu primeiro objetivo!')}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {objectives.map(objective => (
                  <Collapsible
                    key={objective.id}
                    open={expandedObjectives.has(objective.id)}
                    onOpenChange={() => toggleObjective(objective.id)}
                  >
                    <Card className="border-2 hover:border-primary/50 transition-colors">
                      <CollapsibleTrigger asChild>
                        <div className="cursor-pointer w-full">
                          <CardHeader>
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 text-left space-y-2">
                                <div className="flex items-center gap-2">
                                  <CardTitle className="text-2xl">{toTitleCase(objective.title || '')}</CardTitle>
                                  {getStatusBadge(objective.status)}
                                </div>

                                {objective.description && (
                                  <p className="text-sm text-black">{objective.description}</p>
                                )}

                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-black">{toTitleCase('Progresso')}</span>
                                    <span className="text-2xl font-bold">{objective.progress}%</span>
                                  </div>
                                  <Progress
                                    value={objective.progress}
                                    style={{ '--progress-color': getProgressColor(objective.progress) } as any}
                                  />
                                </div>

                                <div className="text-sm text-black">
                                  {objective.key_results.length} {toTitleCase(objective.key_results.length === 1 ? 'Key Result' : 'Key Results')}
                                </div>
                              </div>

                              <div className="flex-shrink-0">
                                {expandedObjectives.has(objective.id) ? (
                                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                          </CardHeader>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <CardContent className="pt-0">
                          {isAdmin && (
                            <div className="flex justify-between items-center mb-4 border-t pt-4">
                              <div className="flex gap-2">
                                <EditObjectiveDialog
                                  objective={{
                                    id: objective.id,
                                    title: objective.title,
                                    description: objective.description,
                                    user_id: objective.user_id,
                                    company_id: objective.company_id,
                                    quarter_id: objective.quarter_id,
                                  }}
                                  onSuccess={loadObjectivesFromRef}
                                />
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteClick(objective.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Excluir
                                </Button>
                              </div>
                              <AddKRDialog
                                objectiveId={objective.id}
                                companyId={objective.company_id}
                                quarterId={objective.quarter_id}
                                onSuccess={loadObjectivesFromRef}
                              />
                            </div>
                          )}

                          {objective.key_results.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              Nenhum Key Result vinculado a este objetivo.
                            </p>
                          ) : (
                            <div className="space-y-3">
                              {objective.key_results.map(kr => (
                                <Card key={kr.id} className="bg-muted/50">
                                  <CardContent className="p-4 space-y-3">
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex-1 space-y-1">
                                        <div className="text-lg font-semibold flex items-center gap-2 flex-wrap">
                                          <div>
                                            {kr.code && <span className="text-primary">{kr.code}</span>}
                                            {kr.code && ' - '}
                                            {toTitleCase(kr.title)}
                                          </div>
                                          {kr.forecast && kr.forecast.status !== 'not_applicable' && (
                                            <TooltipProvider delayDuration={100}>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <div className="cursor-help inline-flex">
                                                    {kr.forecast.status === 'on_track' && (
                                                      <Badge className="bg-emerald-500 hover:bg-emerald-600 font-medium px-2 py-0 h-6 flex gap-1 items-center">
                                                        <TrendingUp className="h-3 w-3" /> No Ritmo
                                                      </Badge>
                                                    )}
                                                    {kr.forecast.status === 'at_risk' && (
                                                      <Badge className="bg-amber-500 hover:bg-amber-600 font-medium px-2 py-0 h-6 flex gap-1 items-center">
                                                        <AlertTriangle className="h-3 w-3" /> Em Risco
                                                      </Badge>
                                                    )}
                                                    {kr.forecast.status === 'off_track' && (
                                                      <Badge className="bg-rose-500 hover:bg-rose-600 font-medium px-2 py-0 h-6 flex gap-1 items-center">
                                                        <XOctagon className="h-3 w-3" /> Atrasado
                                                      </Badge>
                                                    )}
                                                  </div>
                                                </TooltipTrigger>
                                                <TooltipContent className="w-72 p-3 space-y-2">
                                                  <p className="font-semibold text-sm">Previsão de Atingimento</p>
                                                  <div className="text-xs space-y-1">
                                                    <p>Mantendo o ritmo atual desde o início do Quarter, a projeção aponta que:</p>
                                                    <div className="bg-muted p-2 rounded border mt-2">
                                                      <span className="block mb-1">Valor final projetado: <strong className="text-foreground">{kr.forecast.projectedValue.toFixed(2)}</strong></span>
                                                      <span className="block">Meta exigida: <strong className="text-foreground">{kr.target}</strong></span>
                                                    </div>
                                                  </div>
                                                </TooltipContent>
                                              </Tooltip>
                                            </TooltipProvider>
                                          )}
                                        </div>
                                        {typeof kr.attainment_kr === 'number' && !isNaN(kr.attainment_kr) && (
                                          <div className="mt-1">
                                            <span className="font-medium text-[#0d3a8c] text-xs">Atingimento:</span>
                                            <span className="ml-1 font-bold text-sm text-[#0d3a8c]">
                                              {kr.attainment_kr.toFixed(2)}%
                                            </span>
                                          </div>
                                        )}
                                      </div>

                                      <div className="flex-shrink-0 text-right flex items-center gap-2">
                                        <div className="text-xs text-muted-foreground">KR</div>
                                        <div className="text-xl font-bold px-2 py-1 rounded-md" style={{ color: 'black' }}>
                                          {kr.progress}%
                                        </div>
                                        {isAdmin && (
                                          <>
                                            <EditKRDialog
                                              krId={kr.id}
                                              companyId={objective.company_id}
                                              onSuccess={loadObjectivesFromRef}
                                              trigger={
                                                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Editar Key Result">
                                                  <Pencil className="h-4 w-4" />
                                                </Button>
                                              }
                                            />
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-8 w-8 text-destructive"
                                              aria-label="Excluir Key Result"
                                              onClick={() => setKrToDelete(kr.id)}
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </>
                                        )}
                                      </div>
                                    </div>

                                    <Progress
                                      value={kr.progress}
                                      style={{ '--progress-color': getProgressColor(kr.progress) } as any}
                                      className="h-2"
                                    />
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog: Excluir Objetivo */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este objetivo? Esta ação não pode ser desfeita e todos os Key Results associados também serão excluídos permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? 'Excluindo...' : 'Excluir'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog: Excluir KR */}
        <AlertDialog open={krToDelete !== null} onOpenChange={(open) => !open && !isDeletingKr && setKrToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão do Key Result</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este Key Result? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingKr}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteKrConfirm}
                disabled={isDeletingKr}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeletingKr ? 'Excluindo...' : 'Excluir'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
