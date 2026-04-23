import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calculateKR } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useUserRole } from '@/hooks/useUserRole';

export function useDashboardChartData(filterUserId?: string | null) {
    const { user } = useAuth();
    const { selectedCompanyId: company_id } = useCompany();
    const { role, loading: roleLoading } = useUserRole();

    const enabled = !!user && !!company_id && !roleLoading;

    return useQuery({
        queryKey: ['dashboard-chart', company_id, user?.id, role, filterUserId],
        queryFn: async () => {
            if (!user || !company_id || !role) return { checkins: [], averages: {} };

            // 1. Get active quarter
            const { data: quarters } = await supabase
                .from('quarters')
                .select('id, start_date, end_date')
                .eq('company_id', company_id)
                .order('start_date', { ascending: false });

            if (!quarters || quarters.length === 0) return { checkins: [], averages: {} };

            const today = new Date().toISOString().split('T')[0];
            const activeQuarter = quarters.find(q => q.start_date <= today && q.end_date >= today) || quarters[0];
            const quarter_id = activeQuarter.id;

            // 2. Get checkins for the quarter
            let checkinsQuery = supabase
                .from('checkins')
                .select('id, checkin_date, user_id')
                .eq('quarter_id', quarter_id)
                .order('checkin_date', { ascending: true });

            const { data: checkins } = await checkinsQuery;

            if (!checkins || checkins.length === 0) return { checkins: [], averages: {} };

            // 3. Get Objectives & KRs
            let userIdFilter: string | null = null;
            if (role === 'user') {
                userIdFilter = user.id;
            } else if (role === 'admin') {
                userIdFilter = (filterUserId && filterUserId !== 'all') ? filterUserId : null;
            } else if (role === 'manager') {
                userIdFilter = null;
            }

            let objectivesQuery = supabase
                .from('objectives')
                .select('id, title, user_id, profiles!user_id!inner(is_active)')
                .eq('company_id', company_id)
                .eq('quarter_id', quarter_id)
                .eq('archived', false)
                .eq('profiles.is_active', true);

            if (userIdFilter) {
                // Find KRs owned by user to include their objectives too
                const { data: userKrs } = await supabase
                    .from('key_results')
                    .select('objective_id')
                    .eq('user_id', userIdFilter);

                const userKrObjIds = (userKrs || []).map(kr => kr.objective_id);

                if (userKrObjIds.length > 0) {
                    objectivesQuery = objectivesQuery.or(`user_id.eq.${userIdFilter},id.in.(${userKrObjIds.join(',')})`);
                } else {
                    objectivesQuery = objectivesQuery.eq('user_id', userIdFilter);
                }
            }

            const { data: objectives } = await objectivesQuery;
            if (!objectives || objectives.length === 0) return { checkins, averages: {} };

            const objectiveIds = objectives.map(o => o.id);

            let krsQuery = supabase
                .from('key_results')
                .select('id, objective_id, direction, type, weight, user_id, profiles!user_id!inner(is_active)')
                .in('objective_id', objectiveIds)
                .eq('profiles.is_active', true);

            if (userIdFilter) {
                krsQuery = krsQuery.eq('user_id', userIdFilter);
            }

            const { data: krs } = await krsQuery;
            if (!krs || krs.length === 0) return { checkins, averages: {} };

            const krIds = krs.map(kr => kr.id);

            // 4. Get checkin_results for these KRs (only for actual recorded check-ins)
            const checkinIds = checkins.map(c => c.id);

            const { data: checkinResults } = await supabase
                .from('checkin_results')
                .select('checkin_id, key_result_id, valor_realizado, meta_checkin, minimo_orcamento')
                .in('checkin_id', checkinIds)
                .in('key_result_id', krIds);

            // Mapa direto: checkin_id -> lista de resultados DESSE checkin específico
            const resultsByCheckinId = new Map<string, typeof checkinResults>();
            (checkinResults || []).forEach(r => {
                if (!resultsByCheckinId.has(r.checkin_id)) resultsByCheckinId.set(r.checkin_id, []);
                resultsByCheckinId.get(r.checkin_id)!.push(r);
            });

            // Group KRs by objective title
            const titleMap = new Map<string, typeof krs>();
            const objectiveIdToTitle = new Map<string, string>();
            objectives.forEach(obj => {
                objectiveIdToTitle.set(obj.id, obj.title);
                if (!titleMap.has(obj.title)) titleMap.set(obj.title, []);
            });
            krs.forEach(kr => {
                const title = objectiveIdToTitle.get(kr.objective_id);
                if (title) titleMap.get(title)?.push(kr);
            });
            const grouped = Array.from(titleMap.entries())
                .map(([title, keyResults]) => ({ title, keyResults }))
                .filter(g => g.keyResults.length > 0);

            const averages: Record<string, { average: number; hasData: boolean }> = {};

            checkins.forEach(checkin => {
                // Só calcula se há resultados registrados NESTE check-in específico
                const thisCheckinResults = resultsByCheckinId.get(checkin.id) || [];

                if (thisCheckinResults.length === 0) {
                    averages[checkin.id] = { average: 0, hasData: false };
                    return;
                }

                let sum = 0;
                let count = 0;

                grouped.forEach(group => {
                    let groupWeightedSum = 0;
                    let groupTotalWeight = 0;
                    let groupHasData = false;

                    group.keyResults.forEach(kr => {
                        // Resultado deste KR NESTE checkin — sem carry-forward
                        const result = thisCheckinResults.find(r => r.key_result_id === kr.id);

                        if (result && result.valor_realizado !== null && result.meta_checkin !== null && result.minimo_orcamento !== null) {
                            const krPct = calculateKR(result.valor_realizado, result.minimo_orcamento, result.meta_checkin, kr.direction, kr.type);
                            if (krPct !== null) {
                                const weight = typeof kr.weight === 'number' && !Number.isNaN(kr.weight) ? kr.weight : 1;
                                groupWeightedSum += krPct * weight;
                                groupTotalWeight += weight;
                                groupHasData = true;
                            }
                        }
                    });

                    if (groupHasData && groupTotalWeight > 0) {
                        const groupAvg = groupWeightedSum / groupTotalWeight;
                        sum += groupAvg;
                        count++;
                    }
                });

                if (count > 0) {
                    averages[checkin.id] = { average: Math.round(sum / count), hasData: true };
                } else {
                    averages[checkin.id] = { average: 0, hasData: false };
                }
            });

            return { checkins, averages };
        },
        enabled,
        staleTime: 5 * 60 * 1000,
    });
}
