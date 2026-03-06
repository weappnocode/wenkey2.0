import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function calculateKR(
    realizado: number,
    minimo: number,
    meta: number,
    direction: string,
    type: string
): number | null {
    if (type === "percentage") return Math.min(realizado, 100);

    if (direction === "increase") {
        if (meta <= minimo) return null;
        return Math.round(((realizado - minimo) / (meta - minimo)) * 100);
    } else if (direction === "decrease") {
        if (minimo <= meta) return null;
        return Math.round(((minimo - realizado) / (minimo - meta)) * 100);
    }
    return null;
}

function getPerformanceLabel(pct: number): string {
    if (pct >= 100) return "🟢 No alvo";
    if (pct >= 70) return "🟡 Em risco";
    return "🔴 Abaixo do esperado";
}

function getProgressColor(pct: number): string {
    if (pct >= 100) return "#16a34a";
    if (pct >= 70) return "#d97706";
    return "#dc2626";
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const today = new Date().toISOString().split("T")[0];

        // 1. Busca todas as empresas com quarter ativo
        const { data: activeQuarters } = await supabase
            .from("quarters")
            .select("id, name, company_id, start_date, end_date")
            .lte("start_date", today)
            .gte("end_date", today);

        if (!activeQuarters || activeQuarters.length === 0) {
            return new Response(
                JSON.stringify({ success: true, message: "Nenhum quarter ativo encontrado.", emails: [] }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const emailPayloads = [];

        for (const quarter of activeQuarters) {
            const companyId = quarter.company_id;
            const quarterId = quarter.id;

            // 2. Busca usuários ativos da empresa (com email via auth.users)
            const { data: profiles } = await supabase
                .from("profiles")
                .select("id, full_name, sector, avatar_url")
                .eq("company_id", companyId)
                .eq("is_active", true);

            if (!profiles || profiles.length === 0) continue;

            const profileIds = profiles.map((p) => p.id);

            // 3. Busca emails dos usuários via auth.users (service role)
            const { data: authUsers } = await supabase.auth.admin.listUsers();
            const emailMap = new Map<string, string>();
            if (authUsers?.users) {
                authUsers.users.forEach((u) => {
                    emailMap.set(u.id, u.email ?? "");
                });
            }

            // 4. Busca objetivos da empresa neste quarter
            const { data: objectives } = await supabase
                .from("objectives")
                .select("id, title, user_id")
                .eq("company_id", companyId)
                .eq("quarter_id", quarterId)
                .eq("archived", false);

            const objectiveIds = objectives?.map((o) => o.id) ?? [];

            // 5. Busca KRs com checkins
            const { data: krs } = await supabase
                .from("key_results")
                .select("id, title, code, type, direction, percent_kr, weight, objective_id, user_id, checkin_results(percentual_atingido, valor_realizado, meta_checkin, minimo_orcamento, checkins(quarter_id, checkin_date))")
                .in("objective_id", objectiveIds.length > 0 ? objectiveIds : ["00000000-0000-0000-0000-000000000000"]);

            // 6. Busca quarter_results para ranking
            const { data: quarterResults } = await supabase
                .from("quarter_results")
                .select("user_id, result_percent")
                .eq("company_id", companyId)
                .eq("quarter_id", quarterId);

            const resultMap = new Map<string, number>();
            quarterResults?.forEach((r) => {
                resultMap.set(r.user_id, Math.round(r.result_percent ?? 0));
            });

            // 7. Monta ranking geral da empresa
            const companyRanking = profiles
                .map((p) => ({
                    user_id: p.id,
                    full_name: p.full_name,
                    sector: p.sector,
                    result_pct: resultMap.get(p.id) ?? 0,
                }))
                .sort((a, b) => b.result_pct - a.result_pct)
                .map((r, i) => ({ ...r, rank: i + 1 }));

            // 8. Monta ranking de OKRs da empresa (top 6 por atingimento)
            const krAttainments: Array<{
                title: string;
                code: string | null;
                result_pct: number;
                owner_name: string | null;
            }> = [];

            krs?.forEach((kr) => {
                const checkins = (kr.checkin_results as Record<string, unknown>[] ?? [])
                    .filter((c) => (c.checkins as Record<string, unknown>)?.quarter_id === quarterId)
                    .sort((a, b) =>
                        new Date((b.checkins as Record<string, unknown>).checkin_date as string).getTime() -
                        new Date((a.checkins as Record<string, unknown>).checkin_date as string).getTime()
                    );

                const latest = checkins[0] as Record<string, unknown> | undefined;
                let pct = kr.percent_kr ?? 0;
                if (latest) {
                    const calc = calculateKR(
                        Number(latest.valor_realizado),
                        Number(latest.minimo_orcamento),
                        Number(latest.meta_checkin),
                        kr.direction as string,
                        kr.type as string
                    );
                    if (calc !== null) pct = calc;
                }

                const owner = profiles.find((p) => p.id === kr.user_id);
                krAttainments.push({
                    title: kr.title,
                    code: kr.code,
                    result_pct: Math.round(pct),
                    owner_name: owner?.full_name ?? null,
                });
            });
            krAttainments.sort((a, b) => b.result_pct - a.result_pct);
            const topOKRs = krAttainments.slice(0, 6);

            // 9. Para cada usuário, monta o payload do email
            for (const profile of profiles) {
                const email = emailMap.get(profile.id);
                if (!email) continue;

                const userResult = resultMap.get(profile.id) ?? 0;
                const userRank = companyRanking.find((r) => r.user_id === profile.id);

                // Objetivos do usuário
                const userObjectives = objectives?.filter((o) => o.user_id === profile.id) ?? [];
                const userObjectiveIds = userObjectives.map((o) => o.id);
                const userKRs = krs?.filter((kr) => userObjectiveIds.includes(kr.objective_id)) ?? [];

                // Progresso por objetivo do usuário
                const objectiveProgress = userObjectives.map((obj) => {
                    const objKRs = userKRs.filter((kr) => kr.objective_id === obj.id);
                    let totalPct = 0;
                    let count = 0;
                    objKRs.forEach((kr) => {
                        const checkins = (kr.checkin_results as Record<string, unknown>[] ?? [])
                            .filter((c) => (c.checkins as Record<string, unknown>)?.quarter_id === quarterId)
                            .sort((a, b) =>
                                new Date((b.checkins as Record<string, unknown>).checkin_date as string).getTime() -
                                new Date((a.checkins as Record<string, unknown>).checkin_date as string).getTime()
                            );
                        const latest = checkins[0] as Record<string, unknown> | undefined;
                        if (latest) {
                            const calc = calculateKR(
                                Number(latest.valor_realizado),
                                Number(latest.minimo_orcamento),
                                Number(latest.meta_checkin),
                                kr.direction as string,
                                kr.type as string
                            );
                            totalPct += calc !== null ? calc : (kr.percent_kr ?? 0);
                        } else {
                            totalPct += kr.percent_kr ?? 0;
                        }
                        count++;
                    });
                    const avg = count > 0 ? Math.round(totalPct / count) : 0;
                    return {
                        title: obj.title,
                        result_pct: avg,
                        color: getProgressColor(avg),
                        label: getPerformanceLabel(avg),
                    };
                });

                // Top 5 ranking (empresa)
                const top5 = companyRanking.slice(0, 5);

                emailPayloads.push({
                    to_email: email,
                    to_name: profile.full_name,
                    quarter_name: quarter.name,
                    user_progress: userResult,
                    user_rank: userRank?.rank ?? 0,
                    active_objectives: userObjectives.length,
                    active_okrs: userKRs.length,
                    objective_progress: objectiveProgress,
                    top5_ranking: top5,
                    top_okrs: topOKRs,
                    dashboard_url: "https://wenkey.com.br/dashboard",
                });
            }
        }

        return new Response(
            JSON.stringify({ success: true, count: emailPayloads.length, emails: emailPayloads }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("[get-weekly-report-data] Error:", error);
        return new Response(
            JSON.stringify({ error: (error as Error).message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
