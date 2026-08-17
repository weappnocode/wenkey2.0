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
        // Piso tambem no decrescente: realizado acima do MIN. ORCAM. zera.
        // Mesma regra ja aplicada em src/pages/KRCheckins.tsx (calculateKR local).
        if (safeMin !== null && safeRealized > safeMin) return 0;
        if (safeTarget === 0) return 0;
        return Math.max(0, ((2 * safeTarget - safeRealized) / safeTarget) * 100);
    }
    return 0;
}


// ─────────────────────────────────────────────────────────────────────────
// Check-in ativo: MESMA regra de calculateQuarterProgress()
// (src/hooks/useDashboardData.ts), que alimenta o card "Progresso do Quarter
// Atual" no Dashboard. E o check-in cuja JANELA contem agora -- ou seja, o
// mais recente cuja data ja chegou, antes do proximo comecar.
//
// Importante: a lista vem da tabela `checkins` (todas as datas agendadas do
// quarter), NAO de checkin_results. Se o check-in ativo ainda nao tem
// resultado lancado, o certo e nao pontuar -- e nao cair no anterior.
// ─────────────────────────────────────────────────────────────────────────
function pickActiveCheckinDate(dates: (string | null | undefined)[], nowMs: number): string | null {
    const unique = Array.from(new Set(dates.filter((d): d is string => !!d)))
        .sort((a, b) => new Date(`${a}T00:00:00`).getTime() - new Date(`${b}T00:00:00`).getTime());

    if (unique.length === 0) return null;

    for (let i = 0; i < unique.length; i++) {
        const start = new Date(`${unique[i]}T00:00:00`).getTime();
        const nextStart = unique[i + 1] ? new Date(`${unique[i + 1]}T00:00:00`).getTime() : null;
        if (nextStart === null && nowMs >= start) return unique[i];
        if (nextStart !== null && nowMs >= start && nowMs < nextStart) return unique[i];
    }

    return unique[unique.length - 1];
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

    // Dominio do app. Estava "wenkey.com.br" fixo aqui, mas o resto do
    // projeto usa wenkey.app: o botao do email ia para o lugar errado.
    const APP_URL = (Deno.env.get("APP_URL") ?? "https://wenkey.app").replace(/\/+$/, "");

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
            .select("company_id, day_of_week, send_hour, is_active, last_sent_at");

        const scheduleMap = new Map<string, { day_of_week: number; send_hour: number; is_active: boolean; last_sent_at: string | null }>();
        (scheduleConfigs ?? []).forEach((s) => scheduleMap.set(s.company_id, s));

        // -- Emails de auth.users: UMA vez, paginado -------------------------
        // listUsers() sem argumento devolve apenas 50 registros do projeto
        // inteiro. Sem paginar, do 51o usuario em diante ninguem recebia, sem
        // erro e sem log (falha silenciosa).
        const emailMap = new Map<string, string>();
        const PER_PAGE = 200;
        for (let page = 1; page <= 100; page++) {
            const { data: authPage, error: authErr } = await supabase.auth.admin.listUsers({
                page,
                perPage: PER_PAGE,
            });
            if (authErr) throw new Error(`listUsers falhou na pagina ${page}: ${authErr.message}`);
            const users = authPage?.users ?? [];
            if (users.length === 0) break;   // para na primeira pagina vazia
            users.forEach((u) => { if (u.email) emailMap.set(u.id, u.email); });
        }
        console.log(`[get-weekly-report-data] ${emailMap.size} emails carregados de auth.users`);

        // -- Inicio da semana corrente: segunda-feira 00:00 BRT --------------
        const curIdx = (currentDayBRT + 6) % 7;            // Seg=0 ... Dom=6
        const weekStartBRT = new Date(nowBRT);
        weekStartBRT.setUTCDate(nowBRT.getUTCDate() - curIdx);
        weekStartBRT.setUTCHours(0, 0, 0, 0);
        // nowBRT e UTC deslocado -3h; volta ao instante real para comparar
        // com o timestamptz gravado em last_sent_at
        const weekStartUTC = new Date(weekStartBRT.getTime() + 3 * 60 * 60 * 1000);

        const emailPayloads = [];
        const skipped: string[] = [];
        const marked: string[] = [];

        for (const quarter of activeQuarters) {
            const companyId = quarter.company_id;
            const quarterId = quarter.id;
            const payloadsAntes = emailPayloads.length;

            // -- Agenda: vencimento + catch-up + idempotencia semanal --------
            if (!isTest) {
                const schedule = scheduleMap.get(companyId);
                const cfg = schedule ?? { day_of_week: 1, send_hour: 9, is_active: true, last_sent_at: null };
                if (!schedule) skipped.push(`${companyId}(sem config; usando padrao seg/09h)`);

                if (!cfg.is_active) { skipped.push(`${companyId}(envio desativado)`); continue; }

                // Ja enviou nesta semana? Nunca duplica, mesmo reexecutando.
                if (cfg.last_sent_at && new Date(cfg.last_sent_at) >= weekStartUTC) {
                    skipped.push(`${companyId}(ja enviado nesta semana em ${cfg.last_sent_at})`);
                    continue;
                }

                // Venceu? O >= da catch-up: se o cron falhou as 9h, envia as 10h.
                const cfgIdx = (cfg.day_of_week + 6) % 7;
                const isDue = curIdx > cfgIdx || (curIdx === cfgIdx && currentHourBRT >= cfg.send_hour);
                if (!isDue) {
                    skipped.push(
                        `${companyId}(ainda nao venceu: agora=dia${currentDayBRT}/${currentHourBRT}h ` +
                        `alvo=dia${cfg.day_of_week}/${cfg.send_hour}h)`
                    );
                    continue;
                }
            }

            // Profiles
            let profileQuery = supabase
                .from("profiles")
                .select("id, full_name, sector, avatar_url")
                .eq("company_id", companyId)
                .eq("is_active", true)
                .eq("exclude_from_okr", false);

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

            // Todas as datas de check-in agendadas para o quarter
            const { data: quarterCheckins } = await supabase
                .from("checkins")
                .select("checkin_date")
                .eq("quarter_id", quarterId);

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

            // Check-in ativo: UM so, para todos os KRs -- mesma escolha do
            // Dashboard. Antes cada KR usava o SEU proprio ultimo check-in,
            // entao KRs do mesmo objetivo vinham de datas diferentes.
            const activeCheckinDate: string | null = pickActiveCheckinDate(
                (quarterCheckins ?? []).map((c: Record<string, string>) => c.checkin_date),
                Date.now(),
            );

            // Devolve null quando o KR nao deve entrar na conta -- o chamador
            // descarta. Antes caia em `percent_kr` (valor residual gravado na
            // tabela) e ainda somava o peso, o que inflava a media: era dai que
            // saia 7% num objetivo que a tela mostra como 0%.
            function getKRProgress(kr: Record<string, unknown>): number | null {
                if (!activeCheckinDate) return null;

                const r = checkinResults.find((c: Record<string, unknown>) =>
                    c.key_result_id === kr.id &&
                    (c.checkins as Record<string, string>)?.checkin_date === activeCheckinDate
                ) as Record<string, number | null> | undefined;

                if (!r) return null;

                // Mesma exigencia do Dashboard: realizado e meta preenchidos.
                // minimo_orcamento pode ser nulo -- calculateKR trata isso como
                // "sem Piso" e usa a formula simples. Exigir os tres (como faz a
                // tela de Check-ins) descartaria KR sem Piso definido.
                if (r.valor_realizado === null || r.meta_checkin === null) {
                    return null;
                }

                return calculateKR(
                    Number(r.valor_realizado), Number(r.minimo_orcamento),
                    Number(r.meta_checkin), kr.direction as string, kr.type as string
                );
            }

            function getWeightedProgress(krList: Record<string, unknown>[]): number {
                let weightedSum = 0; let totalWeight = 0;
                krList.forEach((kr) => {
                    const pct = getKRProgress(kr);
                    if (pct === null) return;   // descarta, sem fallback
                    const weight = typeof kr.weight === 'number' && !isNaN(kr.weight) ? kr.weight : 1;
                    weightedSum += pct * weight;
                    totalWeight += weight;
                });
                return totalWeight > 0 ? weightedSum / totalWeight : 0;
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
                        result_pct: Math.round(getKRProgress(kr) ?? 0),
                    }))
                    // Do MENOR para o maior: o que precisa de atencao aparece
                    // primeiro. Sem corte -- o .slice(0, 6) que existia aqui
                    // escondia justamente o KR de pior desempenho e deixava a
                    // lista em desacordo com o contador "OKRs ativos" do topo.
                    .sort((a: Record<string, unknown>, b: Record<string, unknown>) => (a.result_pct as number) - (b.result_pct as number));

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
                    dashboard_url: `${APP_URL}/dashboard`,
                });
            }
            // -- Marca a semana como enviada (idempotencia) ------------------
            // ATENCAO: marca quando os payloads foram ENTREGUES ao n8n, nao
            // quando o Gmail confirmou a entrega. Se o n8n cair depois deste
            // ponto, a semana fica marcada como enviada.
            if (!isTest && emailPayloads.length > payloadsAntes) {
                const { error: markErr } = await supabase
                    .from("email_schedule_config")
                    .upsert(
                        { company_id: companyId, last_sent_at: new Date().toISOString() },
                        { onConflict: "company_id" }
                    );
                if (markErr) {
                    console.error(`[get-weekly-report-data] Falha ao marcar last_sent_at de ${companyId}: ${markErr.message}`);
                } else {
                    marked.push(companyId);
                }
            }
        }

        console.log(
            `[get-weekly-report-data] ${emailPayloads.length} emails | ` +
            `marcadas: ${marked.join(", ") || "-"} | puladas: ${skipped.join(", ") || "-"}`
        );

        return new Response(
            JSON.stringify({
                success: true,
                count: emailPayloads.length,
                is_test: isTest,
                auth_users_loaded: emailMap.size,
                week_start_brt: weekStartUTC.toISOString(),
                marked,
                skipped,
                emails: emailPayloads,
            }),
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
