import { supabase } from '@/integrations/supabase/client';

/**
 * Envia dados para um webhook do n8n via Edge Function proxy.
 * Isso resolve o problema de CORS que impede o browser de enviar
 * `Content-Type: application/json` com `mode: 'no-cors'`.
 */
export async function callN8nWebhook(
    webhookPath: string,
    payload: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
    try {
        const { data, error } = await supabase.functions.invoke('n8n-proxy', {
            body: {
                webhook_path: webhookPath,
                payload,
            },
        });

        if (error) {
            console.warn(`[n8n] Proxy error for ${webhookPath}:`, error);
            return { success: false, error: error.message };
        }

        return { success: data?.success ?? true };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido';
        console.warn(`[n8n] Erro ao chamar webhook ${webhookPath}:`, message);
        return { success: false, error: message };
    }
}
