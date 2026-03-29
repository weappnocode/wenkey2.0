-- Adiciona campo de email do responsável (CEO) na tabela companies
ALTER TABLE public.companies 
ADD COLUMN responsible_email text;
