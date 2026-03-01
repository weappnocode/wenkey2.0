const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const VITE_SUPABASE_URL = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const VITE_SUPABASE_ANON_KEY = envContent.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.*)/)[1].trim();

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

function calculateKR(realized, min, target, direction, type) {
    if (target === null || target === undefined || Number.isNaN(Number(target))) return null;

    const safeTarget = Number(target);
    const safeRealized = (realized === null || realized === undefined || Number.isNaN(Number(realized))) ? null : Number(realized);
    const safeMin = (min !== null && min !== undefined) ? Number(min) : null;

    if (type === 'date' || type === 'data') {
        if (safeRealized === null) return null;
        const limit = safeMin !== null ? safeMin : safeTarget;
        return null;
    }

    if (safeRealized === null) return null;

    if (!direction || direction === 'increase' || direction === 'maior-é-melhor') {
        if (safeMin !== null && !Number.isNaN(safeMin)) {
            if (safeRealized >= safeTarget) return 100;
            if (safeRealized < safeMin) return 0;
            const denominator = safeTarget - safeMin;
            if (denominator === 0) return 0;
            const result = ((safeRealized - safeMin) / denominator) * 100;
            return Math.max(0, Math.min(100, result));
        }
        if (safeTarget === 0) return 0;
        const result = (safeRealized / safeTarget) * 100;
        return Math.min(100, Math.max(0, result));
    }

    if (direction === 'decrease' || direction === 'menor-é-melhor') {
        if (safeRealized <= safeTarget) return 100;
        if (safeTarget === 0) return 0;
        const result = ((2 * safeTarget - safeRealized) / safeTarget) * 100;
        return Math.max(0, result);
    }

    return 0;
}

async function debug() {
    const { data: objectives, error } = await supabase
        .from('objectives')
        .select('id, title, percent_obj, user_id, key_results (id, percent_kr, type, direction, target, weight, checkin_results(percentual_atingido, valor_realizado, meta_checkin, minimo_orcamento, created_at, checkins(quarter_id)))')
        .ilike('title', '%Faturamento%');

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Found ${objectives.length} objectives matching Faturamento`);

    for (const obj of objectives) {
        console.log(`\nObjective: ${obj.title} (ID: ${obj.id})`);
        const krs = obj.key_results || [];

        let weightedSum = 0;
        let totalWeight = 0;
        let hasData = false;

        for (const kr of krs) {
            console.log(`  KR: ${kr.id} (Target: ${kr.target}, Weight: ${kr.weight})`);
            console.log(`    DB percent_kr: ${kr.percent_kr}`);

            const results = (kr.checkin_results || []);
            const latestResult = [...results].sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0];

            if (latestResult) {
                console.log(`    Latest Result -> Realized: ${latestResult.valor_realizado}, Min: ${latestResult.minimo_orcamento}, Meta: ${latestResult.meta_checkin}`);
                const krProgress = calculateKR(
                    latestResult.valor_realizado,
                    latestResult.minimo_orcamento,
                    latestResult.meta_checkin,
                    kr.direction,
                    kr.type
                );
                console.log(`    Calculated KR Progress: ${krProgress}`);

                if (krProgress !== null) {
                    const weight = kr.weight || 1;
                    weightedSum += krProgress * weight;
                    totalWeight += weight;
                    hasData = true;
                }
            } else {
                console.log(`    No checkin results found for KR`);
            }
        }

        if (hasData && totalWeight > 0) {
            console.log(`  => Objective Progress: ${weightedSum / totalWeight}%`);
        } else {
            console.log(`  => No valid checkins. Fallback to percent_kr.`);
            let fallbackSum = 0;
            let fallbackWeight = 0;
            for (const kr of krs) {
                const weight = kr.weight || 1;
                fallbackSum += (kr.percent_kr || 0) * weight;
                fallbackWeight += weight;
            }
            console.log(`  => Fallback Progress: ${fallbackWeight > 0 ? fallbackSum / fallbackWeight : 0}%`);
        }
    }
}

debug();
