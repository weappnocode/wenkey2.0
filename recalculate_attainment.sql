DO $$
DECLARE
  r RECORD;
  safeTarget numeric;
  safeRealized numeric;
  safeMin numeric;
  vf_attainment numeric;
  kr_progress numeric;
  denom numeric;
BEGIN
  -- Passo 1: Atualiza checkin_results
  FOR r IN 
    SELECT c.id, c.valor_realizado, c.meta_checkin, c.minimo_orcamento,
           k.direction, k.type
    FROM checkin_results c
    JOIN key_results k ON c.key_result_id = k.id
    WHERE c.meta_checkin IS NOT NULL 
      AND c.valor_realizado IS NOT NULL
  LOOP

    safeRealized := r.valor_realizado;
    safeTarget := r.meta_checkin;
    safeMin := r.minimo_orcamento;
    vf_attainment := NULL;

    IF r.type <> 'date' AND r.type <> 'data' THEN
      IF r.direction IS NULL OR r.direction = 'increase' OR r.direction = 'maior-é-melhor' THEN
        IF safeMin IS NOT NULL AND safeRealized < safeMin THEN
          vf_attainment := 0;
        ELSEIF safeTarget > 0 THEN
          vf_attainment := (safeRealized / safeTarget) * 100;
        ELSE
          vf_attainment := 0;
        END IF;
      ELSIF r.direction = 'decrease' OR r.direction = 'menor-é-melhor' THEN
        IF safeRealized <= safeTarget THEN
          vf_attainment := 100;
        ELSIF safeMin IS NOT NULL AND safeRealized > safeMin THEN
          vf_attainment := 0;
        ELSEIF safeTarget > 0 THEN
          vf_attainment := (safeTarget / safeRealized) * 100;
        ELSE
          vf_attainment := 0;
        END IF;
      END IF;
    END IF;

    IF vf_attainment IS NOT NULL THEN
      -- Isto vai acionar a trigger update_kr_percent, que temporariamente define percent_kr como vf_attainment
      UPDATE checkin_results
      SET percentual_atingido = ROUND(vf_attainment, 2)
      WHERE id = r.id;
    END IF;
  END LOOP;

  -- Passo 2: Atualiza Key Results progressos reais
  FOR r IN
    SELECT x.kr_id, x.meta_checkin, x.valor_realizado, x.minimo_orcamento, x.direction, x.type
    FROM (
      SELECT k.id as kr_id, c.meta_checkin, c.valor_realizado, c.minimo_orcamento, k.direction, k.type,
             ROW_NUMBER() OVER(PARTITION BY c.key_result_id ORDER BY c.created_at DESC) as rn
      FROM key_results k
      JOIN checkin_results c ON c.key_result_id = k.id
      WHERE c.meta_checkin IS NOT NULL AND c.valor_realizado IS NOT NULL
    ) x
    WHERE x.rn = 1
  LOOP
    safeRealized := r.valor_realizado;
    safeTarget := r.meta_checkin;
    safeMin := r.minimo_orcamento;
    kr_progress := NULL;

    IF r.type <> 'date' AND r.type <> 'data' THEN
      IF r.direction IS NULL OR r.direction = 'increase' OR r.direction = 'maior-é-melhor' THEN
        IF safeMin IS NOT NULL THEN
          IF safeRealized >= safeTarget THEN
            kr_progress := 100;
          ELSIF safeRealized < safeMin THEN
            kr_progress := 0;
          ELSE
            denom := safeTarget - safeMin;
            IF denom = 0 THEN
              kr_progress := 0;
            ELSE
              kr_progress := ((safeRealized - safeMin) / denom) * 100;
            END IF;
          END IF;
        ELSE
          IF safeRealized >= safeTarget THEN
            kr_progress := 100;
          ELSEIF safeTarget = 0 THEN
            kr_progress := 0;
          ELSE
            kr_progress := (safeRealized / safeTarget) * 100;
          END IF;
        END IF;
      ELSIF r.direction = 'decrease' OR r.direction = 'menor-é-melhor' THEN
        IF safeRealized <= safeTarget THEN
          kr_progress := 100;
        ELSIF safeMin IS NOT NULL AND safeRealized > safeMin THEN
          kr_progress := 0;
        ELSIF safeTarget = 0 THEN
          kr_progress := 0;
        ELSE
          kr_progress := ((2 * safeTarget - safeRealized) / safeTarget) * 100;
        END IF;
      END IF;

      IF kr_progress < 0 THEN kr_progress := 0; END IF;
      IF kr_progress > 100 AND (r.direction IS NULL OR r.direction = 'increase' OR r.direction = 'maior-é-melhor') THEN 
         kr_progress := 100; 
      END IF;

      IF kr_progress IS NOT NULL THEN
         -- Isto vai acionar a trigger update_objective_percent e corrigir definitivamente
         UPDATE key_results
         SET percent_kr = ROUND(kr_progress, 2)
         WHERE id = r.kr_id;
      END IF;
      
    END IF;
  END LOOP;
END;
$$;
