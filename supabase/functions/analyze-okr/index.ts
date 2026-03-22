import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `
Você é um Analista experiente e mentor de liderança, com forte visão estratégica de negócios, execução e desenvolvimento de equipes.

Sua função é analisar resultados de OKRs (Objectives and Key Results) para compreender o desempenho e ajudar líderes e equipes a evoluírem na execução.

A análise deve sempre ter um tom estratégico, construtivo e orientado ao aprendizado.

------------------------------------------------------------

ESTRUTURA OBRIGATÓRIA DE SAÍDA

Para cada Objetivo fornecido, siga EXATAMENTE esta estrutura de Markdown:

## [Nome do Objetivo]

#### [Título do Key Result 1]
[Parágrafo de análise deste KR]

#### [Título do Key Result 2]
[Parágrafo de análise deste KR]

Repita esse padrão para todos os objetivos e seus respectivos Key Results.

------------------------------------------------------------

LÓGICA DE ANÁLISE

SE quarter_status = "ongoing":
- Seja conciso. Foque em: progresso atual, consistência de execução, tendência e probabilidade de atingimento.

SE quarter_status = "closed":
- Seja mais completo. Analise o desempenho final de cada KR, possíveis causas e aprendizados.

------------------------------------------------------------

ESTILO DE FORMATAÇÃO

- NUNCA use listas (bullets -, *, ou números 1., 2., etc.)
- NUNCA use tags HTML.
- Use APENAS os cabeçalhos ## para objetivos e #### para KRs. Nenhum outro nível de cabeçalho.
- Cada análise de KR deve ser um parágrafo fluido e contínuo, sem marcadores.
- Deixe uma linha em branco entre o parágrafo de análise de um KR e o próximo #### KR.
- Não use negrito no meio dos parágrafos de análise.
`;


serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { contextData } = await req.json();
        const company_segment: string | undefined = contextData?.company_segment;

        if (!contextData) {
            return new Response(
                JSON.stringify({ error: 'Dados de contexto do OKR são obrigatórios' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
        if (!OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY not configured');
        }

        const companyCtx = company_segment
            ? `\n\nCONTEXTO DA EMPRESA:\n"${company_segment}"\n\nConsidere este contexto para personalizar a análise e tornar os insights mais relevantes para este modelo de negócio.\n`
            : '';

        const userMessage = `Por favor, analise os seguintes dados do OKR com base no seu papel de Analista:${companyCtx}\n\n${JSON.stringify(contextData, null, 2)}`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userMessage }
                ],
                temperature: 0.7,
            }),
        });

        if (response.status === 429) {
            return new Response(
                JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente mais tarde.' }),
                { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenAI API error:', response.status, errorText);
            throw new Error(`Erro na IA: ${response.status}`);
        }

        const data = await response.json();
        const analysis = data.choices?.[0]?.message?.content?.trim();

        if (!analysis) {
            throw new Error('Nenhuma análise gerada pela IA.');
        }

        return new Response(
            JSON.stringify({ analysis }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('analyze-okr error:', error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
