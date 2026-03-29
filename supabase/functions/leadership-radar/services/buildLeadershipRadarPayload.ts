import { SupabaseClient } from "@supabase/supabase-js";

export async function buildLeadershipRadarPayload(
    supabase: SupabaseClient, 
    params: { companyId: string, quarterId: string, scope: string, userId?: string }
) {
    const { companyId, quarterId, scope, userId } = params;

    // 1. Fetch Company & Quarter
    const { data: company } = await supabase.from('companies').select('name, responsible_email').eq('id', companyId).single();
    const { data: quarter } = await supabase.from('quarters').select('id, name, start_date, end_date').eq('id', quarterId).single();

    if (!company || !quarter) {
        throw new Error("Company or Quarter not found");
    }

    // 2. Fetch Active OKRs and KRs
    // Se o scope for 'area' ou 'manager', filtramos baseados no userId.
    let objectivesQuery = supabase.from('objectives')
        .select(`
            id, title, percent_obj, archived,
            profiles:user_id (id, full_name, sector, is_active),
            key_results (
                id, title, percent_kr, direction, type, weight, target, baseline,
                checkin_results (percentual_atingido, valor_realizado, meta_checkin, minimo_orcamento, created_at, checkins (checkin_date))
            )
        `)
        .eq('company_id', companyId)
        .eq('quarter_id', quarterId)
        .eq('archived', false)
        .eq('profiles.is_active', true);

    if (scope === 'area' || scope === 'manager') {
        if (!userId) throw new Error("userId required for area/manager scope radar");
        objectivesQuery = objectivesQuery.eq('user_id', userId);
    }

    const { data: objectives, error: objError } = await objectivesQuery;
    
    if (objError) {
        throw new Error(`Error fetching objectives: ${objError.message}`);
    }

    // Processamento de métricas (Simplificado para o Payload RAG/Prompt)
    let totalObjectives = 0;
    let healthyObs = 0;
    let attentionObs = 0;
    let riskObs = 0;
    let delayedCheckins = 0;

    const areasMap: Record<string, { o_count: number, kr_count: number, avg_progress: number, delays: number }> = {};

    const objectivesPayload = (objectives || []).map((obj: any) => {
        totalObjectives++;
        const sector = (obj.profiles?.sector || 'Sem Área').trim();
        const ownerName = obj.profiles?.full_name || 'Desconhecido';

        if (!areasMap[sector]) {
            areasMap[sector] = { o_count: 0, kr_count: 0, avg_progress: 0, delays: 0 };
        }
        areasMap[sector].o_count++;

        // Status base: >= 70% Saúdavel, >= 40% Atenção, < 40% Risco 
        // (Isso poder ser inferido melhor pela IA, mas passamos hints)
        const progress = obj.percent_obj || 0;
        let inferredStatus = 'risk';
        if (progress >= 70) {
            healthyObs++; inferredStatus = 'healthy';
        } else if (progress >= 40) {
            attentionObs++; inferredStatus = 'attention';
        } else {
            riskObs++;
        }

        const krsList = (obj.key_results || []).map((kr: any) => {
            areasMap[sector].kr_count++;
            
            // Checar se há check-in na última semana, se não = atrasado
            const checkins = kr.checkin_results || [];
            let latestCheckinDate = null;
            if (checkins.length > 0) {
                // assume estão ordenados ou filtra o maior, aqui simplificaremos pegando o 1o ou length -> dependendo do order
                latestCheckinDate = checkins[0]?.checkins?.checkin_date || null;
            }

            if (!latestCheckinDate) {
                delayedCheckins++;
                areasMap[sector].delays++;
            }

            return {
                title: kr.title,
                progress: kr.percent_kr,
                target: kr.target,
                latest_checkin_date: latestCheckinDate
            };
        });

        return {
            title: obj.title,
            owner: ownerName,
            sector: sector,
            progress: progress,
            inferred_status: inferredStatus,
            krs: krsList
        };
    });

    const metricsSnapshot = {
        healthy_pct: totalObjectives > 0 ? Math.round((healthyObs / totalObjectives) * 100) : 0,
        attention_pct: totalObjectives > 0 ? Math.round((attentionObs / totalObjectives) * 100) : 0,
        risk_pct: totalObjectives > 0 ? Math.round((riskObs / totalObjectives) * 100) : 0,
        delayed_checkins: delayedCheckins,
        total_objectives: totalObjectives
    };

    return {
        company: company.name,
        company_responsible_email: company.responsible_email,
        quarter: quarter.name,
        quarter_start: quarter.start_date,
        quarter_end: quarter.end_date,
        generation_date: new Date().toISOString(),
        metricsSnapshot,
        areasContext: areasMap,
        objectives: objectivesPayload
    };
}
