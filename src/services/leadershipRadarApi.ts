import { supabase } from '@/integrations/supabase/client';

export interface LeadershipRadar {
    id: string;
    company_id: string;
    quarter_id: string;
    recipient_user_id: string;
    title: string;
    status_geral: 'saudavel' | 'atencao' | 'risco';
    visao_geral: string;
    metrics_snapshot: any;
    avancos: any[];
    riscos: any[];
    areas_destaque: any[];
    recomendacoes: any[];
    generation_status: string;
    generated_at: string;
    emailed_at: string | null;
}

export const leadershipRadarApi = {
    async generateRadar(companyId: string, quarterId: string, recipientUserId?: string, scope: string = 'company'): Promise<LeadershipRadar> {
        const { data, error } = await supabase.functions.invoke('leadership-radar/generate', {
            body: {
                company_id: companyId,
                quarter_id: quarterId,
                recipient_user_id: recipientUserId,
                radar_scope: scope
            }
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        return data.radar;
    },

    async resendRadarEmail(radarId: string): Promise<boolean> {
        const { data, error } = await supabase.functions.invoke(`leadership-radar/resend/${radarId}`, {
            method: 'POST'
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        return data.email_sent;
    },

    async getRadarHistory(limit: number = 10): Promise<LeadershipRadar[]> {
        const { data, error } = await supabase.functions.invoke(`leadership-radar/history?limit=${limit}`, {
            method: 'GET'
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        return data.radars;
    },

    async getRadarById(radarId: string): Promise<LeadershipRadar> {
        const { data, error } = await supabase.functions.invoke(`leadership-radar/${radarId}`, {
            method: 'GET'
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        return data.radar;
    }
};
