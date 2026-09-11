-- A Lei Seca passou a viver em topics.legal_basis/priority (já exibido na árvore
-- matéria > assunto do Edital e reaproveitado pela aba Lei Seca). A tabela solta
-- criada antes, sem vínculo real de assunto, fica redundante.
drop table if exists public.legal_provisions;
