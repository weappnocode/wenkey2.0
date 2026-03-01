import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useUserRole } from '@/hooks/useUserRole';
import { calculateKR } from '@/lib/utils';

// Interfaces
export interface Quarter {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    is_active: boolean;
}

export interface UserProfile {
    id: string;
    company_id: string;
    full_name: string;
    sector: string | null;
    avatar_url: string | null;
    is_active: boolean;
}

export interface QuarterPerformance {
    quarter_id: string;
    quarter_name: string;
    result_pct: number;
    is_active: boolean;
    status: 'current' | 'finished' | 'future';
}

export interface UserRanking {
    rank: number;
    user_id: string;
    full_name: string;
    sector: string | null;
    avatar_url: string | null;
    result_pct: number;
}

export interface ObjectiveRanking {
    objective_title: string;
    result_pct: number;
    kr_count: number;
}

export interface OKRRanking {
    code: string | null;
    title: string;
    result_pct: number;
    owner_name: string | null;
    owner_sector: string | null;
    owner_avatar_url: string | null;
}

export interface DashboardData {
    company_id: string;
    user_id: string;
    quarters: Quarter[];
    active_quarter: Quarter | null;
    userProfile: UserProfile | null;
    metrics: {
        activeObjectivesCount: number;
        activeOKRsCount: number;
        currentQuarterProgress: number;
        quarterPerformance: QuarterPerformance[];
        userRankings: UserRanking[];
        objectiveRankings: ObjectiveRanking[];
        okrRankings: OKRRanking[];
    };
}

// Helper Functions (Business Logic)
const calculateQuarterProgress = async (
    companyId: string,
    quarterId: string,
    userId: string | null
): Promise<number> => {
    let query = supabase
        .from('objectives')
        .select('id')
        .eq('company_id', companyId)
        .eq('quarter_id', quarterId)
        .eq('archived', false);

    if (userId) {
        query = query.eq('user_id', userId);
    }

    const { data: objectives } = await query;

    if (!objectives || objectives.length === 0) return 0;

    const objectiveIds = objectives.map(o => o.id);

    const { data: krs } = await supabase
        .from('key_results')
        .select('id, objective_id, direction, type, percent_kr, weight')
        .in('objective_id', objectiveIds);

    if (!krs || krs.length === 0) return 0;

    const krIds = krs.map(kr => kr.id);

    const { data: checkins } = await supabase
        .from('checkin_results')
        .select('key_result_id, percentual_atingido, valor_realizado, meta_checkin, minimo_orcamento, created_at, checkins!inner(quarter_id, checkin_date)')
        .eq('checkins.quarter_id', quarterId)
        .in('key_result_id', krIds);

    const objAverages: number[] = [];

    objectiveIds.forEach(objId => {
        const objKrs = krs.filter(kr => kr.objective_id === objId);
        if (objKrs.length === 0) return;

        let weightedSum = 0;
        let totalWeight = 0;
        let hasData = false;

        objKrs.forEach((kr: any) => {
            const today = new Date().toISOString().split('T')[0];
            const krCheckins = (checkins || [])
                .filter(c => c.key_result_id === kr.id && c.checkins?.checkin_date <= today)
                .sort((a, b) => new Date(b.checkins?.checkin_date || 0).getTime() - new Date(a.checkins?.checkin_date || 0).getTime());

            if (krCheckins.length > 0) {
                const latest = krCheckins[0];
                const krProgress = calculateKR(
                    latest.valor_realizado,
                    latest.minimo_orcamento,
                    latest.meta_checkin,
                    kr.direction,
                    kr.type
                );

                if (krProgress !== null) {
                    const weight = typeof kr.weight === 'number' && !Number.isNaN(kr.weight) ? kr.weight : 1;
                    weightedSum += krProgress * weight;
                    totalWeight += weight;
                    hasData = true;
                }
            }
        });

        if (hasData && totalWeight > 0) {
            objAverages.push(weightedSum / totalWeight);
        } else {
            // Se não tem check-ins, faz média simples dos percent_kr para não zerar
            let fallbackSum = 0;
            let fallbackWeight = 0;
            objKrs.forEach((kr: any) => {
                const weight = typeof kr.weight === 'number' && !Number.isNaN(kr.weight) ? kr.weight : 1;
                fallbackSum += (kr.percent_kr || 0) * weight;
                fallbackWeight += weight;
            });
            if (fallbackWeight > 0) {
                objAverages.push(fallbackSum / fallbackWeight);
            } else {
                objAverages.push(0);
            }
        }
    });

    if (objAverages.length === 0) return 0;

    const avg = objAverages.reduce((sum, val) => sum + val, 0) / objAverages.length;
    return Math.round(avg);
};

// Hook Principal
export function useDashboardData() {
    const { user } = useAuth();
    const { selectedCompanyId } = useCompany();
    const { role, loading: roleLoading } = useUserRole();

    const enabled = !!user && !!selectedCompanyId && !roleLoading;

    return useQuery({
        queryKey: ['dashboard', user?.id, selectedCompanyId, role],
        queryFn: async (): Promise<DashboardData | null> => {
            if (!user || !selectedCompanyId || !role) return null;

            // 1. Fetch User Profile & Quarters (Basic Data)
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('id, company_id, full_name, sector, avatar_url, is_active')
                .eq('id', user.id)
                .maybeSingle();

            if (profileError) {
                console.error("[useDashboardData] profileError:", profileError);
            }

            if (!profile) {
                console.warn("[useDashboardData] No profile found");
                return null;
            }

            // Admins can view any company's dashboard, so we shouldn't fail if they don't have a company_id
            // ONLY if they aren't an admin and don't have a company_id should we fail.
            if (!profile.company_id && role !== 'admin') {
                console.warn("[useDashboardData] No company in profile and not admin");
                return null;
            }

            let avatar_url = profile.avatar_url;
            if (avatar_url && !avatar_url.startsWith('http')) {
                const { data } = supabase.storage.from('avatars').getPublicUrl(avatar_url);
                avatar_url = data.publicUrl;
            }

            const { data: quarters, error: quartersError } = await supabase
                .from('quarters')
                .select('id, name, start_date, end_date, is_active')
                .eq('company_id', selectedCompanyId)
                .order('start_date', { ascending: false });

            if (quartersError) {
                console.error("[useDashboardData] quartersError:", quartersError);
            }

            if (!quarters || quarters.length === 0) {
                console.warn("[useDashboardData] No quarters found for company", selectedCompanyId);
                // Return data with empty quarters instead of completely failing the dashboard
                // Let's not return null here, return the partial data so we can see the profile
                // but the UI handles it as missing active_quarter.
                return {
                    company_id: selectedCompanyId,
                    user_id: user.id,
                    quarters: [],
                    active_quarter: null,
                    userProfile: { ...profile, avatar_url, company_id: profile.company_id || selectedCompanyId },
                    metrics: {
                        activeObjectivesCount: 0,
                        activeOKRsCount: 0,
                        currentQuarterProgress: 0,
                        quarterPerformance: [],
                        userRankings: [],
                        objectiveRankings: [],
                        okrRankings: []
                    }
                };
            }

            const today = new Date().toISOString().split('T')[0];
            const activeQuarter = quarters.find(q => q.start_date <= today && q.end_date >= today) || quarters[0];

            // 2. Fetch Metrics (Role Dependent)
            const userIdFilter = (role === 'admin' || role === 'manager') ? null : user.id;

            // ... (Metrics calculation logic migrated from Dashboard.tsx)
            // Active Objectives Count
            let objectivesQuery = supabase
                .from('objectives')
                .select('id')
                .eq('company_id', selectedCompanyId)
                .eq('quarter_id', activeQuarter.id)
                .eq('archived', false);

            if (userIdFilter) objectivesQuery = objectivesQuery.eq('user_id', userIdFilter);
            const { data: userObjectives } = await objectivesQuery;
            const activeObjectivesCount = userObjectives?.length ?? 0;

            // Active OKRs Count
            let activeOKRsCount = 0;
            if (activeObjectivesCount > 0) {
                const objectiveIds = userObjectives!.map(obj => obj.id);
                const { count } = await supabase
                    .from('key_results')
                    .select('*', { count: 'exact', head: true })
                    .eq('company_id', selectedCompanyId)
                    .in('objective_id', objectiveIds);
                activeOKRsCount = count ?? 0;
            }

            // Current Quarter Progress
            let currentQuarterProgress = 0;
            if (role === 'user') {
                const { data: quarterResult } = await supabase
                    .from('quarter_results')
                    .select('result_percent')
                    .eq('company_id', selectedCompanyId)
                    .eq('user_id', user.id)
                    .eq('quarter_id', activeQuarter.id)
                    .maybeSingle();

                if (quarterResult && quarterResult.result_percent !== null) {
                    currentQuarterProgress = Math.round(quarterResult.result_percent);
                } else {
                    currentQuarterProgress = await calculateQuarterProgress(selectedCompanyId, activeQuarter.id, user.id);
                }
            } else {
                const { data: allQuarterResults } = await supabase
                    .from('quarter_results')
                    .select('result_percent')
                    .eq('company_id', selectedCompanyId)
                    .eq('quarter_id', activeQuarter.id);

                if (allQuarterResults && allQuarterResults.length > 0) {
                    const validResults = allQuarterResults
                        .map(r => r.result_percent)
                        .filter((val): val is number => val !== null);
                    if (validResults.length > 0) {
                        const avg = validResults.reduce((sum, val) => sum + val, 0) / validResults.length;
                        currentQuarterProgress = Math.round(avg);
                    }
                }
            }

            // Rankings Calculation (Inline or helper)
            // Helper: User Rankings
            const { data: profilesData } = await supabase
                .from('profiles')
                .select('id, full_name, sector, avatar_url, is_active')
                .eq('company_id', selectedCompanyId)
                .eq('is_active', true);

            const { data: quarterResults } = await supabase
                .from('quarter_results')
                .select('user_id, result_percent')
                .eq('company_id', selectedCompanyId)
                .eq('quarter_id', activeQuarter.id);

            const quarterResultsMap = new Map((quarterResults || []).map(r => [r.user_id, r.result_percent]));

            let userRankings: UserRanking[] = [];
            if (profilesData && profilesData.length > 0) {
                profilesData.forEach(prof => {
                    let av = prof.avatar_url;
                    if (av && !av.startsWith('http')) {
                        const { data } = supabase.storage.from('avatars').getPublicUrl(av);
                        av = data.publicUrl;
                    }
                    userRankings.push({
                        rank: 0,
                        user_id: prof.id,
                        full_name: prof.full_name,
                        sector: prof.sector,
                        avatar_url: av,
                        result_pct: Math.round(quarterResultsMap.get(prof.id) || 0)
                    });
                });

                // Sort descending
                userRankings.sort((a, b) => b.result_pct - a.result_pct);

                // Re-assign ranks
                userRankings = userRankings.map((r, i) => ({ ...r, rank: i + 1 }));
            }

            const getKRAttainment = (kr: any, quarterId: string) => {
                const today = new Date().toISOString().split('T')[0];
                const results = (kr.checkin_results || []).filter((r: any) =>
                    r.checkins && r.checkins.quarter_id === quarterId && r.checkins.checkin_date <= today
                );
                const latestResult = [...results].sort((a: any, b: any) =>
                    new Date(b.checkins?.checkin_date || 0).getTime() - new Date(a.checkins?.checkin_date || 0).getTime()
                )[0];

                if (latestResult) {
                    return calculateKR(
                        latestResult.valor_realizado,
                        latestResult.minimo_orcamento,
                        latestResult.meta_checkin,
                        kr.direction,
                        kr.type
                    );
                }
                return null;
            };

            // Helper: Objective Rankings
            let allObjectivesQuery = supabase
                .from('objectives')
                .select('id, title, percent_obj, user_id, key_results (id, percent_kr, type, direction, target, weight, checkin_results(percentual_atingido, valor_realizado, meta_checkin, minimo_orcamento, created_at, checkins(quarter_id, checkin_date)))')
                .eq('company_id', selectedCompanyId)
                .eq('quarter_id', activeQuarter.id)
                .eq('archived', false);

            if (userIdFilter) {
                allObjectivesQuery = allObjectivesQuery.eq('user_id', userIdFilter);
            }

            const { data: allObjectives } = await allObjectivesQuery;

            const objectiveRankings: ObjectiveRanking[] = [];
            if (allObjectives && allObjectives.length > 0) {
                const groups = new Map<string, { totalPct: number; userCount: number; krCount: number }>();
                allObjectives.forEach(obj => {
                    const title = obj.title.trim();
                    const current = groups.get(title) || { totalPct: 0, userCount: 0, krCount: 0 };

                    let objAttainment = 0;
                    const krs = obj.key_results as any[] || [];
                    if (krs.length > 0) {
                        let weightedSum = 0;
                        let totalWeight = 0;
                        let hasData = false;

                        krs.forEach((kr: any) => {
                            const krPercentage = getKRAttainment(kr, activeQuarter.id);
                            const weight = typeof kr.weight === 'number' && !Number.isNaN(kr.weight) ? kr.weight : 1;

                            if (krPercentage !== null) {
                                weightedSum += krPercentage * weight;
                                totalWeight += weight;
                                hasData = true;
                            }
                        });

                        if (hasData && totalWeight > 0) {
                            objAttainment = weightedSum / totalWeight;
                        } else {
                            let fallbackSum = 0;
                            let fallbackWeight = 0;
                            krs.forEach((kr: any) => {
                                const weight = typeof kr.weight === 'number' && !Number.isNaN(kr.weight) ? kr.weight : 1;
                                fallbackSum += (kr.percent_kr || 0) * weight;
                                fallbackWeight += weight;
                            });
                            objAttainment = fallbackWeight > 0 ? fallbackSum / fallbackWeight : 0;
                        }
                    }

                    current.totalPct += objAttainment;
                    current.userCount += 1;
                    current.krCount += krs.length;
                    groups.set(title, current);
                });
                for (const [title, stats] of groups.entries()) {
                    const avg = Math.round(stats.totalPct / stats.userCount);
                    objectiveRankings.push({
                        objective_title: title,
                        result_pct: avg,
                        kr_count: stats.krCount
                    });
                }
                objectiveRankings.sort((a, b) => b.result_pct - a.result_pct);
            }

            // Helper: OKR Rankings
            let krsQuery = supabase.from('key_results')
                .select('title, code, percent_kr, type, direction, target, user_id, objectives(user_id), checkin_results(percentual_atingido, valor_realizado, meta_checkin, minimo_orcamento, created_at, checkins(quarter_id))')
                .eq('company_id', selectedCompanyId)
                .eq('quarter_id', activeQuarter.id);
            if (userIdFilter) krsQuery = krsQuery.eq('user_id', userIdFilter);

            const { data: krs } = await krsQuery;
            const okrRankings: OKRRanking[] = [];
            if (krs && krs.length > 0) {
                const ownerIds = Array.from(new Set(krs.map(kr => (kr.objectives as any)?.user_id || kr.user_id).filter(Boolean)));
                const { data: owners } = await supabase.from('profiles').select('id, full_name, sector, avatar_url').in('id', ownerIds);
                const ownersMap = new Map(owners?.map(o => [o.id, o]) || []);
                krs.forEach(kr => {
                    const ownerId = (kr.objectives as any)?.user_id || kr.user_id;
                    const owner = ownersMap.get(ownerId);
                    let av = owner?.avatar_url;
                    if (av && !av.startsWith('http')) {
                        const { data } = supabase.storage.from('avatars').getPublicUrl(av);
                        av = data.publicUrl;
                    }

                    const krAttainment = getKRAttainment(kr, activeQuarter.id);
                    const finalPct = krAttainment !== null ? krAttainment : (kr.percent_kr ?? 0);

                    okrRankings.push({
                        code: kr.code,
                        title: kr.title,
                        result_pct: Math.round(finalPct),
                        owner_name: owner?.full_name ?? null,
                        owner_sector: owner?.sector ?? null,
                        owner_avatar_url: av ?? null
                    });
                });
                okrRankings.sort((a, b) => b.result_pct - a.result_pct);
            }

            // Quarter Performance History
            const quarterPerformance: QuarterPerformance[] = [];
            for (const q of quarters) {
                let result_pct = 0;
                let status: 'current' | 'finished' | 'future' = 'future';
                if (today >= q.start_date && today <= q.end_date) status = 'current';
                else if (today > q.end_date) status = 'finished';

                if (role !== 'admin') { // User specific
                    const { data: qResult } = await supabase.from('quarter_results')
                        .select('result_percent')
                        .eq('company_id', selectedCompanyId)
                        .eq('user_id', user.id)
                        .eq('quarter_id', q.id)
                        .maybeSingle();
                    if (qResult && qResult.result_percent !== null) result_pct = Math.round(qResult.result_percent);
                    else if (status === 'current') result_pct = await calculateQuarterProgress(selectedCompanyId, q.id, user.id);
                } else { // Admin (Company wide)
                    // Logic simplified for history - using calculateQuarterProgress(null) for simplicity or existing results
                    result_pct = await calculateQuarterProgress(selectedCompanyId, q.id, null);
                }

                quarterPerformance.push({
                    quarter_id: q.id,
                    quarter_name: q.name,
                    result_pct,
                    is_active: q.id === activeQuarter.id,
                    status
                });
            }

            return {
                company_id: selectedCompanyId,
                user_id: user.id,
                quarters,
                active_quarter: activeQuarter,
                userProfile: { ...profile, avatar_url },
                metrics: {
                    activeObjectivesCount,
                    activeOKRsCount,
                    currentQuarterProgress,
                    quarterPerformance,
                    userRankings,
                    objectiveRankings,
                    okrRankings
                }
            };
        },
        enabled,
        staleTime: 5 * 60 * 1000, // 5 minutes cache
        refetchOnWindowFocus: false
    });
}
