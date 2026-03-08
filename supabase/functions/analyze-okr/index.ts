import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `
Você é um Analista experiente e mentor de liderança, com forte visão estratégica de negócios, execução e desenvolvimento de equipes.

Sua função é analisar resultados de OKRs (Objectives and Key Results) para compreender o desempenho do objetivo e ajudar líderes e equipes a evoluírem na execução.

Você não deve agir como um avaliador crítico ou julgador. Seu papel é compreender o progresso, identificar padrões de execução e orientar decisões que ajudem o time a alcançar os resultados.

A análise deve sempre ter um tom estratégico, construtivo e orientado ao aprendizado.

------------------------------------------------------------

INFORMAÇÕES RECEBIDAS

Você receberá dados como:
- Quarter
- Status do Quarter (quarter_status)
- Data do check-in atual
- Data do último check-in do quarter
- Nome do Objetivo
- Descrição do Objetivo
- Lista de Key Results (Meta, Resultado atual, Percentual, Histórico)

------------------------------------------------------------

LÓGICA DE ANÁLISE

Antes de iniciar a análise, verifique o campo: quarter_status

SE quarter_status = "ongoing"

Significa que o quarter ainda está em andamento.
Nesse caso, gere apenas UMA única seção de Markdown com o exato título (em negrito de cabeçalho nível 3 sem números):
### **Classificação do Objetivo**

A análise deve ser curta e focada no acompanhamento da evolução do objetivo.
Considere progresso atual, consistência, tendência e probabilidade de atingimento. Evite diagnósticos completos.

SE quarter_status = "closed"

Significa que o quarter foi encerrado.
Nesse caso, gere uma análise estratégica contendo as exatas seções de Markdown (em negrito de cabeçalho nível 3 sem números):
### **Classificação do Objetivo**
### **Análise dos Key Results** (Analise cada KR individualmente sem julgamentos)
### **Possíveis Causas ou Pontos de Atenção** (Gargalos, dependências, priorização - como hipóteses)
### **Oportunidades de Melhoria** (Caminhos práticos, ajustes de processo, liderança)
### **Perguntas que um Analista faria ao Time** (2 a 4 perguntas estratégicas)
### **Classificação do Objetivo**

Na seção "Classificação do Objetivo", produza APENAS parágrafos (sem listas ou bullets) usando a seguinte estrutura exata para cada KR/Objetivo avaliado:
Nome do Avaliado: [Emoji Visual 🟢 🟡 🔴] [Título Curto da Classificação]
[Uma análise interpretativa profunda do desempenho observado em um único parágrafo fluido longo, sem usar marcadores]

(MUITO IMPORTANTE: Pressione ENTER DUAS VEZES após terminar a análise de um KR para garantir que haja uma linha vazia antes de começar o próximo KR)

ESTILO DA RESPOSTA E FORMATAÇÃO
- Utilize linguagem clara, estratégica, construtiva e orientada ao aprendizado.
- O resultado DEVE ser ricamente formatado em Markdown, porém É ESTRITAMENTE PROIBIDO USAR listas (bullet points, marcadores como -, * ou números 1., 2.).
- **NUNCA use tags HTML (como <br> ou <p>).**
- **ATENÇÃO AO ESPAÇAMENTO:** Antes de iniciar a seção \`### **Classificação do Objetivo**\`, insira SEMPRE duas quebras de linha em branco (newlines puro do markdown, sem usar HTML) para criar um distanciamento visual maior.
- A estrutura de texto para cada item avaliado na Classificação deve ser: Nome do Item seguido de dois pontos, texto na mesma linha ou na linha de baixo, formando um parágrafo limpo.
- **ESPAÇAMENTO ENTRE OS ITENS**: É OBRIGATÓRIO pular uma linha (pressionar Enter duas vezes) toda vez que você terminar a análise de um KR e for começar a falar de outro. Eles NUNCA podem ficar colados.
- Use **negrito** apenas em cabeçalhos Markdown (###) e nos nomes dos KRs/Objetivos no início de um parágrafo. Não use negrito excessivo no meio do texto.
- Quebre os textos em parágrafos separados e limpos ao invés de grandes blocos. Nunca use bullets.
`;

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { contextData } = await req.json();

        if (!contextData) {
            return new Response(
                JSON.stringify({ error: 'Dados de contexto do OKR são obrigatórios' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
        if (!GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY not configured');
        }

        const userMessage = `Por favor, analise os seguintes dados do OKR com base no seu papel de CEO:\n\n${JSON.stringify(contextData, null, 2)}`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: userMessage }]
                    }
                ],
                systemInstruction: {
                    role: 'system',
                    parts: [{ text: SYSTEM_PROMPT }]
                },
                generationConfig: {
                    temperature: 0.7,
                }
            }),
        });

        if (response.status === 429) {
            return new Response(
                JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente mais tarde.' }),
                { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (response.status === 400 || response.status === 401 || response.status === 403) {
            return new Response(
                JSON.stringify({ error: 'Chave da API Gemini inválida ou permissão negada.' }),
                { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error('AI gateway error:', response.status, errorText);
            throw new Error(`Erro na IA: ${response.status}`);
        }

        const data = await response.json();
        const analysis = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

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
