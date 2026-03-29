import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LEADERSHIP_RADAR_URL = `${SUPABASE_URL}/functions/v1/leadership-radar`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// BRT = UTC-3. Converte uma data ISO para início do dia em BRT (meia-noite BRT = 03:00 UTC)
function checkinDateToBRTMidnightUTC(dateStr: string): Date {
    // dateStr = "YYYY-MM-DD" — meia-noite em BRT = UTC+3h
    return new Date(`${dateStr}T03:00:00.000Z`);
}

// Calcula o momento de disparo: meia-noite BRT do checkin - N horas
function calcTriggerUTC(checkinDateStr: string, hoursBefore: number): Date {
    const midnight = checkinDateToBRTMidnightUTC(checkinDateStr);
    return new Date(midnight.getTime() - hoursBefore * 3600 * 1000);
}

// Verifica se "agora" está dentro de uma janela de disparo de ±30 min do trigger
function isWithinWindow(triggerUTC: Date, nowUTC: Date): boolean {
    const diff = Math.abs(nowUTC.getTime() - triggerUTC.getTime());
    return diff <= 30 * 60 * 1000; // ±30 minutos
}

async function processCompany(company: any, quarter: any, nowUTC: Date) {
    const checkinDate: string = quarter.end_date; // "YYYY-MM-DD"
    const companyId: string = company.id;
    const logs: string[] = [];

    // ─────────────────────────────────────────
    // 1. RADAR EMAIL AUTOMÁTICO
    // ─────────────────────────────────────────
    if (company.radar_email_enabled) {
        const radarTrigger = calcTriggerUTC(checkinDate, company.radar_email_hours_before);

        if (isWithinWindow(radarTrigger, nowUTC)) {
            // Verifica se já foi gerado nas últimas 20h para evitar duplicata
            const { data: recentRadar } = await supabase
                .from("leadership_radars")
                .select("id, created_at")
                .eq("company_id", companyId)
                .gte("created_at", new Date(nowUTC.getTime() - 20 * 3600 * 1000).toISOString())
                .limit(1)
                .maybeSingle();

            if (recentRadar) {
                logs.push(`[${companyId}] Radar já enviado nas últimas 20h — pulando.`);
            } else {
                logs.push(`[${companyId}] Disparando geração automática do Radar...`);
                try {
                    // Busca o quarter ativo e usuário responsável para gerar
                    const res = await fetch(`${LEADERSHIP_RADAR_URL}/generate`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
                        },
                        body: JSON.stringify({
                            company_id: companyId,
                            quarter_id: quarter.id,
                            scope: "company",
                            triggered_by: "scheduler",
                        }),
                    });
                    const result = await res.json();
                    if (res.ok) {
                        logs.push(`[${companyId}] ✅ Radar gerado e enviado. ID: ${result.id}`);
                    } else {
                        logs.push(`[${companyId}] ❌ Falha ao gerar radar: ${JSON.stringify(result)}`);
                    }
                } catch (err: any) {
                    logs.push(`[${companyId}] ❌ Erro ao chamar leadership-radar: ${err.message}`);
                }
            }
        }
    }

    // ─────────────────────────────────────────
    // 2. BLOQUEIO DA PLATAFORMA
    // ─────────────────────────────────────────
    if (company.platform_lock_enabled) {
        const lockStart = calcTriggerUTC(checkinDate, company.platform_lock_hours_before);
        const checkinEnd = checkinDateToBRTMidnightUTC(checkinDate);
        // Bloqueio termina no fim do dia do check-in (23:59h BRT = 02:59 UTC do dia seguinte)
        const lockEnd = new Date(checkinEnd.getTime() + 23 * 3600 * 1000 + 59 * 60 * 1000);

        const shouldBeLocked = nowUTC >= lockStart && nowUTC <= lockEnd;

        // Só atualiza se o estado mudou
        if (shouldBeLocked !== company.is_locked) {
            const { error } = await supabase
                .from("companies")
                .update({
                    is_locked: shouldBeLocked,
                    locked_until: shouldBeLocked ? lockEnd.toISOString() : null,
                    updated_at: nowUTC.toISOString(),
                })
                .eq("id", companyId);

            if (error) {
                logs.push(`[${companyId}] ❌ Erro ao atualizar is_locked: ${error.message}`);
            } else {
                logs.push(`[${companyId}] 🔒 Plataforma ${shouldBeLocked ? "BLOQUEADA" : "DESBLOQUEADA"} (checkin: ${checkinDate})`);
            }
        }
    }

    return logs;
}

Deno.serve(async (req: Request) => {
    // Aceita tanto GET (pg_cron) quanto POST (teste manual)
    if (req.method !== "GET" && req.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
    }

    const nowUTC = new Date();
    const allLogs: string[] = [`[scheduler] Iniciando às ${nowUTC.toISOString()}`];

    try {
        // Busca todas as empresas que têm alguma das features ativas
        const { data: companies, error: compErr } = await supabase
            .from("companies")
            .select("id, radar_email_enabled, radar_email_hours_before, platform_lock_enabled, platform_lock_hours_before, is_locked")
            .or("radar_email_enabled.eq.true,platform_lock_enabled.eq.true");

        if (compErr) throw compErr;
        if (!companies || companies.length === 0) {
            allLogs.push("[scheduler] Nenhuma empresa com automação ativa.");
            return new Response(JSON.stringify({ ok: true, logs: allLogs }), {
                headers: { "Content-Type": "application/json" },
            });
        }

        allLogs.push(`[scheduler] ${companies.length} empresa(s) para processar.`);

        // Para cada empresa, busca o quarter ativo
        for (const company of companies) {
            const { data: quarter } = await supabase
                .from("quarters")
                .select("id, end_date, name")
                .eq("company_id", company.id)
                .eq("is_active", true)
                .gte("end_date", nowUTC.toISOString().split("T")[0])
                .order("end_date", { ascending: true })
                .limit(1)
                .maybeSingle();

            if (!quarter) {
                allLogs.push(`[${company.id}] Sem quarter ativo com end_date futuro — pulando.`);
                continue;
            }

            const companyLogs = await processCompany(company, quarter, nowUTC);
            allLogs.push(...companyLogs);
        }

        allLogs.push(`[scheduler] Concluído às ${new Date().toISOString()}`);
        return new Response(JSON.stringify({ ok: true, logs: allLogs }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (err: any) {
        allLogs.push(`[scheduler] ❌ Erro fatal: ${err.message}`);
        return new Response(JSON.stringify({ ok: false, logs: allLogs, error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
});
