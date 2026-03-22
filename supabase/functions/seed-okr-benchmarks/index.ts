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
        console.log("Request received to seed-okr-benchmarks");
        const jsonBody = await req.json().catch(() => ({}));
        
        const { benchmarks } = jsonBody;

        if (!benchmarks || !Array.isArray(benchmarks)) {
            throw new Error('É necessário enviar uma array de benchmarks.');
        }

        const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error('Configurações ausentes (chaves de API ou Supabase).');
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        let successCount = 0;
        let errors = [];

        for (const b of benchmarks) {
            try {
                // Mapeamento flexível de colunas (Suporta template e planilha sem cabeçalho)
                const category = b.strategic_category || b.Categoria || b[3] || b['Categoria Estratégica'] || 'Geral';
                const industry = b.industry || b.Setor || b[0] || 'Varejo';
                const objective = b.objective_text || b.Objetivo || b[1] || b['Objetivo Estratégico'];
                const krText = b.key_results || b.KR || b[2] || b['KRs ciclo Q1'];
                const impact = b.impact_description || b.Impacto || b[4] || '';

                if (!objective || !krText) continue; // Pular linhas vazias

                // Montar o texto para gerar o embedding (foco no raciocínio e contexto)
                const textToEmbed = `Indústria/Setor: ${industry}. Categoria: ${category}. Objetivo: ${objective}. KR de referência: ${typeof krText === 'string' ? krText : JSON.stringify(krText)}.`;
                
                const embedResponse = await fetch("https://api.openai.com/v1/embeddings", {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    },
                    body: JSON.stringify({
                        input: textToEmbed,
                        model: "text-embedding-3-small",
                    }),
                });

                if (!embedResponse.ok) throw new Error(`Falha embedding OpenAI: ${embedResponse.status}`);
                
                const embedData = await embedResponse.json();
                const embedding = embedData.data?.[0]?.embedding;

                if (!embedding) throw new Error("Vetor nulo retornado pela OpenAI");

                // Converter KR para array (o banco espera JSONB)
                let parsedKRs = krText;
                if (typeof parsedKRs === 'string') {
                    try {
                        // Tentar parsear se for JSON literal
                        if (parsedKRs.startsWith('[') || parsedKRs.startsWith('{')) {
                            parsedKRs = JSON.parse(parsedKRs);
                        } else {
                            parsedKRs = [parsedKRs];
                        }
                    } catch (e) {
                        parsedKRs = [parsedKRs];
                    }
                }

                // Normalização da Categoria para o Enum do Banco
                const validCategories = ['Receita', 'Eficiência Operacional', 'Cliente', 'Crescimento', 'Pessoas', 'Inovação / Digital'];
                let finalCategory = category;
                if (!validCategories.includes(category)) {
                    // Mapeamento de sinonimos comuns
                    if (category.includes('Financeiro') || category.includes('Vendas')) finalCategory = 'Receita';
                    else if (category.includes('Processo') || category.includes('Custo')) finalCategory = 'Eficiência Operacional';
                    else if (category.includes('Sucesso') || category.includes('NPS')) finalCategory = 'Cliente';
                    else if (category.includes('Expansão')) finalCategory = 'Crescimento';
                    else if (category.includes('Cultura') || category.includes('RH')) finalCategory = 'Pessoas';
                    else if (category.includes('Tecnologia')) finalCategory = 'Inovação / Digital';
                    else finalCategory = 'Crescimento'; // Default
                }

                const { error: insertError } = await supabase.from('okr_benchmarks').insert({
                    strategic_category: finalCategory,
                    industry: industry,
                    objective_text: objective,
                    key_results: Array.isArray(parsedKRs) ? parsedKRs : [parsedKRs],
                    impact_description: impact,
                    metric_type: b.metric_type || 'unidades',
                    goal_direction: b.goal_direction || 'increase',
                    complexity: b.complexity || 'medium',
                    embedding: embedding
                });

                if (insertError) {
                    console.error("Erro DB no Objetivo:", objective, insertError);
                    errors.push({ row: objective, error: insertError.message });
                } else {
                    successCount++;
                }

            } catch (err: any) {
                console.error("Erro no processamento da linha:", err);
                errors.push({ error: err.message });
            }
        }

        return new Response(JSON.stringify({ success: true, inserted: successCount, errors }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    } catch (error) {
        console.error('seed-okr-benchmarks error:', error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
