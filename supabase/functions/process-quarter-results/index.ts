// NAO reimportar '../types.d.ts': aquele arquivo so tem `declare module`
// (efeito zero em runtime) e usa specifier pelado '@supabase/supabase-js',
// o que faz o bundler do Deno falhar no deploy com erro 400.
import {
  createClient,
  type SupabaseClient,
} from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CheckinResult {
  id: string;
  key_result_id: string;
  valor_realizado: number | null;
  meta_checkin: number | null;
  minimo_orcamento: number | null;
}

interface KeyResult {
  id: string;
  objective_id: string;
  weight: number | null;
  direction: string;
  type: string;
  baseline: number;
  floor_value: number;
  target: number;
}

interface Objective {
  id: string;
  user_id: string;
  company_id: string;
}


// ─────────────────────────────────────────────────────────────────────────
// Copia fiel de src/lib/deadlineProgress.ts e src/lib/utils.ts (calculateKR).
// A tela de Check-ins calcula a media com ESTAS funcoes, sobre as colunas
// cruas do check-in. Antes esta funcao lia checkin_results.percentual_atingido,
// que guarda o "Atingimento Visual" (Realizado / Meta) e NAO o progresso com
// Piso -- por isso quarter_results divergia do que aparece na tela.
// Se mexer em src/lib/utils.ts, replique aqui.
// ─────────────────────────────────────────────────────────────────────────
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function normalizeToMidnight(input: unknown): Date | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'string') {
    const parts = input.split('-').map((p) => Number(p));
    if (parts.length >= 3 && parts.every((n) => !Number.isNaN(n))) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      d.setHours(0, 0, 0, 0);
      return d;
    }
  }
  const date = input instanceof Date ? new Date(input.getTime()) : new Date(input as string | number);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function calculateDeadlineProgress(metaDate: unknown, limitDate: unknown, doneDate: unknown): number | null {
  const meta = normalizeToMidnight(metaDate);
  const limit = normalizeToMidnight(limitDate);
  const done = normalizeToMidnight(doneDate);
  if (!meta || !limit || !done) return null;

  const metaTime = meta.getTime();
  const limitTime = limit.getTime();
  const doneTime = done.getTime();

  if (metaTime === limitTime) return doneTime <= metaTime ? 100 : 0;
  if (doneTime <= metaTime) return 100;
  if (doneTime >= limitTime) return 0;

  const windowDays = Math.max(1, Math.round((limitTime - metaTime) / MS_PER_DAY));
  const delayDays = Math.round((doneTime - metaTime) / MS_PER_DAY);
  const clamped = Math.max(0, Math.min(1, 1 - delayDays / windowDays));
  return parseFloat((clamped * 100).toFixed(2));
}

function calculateKR(
  realized: number | null,
  min: number | null,
  target: number | null,
  direction: string | null,
  type?: string | null,
): number | null {
  if (target === null || target === undefined || Number.isNaN(Number(target))) return null;

  const safeTarget = Number(target);
  const safeRealized = (realized === null || realized === undefined || Number.isNaN(Number(realized)))
    ? null
    : Number(realized);
  const safeMin = (min !== null && min !== undefined) ? Number(min) : null;

  if (type === 'date' || type === 'data') {
    if (safeRealized === null) return null;
    const limit = safeMin !== null ? safeMin : safeTarget;
    return calculateDeadlineProgress(safeTarget, limit, safeRealized);
  }

  if (safeRealized === null) return null;

  if (!direction || direction === 'increase' || direction === 'maior-é-melhor') {
    if (safeMin !== null) {
      if (safeRealized >= safeTarget) return 100;
      if (safeRealized < safeMin) return 0;
      const denominator = safeTarget - safeMin;
      if (denominator === 0) return 0;
      return Math.max(0, Math.min(100, ((safeRealized - safeMin) / denominator) * 100));
    }
    if (safeTarget === 0) return 0;
    return Math.min(100, Math.max(0, (safeRealized / safeTarget) * 100));
  }

  if (direction === 'decrease' || direction === 'menor-é-melhor') {
    if (safeRealized <= safeTarget) return 100;
    // Piso tambem no decrescente: realizado acima do MIN. ORCAM. zera.
    // Mesma regra ja aplicada em src/pages/KRCheckins.tsx (calculateKR local).
    if (safeMin !== null && safeRealized > safeMin) return 0;
    if (safeTarget === 0) return 0;
    return Math.max(0, ((2 * safeTarget - safeRealized) / safeTarget) * 100);
  }

  return 0;
}


// ─────────────────────────────────────────────────────────────────────────
// Check-in ativo: MESMA regra de calculateQuarterProgress()
// (src/hooks/useDashboardData.ts), que alimenta o card "Progresso do Quarter
// Atual" no Dashboard. E o check-in cuja JANELA contem agora -- ou seja, o
// mais recente cuja data ja chegou, antes do proximo comecar.
//
// Importante: a lista vem da tabela `checkins` (todas as datas agendadas do
// quarter), NAO de checkin_results. Se o check-in ativo ainda nao tem
// resultado lancado, o certo e nao pontuar -- e nao cair no anterior.
// ─────────────────────────────────────────────────────────────────────────
function pickActiveCheckinDate(dates: (string | null | undefined)[], nowMs: number): string | null {
    const unique = Array.from(new Set(dates.filter((d): d is string => !!d)))
        .sort((a, b) => new Date(`${a}T00:00:00`).getTime() - new Date(`${b}T00:00:00`).getTime());

    if (unique.length === 0) return null;

    for (let i = 0; i < unique.length; i++) {
        const start = new Date(`${unique[i]}T00:00:00`).getTime();
        const nextStart = unique[i + 1] ? new Date(`${unique[i + 1]}T00:00:00`).getTime() : null;
        if (nextStart === null && nowMs >= start) return unique[i];
        if (nextStart !== null && nowMs >= start && nowMs < nextStart) return unique[i];
    }

    return unique[unique.length - 1];
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '').trim();

    // Duas formas de chamar:
    //   1) service_role  -> agendador (n8n / cron). Nao ha usuario logado.
    //   2) JWT de admin  -> chamada manual pelo app, como antes.
    if (token === supabaseServiceKey) {
      console.log('Service role authorized for quarter processing');
    } else {
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);

      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: 'Invalid authentication token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (roleError || !roleData) {
        console.log(`Access denied for user ${user.id} - admin role required`);
        return new Response(
          JSON.stringify({ error: 'Forbidden - Admin access required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Admin user ${user.id} authorized for quarter processing`);
    }

    console.log('Starting quarter results processing...');

    // Todo quarter ativo que JA COMECOU -- inclui os em andamento.
    // Antes o filtro era `.lte('end_date', today)`, ou seja, so quarters ja
    // encerrados: o quarter corrente nunca era processado e quarter_results
    // ficava congelado no ultimo valor gravado pela tela de Check-ins.
    const today = new Date().toISOString().split('T')[0];
    const { data: quartersToProcess, error: quartersError } = await supabase
      .from('quarters')
      .select('id, company_id, end_date, name')
      .lte('start_date', today)
      .eq('is_active', true);

    if (quartersError) {
      console.error('Error fetching quarters:', quartersError);
      throw quartersError;
    }

    console.log(`Found ${quartersToProcess?.length || 0} quarters to process`);

    if (!quartersToProcess || quartersToProcess.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No quarters to process', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let processedCount = 0;

    for (const quarter of quartersToProcess) {
      console.log(`Processing quarter: ${quarter.name} (${quarter.id})`);

      // Get all objectives for this quarter
      const { data: objectives, error: objectivesError } = await supabase
        .from('objectives')
        .select('id, user_id, company_id')
        .eq('quarter_id', quarter.id);

      if (objectivesError) {
        console.error(`Error fetching objectives for quarter ${quarter.id}:`, objectivesError);
        continue;
      }

      if (!objectives || objectives.length === 0) {
        console.log(`No objectives found for quarter ${quarter.id}`);
        continue;
      }

      // Group objectives by user
      const userObjectivesMap = new Map<string, Objective[]>();
      objectives.forEach((obj: Objective) => {
        if (!userObjectivesMap.has(obj.user_id)) {
          userObjectivesMap.set(obj.user_id, []);
        }
        userObjectivesMap.get(obj.user_id)!.push(obj);
      });

      console.log(`Found ${userObjectivesMap.size} users with objectives in quarter ${quarter.id}`);

      // Process each user
      for (const [userId, userObjectives] of userObjectivesMap) {
        try {
          const resultPercent = await calculateUserQuarterResult(
            supabase,
            quarter.id,
            userId,
            userObjectives
          );

          console.log(`User ${userId} result: ${resultPercent}%`);

          // Save or update the result
          const { error: upsertError } = await supabase
            .from('quarter_results')
            .upsert({
              quarter_id: quarter.id,
              user_id: userId,
              company_id: quarter.company_id,
              result_percent: resultPercent,
              saved_at: new Date().toISOString(),
            }, {
              onConflict: 'quarter_id,user_id'
            });

          if (upsertError) {
            console.error(`Error saving result for user ${userId}:`, upsertError);
          } else {
            processedCount++;
            console.log(`Successfully saved result for user ${userId}`);
          }
        } catch (error) {
          console.error(`Error calculating result for user ${userId}:`, error);
        }
      }
    }

    console.log(`Processing complete. Saved ${processedCount} results.`);

    return new Response(
      JSON.stringify({ 
        message: 'Quarter results processed successfully', 
        processed: processedCount,
        quarters: quartersToProcess.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing quarter results:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function calculateUserQuarterResult(
  supabase: SupabaseClient,
  quarterId: string,
  userId: string,
  objectives: Objective[]
): Promise<number> {
  // Todos os check-ins agendados do quarter, com data.
  const { data: checkins, error: checkinsError } = await supabase
    .from('checkins')
    .select('id, checkin_date')
    .eq('quarter_id', quarterId);

  if (checkinsError || !checkins || checkins.length === 0) {
    console.log(`No check-ins found for quarter ${quarterId}`);
    return 0;
  }

  // Get all KRs for user's objectives
  const objectiveIds = objectives.map(obj => obj.id);
  const { data: keyResults, error: krsError } = await supabase
    .from('key_results')
    .select('id, objective_id, weight, direction, type, baseline, floor_value, target')
    .in('objective_id', objectiveIds);

  if (krsError || !keyResults || keyResults.length === 0) {
    console.log(`No KRs found for user ${userId}`);
    return 0;
  }

  const krIds = keyResults.map((kr: KeyResult) => kr.id);

  // UM check-in de referencia -- o ativo, mesma regra do Dashboard.
  // Antes isto percorria os check-ins do mais novo para o mais antigo ate achar
  // um com resultados, o que podia pontuar por um check-in antigo depois que um
  // novo ja tinha comecado.
  const activeCheckinDate = pickActiveCheckinDate(
    checkins.map((c: { checkin_date: string }) => c.checkin_date),
    Date.now(),
  );

  if (!activeCheckinDate) {
    console.log(`No active check-in for quarter ${quarterId}`);
    return 0;
  }

  const activeCheckinIds = checkins
    .filter((c: { checkin_date: string }) => c.checkin_date === activeCheckinDate)
    .map((c: { id: string }) => c.id);

  {
    const { data: krResults, error: krResultsError } = await supabase
      .from('checkin_results')
      .select('id, key_result_id, valor_realizado, meta_checkin, minimo_orcamento')
      .in('checkin_id', activeCheckinIds)
      .in('key_result_id', krIds);

    if (krResultsError) {
      console.error(`Error fetching check-in results for ${activeCheckinDate}:`, krResultsError);
      return 0;
    }

    if (!krResults || krResults.length === 0) {
      console.log(`No KR results in active check-in ${activeCheckinDate} for user ${userId}`);
      return 0;
    }

    // Calculate weighted average by objective using this check-in's results
    const objectiveResults: number[] = [];

    for (const objective of objectives) {
      const objectiveKRs = keyResults.filter((kr: KeyResult) => kr.objective_id === objective.id);
      if (objectiveKRs.length === 0) continue;

      let totalWeight = 0;
      let weightedSum = 0;

      for (const kr of objectiveKRs) {
        const krResult = krResults.find((c: CheckinResult) => c.key_result_id === kr.id);
        const weight = typeof kr.weight === 'number' && !Number.isNaN(kr.weight) ? kr.weight : 1;

        if (!krResult) continue;

        // Mesma exigencia do Dashboard: realizado e meta preenchidos.
        // minimo_orcamento pode ser nulo (KR sem Piso) -- calculateKR trata.
        if (krResult.valor_realizado === null || krResult.meta_checkin === null) continue;

        const pct = calculateKR(
          krResult.valor_realizado,
          krResult.minimo_orcamento,
          krResult.meta_checkin,
          kr.direction,
          kr.type,
        );

        // Sem fallback: KR sem calculo valido sai da conta, igual a tela faz.
        if (pct === null) continue;

        weightedSum += pct * weight;
        totalWeight += weight;
      }

      if (totalWeight > 0) {
        objectiveResults.push(weightedSum / totalWeight);
      }
    }

    if (objectiveResults.length === 0) {
      return 0;
    }

    const average = objectiveResults.reduce((sum, val) => sum + val, 0) / objectiveResults.length;
    return Math.round(average * 100) / 100;
  }
}
