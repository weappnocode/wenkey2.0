import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        console.log("Request received to generate-okr with RAG");
        const jsonBody = await req.json().catch(() => ({}));
        const { prompt, answers } = jsonBody;

        const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error('Configuração ausente: verifique as variáveis de ambiente.');
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        let userMessage = "";
        let embeddingText = "";

        if (prompt) {
            userMessage = "Gere um OKR estratégico para o seguinte contexto:\n\n" + prompt;
            embeddingText = prompt;
        } else if (answers) {
            const { area, problema, metrica, baseline, meta, prazo } = answers;
            
            // Feature Engineering básico
            let hint = "";
            let intensity = 0;
            const b = parseFloat(baseline?.replace(/[^0-9.-]+/g, ""));
            const m = parseFloat(meta?.replace(/[^0-9.-]+/g, ""));
            
            if (!isNaN(b) && !isNaN(m) && b !== 0) {
                intensity = ((m - b) / Math.abs(b)) * 100;
                hint = `\nIntensidade da meta calculada: ${intensity > 0 ? '+' : ''}${intensity.toFixed(1)}%`;
            }

            userMessage = `Área: ${area || 'Não informado'}
Problema ou oportunidade: ${problema || 'Não informado'}
Métrica principal: ${metrica || 'Não informado'}
Valor atual (baseline): ${baseline || 'Não informado'}
Meta desejada: ${meta || 'Não informado'}
Prazo: ${prazo || 'Não informado'}${hint}`;

            embeddingText = `Área: ${area}. Problema: ${problema}. Métrica: ${metrica}.`;
        } else {
            throw new Error('Forneça um texto ou preencha o questionário.');
        }

        console.log("Generating embedding for RAG...");
        const embedResponse = await fetch("https://api.openai.com/v1/embeddings", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                input: embeddingText,
                model: "text-embedding-3-small",
            }),
        });

        const embeddingData = await embedResponse.json();
        const query_embedding = embeddingData.data?.[0]?.embedding;
        
        let contextSection = "";
        if (query_embedding) {
            console.log("Querying Supabase pgvector...");
            const { data: matchedOKRs, error: matchError } = await supabase.rpc('match_okr_benchmarks', {
                query_embedding,
                match_threshold: 0.1, // Aceita resultados bem variados
                match_count: 3
            });

            if (matchError) {
                console.error("Error matching okrs:", matchError);
            } else if (matchedOKRs && matchedOKRs.length > 0) {
                contextSection = `\n\nEXEMPLOS DE BENCHMARKS STRATÉGICOS DE ALTA PERFORMANCE (USE COMO INSPIRAÇÃO):\n`;
                matchedOKRs.forEach((okr: any, idx: number) => {
                    contextSection += `\nExemplo ${idx + 1}:\nObjetivo: ${okr.objective_text}\nKRs: ${JSON.stringify(okr.key_results)}\nImpacto: ${okr.impact_description}\n`;
                });
            }
        }

        const SYSTEM_PROMPT = `Você é um Arquiteto de Sistemas especialista em estratégia de Produto e OKRs, focado em impacto de negócio.

Sua missão é gerar 1 Objetivo altamente estratégico e 3 a 4 Key Results excepcionais baseados nos inputs do usuário.

REGRAS RÍGIDAS PARA O OBJETIVO:
- Deve ser aspiracional, qualitativo, memorável e focado PÚRAMENTE no *Outcome* (Resultado final gerado).
- Não deve conter números (métricas vão para os KRs).
- Deve refletir e resolver diretamente o problema/oportunidade mapeado.

REGRAS RÍGIDAS PARA OS KEY RESULTS:
- Devem ser quantitativos e 100% mensuráveis.
- Devem conter metas claras e factíveis. Não use 'implementar X', use 'Aumentar a conversão da feature X para Y%'.
- Devem representar alavancas que, se puxadas, garantem que o Objetivo será atingido.

TIPOS DE KR: 'percentual' (unidade: %), 'moeda' (unidade: R$), 'numero', 'data'
DIREÇÕES: 'increase', 'decrease'${contextSection}

FORMATO DE RESPOSTA OBRIGATÓRIO (APENAS ESTE JSON VÁLIDO):
{
  "objective": "Objetivo Inspirador",
  "description": "Porque isso importa e qual a mudança esperada...",
  "key_results": [
    {
      "title": "Aumentar a métrica X",
      "target": 0,
      "unit": "",
      "type": "percentual",
      "direction": "increase"
    }
  ]
}`;

        console.log("Calling OpenAI Chat for Generation...");
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: userMessage }
                ],
                temperature: 0.6,
                response_format: { type: "json_object" },
            }),
        });

        if (!response.ok) {
            throw new Error(`Erro na IA: ${response.status}`);
        }

        const data = await response.json();
        const jsonResponse = data.choices?.[0]?.message?.content?.trim();

        if (!jsonResponse) {
            throw new Error('A IA não conseguiu gerar uma resposta. Tente reformular.');
        }

        return new Response(jsonResponse, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error('generate-okr error:', error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno no servidor' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
