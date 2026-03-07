const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function run() {
    const { data: q, error } = await supabase.from('quarters').select('id, company_id').order('start_date', { ascending: false }).limit(1);
    if (error || !q || q.length === 0) { console.error("No companies", error); return; }
    const companyId = q[0].company_id;
    const quarterId = q[0].id;

    let { data: objs } = await supabase.from('objectives').select('id, title').eq('company_id', companyId).eq('quarter_id', quarterId).eq('archived', false);
    const objIds = objs.map(o => o.id);

    const { data: krs } = await supabase.from('key_results').select('id, objective_id, direction, type, weight, percent_kr').in('objective_id', objIds);
    const krIds = krs.map(k => k.id);

    const { data: checkins } = await supabase.from('checkins').select('id, checkin_date').eq('quarter_id', quarterId).order('checkin_date', { ascending: true });
    const checkinIds = checkins.map(c => c.id);

    const { data: results } = await supabase.from('checkin_results').select('checkin_id, key_result_id, percentual_atingido, valor_realizado, meta_checkin, minimo_orcamento').in('key_result_id', krIds);

    // Logic 1 (Dashboard, 64%)
    let objAverages1 = [];
    objIds.forEach(objId => {
        let objKrs = krs.filter(kr => kr.objective_id === objId);
        let weightedSum = 0; let totalWeight = 0; let hasData = false;
        objKrs.forEach(kr => {
            let krCheckins = results.filter(c => c.key_result_id === kr.id);
            if (krCheckins.length > 0) {
                // Sort by checkin_id order (meaning by checkin_date from checkins array index)
                krCheckins.sort((a, b) => {
                    return checkinIds.indexOf(b.checkin_id) - checkinIds.indexOf(a.checkin_id);
                });
                let latest = krCheckins[0];
                let pct = latest.percentual_atingido || 0;
                weightedSum += pct * (kr.weight || 1);
                totalWeight += (kr.weight || 1);
                hasData = true;
            }
        });
        if (hasData && totalWeight > 0) objAverages1.push(weightedSum / totalWeight);
        else objAverages1.push(0);
    });
    console.log("Dashboard logic avg (64?):", objAverages1.reduce((a, b) => a + b, 0) / objAverages1.length);

    // Logic 2 (Checkins chart, 82%)
    const lastCheckinId = checkinIds[checkinIds.length - 1]; // Active checkin is latest in time usually
    let sum2 = 0; let count2 = 0;
    objs.forEach(obj => {
        let groupKrs = krs.filter(kr => kr.objective_id === obj.id);
        let gSum = 0; let gWeight = 0; let gHasData = false;
        groupKrs.forEach(kr => {
            let res = results.find(r => r.key_result_id === kr.id && r.checkin_id === lastCheckinId);
            if (res && res.percentual_atingido !== null) {
                gSum += (res.percentual_atingido || 0) * (kr.weight || 1);
                gWeight += (kr.weight || 1);
                gHasData = true;
            }
        });
        if (gHasData && gWeight > 0) {
            sum2 += gSum / gWeight; count2++;
        }
    });
    console.log("Chart logic avg (82?):", sum2 / count2);
}
run().catch(console.error);
