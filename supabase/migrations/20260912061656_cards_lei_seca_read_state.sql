-- Marca quando um cartão de Lei Seca foi lido, para a página Lei Seca acompanhar progresso de leitura.
alter table public.cards add column if not exists read_at timestamptz;
