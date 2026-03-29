-- Adiciona colunas de configuração de agendamento do Radar e Bloqueio da Plataforma
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS radar_email_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS radar_email_hours_before integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS platform_lock_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS platform_lock_hours_before integer NOT NULL DEFAULT 24;

-- radar_email_enabled: ativa envio automático do Radar antes do check-in
-- radar_email_hours_before: antecedência (h) em relação ao check-in para envio (3,6,12,24,48,72)
-- platform_lock_enabled: ativa bloqueio de edição da plataforma antes do check-in
-- platform_lock_hours_before: antecedência (h) em relação ao check-in para bloqueio (3,6,12,24,48,72)
-- Todos os horários são calculados em BRT (America/Sao_Paulo, UTC-3)
