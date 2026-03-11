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

        const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
        if (!GEMINI_API_KEY) {
            console.error("GEMINI_API_KEY not found in environment");
            throw new Error('Configuração ausente: GEMINI_API_KEY não encontrada.');
        }

        let userMessage = "";

        if (prompt) {
            userMessage = "Gere um OKR estratégico para o seguinte contexto:\n\n" + prompt;
        } else if (answers) {
            const { area, problema, metrica, baseline, meta, prazo } = answers;
            userMessage = `Você é um especialista em estratégia e OKRs.

Com base nas informações fornecidas pelo usuário, gere um OKR estratégico.

INFORMAÇÕES DO USUÁRIO:

Área: ${area || 'Não informado'}
Problema ou oportunidade: ${problema || 'Não informado'}
Métrica principal: ${metrica || 'Não informado'}
Valor atual (baseline): ${baseline || 'Não informado'}
Meta desejada: ${meta || 'Não informado'}
Prazo: ${prazo || 'Não informado'}`;
        } else {
            throw new Error('Forneça um texto ou preencha o questionário.');
        }

        console.log("Calling Gemini API...");

        const response = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + GEMINI_API_KEY,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
                    systemInstruction: {
                        role: 'system',
                        parts: [{ text: SYSTEM_PROMPT }]
                    },
                    generationConfig: {
                        temperature: 0.7,
                        response_mime_type: "application/json"
                    }
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API error:', response.status, errorText);
            throw new Error(`Erro na IA: ${response.status}`);
        }

        const data = await response.json();
        const jsonResponse = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!jsonResponse) {
            console.error("Empty response from Gemini", JSON.stringify(data));
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
