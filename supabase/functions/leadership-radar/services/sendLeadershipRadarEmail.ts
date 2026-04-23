// Helpers para renderizar listas como HTML simples para o n8n
function renderAvancos(avancos: any[]): string {
    if (!avancos || avancos.length === 0) return '<p style="color:#15803d;font-size:14px;">Nenhum avanço registrado.</p>';
    return avancos.map((a: any) => {
        const texto = typeof a === 'string' ? a : (a.descricao || a.texto || a.text || a.acao || Object.values(a).join(' — '));
        return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;"><tr>
            <td style="color:#16a34a;font-size:14px;padding-right:10px;vertical-align:top;width:20px;font-weight:700;">✓</td>
            <td style="color:#15803d;font-size:14px;line-height:1.6;">${texto}</td>
        </tr></table>`;
    }).join('');
}

function renderRiscos(riscos: any[]): string {
    if (!riscos || riscos.length === 0) return '<p style="color:#b91c1c;font-size:14px;">Nenhum risco identificado.</p>';
    return riscos.map((r: any) => {
        const foco = r.foco || r.area || '';
        const gravidade = r.gravidade ? ` · ${r.gravidade.toUpperCase()}` : '';
        const motivo = r.motivo || r.descricao || r.texto || r.text || (typeof r === 'string' ? r : Object.values(r).join(' — '));
        return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;"><tr>
            <td style="vertical-align:top;padding-right:12px;width:20px;"><span style="color:#dc2626;font-weight:700;font-size:16px;">!</span></td>
            <td>
                ${foco ? `<p style="margin:0 0 3px;color:#991b1b;font-size:13px;font-weight:700;">${foco}${gravidade}</p>` : ''}
                <p style="margin:0;color:#b91c1c;font-size:14px;line-height:1.5;">${motivo}</p>
            </td>
        </tr></table>`;
    }).join('');
}

function renderAreasDestaque(areas: any[]): string {
    if (!areas || areas.length === 0) return '<p style="color:#92400e;font-size:14px;">Sem áreas em destaque.</p>';
    return areas.map((a: any) => {
        const texto = typeof a === 'string' ? a : (a.area || a.nome || a.texto || a.text || Object.values(a).join(' — '));
        return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;"><tr>
            <td style="color:#d97706;font-size:14px;padding-right:10px;vertical-align:top;width:20px;">★</td>
            <td style="color:#92400e;font-size:14px;line-height:1.6;">${texto}</td>
        </tr></table>`;
    }).join('');
}

function renderRecomendacoes(recomendacoes: any[]): string {
    if (!recomendacoes || recomendacoes.length === 0) return '<p style="color:#334155;font-size:14px;">Nenhuma recomendação gerada.</p>';
    return recomendacoes.map((r: any, i: number) => {
        const acao = typeof r === 'string' ? r : (r.acao || r.descricao || r.texto || r.text || '');
        const prioridade = r.prioridade || '';
        return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;"><tr>
            <td style="vertical-align:top;padding-right:12px;width:28px;">
                <div style="background-color:#4f46e5;border-radius:50%;width:22px;height:22px;text-align:center;line-height:22px;color:#ffffff;font-size:11px;font-weight:700;">${i + 1}</div>
            </td>
            <td>
                <p style="margin:0 0 2px;color:#1e293b;font-size:14px;font-weight:600;">${acao}</p>
                ${prioridade ? `<p style="margin:0;color:#64748b;font-size:12px;">Prioridade: <span style="color:#4f46e5;font-weight:600;">${prioridade}</span></p>` : ''}
            </td>
        </tr></table>`;
    }).join('');
}

function getStatusBanner(status: string): string {
    if (status === 'saudavel') {
        return `<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background-color:#f0fdf4;padding:12px 40px;text-align:center;border-bottom:1px solid #bbf7d0;"><span style="color:#16a34a;font-size:13px;font-weight:700;">✅ STATUS GERAL: SAUDÁVEL — OKRs no caminho certo</span></td></tr></table>`;
    } else if (status === 'atencao') {
        return `<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background-color:#fffbeb;padding:12px 40px;text-align:center;border-bottom:1px solid #fde68a;"><span style="color:#d97706;font-size:13px;font-weight:700;">⚠️ STATUS GERAL: ATENÇÃO — Pontos críticos identificados</span></td></tr></table>`;
    } else {
        return `<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background-color:#fef2f2;padding:12px 40px;text-align:center;border-bottom:1px solid #fecaca;"><span style="color:#dc2626;font-size:13px;font-weight:700;">🚨 STATUS GERAL: RISCO — Ação imediata necessária</span></td></tr></table>`;
    }
}

export async function sendLeadershipRadarEmail(radarRecord: any) {
    const N8N_BASE_URL = "https://n8n.weappnocode.com/webhook";
    const WEBHOOK_PATH = "29032026";

    console.log(`[sendLeadershipRadarEmail] Sending radar ${radarRecord.id} to n8n webhook...`);

    try {
        const n8nUrl = `${N8N_BASE_URL}/${WEBHOOK_PATH}`;
        const metrics = radarRecord.metrics_snapshot || {};

        // Payload com HTML pré-renderizado — o n8n só injeta strings simples
        const payload = {
            radar_id: radarRecord.id,
            recipient_email: radarRecord.input_payload?.company_responsible_email || null,
            // Strings simples
            title: radarRecord.title,
            visao_geral: radarRecord.visao_geral,
            link_plataforma: `https://wenkey2-0.vercel.app/auth`,
            // KPIs como strings prontas
            healthy_pct: `${metrics.healthy_pct ?? 0}%`,
            attention_pct: `${metrics.attention_pct ?? 0}%`,
            risk_pct: `${metrics.risk_pct ?? 0}%`,
            total_objectives: metrics.total_objectives ?? 0,
            delayed_checkins: metrics.delayed_checkins ?? 0,
            // HTML pré-renderizado para cada seção de lista
            html_status_banner: getStatusBanner(radarRecord.status_geral),
            html_avancos: renderAvancos(radarRecord.avancos || []),
            html_riscos: renderRiscos(radarRecord.riscos || []),
            html_areas_destaque: renderAreasDestaque(radarRecord.areas_destaque || []),
            html_recomendacoes: renderRecomendacoes(radarRecord.recomendacoes || []),
        };

        const n8nResponse = await fetch(n8nUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!n8nResponse.ok) {
            console.error(`[n8n error] Status: ${n8nResponse.status} - ${await n8nResponse.text()}`);
            return false;
        }

        console.log(`[sendLeadershipRadarEmail] Email dispatched successfully to n8n.`);
        return true;
    } catch (error) {
        console.error("[sendLeadershipRadarEmail] Error:", error);
        return false;
    }
}
