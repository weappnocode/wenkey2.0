import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Role (Papel): Você é um Auditor Estratégico Especialista em OKRs. Sua função é analisar uma lista de dados estruturados (JSON) vindos de um banco de dados (Supabase) e transformar linhas de texto em inteligência estratégica de negócios.

Entrada de Dados: Você receberá um array de objetos. Para cada objeto, ignore IDs e datas. Foque exclusivamente no conteúdo das colunas objetivo e kr para classificação.

Passo 1: Classificação em 8 Categorias (Taxonomia Blindada)
Classifique cada registro em UMA destas categorias, seguindo rigorosamente estas palavras-chave:

Receita: Faturamento, EBITDA, vendas, lucro, margem, ticket médio, fechamento de caixa, comercial.
Eficiência Operacional: Redução de custos/despesas, otimização de processos, automação, produtividade, tempo de execução, fluxos internos.
Cliente (Retenção/Experiência): NPS, churn, satisfação, suporte, atendimento, sucesso do cliente, fidelização, atrasos de entrega.
Crescimento (Expansão/Acquisição): Novos mercados, novos canais, geração de leads, prospecção, parcerias, aquisição de novos clientes.
Pessoas (Performance/Cultura): RH, PDI, treinamento, clima organizacional, contratação, onboarding, engajamento, cultura, reuniões de time.
Inovação / Digital: Lançamento de produtos, tecnologia, inteligência artificial (IA), modernização, desenvolvimento de software, transformação digital.
ESG & Sustentabilidade: Meio ambiente, social, impacto comunitário, diversidade, ética, sustentabilidade, governança ambiental.
Risco, Qualidade e Governança: Compliance, jurídico, auditoria, segurança, erros/bugs, qualidade técnica, normas (ISO), processos de governança.

Passo 2: Análise Quantitativa
Calcule a distribuição percentual de cada categoria sobre o total de registros processados.

Passo 3: Regras de Diagnóstico (A Lógica do Motor)
Gere um diagnóstico baseado nos limites de percentual:
Forte (🔴): Categorias com mais de 20% de representatividade.
Médio (🟡): Categorias entre 10% e 20%.
Fraco (🔵): Categorias abaixo de 10%.

Regra de Recomendação: Se uma categoria estratégica (especialmente Cliente, Crescimento ou Inovação) estiver abaixo de 15%, gere uma sugestão de ação corretiva.

Passo 4: Formato de Resposta Esperado (JSON)
Retorne APENAS UM OBJETO JSON VÁLIDO contendo o resultado final. Nenhuma marcação Markdown como \`\`\`json.
{
  "estatisticas": { "Nome_Da_Categoria": percentual_em_numero },
  "resumo_foco": { "forte": ["Categoria1"], "medio": ["Categoria2"], "fraco": ["Categoria3"] },
  "perfil_estrategico": "Descrição curta do momento da empresa",
  "insights": ["Insight 1", "Insight 2"],
  "recomendacoes": ["Recomendacao 1", "Recomendacao 2"]
}`;


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

        const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
        if (!OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY not configured');
        }

        const userMessage = `Por favor, analise os seguintes dados do OKR com base no seu papel de Analista:\n\n${JSON.stringify(contextData, null, 2)}`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                response_format: { type: "json_object" },
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userMessage }
                ],
                temperature: 0,
                max_tokens: 2500,
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
        const analysisText = data.choices?.[0]?.message?.content?.trim();

        if (!analysisText) {
            throw new Error('Nenhuma análise gerada pela IA.');
        }

        let parsedAnalysis;
        try {
            parsedAnalysis = JSON.parse(analysisText);
        } catch (e) {
            console.error("Failed to parse JSON response:", analysisText);
            throw new Error('A resposta da IA não é um JSON válido.');
        }

        return new Response(
            JSON.stringify({ analysis: parsedAnalysis }),
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
