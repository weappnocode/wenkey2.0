-- Create okr_benchmarks table
create table if not exists public.okr_benchmarks (
    id uuid default gen_random_uuid() primary key,
    strategic_category text not null check (strategic_category in ('Receita', 'Eficiência Operacional', 'Cliente', 'Crescimento', 'Pessoas', 'Inovação / Digital')),
    industry text not null,
    objective_text text not null,
    key_results jsonb not null,
    impact_description text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.okr_benchmarks enable row level security;

-- Create policy for public read access
create policy "Allow public read access to okr_benchmarks"
    on public.okr_benchmarks for select
    using (true);

-- Insert initial benchmarks
insert into public.okr_benchmarks (strategic_category, industry, objective_text, key_results, impact_description) values
('Receita', 'Varejo', 'Maximizar o faturamento e ticket médio no Q3', '["Aumentar o Ticket Médio de R$ 150 para R$ 180", "Atingir R$ 2M de faturamento mensal", "Aumentar a conversão da Black Friday de 2.5% para 4%"]', 'Garante o crescimento da linha principal de receita otimizando clientes atuais e volume extra.'),
('Receita', 'SaaS', 'Impulsionar o crescimento exponencial de MRR', '["Aumentar o MRR em 15%", "Fechar 5 novos contratos Enterprise", "Aumentar a receita de expansão (upsell/cross-sell) em 20%"]', 'Foca puramente em Receita Recorrente e expansão na base atual.'),
('Eficiência Operacional', 'Geral', 'Operação enxuta e margens saudáveis', '["Reduzir o custo de infraestrutura em 15%", "Diminuir o tempo de fechamento contábil de 5 para 2 dias", "Aumentar a margem EBITDA de 12% para 18%"]', 'Garante que o crescimento ocorra de forma rentável.'),
('Cliente', 'SaaS', 'Garantir retenção e maximizar a experiência do usuário', '["Reduzir o Revenue Churn de 3% para 1.5%", "Aumentar o NPS de 45 para 60", "Reduzir o tempo de primeira resposta do suporte para menos de 10 minutos"]', 'Foca diretamente no sucesso do cliente para blindar a base.'),
('Cliente', 'Varejo', 'Lealdade máxima e experiência de compra sem fricção', '["Aumentar a taxa de recompra de 20% para 35%", "Reduzir o índice de devoluções de 8% para 4%", "Atingir CSAT de 90% no atendimento pós-venda"]', 'Mede o quão bem a empresa mantém os clientes felizes e fiéis.'),
('Crescimento', 'SaaS', 'Dominar novos canais de aquisição digital', '["Reduzir o CAC (Custo de Aquisição) em 20%", "Aumentar os leads inbound semanais de 100 para 250", "Dobrar a taxa de conversão da landing page de 3% para 6%"]', 'Expansão e alavanca de máquina de vendas.'),
('Crescimento', 'Franquias', 'Expansão agressiva da rede de parceiros', '["Inaugurar 10 novas unidades até o fim do trimestre", "Reduzir o tempo de ramp-up das novas lojas de 3 para 1.5 meses", "Aumentar o volume de leads qualificados para franquias em 50%"]', 'Foca em capilaridade e abertura de mercado.'),
('Pessoas', 'Geral', 'Construir um time de alta performance e engajamento', '["Alcançar 85% de favorabilidade na pesquisa de clima (eNPS)", "Garantir que 100% dos líderes passem pelo treinamento de feedback", "Aumentar para 90% as metas individuais atingidas"]', 'Garanta sustentação do negócio apostando na cultura.'),
('Inovação / Digital', 'Geral', 'Liderar a transformação digital no setor', '["Lançar o novo app mobile e atingir 10k downloads", "Automatizar 3 processos core reduzindo horas manuais em 40%", "Aumentar a adoção de IA pelos times internos para 70%"]', 'Mede o esforço na criação de novos modelos de negócio ou modernização.');
