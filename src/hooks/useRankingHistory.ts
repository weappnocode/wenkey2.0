import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calculateKR } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useUserRole } from '@/hooks/useUserRole';

export interface RankingHistoryPoint {
    date: string;
    checkin_id: string;
    [userName: string]: number | string; // userName -> result_pct
}

export function useRankingHistory() {
    const { user } = useAuth();
    const { selectedCompanyId: company_id } = useCompany();
    const { role, loading: roleLoading } = useUserRole();

    const enabled = !!user && !!company_id && !roleLoading;

    return useQuery({
        queryKey: ['ranking-history', company_id],
        queryFn: async () => {
            if (!user || !company_id) return [];

            // 1. Get active quarter
            const today = new Date().toISOString().split('T')[0];
            const { data: quarters } = await supabase
                .from('quarters')
                .select('id, name, start_date, end_date')
                .eq('company_id', company_id)
                .order('start_date', { ascending: false });

            if (!quarters || quarters.length === 0) return [];
            const activeQuarter = quarters.find(q => q.start_date <= today && q.end_date >= today) || quarters[0];

            // 2. Get all active users (profiles)
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, is_team')
                .eq('company_id', company_id)
                .eq('is_active', true)
                .eq('exclude_from_okr', false);

            if (!profiles || profiles.length === 0) return [];

            // 3. Get all checkins for this quarter (global, sorted)
            const { data: checkins } = await supabase
                .from('checkins')
                .select('id, checkin_date')
                .eq('quarter_id', activeQuarter.id)
                .order('checkin_date', { ascending: true });

            if (!checkins || checkins.length === 0) return [];

            // 4. Get all objectives and KRs for the quarter
            const { data: objectives } = await supabase
                .from('objectives')
                .select('id, title, user_id')
                .eq('quarter_id', activeQuarter.id)
                .eq('archived', false);

            if (!objectives || objectives.length === 0) return [];

            const { data: krs } = await supabase
                .from('key_results')
                .select('id, objective_id, direction, type, weight, user_id')
                .in('objective_id', objectives.map(o => o.id));

            if (!krs || krs.length === 0) return [];

            // 5. Get all checkin results for these KRs in this quarter
            const { data: allResults } = await supabase
                .from('checkin_results')
                .select('checkin_id, key_result_id, valor_realizado, meta_checkin, minimo_orcamento')
                .in('checkin_id', checkins.map(c => c.id))
                .in('key_result_id', krs.map(kr => kr.id));

            // Map checkin_id to checkin_date for quick lookup
            const checkinDateMap = new Map(checkins.map(c => [c.id, c.checkin_date]));
            
            // Map objective_id to title
            const objIdToTitle = new Map(objectives.map(o => [o.id, o.title]));

            // Pre-process: Group KRs by user and then by objective title
            const userToObjectiveGroups = new Map<string, Map<string, typeof krs>>();
            
            krs.forEach(kr => {
                const userId = kr.user_id;
                if (!userId) return;
                
                if (!userToObjectiveGroups.has(userId)) {
                    userToObjectiveGroups.set(userId, new Map());
                }
                
                const title = objIdToTitle.get(kr.objective_id) || 'Sem Título';
                const groups = userToObjectiveGroups.get(userId)!;
                if (!groups.has(title)) {
                    groups.set(title, []);
                }
                groups.get(title)!.push(kr);
            });

            // Calculate history
            const history: RankingHistoryPoint[] = [];

            checkins.forEach(checkin => {
                const point: RankingHistoryPoint = {
                    date: checkin.checkin_date,
                    checkin_id: checkin.id
                };

                const checkinDate = checkin.checkin_date;

                // For each user, calculate performance at this checkin date
                profiles.forEach(profile => {
                    const userId = profile.id;
                    const objectiveGroups = userToObjectiveGroups.get(userId);
                    
                    if (!objectiveGroups || objectiveGroups.size === 0) {
                        return;
                    }

                    // Get latest result for each KR up to this checkin date
                    const latestResultPerKR = new Map<string, typeof allResults[0]>();
                    (allResults || []).forEach(res => {
                        const resDate = checkinDateMap.get(res.checkin_id);
                        if (!resDate || resDate > checkinDate) return;

                        const existing = latestResultPerKR.get(res.key_result_id);
                        const existingDate = existing ? checkinDateMap.get(existing.checkin_id) : null;

                        if (!existing || (existingDate && resDate > existingDate)) {
                            latestResultPerKR.set(res.key_result_id, res);
                        }
                    });

                    // Calculate weighted average of objectives
                    const groupAverages: number[] = [];
                    objectiveGroups.forEach((groupKRs) => {
                        let weightedSum = 0;
                        let totalWeight = 0;
                        let hasData = false;

                        groupKRs.forEach(kr => {
                            const result = latestResultPerKR.get(kr.id);
                            if (result && result.valor_realizado !== null && result.meta_checkin !== null) {
                                const krPct = calculateKR(
                                    result.valor_realizado,
                                    result.minimo_orcamento,
                                    result.meta_checkin,
                                    kr.direction,
                                    kr.type
                                );
                                if (krPct !== null) {
                                    const weight = typeof kr.weight === 'number' && !Number.isNaN(kr.weight) ? kr.weight : 1;
                                    weightedSum += krPct * weight;
                                    totalWeight += weight;
                                    hasData = true;
                                }
                            }
                        });

                        if (hasData && totalWeight > 0) {
                            groupAverages.push(weightedSum / totalWeight);
                        }
                    });

                    if (groupAverages.length > 0) {
                        const avg = groupAverages.reduce((s, v) => s + v, 0) / groupAverages.length;
                        point[profile.full_name] = Math.round(avg);
                    } else {
                        point[profile.full_name] = 0;
                    }
                });

                history.push(point);
            });

            return history;
        },
        enabled,
        staleTime: 5 * 60 * 1000,
    });
}
