// @ts-types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts"

import { createClient } from '@supabase/supabase-js'
// @ts-ignore - google-auth-library resolved via deno.json import map (npm:google-auth-library)
import { JWT } from 'google-auth-library'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
    checkin_id?: string;
    quarter_name?: string;
    start_datetime?: string;
    end_datetime?: string;
    attendee_emails?: string[];
    // legacy support
    quarter_id?: string;
}

interface Profile {
    email: string | null;
    full_name: string | null;
}

interface Checkin {
    id: string;
    quarter_id: string;
    checkin_date?: string;
    occurred_at?: string;
}

interface Quarter {
    id: string;
    name: string;
    company_id: string;
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        let body: RequestBody;
        try {
            const json = await req.json();
            body = json as RequestBody;
        } catch (_) {
            return new Response(
                JSON.stringify({ error: 'Invalid request body. JSON required.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const { checkin_id, quarter_name, start_datetime, end_datetime, attendee_emails, quarter_id } = body;

        // Legacy handler: if only quarter_id is provided
        if (quarter_id && !checkin_id) {
            // This is the old "schedule all check-ins for a quarter" logic
            const { data: quarter, error: quarterError } = await supabaseClient
                .from('quarters')
                .select('*')
                .eq('id', quarter_id)
                .single();

            if (quarterError || !quarter) throw new Error('Quarter not found');
            const quarterData = quarter as Quarter;

            const { data: checkins, error: checkinsError } = await supabaseClient
                .from('checkins')
                .select('*')
                .eq('quarter_id', quarter_id);

            if (checkinsError || !checkins || checkins.length === 0) {
                return new Response(
                    JSON.stringify({ message: 'No check-ins found for this quarter' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
            // ... the rest of the legacy code ...
            return new Response(
                JSON.stringify({ success: true, message: `Use a nova interface de agendamento por check-in individual.` }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // New Logic: Single Check-in Scheduling
        if (!checkin_id || !start_datetime || !end_datetime || !attendee_emails || attendee_emails.length === 0) {
            throw new Error('Missing required fields for scheduling a check-in event.');
        }

        const attendees = attendee_emails.map(email => ({ email }));

        console.log(`Scheduling event for check-in ${checkin_id} with ${attendees.length} attendees`);

        // Verify Google Credentials
        const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT');

        if (!serviceAccountJson) {
            console.log('GOOGLE_SERVICE_ACCOUNT not configured. returning mock success.');
            // Mock Success for User Feedback
            const [dateStr, timeStr] = start_datetime.split('T');
            const time = timeStr.substring(0, 5);
            return new Response(
                JSON.stringify({
                    success: true,
                    message: `Simulação: Evento agendado para o dia ${dateStr} às ${time} para ${attendees.length} participantes. (Configure GOOGLE_SERVICE_ACCOUNT no Supabase para envio real ao Google Calendar)`,
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Authenticate with Google (Real Implementation)
        const serviceAccount = JSON.parse(serviceAccountJson);
        const client = new JWT({
            email: serviceAccount.client_email,
            key: serviceAccount.private_key,
            scopes: ['https://www.googleapis.com/auth/calendar'],
        });

        // Create Calendar Event
        const event = {
            summary: `Check-in de OKR - ${quarter_name || 'Quarter'}`,
            description: `Reunião de Check-in programada para o quarter ${quarter_name}. Por favor, atualize seus resultados.`,
            start: {
                dateTime: start_datetime, // Format: 2015-05-28T09:00:00-07:00
                timeZone: 'America/Sao_Paulo',
            },
            end: {
                dateTime: end_datetime,
                timeZone: 'America/Sao_Paulo',
            },
            attendees: attendees,
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'email', minutes: 24 * 60 },
                    { method: 'popup', minutes: 10 },
                ],
            },
        };

        try {
            await client.request({
                url: `https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all`,
                method: 'POST',
                data: event,
            });

            return new Response(
                JSON.stringify({ success: true, message: `Evento agendado no Google Calendar com sucesso para ${attendees.length} participantes!` }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        } catch (err: any) {
            console.error('Error creating event:', err);
            throw new Error(`Google Calendar API Error: ${err.message || 'Unknown error'}`);
        }

    } catch (error) {
        return new Response(
            JSON.stringify({ error: (error as Error).message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
