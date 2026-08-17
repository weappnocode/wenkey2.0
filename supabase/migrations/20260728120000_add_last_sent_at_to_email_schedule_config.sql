-- Idempotência + catch-up do relatório semanal por e-mail.
--
-- last_sent_at guarda o instante em que os payloads da semana foram entregues
-- ao n8n. A função get-weekly-report-data usa essa coluna para:
--
--   1) Nunca enviar duas vezes na mesma semana. Antes, qualquer reexecução do
--      workflow dentro da hora agendada reenviava tudo para todo mundo.
--
--   2) Fazer catch-up. Antes a condição era `send_hour == hora_atual` (igualdade
--      exata): se o n8n estivesse fora do ar às 9h da segunda, aquele envio era
--      perdido para sempre. Agora a condição é "venceu e ainda não enviei nesta
--      semana", então às 10h ele envia normalmente.
--
-- A semana é definida como começando na segunda-feira 00:00 BRT (UTC-3).
--
-- ATENÇÃO: a tabela email_schedule_config foi criada direto pelo dashboard e não
-- possui migration de origem neste repositório — o schema dela existe só na
-- nuvem. Rode `supabase db pull` para versioná-la e evitar essa deriva.

ALTER TABLE public.email_schedule_config
  ADD COLUMN IF NOT EXISTS last_sent_at timestamptz;

COMMENT ON COLUMN public.email_schedule_config.last_sent_at IS
  'Instante (UTC) do último envio do relatório semanal. Comparado com a segunda-feira 00:00 BRT da semana corrente para garantir no máximo 1 envio por semana por empresa.';
