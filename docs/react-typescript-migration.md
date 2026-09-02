# Migração incremental para React + TypeScript

## Objetivo
Modernizar o Trilha Flashcard sem reescrever o produto, preservando a interface publicada, o modo offline, o IndexedDB, os cartões existentes e a sincronização atual durante a transição.

## Princípios
- `main` continua estável durante a migração.
- nenhuma feature antiga é removida antes de existir equivalente testado.
- Supabase usa `user.id` como identidade canônica; não criar novas dependências de `uid` do Firebase.
- IndexedDB continua sendo a cópia de trabalho local.
- sincronização remota permanece incremental e protegida por RLS.
- React entra por módulos, não por uma troca total de `index.html`/`app.js`.

## Fases

### 1. Fundação tipada — concluída
- [x] contratos TypeScript de autenticação e sincronização;
- [x] serviço Supabase baseado em `user.id`;
- [x] adaptador de sincronização Supabase tipado;
- [x] store de autenticação independente da UI;
- [x] testes unitários do serviço de autenticação e da store;
- [x] toolchain React/TypeScript executável no CI (`.github/workflows/react-foundation.yml`);
- [x] `AuthContext` React consumindo a store (`modern/src/auth/AuthContext.tsx`);
- [x] componente piloto sem substituir a interface atual — hoje já é o workspace React completo (`modern/src/app/ModernWorkspace.tsx`).

### 2. Autenticação e sincronização — implementada, validação de produção pendente
- [x] `AuthContext` ligado à store;
- [x] Firebase mantido apenas como compatibilidade durante a migração (login/sync legado intactos em `firebase-config.js`/`cloud-sync.js`);
- [ ] validar login Google, refresh, logout e restauração de sessão **no domínio final de produção** (critério do gate em `docs/PRODUCTION_CUTOVER.md`);
- [ ] validar conflito local/remoto e recuperação em outro dispositivo **no domínio final de produção** (idem).

### 3. Features React isoladas — concluída
Todas as áreas previstas já têm página/componente próprio em `modern/src`, consumindo repositories de `src/features`:
1. [x] status de sincronização (`sync/SyncPanel.tsx`);
2. [x] autenticação (`auth/AuthContext.tsx`);
3. [x] gerenciador de cartões (`cards/CardManagerLauncher.tsx`, `cards/PdfImportLauncher.tsx`);
4. [x] matérias/edital (`edital/EditalPage.tsx`);
5. [x] estudo e revisão (`app/ModernWorkspace.tsx` → `StudyPage`);
6. [x] desempenho (`performance/PerformancePage.tsx`).

Também já cobertos além do escopo inicial: banco de questões (`questions/ProductionQuestionsPage.tsx`, integrado à Quest.API) e jurisprudência (`jurisprudence/JurisprudencePage.tsx` — componente pronto, hoje exibe estado vazio por falta de conteúdo cadastrado, não por lógica pendente).

### 4. Banco relacional Supabase — concluída
Tabelas de domínio já existem em `supabase/migrations/20260829183000_normalized_study_domain.sql` e seguintes, sem remover `flashcard_sync_entries`:
- [x] concursos/perfis (`study_profiles`);
- [x] disciplinas (`subjects`);
- [x] tópicos (`topics`);
- [x] cartões (`cards`);
- [x] revisões (`reviews`);
- [x] questões e tentativas (`questions`, `question_attempts`);
- [x] jurisprudência (`jurisprudence`);
- [x] caderno de erros (`error_notebook`).

### 5. Encerramento do legado — em aberto
Esta é a etapa que falta hoje. Depende da paridade funcional já implementada ser **validada em produção** (ver `docs/PRODUCTION_CUTOVER.md`):
- [ ] promover `modern/dist` a entrypoint publicado no lugar de `index.html`/`app.js`;
- [ ] retirar Firebase e adaptadores temporários Firebase/Supabase;
- [ ] reduzir/aposentar `app.js` e os demais módulos legados da raiz;
- [ ] arquivar dados antigos migrados após confirmação de paridade.

## Critérios antes de qualquer merge estrutural
1. `npm ci` sem erro;
2. suíte Vitest verde;
3. build tipado verde;
4. login Google validado;
5. importação de cartões não perde dados;
6. fechar/reabrir mantém cartões e progresso;
7. sincronizar e restaurar em outro dispositivo funciona;
8. PWA/offline não regride;
9. `main` não muda visualmente até aprovação explícita.
