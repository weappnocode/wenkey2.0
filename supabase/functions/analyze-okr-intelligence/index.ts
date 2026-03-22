import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        console.log("Request received to analyze-okr-intelligence");
        const jsonBody = await req.json().catch(() => ({}));
        
        const { generatedOKR, answers, company_segment } = jsonBody;

        if (!generatedOKR) {
            throw new Error('O OKR gerado é obrigatório para a análise.');
        }

        const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

        if (!OPENAI_API_KEY) {
            throw new Error('Configuração ausente: OPENAI_API_KEY não encontrada.');
        }

        const SYSTEM_PROMPT = `Você é um Analista de Negócios Sênior e Estrategista especialista na metodologia OKR (Objectives and Key Results).
Seu objetivo é processar um OKR recém-criado e aplicar um "Critical Analysis Engine" rigoroso.

Você deve avaliar o OKR em 5 dimensões de negócio, dando uma nota de 0 a 10 para cada:

1. Clareza (0-10): O objetivo é focado, inspirador e sem jargões corporativos genéricos?
2. Mensurabilidade (0-10): Os KRs são 100% numéricos, rastreáveis e verificáveis sem subjetividade?
3. Outcome vs Output (0-10): O OKR foca no resultado final (aumento na taxa, redução de custo) ou apenas na entrega de projetos (tarefas ou roadmaps)?
4. Ambição (0-10): O salto entre baseline e meta é agressivo o suficiente para tirar o time da zona de conforto, mas sem ser impossível? (Leve em consideração a intensidade percebida).
5. Alinhamento Estratégico (0-10): Isso resolve de fato o "Problema/Oportunidade" declarado pelo usuário?

O RESULTADO DEVE SER OBRIGATORIAMENTE ESTE JSON ESTRUTURADO:
{
  "general_score": 0.0, // (Média ponderada simples das 5 dimensões, 1 casa decimal)
  "strength": "Fraco | Moderado | Forte | Avançado", // (Avançado se > 8.5)
  "estimated_impact": "Curto texto sobre o potencial de impacto no negócio caso o OKR seja cumprido 100%",
  "diagnostics": {
    "clarity": {
      "score": 0,
      "feedback": "Comentário analítico justificando a nota. Máx 2 linhas."
    },
    "measurability": {
      "score": 0,
      "feedback": "..."
    },
    "outcome_vs_output": {
      "score": 0,
      "feedback": "..."
    },
    "ambition": {
      "score": 0,
      "feedback": "..."
    },
    "alignment": {
      "score": 0,
      "feedback": "..."
    }
  },
  "improvement_suggestions": [
    "Dica tática de melhoria rápida 1",
    "Reflexão estratégica 2"
  ]
}

- SEJA RIGOROSO. O normal é o usuário criar KRs de "tarefa" e tomar notas baixas (eg. 3 ou 4) em Outcome vs Output.
- APENAS RETORNE JSON VÁLIDO.
`;

        const userMessage = `OKR Gerado (Para Análise):\n${JSON.stringify(generatedOKR, null, 2)}
        
\n\nContexto Original do Usuário (Sua intenção):\n${JSON.stringify(answers || {}, null, 2)}

\n\nContexto da Empresa (Atividade/Segmento):\n${company_segment || "Não informado"}`;

        console.log("Calling OpenAI for Intelligent Analysis...");
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
                temperature: 0.3, // Temp mais baixa para análise crítica
                response_format: { type: "json_object" },
            }),
        });

        if (!response.ok) {
            throw new Error(`Erro na IA Analítica: ${response.status}`);
        }

        const data = await response.json();
        const jsonResponse = data.choices?.[0]?.message?.content?.trim();

        if (!jsonResponse) {
            throw new Error('A IA não conseguiu gerar a análise.');
        }

        return new Response(jsonResponse, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error('analyze-okr-intelligence error:', error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno na engine' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
