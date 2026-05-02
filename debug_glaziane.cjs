const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const VITE_SUPABASE_URL = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
// Tenta a chave de serviço primeiro, senão usa a anon
const serviceKeyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
const anonKeyMatch = envContent.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.*)/);
const KEY = (serviceKeyMatch ? serviceKeyMatch[1].trim() : null) || (anonKeyMatch ? anonKeyMatch[1].trim() : '');

const supabase = createClient(VITE_SUPABASE_URL, KEY);

async function debug() {
    // 1. Quarter ativo
    const today = new Date().toISOString().split('T')[0];
    const { data: quarters } = await supabase
        .from('quarters')
        .select('id, start_date, end_date')
        .order('start_date', { ascending: false });

    const activeQuarter = quarters?.find(q => q.start_date <= today && q.end_date >= today) || quarters?.[0];
    console.log('Quarter ativo:', activeQuarter?.id, activeQuarter?.start_date, '->', activeQuarter?.end_date);

    // 2. Checkins do quarter
    const { data: checkins } = await supabase
        .from('checkins')
        .select('id, checkin_date, user_id')
        .eq('quarter_id', activeQuarter.id)
        .order('checkin_date', { ascending: true });

    console.log(`\nTotal checkins no quarter: ${checkins?.length}`);

    // 3. Procurar pelo nome Glaziane nos profiles
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .ilike('full_name', '%glaziane%');

    console.log('\nPerfis encontrados:', profiles);

    if (!profiles || profiles.length === 0) {
        console.log('Glaziane não encontrada. Listando todos os profiles...');
        const { data: allProfiles } = await supabase.from('profiles').select('id, full_name').eq('is_active', true);
        console.log(allProfiles?.map(p => p.full_name));
        return;
    }

    const glazianeId = profiles[0].id;
    console.log('\nGlaziane ID:', glazianeId);

    // 4. KRs da Glaziane
    const { data: krs } = await supabase
        .from('key_results')
        .select('id, objective_id, direction, type, weight, objectives(title)')
        .eq('user_id', glazianeId);

    console.log(`\nKRs da Glaziane (${krs?.length}):`);
    krs?.forEach(kr => {
        console.log(`  KR ${kr.id} - Objetivo: ${kr.objectives?.title} - Direction: ${kr.direction}`);
    });

    if (!krs || krs.length === 0) return;

    const krIds = krs.map(k => k.id);
    const checkinIds = checkins?.map(c => c.id) || [];

    // 5. Todos os checkin_results desses KRs no quarter
    const { data: results } = await supabase
        .from('checkin_results')
        .select('checkin_id, key_result_id, valor_realizado, meta_checkin, minimo_orcamento')
        .in('checkin_id', checkinIds)
        .in('key_result_id', krIds);

    console.log(`\nCheckin results encontrados: ${results?.length}`);

    // Montar mapa checkin_id -> data
    const checkinDateMap = new Map(checkins?.map(c => [c.id, c.checkin_date]));

    // Agrupar por KR
    krs?.forEach(kr => {
        const krResults = (results || []).filter(r => r.key_result_id === kr.id);
        console.log(`\n  KR ${kr.id} (${kr.objectives?.title}):`);
        krResults.forEach(r => {
            const data = checkinDateMap.get(r.checkin_id);
            console.log(`    Checkin ${data}: realizado=${r.valor_realizado}, meta=${r.meta_checkin}, min=${r.minimo_orcamento}`);
        });
    });
}

debug().catch(console.error);
