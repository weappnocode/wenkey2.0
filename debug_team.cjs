const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
async function run() {
    const { data: q, error } = await supabase.from('quarters').select('id, company_id').order('start_date', { ascending: false }).limit(1);
    if (error || !q || q.length === 0) { console.error("No companies", error); return; }
    const companyId = q[0].company_id;
    const quarterId = q[0].id;

    const { data: teams } = await supabase.from('profiles').select('id, full_name, is_team').eq('company_id', companyId).eq('is_team', true);
    console.log("Teams in profiles:", teams);

    if (teams && teams.length > 0) {
        for (const team of teams) {
            const teamId = team.id;
            const { data: qResult } = await supabase.from('quarter_results').select('*').eq('user_id', teamId).eq('quarter_id', quarterId);
            console.log(`Team ${team.full_name} quarter results:`, qResult);

            const { data: objs } = await supabase.from('objectives').select('id, title').eq('user_id', teamId).eq('quarter_id', quarterId);
            console.log(`Team ${team.full_name} objectives (${objs?.length}):`, objs);
        }
    }
}
run().catch(console.error);
