import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Exact replica of src/lib/utils.ts calculateKR ──────────────────────────
function calculateKR(
    realized: number | null,
    min: number | null,
    target: number | null,
    direction: string | null,
    type?: string | null
): number | null {
    if (target === null || target === undefined || isNaN(Number(target))) return null;
    const safeTarget = Number(target);
    const safeRealized = (realized === null || realized === undefined || isNaN(Number(realized))) ? null : Number(realized);
    const safeMin = (min !== null && min !== undefined && !isNaN(Number(min))) ? Number(min) : null;
    if (type === 'date' || type === 'data') return null;
    if (safeRealized === null) return null;
    if (!direction || direction === 'increase' || direction === 'maior-é-melhor') {
        if (safeMin !== null) {
            if (safeRealized >= safeTarget) return 100;
            if (safeRealized < safeMin) return 0;
            const den = safeTarget - safeMin;
            if (den === 0) return 0;
            return Math.max(0, Math.min(100, ((safeRealized - safeMin) / den) * 100));
        }
        if (safeTarget === 0) return 0;
        return Math.min(100, Math.max(0, (safeRealized / safeTarget) * 100));
    }
    if (direction === 'decrease' || direction === 'menor-é-melhor') {
        if (safeRealized <= safeTarget) return 100;
        if (safeTarget === 0) return 0;
        return Math.max(0, ((2 * safeTarget - safeRealized) / safeTarget) * 100);
    }
    return 0;
}

function getProgressColor(pct: number): string {
    if (pct >= 100) return "#16a34a";
    if (pct >= 70) return "#d97706";
    return "#dc2626";
}

function getPerformanceLabel(pct: number): string {
    if (pct >= 100) return "No alvo";
    if (pct >= 70) return "Em risco";
    return "Abaixo do esperado";
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // Parsing test_user_id from body
        let testUserId: string | null = null;
        let testCompanyId: string | null = null;
        if (req.method === "POST") {
            try {
                const body = await req.json();
                testUserId = body?.user_id || null;
                console.log("[get-weekly-report-data] Test request for user:", testUserId);
            } catch (_) { /* ignore */ }
        }

        const isTest = testUserId !== null;

        if (isTest) {
            const { data: profile } = await supabase
                .from("profiles")
                .select("company_id")
                .eq("id", testUserId)
                .single();
            if (profile) testCompanyId = profile.company_id;
        }

        // Current time in BRT (UTC-3)
        const nowUTC = new Date();
        const nowBRT = new Date(nowUTC.getTime() - 3 * 60 * 60 * 1000);
        const currentDayBRT = nowBRT.getUTCDay();    // 0=Sun...6=Sat
        const currentHourBRT = nowBRT.getUTCHours(); // 0-23

        const today = nowUTC.toISOString().split("T")[0];

        let query = supabase
            .from("quarters")
            .select("id, name, company_id, start_date, end_date")
            .lte("start_date", today)
            .gte("end_date", today);

        if (isTest && testCompanyId) {
            query = query.eq("company_id", testCompanyId);
        }

        const { data: activeQuarters } = await query;

        if (!activeQuarters || activeQuarters.length === 0) {
            return new Response(
                JSON.stringify({ success: true, message: "Nenhum quarter ativo.", emails: [] }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Load schedule configs for all companies
        const { data: scheduleConfigs } = await supabase
            .from("email_schedule_config")
            .select("company_id, day_of_week, send_hour, is_active");

        const scheduleMap = new Map<string, { day_of_week: number; send_hour: number; is_active: boolean }>();
        (scheduleConfigs ?? []).forEach((s) => scheduleMap.set(s.company_id, s));

        const emailPayloads = [];
        const skipped: string[] = [];

        for (const quarter of activeQuarters) {
            const companyId = quarter.company_id;
            const quarterId = quarter.id;

            // ── Check schedule (Skip if isTest) ──────────────────────────────────
            if (!isTest) {
                const schedule = scheduleMap.get(companyId);
                if (schedule) {
                    if (!schedule.is_active) { skipped.push(companyId + "(disabled)"); continue; }
                    if (schedule.day_of_week !== currentDayBRT || schedule.send_hour !== currentHourBRT) {
                        skipped.push(companyId + `(wrong time: day=${currentDayBRT}/${schedule.day_of_week} hour=${currentHourBRT}/${schedule.send_hour})`);
                        continue;
                    }
                } else {
                    // Default: Monday (1) at 9 BRT
                    if (currentDayBRT !== 1 || currentHourBRT !== 9) {
                        skipped.push(companyId + "(default schedule not matched)");
                        continue;
                    }
                }
            }
            // ────────────────────────────────────────────────────────────

            // Profiles
            let profileQuery = supabase
                .from("profiles")
                .select("id, full_name, sector, avatar_url")
                .eq("company_id", companyId)
                .eq("is_active", true);

            if (isTest) {
                profileQuery = profileQuery.eq("id", testUserId);
            }

            const { data: profiles } = await profileQuery;

            if (!profiles || profiles.length === 0) continue;

            const profilesWithAvatars = profiles.map(p => {
                let av = p.avatar_url;
                if (av && !av.startsWith('http')) {
                    const { data } = supabase.storage.from('avatars').getPublicUrl(av);
                    av = data.publicUrl;
                }
                return { ...p, avatar_url: av };
            });

            const { data: authUsers } = await supabase.auth.admin.listUsers();
            const emailMap = new Map<string, string>();
            if (authUsers?.users) {
                authUsers.users.forEach((u) => emailMap.set(u.id, u.email ?? ""));
            }

            const { data: objectives } = await supabase
                .from("objectives")
                .select("id, title, user_id")
                .eq("company_id", companyId)
                .eq("quarter_id", quarterId)
                .eq("archived", false);

            const objectiveIds = objectives?.map((o) => o.id) ?? [];

            const krsResult = objectiveIds.length > 0
                ? await supabase
                    .from("key_results")
                    .select("id, title, code, type, direction, percent_kr, weight, objective_id, user_id")
                    .in("objective_id", objectiveIds)
                : { data: [] };
            const krs = krsResult.data ?? [];
            const krIds = krs.map((kr: Record<string, string>) => kr.id);

            const checkinResult = krIds.length > 0
                ? await supabase
                    .from("checkin_results")
                    .select("key_result_id, valor_realizado, meta_checkin, minimo_orcamento, checkins!inner(quarter_id, checkin_date)")
                    .eq("checkins.quarter_id", quarterId)
                    .in("key_result_id", krIds)
                : { data: [] };
            const checkinResults = checkinResult.data ?? [];

            const { data: quarterResults } = await supabase
                .from("quarter_results")
                .select("user_id, result_percent")
                .eq("company_id", companyId)
                .eq("quarter_id", quarterId);

            const resultMap = new Map<string, number>();
            quarterResults?.forEach((r) => resultMap.set(r.user_id, Math.round(r.result_percent ?? 0)));

            const companyRanking = profilesWithAvatars
                .map((p) => ({ user_id: p.id, full_name: p.full_name, sector: p.sector, avatar_url: p.avatar_url, result_pct: resultMap.get(p.id) ?? 0 }))
                .sort((a, b) => b.result_pct - a.result_pct)
                .map((r, i) => ({ ...r, rank: i + 1 }));

            function getKRProgress(krId: string, krType: string, krDirection: string, krPercentKr: number): number {
                const krCheckins = checkinResults
                    .filter((c: Record<string, unknown>) => c.key_result_id === krId &&
                        (c.checkins as Record<string, string>)?.checkin_date <= today)
                    .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
                        new Date((b.checkins as Record<string, string>).checkin_date).getTime() -
                        new Date((a.checkins as Record<string, string>).checkin_date).getTime()
                    );
                if (krCheckins.length === 0) return krPercentKr ?? 0;
                const latest = krCheckins[0] as Record<string, number>;
                const calc = calculateKR(
                    Number(latest.valor_realizado), Number(latest.minimo_orcamento),
                    Number(latest.meta_checkin), krDirection, krType
                );
                return calc !== null ? calc : (krPercentKr ?? 0);
            }

            function getWeightedProgress(krList: Record<string, unknown>[]): number {
                let weightedSum = 0; let totalWeight = 0; let hasData = false;
                krList.forEach((kr) => {
                    const pct = getKRProgress(kr.id as string, kr.type as string, kr.direction as string, kr.percent_kr as number);
                    const weight = typeof kr.weight === 'number' && !isNaN(kr.weight) ? kr.weight : 1;
                    const krCheckins = checkinResults.filter((c: Record<string, unknown>) => c.key_result_id === kr.id);
                    if (krCheckins.length > 0) { weightedSum += pct * weight; totalWeight += weight; hasData = true; }
                });
                if (hasData && totalWeight > 0) return weightedSum / totalWeight;
                let fb = 0; let fw = 0;
                krList.forEach((kr) => {
                    const w = typeof kr.weight === 'number' && !isNaN(kr.weight) ? kr.weight : 1;
                    fb += (kr.percent_kr as number ?? 0) * w; fw += w;
                });
                return fw > 0 ? fb / fw : 0;
            }

            for (const profile of profilesWithAvatars) {
                const email = emailMap.get(profile.id);
                if (!email) continue;
                const userRank = companyRanking.find((r) => r.user_id === profile.id);
                const userObjectives = objectives?.filter((o) => o.user_id === profile.id) ?? [];
                const userObjectiveIds = userObjectives.map((o) => o.id);
                const userKRs = krs.filter((kr: Record<string, string>) => userObjectiveIds.includes(kr.objective_id));

                const objectiveProgress = userObjectives.map((obj) => {
                    const objKRs = userKRs.filter((kr: Record<string, string>) => kr.objective_id === obj.id);
                    const avg = Math.round(getWeightedProgress(objKRs as unknown as Record<string, unknown>[]));
                    return { title: obj.title, result_pct: avg, color: getProgressColor(avg), label: getPerformanceLabel(avg) };
                });

                const userOKRs = userKRs
                    .map((kr: Record<string, unknown>) => ({
                        title: kr.title as string,
                        result_pct: Math.round(getKRProgress(kr.id as string, kr.type as string, kr.direction as string, kr.percent_kr as number)),
                    }))
                    .sort((a: Record<string, unknown>, b: Record<string, unknown>) => (b.result_pct as number) - (a.result_pct as number))
                    .slice(0, 6);

                emailPayloads.push({
                    to_email: email,
                    to_name: profile.full_name,
                    user_id: profile.id,
                    quarter_name: quarter.name,
                    user_progress: userRank?.result_pct ?? 0,
                    user_rank: userRank?.rank ?? 0,
                    active_objectives: userObjectives.length,
                    active_okrs: userKRs.length,
                    objective_progress: objectiveProgress,
                    top5_ranking: companyRanking.slice(0, 5),
                    user_okrs: userOKRs,
                    dashboard_url: "https://wenkey.com.br/dashboard",
                });
            }
        }

        console.log(`[get-weekly-report-data] Sending ${emailPayloads.length} emails. Skipped: ${skipped.join(', ')}`);

        return new Response(
            JSON.stringify({ success: true, count: emailPayloads.length, is_test: isTest, skipped, emails: emailPayloads }),
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
