import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import { buildLeadershipRadarPayload } from "./services/buildLeadershipRadarPayload.ts";
import { generateLeadershipRadar } from "./services/generateLeadershipRadar.ts";
import { sendLeadershipRadarEmail } from "./services/sendLeadershipRadarEmail.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

Deno.serve(async (req: Request) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const path = url.pathname.split('/').filter(Boolean);
        const action = path[path.length - 1]; // e.g. generate, generate-all, history, resend etc

        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        
        // Supabase client bypassing RLS for server-side operations
        const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            }
        });

        // Autenticação:
        // Se for uma requisição via UI (usuário autenticado), ele manda o token no header Authorization.
        // Se for chamada via pg_net (cron), podemos passar uma chave de segurança ou só Service Role via Bearer.
        const authHeader = req.headers.get('Authorization');
        let user = null;
        let isAdmin = false;

        if (authHeader) {
            const token = authHeader.replace('Bearer ', '');
            
            // Verifica se é a chave de serviço (usada pelo cron)
            if (token === SUPABASE_SERVICE_ROLE_KEY) {
                isAdmin = true; // Contexto de cron (Superuser)
            } else {
                // Usuário normal da UI
                const { data: { user: authUser }, error: userError } = await supabaseService.auth.getUser(token);
                if (!userError && authUser) {
                    user = authUser;
                    // Verifica se o request vem de um Admin/Manager
                    const { data: userRole } = await supabaseService.from('user_roles')
                        .select('role')
                        .eq('user_id', user.id)
                        .single();

                    isAdmin = userRole?.role === 'admin' || userRole?.role === 'manager';
                }
            }
        }

        // ==========================================
        // ROUTING
        // ==========================================

        if (req.method === 'POST') {
            const body = await req.json().catch(() => ({}));

            if (action === 'generate-all') {
                // Rota chamada pelo CRON JOB
                if (!isAdmin) throw new Error('Unauthorized');
                
                // Lógica de buscar todas as rotinas que o check-in é AMANHÃ.
                // Isso varreria companies e quarters. Por simplicidade inicial, 
                // para o MVP, vamos iterar sobre quarters ativos.
                return new Response(JSON.stringify({ message: "Cron em desenvolvimento. Endpoint gerado." }), 
                   { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            if (action === 'generate') {
                // Rota chamada pela UI ou individualmente.
                if (!isAdmin && !user) throw new Error('Unauthorized. Must be logged in or cron.');
                
                const { company_id, quarter_id, recipient_user_id, radar_scope } = body;
                if (!company_id || !quarter_id) {
                    throw new Error('company_id and quarter_id are required');
                }

                console.log(`[leadership-radar] Building payload for company ${company_id}, quarter ${quarter_id}, scope: ${radar_scope}...`);
                const radarPayload = await buildLeadershipRadarPayload(supabaseService, {
                    companyId: company_id,
                    quarterId: quarter_id,
                    scope: radar_scope || 'company',
                    userId: recipient_user_id || user?.id,
                });

                console.log(`[leadership-radar] Generating AI content...`);
                // Envia para OpenAI
                const aiResult = await generateLeadershipRadar(radarPayload);

                console.log(`[leadership-radar] Saving to DB...`);
                // Salvar registro no DB (leadership_radars)
                const { data: radarRecord, error: insertError } = await supabaseService.from('leadership_radars').insert({
                    company_id,
                    quarter_id,
                    recipient_user_id: recipient_user_id || user?.id,
                    recipient_role: 'manager', // Adjust based on user_role
                    radar_scope: radar_scope || 'company',
                    status_geral: aiResult.status_geral,
                    title: aiResult.titulo || 'Radar da Liderança',
                    visao_geral: aiResult.visao_geral,
                    avancos: aiResult.avancos,
                    riscos: aiResult.riscos,
                    areas_destaque: aiResult.areas_destaque,
                    recomendacoes: aiResult.recomendacoes,
                    metrics_snapshot: radarPayload.metricsSnapshot,
                    input_payload: radarPayload,
                    ai_raw_response: JSON.stringify(aiResult),
                    generation_status: 'generated'
                }).select().single();

                if (insertError) {
                    console.error('DB Insert Error:', insertError);
                    throw new Error('Falha ao salvar radar no banco de dados.');
                }

                console.log(`[leadership-radar] Dispatching email via n8n...`);
                // Dispara o email assincronamente (n8n webhook)
                // Usaremos um await ou apenas deixamos de fundo o envio
                const emailSuccess = await sendLeadershipRadarEmail(radarRecord);
                
                if (emailSuccess) {
                    await supabaseService.from('leadership_radars').update({
                        generation_status: 'emailed',
                        emailed_at: new Date().toISOString(),
                    }).eq('id', radarRecord.id);
                }

                return new Response(JSON.stringify({ 
                    success: true, 
                    radar: radarRecord, 
                    email_sent: emailSuccess 
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            if (action === 'resend' || path.includes('resend')) {
                // ex: POST /leadership-radar/resend/:id
                const id = body.id || path[path.length - 1]; // simplificando a captura do parametro
                const { data: radar } = await supabaseService.from('leadership_radars').select('*').eq('id', id).single();
                if (!radar) throw new Error('Radar não encontrado');

                const emailSuccess = await sendLeadershipRadarEmail(radar);
                if (emailSuccess) {
                    await supabaseService.from('leadership_radars').update({
                        generation_status: 'emailed',
                        emailed_at: new Date().toISOString(),
                    }).eq('id', radar.id);
                }

                return new Response(JSON.stringify({ success: true, email_sent: emailSuccess }), 
                   { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }
        }

        if (req.method === 'GET') {
            if (!user) throw new Error('Unauthorized');

            if (action === 'history') {
                const limit = parseInt(url.searchParams.get('limit') || '10');
                const { data: radars, error } = await supabaseService.from('leadership_radars')
                    .select('id, title, status_geral, generated_at, generation_status, company_id, quarter_id')
                    .eq('recipient_user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(limit);

                if (error) throw error;

                return new Response(JSON.stringify({ radars: radars || [] }), 
                   { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Ex: GET /leadership-radar/:id
            const id = action;
            if (id) {
                const { data: radar, error } = await supabaseService.from('leadership_radars')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error || !radar) throw new Error('Radar não encontrado');
                return new Response(JSON.stringify({ radar }), 
                   { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }
        }

        throw new Error('Route not supported');

    } catch (error: any) {
        console.error('[leadership-radar] Error:', error);
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    }
});
