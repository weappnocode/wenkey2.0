
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Trophy, TrendingUp, Target, AlertTriangle, XOctagon } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { toTitleCase } from '@/lib/utils';

interface Company {
    id: string;
    name: string;
}

interface Quarter {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    is_active: boolean;
}

interface UserProfile {
    id: string;
    full_name: string;
    avatar_url: string | null;
    sector: string | null;
    is_active: boolean;
    company_id: string;
}

interface QuarterResult {
    quarter_id: string;
    user_id: string;
    result_percent: number;
}

interface KR {
    id: string;
    title: string;
    target: number;
    current: number;
    percent_kr: number;
}

interface ObjectiveWithKRs {
    id: string;
    title: string;
    progress: number;
    profiles?: {
        full_name: string;
        sector: string | null;
    };
    key_results: KR[];
}

export default function PerformanceHistory() {
    const { selectedCompanyId, selectedCompany } = useCompany();
    const { user } = useAuth();
    const { isAdmin, role } = useUserRole();
    const [loading, setLoading] = useState(true);
    const [activeUsersOnly, setActiveUsersOnly] = useState(true);
    const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

    // Data State
    const [quarters, setQuarters] = useState<Quarter[]>([]);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [results, setResults] = useState<QuarterResult[]>([]);

    // Admin Filter State — inicializa já com a empresa do contexto (localStorage)
    const [filterCompanyId, setFilterCompanyId] = useState<string>(selectedCompanyId || "");

    // Drill-down State
    const [selectedQuarterId, setSelectedQuarterId] = useState<string | null>(null);
    const [quarterObjectives, setQuarterObjectives] = useState<ObjectiveWithKRs[]>([]);
    const [loadingObjectives, setLoadingObjectives] = useState(false);
    const [expandedObjectiveIds, setExpandedObjectiveIds] = useState<Set<string>>(new Set());

    const fetchQuarterObjectives = useCallback(async (quarterId: string, userId: string) => {
        if (selectedQuarterId === quarterId) {
            setSelectedQuarterId(null);
            setQuarterObjectives([]);
            return;
        }

        setSelectedQuarterId(quarterId);
        setLoadingObjectives(true);
        setExpandedObjectiveIds(new Set());

        try {
            let query = supabase
                .from('objectives')
                .select(`
                    id, title, progress, user_id,
                    profiles!user_id(full_name, sector),
                    key_results(id, title, target, current, percent_kr)
                `)
                .eq('quarter_id', quarterId);

            if (role === 'admin' || role === 'manager') {
                query = query.eq('company_id', filterCompanyId);
            } else {
                query = query.eq('user_id', userId);
            }

            const { data, error } = await query.order('created_at', { ascending: true });

            if (error) throw error;
            setQuarterObjectives(data as unknown as ObjectiveWithKRs[] || []);
        } catch (err) {
            console.error("Error fetching objectives:", err);
            toast.error("Erro ao carregar objetivos do quarter.");
        } finally {
            setLoadingObjectives(false);
        }
    }, [selectedQuarterId, role, filterCompanyId]);

    const toggleObjective = (objId: string) => {
        setExpandedObjectiveIds(prev => {
            const next = new Set(prev);
            if (next.has(objId)) next.delete(objId);
            else next.add(objId);
            return next;
        });
    };

    const loadData = useCallback(async () => {
        try {
            setLoading(true);

            // 1. Fetch Quarters (sorted by date)
            const { data: quartersData, error: quartersError } = await supabase
                .from('quarters')
                .select('*')
                .eq('company_id', filterCompanyId)
                .order('start_date', { ascending: true });

            if (quartersError) throw quartersError;
            setQuarters(quartersData || []);

            // 2. Fetch Users
            let usersQuery = supabase
                .from('profiles')
                .select('id, full_name, avatar_url, sector, is_active, company_id')
                .eq('company_id', filterCompanyId)
                .order('full_name');

            // Se for perfil 'user', força a ver apenas a si mesmo
            if (role === 'user' && user) {
                usersQuery = usersQuery.eq('id', user.id);
            }

            const { data: usersData, error: usersError } = await usersQuery;

            const normalizedUsers = (usersData || []).map(u => {
                let avatarUrl = u.avatar_url;
                if (avatarUrl && !avatarUrl.startsWith('http')) {
                    const { data } = supabase.storage.from('avatars').getPublicUrl(avatarUrl);
                    avatarUrl = data.publicUrl;
                }
                return { ...u, avatar_url: avatarUrl };
            });

            setUsers(normalizedUsers);

            // 3. Fetch Quarter Results
            const { data: resultsData, error: resultsError } = await supabase
                .from('quarter_results')
                .select('quarter_id, user_id, result_percent')
                .eq('company_id', filterCompanyId);

            if (resultsError) throw resultsError;
            setResults(resultsData || []);

        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : '';
            const isTransient = msg.includes('Failed to fetch') || msg.includes('AbortError');
            if (!isTransient) {
                console.error('Error loading history:', error);
                toast.error('Erro ao carregar histórico de performance');
            } else {
                console.warn('[PerformanceHistory] Erro transitório, ignorando:', msg);
            }
        } finally {
            setLoading(false);
        }
    }, [filterCompanyId, role, user?.id]);

    useEffect(() => {
        if (selectedCompanyId) {
            setFilterCompanyId(selectedCompanyId);
        }
    }, [selectedCompanyId]);

    useEffect(() => {
        if (filterCompanyId) {
            loadData();
        }
    }, [filterCompanyId, loadData]);

    // Helper to get result for a specific cell
    const getResult = (userId: string, quarterId: string) => {
        return results.find(r => r.user_id === userId && r.quarter_id === quarterId);
    };

    // Helper to calculate average for a user
    const getUserAverage = useCallback((userId: string) => {
        const userResults = results.filter(r => r.user_id === userId);
        if (userResults.length === 0) return 0;

        const sum = userResults.reduce((acc, curr) => acc + (curr.result_percent || 0), 0);
        return Math.round(sum / userResults.length);
    }, [results]);

    const getPerformanceColor = (pct: number) => {
        return 'text-black font-normal';
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(part => part[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const sortedAndFilteredUsers = useMemo(() => {
        const list = activeUsersOnly ? users.filter(u => u.is_active) : [...users];
        return list.sort((a, b) => {
            const avgA = getUserAverage(a.id);
            const avgB = getUserAverage(b.id);
            return avgB - avgA;
        });
    }, [users, activeUsersOnly, getUserAverage]);

    const effectiveCompanyId = isAdmin ? filterCompanyId : selectedCompanyId;

    if (!effectiveCompanyId) {
        return (
            <Layout>
                <div className="flex h-[50vh] items-center justify-center text-muted-foreground">
                    Selecione uma empresa para visualizar o histórico.
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="space-y-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            <TrendingUp className="h-8 w-8" />
                            {toTitleCase('Histórico de Performance')}
                        </h1>
                        <p className="text-base font-normal text-black">
                            {toTitleCase('Acompanhamento de resultados por quarter e média anual dos colaboradores.')}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {isAdmin && (
                            <div className="w-[240px] h-10 px-3 flex items-center rounded-md border bg-muted/30 text-sm text-foreground">
                                {selectedCompany?.name ? toTitleCase(selectedCompany.name) : toTitleCase('Nenhuma empresa selecionada')}
                            </div>
                        )}
                        <Select
                            value={activeUsersOnly ? "active" : "all"}
                            onValueChange={(v) => setActiveUsersOnly(v === "active")}
                        >
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder={toTitleCase('Filtro de usuários')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">{toTitleCase('Apenas Ativos')}</SelectItem>
                                <SelectItem value="all">{toTitleCase('Todos os Usuários')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Trophy className="h-5 w-5" />
                            {toTitleCase('Tabela de Resultados')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex justify-center py-12">
                                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary"></div>
                            </div>
                        ) : sortedAndFilteredUsers.length === 0 ? (
                            <div className="text-center py-8 text-base font-normal text-muted-foreground">
                                {toTitleCase('Nenhum colaborador encontrado.')}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[300px] text-black">{toTitleCase('Colaborador')}</TableHead>
                                            {quarters.map(quarter => (
                                                <TableHead key={quarter.id} className="text-center min-w-[100px] text-black">
                                                    <div>{toTitleCase(quarter.name)}</div>
                                                    <div className="text-xs font-normal text-black">
                                                        {new Date(quarter.end_date).toLocaleDateString()}
                                                    </div>
                                                </TableHead>
                                            ))}
                                            <TableHead className="text-center font-normal bg-muted/30 w-[120px] text-base text-black">
                                                {toTitleCase('Média Geral')}
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedAndFilteredUsers.map(user => {
                                            const avg = getUserAverage(user.id);
                                            const isExpanded = expandedUserId === user.id;

                                            return (
                                                <React.Fragment key={user.id}>
                                                    <TableRow
                                                        onClick={() => {
                                                            const isNowExpanded = expandedUserId !== user.id;
                                                            setExpandedUserId(isNowExpanded ? user.id : null);
                                                            if (!isNowExpanded) {
                                                                setSelectedQuarterId(null);
                                                                setQuarterObjectives([]);
                                                            }
                                                        }}
                                                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                                                    >
                                                        <TableCell>
                                                            <div className="flex items-center gap-3">
                                                                <Avatar>
                                                                    <AvatarImage src={user.avatar_url || undefined} />
                                                                    <AvatarFallback>{getInitials(user.full_name)}</AvatarFallback>
                                                                </Avatar>
                                                                <div>
                                                                    <div className="text-base font-normal">{toTitleCase(user.full_name)}</div>
                                                                    {user.sector && (
                                                                        <div className="text-sm text-black">{toTitleCase(user.sector)}</div>
                                                                    )}
                                                                </div>
                                                                <div className="ml-auto flex-shrink-0">
                                                                    {isExpanded ? (
                                                                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                                                                    ) : (
                                                                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </TableCell>

                                                        {quarters.map(quarter => {
                                                            const result = getResult(user.id, quarter.id);
                                                            return (
                                                                <TableCell key={quarter.id} className="text-center text-base font-normal">
                                                                    {result ? (
                                                                        <span className={getPerformanceColor(result.result_percent).replace('font-bold', 'font-normal')}>
                                                                            {Math.round(result.result_percent)}%
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-black">-</span>
                                                                    )}
                                                                </TableCell>
                                                            );
                                                        })}

                                                        <TableCell className="text-center bg-muted/30">
                                                            {avg > 0 ? (
                                                                <Badge variant="outline" className={`${getPerformanceColor(avg).replace('font-bold', 'font-normal')} border-current text-base font-normal`}>
                                                                    {avg}%
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-muted-foreground text-base">-</span>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                    {isExpanded && (
                                                        <TableRow className="bg-muted/10 hover:bg-muted/10">
                                                            <TableCell colSpan={quarters.length + 2} className="p-0 border-b">
                                                                <div className="p-6">
                                                                    <div className="flex items-center gap-2 mb-4">
                                                                        <TrendingUp className="h-4 w-4 text-primary" />
                                                                        <h3 className="font-semibold">{toTitleCase('Desempenho por Quarter')} - {toTitleCase(user.full_name)}</h3>
                                                                    </div>
                                                                    <div className="h-[250px] w-full mt-2">
                                                                        <ResponsiveContainer width="100%" height="100%">
                                                                            <BarChart
                                                                                data={quarters.map(q => {
                                                                                    const res = getResult(user.id, q.id);
                                                                                    return {
                                                                                        name: toTitleCase(q.name),
                                                                                        value: res ? Math.round(res.result_percent) : 0,
                                                                                        quarterId: q.id
                                                                                    };
                                                                                })}
                                                                                layout="vertical"
                                                                                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                                                            >
                                                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                                                                <XAxis type="number" domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                                                                                <YAxis dataKey="name" type="category" width={100} />
                                                                                <RechartsTooltip
                                                                                    formatter={(value: number) => [`${value}%`, 'Resultado']}
                                                                                    labelStyle={{ color: 'black' }}
                                                                                />
                                                                                <Bar
                                                                                    dataKey="value"
                                                                                    fill="hsl(var(--primary))"
                                                                                    radius={[0, 4, 4, 0]}
                                                                                    style={{ cursor: 'pointer' }}
                                                                                    onClick={(data: any) => {
                                                                                        console.log('Bar clicked:', data);
                                                                                        const qId = data?.quarterId || data?.payload?.quarterId;
                                                                                        if (qId) {
                                                                                            fetchQuarterObjectives(qId, user.id);
                                                                                        } else {
                                                                                            console.warn('quarterId not found in Recharts onClick payload');
                                                                                        }
                                                                                    }}
                                                                                />
                                                                            </BarChart>
                                                                        </ResponsiveContainer>
                                                                    </div>

                                                                    {selectedQuarterId && (
                                                                        <div className="mt-8 border-t pt-6 bg-muted/5 rounded-b-md px-4 pb-4 mx-[-24px] mb-[-24px]">
                                                                            <h4 className="text-lg font-semibold flex items-center gap-2 mb-4 text-black">
                                                                                <Target className="h-5 w-5 text-primary" />
                                                                                {toTitleCase('Objetivos do Quarter')}
                                                                            </h4>
                                                                            {loadingObjectives ? (
                                                                                <div className="flex justify-center py-6">
                                                                                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary"></div>
                                                                                </div>
                                                                            ) : quarterObjectives.length === 0 ? (
                                                                                <p className="text-sm text-muted-foreground text-center mb-4">Nenhum objetivo encontrado para este quarter.</p>
                                                                            ) : (
                                                                                <div className="space-y-3">
                                                                                    {quarterObjectives.map(obj => (
                                                                                        <Collapsible
                                                                                            key={obj.id}
                                                                                            open={expandedObjectiveIds.has(obj.id)}
                                                                                            onOpenChange={() => toggleObjective(obj.id)}
                                                                                            className="border rounded-md bg-background overflow-hidden shadow-sm"
                                                                                        >
                                                                                            <CollapsibleTrigger asChild>
                                                                                                <div className="p-4 cursor-pointer hover:bg-muted/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                                                                    <div className="flex-1">
                                                                                                        <div className="flex flex-wrap items-center gap-2">
                                                                                                            <h5 className="font-semibold text-base text-black">{toTitleCase(obj.title)}</h5>
                                                                                                            {(isAdmin || role === 'manager') && obj.profiles?.full_name && (
                                                                                                                <Badge variant="secondary" className="font-normal text-xs bg-muted/50 border-muted text-muted-foreground capitalize">
                                                                                                                    {toTitleCase(obj.profiles.full_name)} {obj.profiles.sector ? `- ${toTitleCase(obj.profiles.sector)}` : ''}
                                                                                                                </Badge>
                                                                                                            )}
                                                                                                        </div>
                                                                                                        <div className="flex items-center gap-4 mt-2">
                                                                                                            <div className="flex-1 max-w-[200px]">
                                                                                                                <Progress value={obj.progress} className="h-2" />
                                                                                                            </div>
                                                                                                            <span className="text-sm font-medium">{obj.progress}%</span>
                                                                                                            <span className="text-xs font-medium text-black ml-4 bg-muted px-2 py-0.5 rounded-full">{obj.key_results?.length || 0} KRs</span>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                    <div className="flex items-center justify-end">
                                                                                                        {expandedObjectiveIds.has(obj.id) ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                                                                                                    </div>
                                                                                                </div>
                                                                                            </CollapsibleTrigger>
                                                                                            <CollapsibleContent>
                                                                                                <div className="p-4 bg-muted/20 border-t space-y-3">
                                                                                                    {(!obj.key_results || obj.key_results.length === 0) ? (
                                                                                                        <p className="text-sm text-muted-foreground text-center">Nenhum Key Result cadastrado.</p>
                                                                                                    ) : (
                                                                                                        obj.key_results.map(kr => (
                                                                                                            <div key={kr.id} className="bg-background border rounded-md p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                                                                                                                <div className="flex-1">
                                                                                                                    <p className="font-medium text-sm text-black">{toTitleCase(kr.title)}</p>
                                                                                                                    <p className="text-xs text-muted-foreground mt-1 font-medium">
                                                                                                                        Meta: {kr.target} <span className="mx-2 opacity-50">|</span> Atual: {kr.current}
                                                                                                                    </p>
                                                                                                                </div>
                                                                                                                <div className="text-left sm:text-right bg-muted/40 px-3 py-1.5 rounded-md border border-muted min-w-[120px]">
                                                                                                                    <span className="block text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">Atingimento</span>
                                                                                                                    <span className="font-bold text-[#0d3a8c] text-sm">
                                                                                                                        {typeof kr.percent_kr === 'number' && !isNaN(kr.percent_kr) ? kr.percent_kr.toFixed(2) : '0'}%
                                                                                                                    </span>
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        ))
                                                                                                    )}
                                                                                                </div>
                                                                                            </CollapsibleContent>
                                                                                        </Collapsible>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </Layout>
    );
}
