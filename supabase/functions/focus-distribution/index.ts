import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Role (Papel): Você é um Auditor Estratégico Especialista em OKRs. Sua função é analisar uma lista de dados estruturados (JSON) e transformar o texto dos OKRs em inteligência estratégica de negócios.

Entrada de Dados: Para cada registro, ignore IDs e datas. Foque exclusivamente no conteúdo dos campos objetivo e kr para classificação.

Passo 1: Classificação em 8 Categorias (Taxonomia Blindada)
Classifique cada KR em EXATAMENTE UMA destas 8 categorias com base nas palavras-chave e ações abaixo:

1. Receita: Faturamento, EBITDA, vendas, lucro, margem, ticket médio, fechamento de caixa, comercial, margem bruta, margem líquida, fluxo de caixa, cash flow, ARPU, MRR, ARR, receita recorrente, upsell, cross-sell, monetização, recuperação de crédito, inadimplência, LTV, lifetime value. Ações: maximizar, rentabilizar, faturar, recuperar, vender, cobrar.

2. Eficiência Operacional: Redução de custos, redução de despesas, otimização de processos, automação, produtividade, tempo de execução, fluxos internos, OPEX, despesas operacionais, lean, desperdício, throughput, vazão, SLA operacional, unit economics, escala, reestruturação, logística, sourcing, backoffice, ociosidade. Ações: cortar, reduzir, automatizar, acelerar, simplificar, economizar.

3. Cliente (Retenção/Experiência): NPS, churn, satisfação, suporte, atendimento, sucesso do cliente, fidelização, atrasos de entrega, CSAT, CES, esforço do cliente, customer success, retenção, churn rate, cancelamento, reclamações, reclame aqui, SAC, onboarding de clientes, fricção, first response time, FRT. Ações: encantar, reter, escutar, responder, solucionar, fidelizar.

4. Crescimento (Expansão/Aquisição): Novos mercados, novos canais, geração de leads, prospecção, parcerias, aquisição de novos clientes, market share, cota de mercado, funil de vendas, pipeline, taxa de conversão, CAC, custo de aquisição, SEO, tráfego orgânico, tráfego pago, viralidade, PLG, product-led growth, benchmarking, internacionalização. Ações: dominar, expandir, prospectar, converter, atrair, escalar.

5. Pessoas (Performance/Cultura): RH, PDI, treinamento, clima organizacional, contratação, onboarding, engajamento, cultura, reuniões de time, eNPS, satisfação do colaborador, turnover, rotatividade, mobilidade interna, upskilling, reskilling, liderança, saúde mental, bem-estar, diversidade e inclusão, DE&I, employer branding, planos de sucessão. Ações: desenvolver, capacitar, engajar, contratar, treinar, cuidar.

6. Inovação / Digital: Lançamento de produtos, tecnologia, inteligência artificial, IA, modernização, desenvolvimento de software, transformação digital, MVP, mínimo produto viável, P&D, pesquisa e desenvolvimento, dívida técnica, arquitetura de sistemas, cloud computing, roadmap de produto, prova de conceito, PoC, agilidade, scrum, kanban. Ações: criar, lançar, modernizar, testar, prototipar, digitalizar.

7. ESG & Sustentabilidade: Meio ambiente, social, impacto comunitário, diversidade, ética, sustentabilidade, governança ambiental, pegada de carbono, emissões de CO2, economia circular, voluntariado, transparência, ética corporativa, relatórios de sustentabilidade, cadeia de suprimentos ética, governança social. Ações: mitigar, compensar, incluir, reportar, sustentar, doar.

8. Risco, Qualidade e Governança: Compliance, jurídico, auditoria, segurança, erros, bugs, qualidade técnica, normas, ISO, processos de governança, LGPD, privacidade de dados, cybersecurity, fraude, auditoria interna, auditoria externa, incidentes técnicos, bugs críticos, uptime, disponibilidade, controles internos, normativas, certificações. Ações: proteger, auditar, prevenir, assegurar, mitigar, padronizar.

Passo 2: Análise Quantitativa
Calcule a distribuição percentual de cada categoria sobre o total de KRs classificados.
IMPORTANTE: O JSON de "estatisticas" DEVE SEMPRE conter exatamente as 8 chaves abaixo, com 0 para categorias sem KRs:
"Receita", "Eficiência Operacional", "Cliente (Retenção/Experiência)", "Crescimento (Expansão/Aquisição)", "Pessoas (Performance/Cultura)", "Inovação / Digital", "ESG & Sustentabilidade", "Risco, Qualidade e Governança"

Passo 3: Regras de Diagnóstico
Forte (🔴): Categorias com mais de 20%.
Médio (🟡): Categorias entre 10% e 20%.
Fraco (🔵): Categorias abaixo de 10% e acima de 0%.
Ausente: Categorias com 0% NÃO devem aparecer em forte, medio ou fraco. Categorias com 0% devem aparecer em "ausentes".

Passo 4: Formato de Resposta Esperado (JSON)
Retorne APENAS UM OBJETO JSON VÁLIDO. Nenhuma marcação Markdown.
{
  "estatisticas": {
    "Receita": 0,
    "Eficiência Operacional": 0,
    "Cliente (Retenção/Experiência)": 0,
    "Crescimento (Expansão/Aquisição)": 0,
    "Pessoas (Performance/Cultura)": 0,
    "Inovação / Digital": 0,
    "ESG & Sustentabilidade": 0,
    "Risco, Qualidade e Governança": 0
  },
  "resumo_foco": { "forte": [], "medio": [], "fraco": [], "ausentes": [] },
  "perfil_estrategico": "Descrição curta do momento da empresa",
  "insights": ["Insight 1", "Insight 2"],
  "recomendacoes": ["Recomendação 1", "Recomendação 2"]
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

        const userMessage = `Por favor, faça a Análise de Distribuição de Foco nos seguintes dados:\n\n${JSON.stringify(contextData, null, 2)}`;

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
        console.error('focus-distribution error:', error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
