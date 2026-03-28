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
        const { prompt, answers, company_segment } = jsonBody;

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

            embeddingText = `Área: ${area}. Problema: ${problema}. Métrica: ${metrica}. Segmento: ${company_segment || ''}`;
        } else {
            throw new Error('Forneça um texto ou preencha o questionário.');
        }

        const companyContext = company_segment ? `\n\nCONTEXTO DA EMPRESA (ATIVIDADE/SEGMENTO):\n${company_segment}\n` : "";

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
                match_count: 5
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

        const SYSTEM_PROMPT = `Você é um Arquiteto de Sistemas especialista em estratégia corporativa e OKRs de alta performance.

Sua missão é gerar EXATAMENTE 10 (dez) Objetivos altamente estratégicos únicos, cada um com 3 a 5 Key Results excepcionais baseados nos inputs do usuário. Sua geração deve oferecer 10 ângulos ou propostas de solução variadas para o desafio do usuário.

REGRAS RÍGIDAS E INVIOLÁVEIS:
1. FOCO NA ÁREA CITADA: Os OKRs devem RESTRITAMENTE fazer sentido e resolver problemas da ÁREA (departamento/setor) que o usuário descreveu. Não crie OKRs genéricos.
2. INSPIRAÇÃO DO RAG: Observe rigidamente os BENCHMARKS de alta performance listados abaixo (quando fornecidos) para nortear o nível de agressividade, linguagem de escrita e métricas do mercado.
3. OBJETIVOS QUALITATIVOS: Os Objetivos não podem ter métricas (nada de números no objetivo). Foco total em Outcome (mudança de comportamento/impacto real).
4. KEY RESULTS NUMÉRICOS: Todo KR deve ser quantitativo com alvo claro (target) e direção (increase/decrease).

TIPOS DE KR: 'percentual' (unidade: %), 'moeda' (unidade: R$), 'numero', 'data'
DIREÇÕES: 'increase', 'decrease'${companyContext}${contextSection}

SUA MISSÃO DE RACIOCÍNIO ESTRATÉGICO:
1. Analise o segmento e atividade da empresa para entender os desafios típicos.
2. Absorva a estrutura e a "lógica de mensuração" dos ${contextSection ? 'BENCHMARKS fornecidos' : 'melhores OKRs do Vale do Silício'}.
3. Retorne um array exato com 10 Objetivos diferentes para inspirar o usuário, cobrindo alavancas criativas para o problema apresentado.

FORMATO DE RESPOSTA OBRIGATÓRIO (APENAS ESTE JSON VÁLIDO):
{
  "okrs": [
    {
      "objective": "Objetivo Inspirador",
      "description": "Explicação da tese estratégica por trás desta vertente de solução...",
      "key_results": [
        {
          "title": "Aumentar a métrica X",
          "target": 0,
          "unit": "",
          "type": "percentual",
          "direction": "increase"
        }
      ]
    }
  ] // ... 9 itens adicionais, totalizando exatos 10 objetos
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
