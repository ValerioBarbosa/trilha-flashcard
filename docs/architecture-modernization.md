# Modernização arquitetural do Trilha Flashcard

Objetivo: migrar gradualmente o aplicativo para uma arquitetura modular em TypeScript, com Supabase como backend principal e IndexedDB como cópia local de trabalho, sem quebrar a interface atual nem exigir rewrite completo.

## Princípios

1. Migração incremental: a aplicação atual continua funcional durante toda a transição.
2. Local-first: o estudo deve funcionar offline; IndexedDB permanece como fonte local de trabalho.
3. Supabase principal: autenticação, persistência relacional e sincronização passam a convergir para Supabase.
4. Firebase temporário: permanece apenas como compatibilidade durante a migração.
5. Sem perda de dados: qualquer troca de formato deve ter migração, backup e testes.
6. Tipagem: novos módulos devem ser TypeScript.
7. Separação por domínio: auth, cards, decks, study, review, subjects, edital, jurisprudence, questions e performance.

## Estrutura alvo

```text
src/
  app/
  components/
  features/
    auth/
    cards/
    decks/
    study/
    review/
    subjects/
    edital/
    jurisprudence/
    questions/
    performance/
  services/
    auth/
    supabase/
    sync/
    import/
  database/
    indexeddb/
  types/
supabase/
  migrations/
  functions/
  tests/
```

## Fases

### Fase 1 — Fundação
- introduzir módulos TypeScript sem alterar o runtime atual;
- extrair contratos de autenticação e sincronização;
- preparar um adaptador Supabase sem dependência de `uid` legado do Firebase.

### Fase 2 — Autenticação
- criar camada única de autenticação baseada em `user.id` do Supabase;
- manter ponte de compatibilidade apenas onde o código legado ainda exigir `uid`;
- remover gradualmente dependências diretas de Firebase do fluxo principal.

### Fase 3 — Sincronização local-first
- IndexedDB como cópia de trabalho;
- sincronização incremental por entidade;
- controle de conflitos por versão/timestamp do servidor;
- tombstones para exclusões.

### Fase 4 — Modelo relacional
Criar tabelas para concursos, disciplinas, assuntos, cartões, revisões, questões, tentativas, jurisprudência e caderno de erros.

### Fase 5 — React
Migrar a interface tela por tela, começando por autenticação e sincronização. A aplicação antiga permanece disponível até cada fluxo possuir paridade funcional e testes.

## Regra de aceite de cada etapa

Nenhuma etapa entra na `main` se quebrar: importação de cartões, persistência local, fechamento/reabertura, login, sincronização, recuperação em outro dispositivo, PWA ou estudo offline.
