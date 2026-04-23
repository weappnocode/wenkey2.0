import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const N8N_BASE_URL = "https://n8n.weappnocode.com/webhook";

Deno.serve(async (req: Request) => {
    // Tratamento de CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const { webhook_path, payload } = body;

        if (!webhook_path || !payload) {
            return new Response(
                JSON.stringify({ error: "webhook_path e payload são obrigatórios" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Monta a URL do n8n
        const n8nUrl = `${N8N_BASE_URL}/${webhook_path}`;

        // Faz a chamada server-to-server (sem restrição de CORS)
        const n8nResponse = await fetch(n8nUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const responseText = await n8nResponse.text();

        return new Response(
            JSON.stringify({
                success: n8nResponse.ok,
                status: n8nResponse.status,
                response: responseText,
            }),
            {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    } catch (error) {
        console.error("[n8n-proxy] Erro:", error);
        const errorMessage = error instanceof Error ? error.message : "Erro interno";
        return new Response(
            JSON.stringify({ error: errorMessage }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});
