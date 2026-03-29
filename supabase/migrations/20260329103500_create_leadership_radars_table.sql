create table public.leadership_radars (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  quarter_id uuid references public.quarters(id) on delete cascade,
  recipient_user_id uuid references public.profiles(id) on delete cascade,
  recipient_role text,
  radar_scope text not null, -- company | area | manager | custom
  scope_reference_id uuid, -- pode ser area_id, team_id, etc
  title text not null default 'Radar da Liderança',
  status_geral text, -- saudavel | atencao | risco
  
  -- kpis rápidos
  metrics_snapshot jsonb not null default '{}'::jsonb,
  
  -- estrutura ia
  visao_geral text,
  avancos jsonb not null default '[]'::jsonb,
  riscos jsonb not null default '[]'::jsonb,
  areas_destaque jsonb not null default '[]'::jsonb,
  recomendacoes jsonb not null default '[]'::jsonb,
  
  -- tracking de status
  generated_at timestamptz not null default now(),
  scheduled_for timestamptz,
  emailed_at timestamptz,
  generation_status text not null default 'pending', -- pending | generated | emailed | failed
  email_status text,
  
  -- inputs vs original
  input_payload jsonb not null default '{}'::jsonb,
  ai_raw_response text,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Habilitar RLS
alter table public.leadership_radars enable row level security;

-- Criar trigger de updated_at
create function public.set_current_timestamp_updated_at()
returns trigger as $$
declare
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_public_leadership_radars_updated_at
  before update on public.leadership_radars
  for each row
  execute function public.set_current_timestamp_updated_at();

-- Políticas RLS
-- Admins da company podem ver todos os radares criados nela
create policy "Admins can view leadership radars of their company"
on public.leadership_radars for select
using (
  company_id in (
    select c.id from public.companies c
    join public.profiles p on p.company_id = c.id
    join public.user_roles ur on ur.user_id = p.id
    where p.id = auth.uid() and ur.role = 'admin'
  )
);

-- Usuário logado pode ver radares gerados para ele próprio (recipient_user_id)
create policy "Users can view their own leadership radars"
on public.leadership_radars for select
using (
  recipient_user_id = auth.uid()
);

-- Admin da company pode deletar (opcional)
create policy "Admins can delete leadership radars of their company"
on public.leadership_radars for delete
using (
  company_id in (
    select c.id from public.companies c
    join public.profiles p on p.company_id = c.id
    join public.user_roles ur on ur.user_id = p.id
    where p.id = auth.uid() and ur.role = 'admin'
  )
);

-- Agendamento com pg_cron (Verifica daily 18:00 local time = 21:00 UTC)
-- Como a função não retorna id no select da pg_net a gente usa net.http_post de forma cega ou wrapper do pg_cron
-- OBS: Apenas superusers podem invocar net.http_post puro via cron no supabase, mas podemos deixar a query crua aqui
-- SELECT cron.schedule(
--   'invoke-leadership-radar',
--   '0 21 * * *', -- 21:00 GMT (18:00 BRT)
--   $$
--   select
--     net.http_post(
--         url:='https://[PROJECT_REF].supabase.co/functions/v1/leadership-radar/generate-all',
--         headers:='{"Content-Type": "application/json", "Authorization": "Bearer [SERVICE_ROLE_KEY]"}'::jsonb,
--         body:= '{}'::jsonb
--     );
--   $$
-- );
