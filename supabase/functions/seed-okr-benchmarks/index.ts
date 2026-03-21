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
                // Montar o texto para gerar o embedding
                const textToEmbed = `Área: ${b.strategic_category || b.industry}. Objetivo: ${b.objective_text}. KRs: ${typeof b.key_results === 'string' ? b.key_results : JSON.stringify(b.key_results)}. Impacto: ${b.impact_description}`;
                
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

                if (!embedResponse.ok) throw new Error("Falha ao gerar embedding na OpenAI");
                
                const embedData = await embedResponse.json();
                const embedding = embedData.data?.[0]?.embedding;

                if (!embedding) throw new Error("A OpenAI não retornou um vetor válido");

                // Converter KRs se vieram como string no Excel
                let parsedKRs = b.key_results;
                if (typeof parsedKRs === 'string') {
                    try {
                        parsedKRs = JSON.parse(parsedKRs);
                    } catch (e) {
                        // fallback to array with 1 item
                        parsedKRs = [parsedKRs];
                    }
                }

                const { error: insertError } = await supabase.from('okr_benchmarks').insert({
                    strategic_category: b.strategic_category,
                    industry: b.industry,
                    objective_text: b.objective_text,
                    key_results: parsedKRs,
                    impact_description: b.impact_description,
                    metric_type: b.metric_type || 'outros',
                    goal_direction: b.goal_direction || 'increase',
                    complexity: b.complexity || 'medium',
                    embedding: embedding
                });

                if (insertError) {
                    console.error("DB Error on row:", b.objective_text, insertError);
                    errors.push({ row: b.objective_text, error: insertError.message });
                } else {
                    successCount++;
                }

            } catch (err: any) {
                console.error("Loop error:", err);
                errors.push({ row: b.objective_text, error: err.message });
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
