-- Habilitar a extensão vector se não existir
create extension if not exists vector;

-- Adicionar colunas em okr_benchmarks
alter table public.okr_benchmarks
add column if not exists metric_type text,
add column if not exists goal_direction text check (goal_direction in ('increase', 'reduce', 'maintain')),
add column if not exists complexity text check (complexity in ('low', 'medium', 'high')),
add column if not exists embedding vector(1536);

-- Função RPC para busca de similaridade usando RAG
create or replace function match_okr_benchmarks (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_category text default null,
  filter_direction text default null
)
returns table (
  id uuid,
  strategic_category text,
  industry text,
  objective_text text,
  key_results jsonb,
  impact_description text,
  metric_type text,
  goal_direction text,
  complexity text,
  similarity float
)
language sql stable
as $$
  select
    okr_benchmarks.id,
    okr_benchmarks.strategic_category,
    okr_benchmarks.industry,
    okr_benchmarks.objective_text,
    okr_benchmarks.key_results,
    okr_benchmarks.impact_description,
    okr_benchmarks.metric_type,
    okr_benchmarks.goal_direction,
    okr_benchmarks.complexity,
    1 - (okr_benchmarks.embedding <=> query_embedding) as similarity
  from public.okr_benchmarks
  where 1 - (okr_benchmarks.embedding <=> query_embedding) > match_threshold
    and (filter_category is null or okr_benchmarks.strategic_category = filter_category)
    and (filter_direction is null or okr_benchmarks.goal_direction = filter_direction)
  order by okr_benchmarks.embedding <=> query_embedding
  limit match_count;
$$;
