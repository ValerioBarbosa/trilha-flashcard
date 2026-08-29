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

### 1. Fundação tipada — em andamento
- [x] contratos TypeScript de autenticação e sincronização;
- [x] serviço Supabase baseado em `user.id`;
- [x] adaptador de sincronização Supabase tipado;
- [x] store de autenticação independente da UI;
- [x] testes unitários do serviço de autenticação e da store;
- [ ] toolchain React/TypeScript executável no CI;
- [ ] `AuthContext` React consumindo a store;
- [ ] componente piloto sem substituir a interface atual.

### 2. Autenticação e sincronização
- ligar o `AuthContext` à store;
- manter Firebase apenas como compatibilidade durante a migração;
- validar login Google, refresh, logout e restauração de sessão;
- validar conflito local/remoto e recuperação em outro dispositivo.

### 3. Features React isoladas
Migrar uma feature por vez, começando pelas áreas com menos dependências globais:
1. status de sincronização;
2. autenticação;
3. gerenciador de cartões;
4. matérias/edital;
5. estudo e revisão;
6. desempenho.

### 4. Banco relacional Supabase
Adicionar tabelas de domínio sem remover imediatamente `flashcard_sync_entries`:
- concursos;
- disciplinas;
- tópicos;
- cartões;
- revisões;
- questões e tentativas;
- jurisprudência;
- caderno de erros.

### 5. Encerramento do legado
Somente depois de paridade funcional e testes:
- reduzir dependências do `app.js`;
- retirar adaptadores temporários Firebase/Supabase;
- tornar React a entrada principal;
- manter migração dos dados antigos.

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
