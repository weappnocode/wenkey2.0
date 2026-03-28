import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Role (Papel): Você é um Auditor Estratégico Especialista em OKRs. Sua função é analisar uma lista de dados estruturados (JSON) e transformar o texto dos OKRs em inteligência estratégica de negócios.

Entrada de Dados: Para cada registro, ignore IDs e datas. Foque exclusivamente no conteúdo dos campos objetivo e kr para classificação.

Passo 1: Classificação em 8 Categorias (Taxonomia Blindada)
Classifique cada KR em EXATAMENTE UMA destas 8 categorias com base nas palavras-chave e ações abaixo. Mantenha em mente a ÁREA ATUAL e o SEGMENTO da empresa para o contexto da classificação:

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

MOTOR DE RECOMENDAÇÕES (obrigatório e crítico):
Para CADA categoria com percentual ABAIXO de 15% (incluindo 0%), gere um objeto de recomendação com o nome da categoria e 3 a 4 sugestões estratégicas práticas e específicas.
MUITO IMPORTANTE: Use a "BASE RAG" (se fornecida ao final deste prompt) e a ÁREA/SEGMENTO como NORTE absoluto para redigir as estratégias, moldando as dicas ao perfil da equipe. Use as linhas abaixo apenas como referência secundária se faltarem dados contextuais:
- Crescimento: "Criar estratégia de geração de leads", "Expandir canais digitais de aquisição", "Definir meta de CAC e taxa de conversão", "Estruturar programa de parcerias comerciais"
- Cliente: "Implantar pesquisa de NPS trimestral", "Criar fluxo de onboarding do cliente", "Definir SLA de atendimento e monitorar FRT", "Reduzir churn com programa de sucesso do cliente"
- Inovação / Digital: "Criar roadmap de produto para o próximo ciclo", "Definir uma PoC de IA", "Reduzir dívida técnica com sprint dedicado", "Lançar MVP de nova funcionalidade"
- Receita: "Criar estratégia de upsell para base existente", "Definir meta de MRR mensal", "Mapear oportunidades de cross-sell", "Aumentar LTV médio da carteira"
- Pessoas: "Criar PDI para líderes", "Implantar pesquisa de eNPS", "Revisar onboarding de novos colaboradores", "Definir plano de retenção de talentos"
- Eficiência Operacional: "Mapear gargalos de processo e eliminar desperdícios", "Definir SLA por área operacional", "Automatizar tarefas manuais recorrentes", "Reduzir OPEX com análise de despesas"
- ESG & Sustentabilidade: "Criar relatório de impacto social", "Definir meta de redução de pegada de carbono", "Implementar política de diversidade e inclusão", "Mapear cadeia de suprimentos ética"
- Risco, Qualidade e Governança: "Realizar auditoria interna de processos", "Revisar conformidade com LGPD", "Criar protocolo de resposta a incidentes", "Monitorar uptime e definir SLA técnico"

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
  "recomendacoes": [
    { "categoria": "Nome da Categoria", "percentual": 0, "sugestoes": ["Sugestão 1", "Sugestão 2", "Sugestão 3"] }
  ]
}`;

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { contextData } = await req.json();
        const company_segment: string | undefined = contextData?.company_segment;
        const user_area: string | undefined = contextData?.user_area;

        if (!contextData) {
            return new Response(
                JSON.stringify({ error: 'Dados de contexto do OKR são obrigatórios' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error('Missing environment configurations for OpenAI or Supabase.');
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        let contextSection = "";
        const embeddingText = `Área: ${user_area || 'Performance Estratégica'}. Segmento: ${company_segment || 'Negócios'}.`;
        
        console.log("Generating embedding for RAG in focus-distribution...");
        const embedResponse = await fetch("https://api.openai.com/v1/embeddings", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
            body: JSON.stringify({ input: embeddingText, model: "text-embedding-3-small" }),
        });

        const embeddingData = await embedResponse.json();
        const query_embedding = embeddingData.data?.[0]?.embedding;

        if (query_embedding) {
            console.log("Querying Supabase pgvector for focus distribution...");
            const { data: matchedOKRs } = await supabase.rpc('match_okr_benchmarks', {
                query_embedding,
                match_threshold: 0.1,
                match_count: 5
            });

            if (matchedOKRs && matchedOKRs.length > 0) {
                contextSection = `\n\nEXEMPLOS DE BENCHMARKS DO MERCADO (BASE RAG PARA INSPIRAÇÃO DAS SUGESTÕES ESTRATÉGICAS):\n`;
                matchedOKRs.forEach((okr: any, idx: number) => {
                    contextSection += `\nExemplo ${idx + 1}:\nObjetivo: ${okr.objective_text}\nKRs: ${JSON.stringify(okr.key_results)}\nImpacto: ${okr.impact_description}\n`;
                });
            }
        }

        const companyCtx = company_segment || user_area
            ? `\n\nCONTEXTO ESSENCIAL DA EMPRESA E ÁREA (use para personalizar categorias, insights e recomendções):\nSegmento: "${company_segment || 'Não informado'}"\nÁrea/Departamento: "${user_area || 'Não informado'}"\n${contextSection}\n`
            : '';

        const userMessage = `Por favor, faça a Análise de Distribuição de Foco nos seguintes dados:${companyCtx}\n\n${JSON.stringify(contextData, null, 2)}`;

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
