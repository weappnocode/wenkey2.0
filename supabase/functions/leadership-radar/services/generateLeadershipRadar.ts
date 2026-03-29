export async function generateLeadershipRadar(payload: any) {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!OPENAI_API_KEY) {
        throw new Error("Missing OPENAI_API_KEY");
    }

    const systemPrompt = `Você é um Analista Estratégico Sênior focado em OKRs de alta performance.
Sua tarefa é analisar os dados brutos de OKRs de uma empresa e redigir o "Radar da Liderança" – um briefing executivo sucinto, direto e pragmático, ajudando os C-Levels e Gestores a priorizar sua atenção e tomada de decisão antes da próxima rodada de check-ins.

O TOM DEVE SER: Executivo, profissional, imperativo, sem divagações. Foco no que importa: o que avança rápido e o que ameaça a estratégia.

Seu retorno DEVE SER EXATAMENTE E APENAS O JSON abaixo:
{
  "titulo": "Radar da Liderança - <Nome da Empresa> - <Nome do Quarter>",
  "status_geral": "saudavel" | "atencao" | "risco",
  "visao_geral": "Um parágrafo resumindo a essência corporativa atual.",
  "avancos": [
    { "descricao": "Destaque 1", "impacto": "impacto sobre a meta" }
  ],
  "riscos": [
    { "foco": "Área ou KR", "motivo": "Por que está em risco", "gravidade": "alta|media" }
  ],
  "areas_destaque": [
    { "area": "Marketing", "status": "saudavel", "resumo": "Mandando muito bem em X." }
  ],
  "recomendacoes": [
    { "acao": "Realinhar equipe Y", "prioridade": "imediata" }
  ]
}`;

    const userPrompt = `DADOS DA EMPRESA E QUARTER:
Empresa: ${payload.company}
Quarter: ${payload.quarter}

METRICAS TOTAIS:
- Objetivos Saudáveis: ${payload.metricsSnapshot.healthy_pct}%
- Objetivos Em Atenção: ${payload.metricsSnapshot.attention_pct}%
- Objetivos em Risco: ${payload.metricsSnapshot.risk_pct}%
- KRs com Checkins Atrasados: ${payload.metricsSnapshot.delayed_checkins}

RESUMO POR ÁREAS:
${JSON.stringify(payload.areasContext, null, 2)}

LISTA DETALHADA DE OBJETIVOS E PROGRESSOS:
${JSON.stringify(payload.objectives, null, 2)}

Aja como conselheiro do CEO. Se a saúde for menor que 50%, o status_geral deve ser risco, se for 50-70% atencao, se maior saudavel. Seja duro com check-ins atrasados. Forneça 3-5 avanços, 3-5 riscos, destaque as 2 melhores/piores áreas e 3 recomendações vitais.
`;

    console.log("[generateLeadershipRadar] Calling OpenAI with gpt-4o-mini...");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ]
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenAI API Error: ${err}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
        throw new Error("Não foi possível gerar a resposta estruturada via OpenAI.");
    }

    try {
        const jsonResult = JSON.parse(content);
        return jsonResult;
    } catch (e: any) {
        throw new Error(`Parse error for OpenAI response: ${e.message}`);
    }
}
