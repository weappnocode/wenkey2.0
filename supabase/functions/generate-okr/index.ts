import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Você é um especialista em estratégia e OKRs.

Com base nas informações fornecidas pelo usuário, gere um OKR estratégico.

REGRAS PARA O OBJETIVO:
- Deve ser aspiracional, qualitativo e motivador.
- Deve ser curto e direto.
- Deve refletir claramente o problema ou oportunidade informado.

REGRAS PARA OS KEY RESULTS:
- Devem ser quantitativos e mensuráveis.
- Devem conter meta clara baseada na métrica informada.
- Devem considerar o valor atual e o valor desejado.
- Evite métricas vagas.

TIPOS DE KR SUPORTADOS:
- 'percentual' (unidade: %)
- 'moeda' (unidade: R$)
- 'numero'
- 'data'

DIREÇÕES SUPORTADAS:
- 'increase'
- 'decrease'

FORMATO DE RESPOSTA:
Você DEVE retornar APENAS um objeto JSON válido, sem nenhum texto adicional antes ou depois.

{
  "objective": "",
  "description": "",
  "key_results": [
    {
      "title": "",
      "target": 0,
      "unit": "",
      "type": "",
      "direction": ""
    }
  ]
}`;

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        console.log("Request received to generate-okr");

        const jsonBody = await req.json().catch(() => ({}));
        console.log("Request body keys:", Object.keys(jsonBody));

        const { prompt, answers } = jsonBody;

        const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
        if (!OPENAI_API_KEY) {
            console.error("OPENAI_API_KEY not found in environment");
            throw new Error('Configuração ausente: OPENAI_API_KEY não encontrada.');
        }

        let userMessage = "";

        if (prompt) {
            userMessage = "Gere um OKR estratégico para o seguinte contexto:\n\n" + prompt;
        } else if (answers) {
            const { area, problema, metrica, baseline, meta, prazo } = answers;
            userMessage = `Área: ${area || 'Não informado'}
Problema ou oportunidade: ${problema || 'Não informado'}
Métrica principal: ${metrica || 'Não informado'}
Valor atual (baseline): ${baseline || 'Não informado'}
Meta desejada: ${meta || 'Não informado'}
Prazo: ${prazo || 'Não informado'}`;
        } else {
            throw new Error('Forneça um texto ou preencha o questionário.');
        }

        console.log("Calling OpenAI API...");

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
                temperature: 0.7,
                response_format: { type: "json_object" },
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenAI API error:', response.status, errorText);
            throw new Error(`Erro na IA: ${response.status}`);
        }

        const data = await response.json();
        const jsonResponse = data.choices?.[0]?.message?.content?.trim();

        if (!jsonResponse) {
            console.error("Empty response from OpenAI", JSON.stringify(data));
            throw new Error('A IA não conseguiu gerar uma resposta. Tente reformular.');
        }

        console.log("Success! Returning OKR JSON.");

        return new Response(
            jsonResponse,
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('generate-okr error:', error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno no servidor' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
