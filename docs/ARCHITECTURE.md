# Arquitetura do Trilha Flashcard

## Objetivo

Convergir o projeto para uma única aplicação React + TypeScript, organizada por domínio, sem interromper o aplicativo legado enquanto a paridade funcional não estiver comprovada.

A reorganização é incremental: primeiro criamos limites claros de responsabilidade; depois migramos módulos; por último removemos o legado e as compatibilidades temporárias.

## Estado de transição

Hoje existem três camadas que não devem ser confundidas:

- **legado publicado**: `index.html`, `app.js`, módulos JavaScript da raiz, IndexedDB/localStorage e compatibilidade Firebase;
- **aplicação moderna**: `modern/`, React + TypeScript + Vite;
- **núcleo compartilhado**: `src/`, contratos e serviços TypeScript já reutilizados pela aplicação moderna.

Durante a transição, nenhuma dessas camadas deve ser removida apenas para deixar a árvore visualmente mais limpa. A remoção só ocorre após paridade funcional, testes de recuperação e validação de produção.

## Árvore alvo

```text
src/
├── app/                    # composição, providers, rotas e bootstrap
├── features/
│   ├── auth/
│   ├── cards/
│   ├── questions/
│   ├── study/
│   ├── errors/
│   ├── edital/
│   ├── jurisprudence/
│   └── performance/
├── shared/                 # componentes, hooks e utilitários sem regra de domínio
├── infrastructure/
│   ├── supabase/
│   ├── sync/
│   └── offline/
├── types/                  # tipos realmente transversais
└── legacy/                 # adaptadores temporários durante a migração
```

Ao final da migração, `modern/src` deixa de ser uma segunda árvore de aplicação: seus módulos passam gradualmente para a árvore raiz acima. `modern/` pode permanecer temporariamente apenas como shell/build enquanto o entrypoint definitivo não é promovido.

## Regras de dependência

1. `app` pode compor qualquer feature e infraestrutura.
2. Uma `feature` pode depender de `shared`, `types` e contratos de infraestrutura, mas não deve importar internals de outra feature.
3. `shared` não contém regra de negócio de cartões, questões, edital ou revisão.
4. `infrastructure` não importa componentes React nem páginas.
5. Integrações externas (Supabase, Quest.API, Firebase temporário) ficam atrás de adapters/repositories.
6. Código legado só pode entrar na arquitetura nova por um adapter explícito em `legacy` ou `infrastructure`.
7. Novas funcionalidades não devem ser adicionadas a `app.js`, salvo correção crítica de regressão enquanto ele ainda for o fallback de produção.

## Convenções

- componentes React: `PascalCase.tsx`;
- hooks: `useNome.ts`;
- repositories/adapters: `nome-repository.ts` / `nome-adapter.ts`;
- tipos locais ficam junto da feature; tipos compartilhados ficam em `src/types`;
- imports dentro da aplicação moderna podem usar `@/*`; contratos da raiz podem usar `@core/*` durante a transição;
- evitar arquivos `utils.ts` genéricos: prefira nomes que expressem responsabilidade.

## Estratégia de migração

### Sprint 1 — limites e ferramentas

- documentar a arquitetura;
- materializar a nova árvore por domínios;
- configurar aliases de importação;
- manter comportamento e banco inalterados.

### Sprint 2 — infraestrutura

- consolidar cliente Supabase, autenticação, sync e offline em `src/infrastructure`;
- substituir imports cruzados entre `modern/src` e `../src` por contratos estáveis;
- adicionar testes dos adapters.

### Sprint 3 — domínio de estudo

Migrar `cards`, `study`, `questions` e `errors` para `src/features`, preservando a interface e os dados.

### Sprint 4 — conteúdo estratégico

Migrar `edital`, `jurisprudence` e `performance`, eliminando lógica de negócio do componente de workspace.

### Sprint 5 — corte de produção

- promover o React como entrypoint principal;
- validar PWA/offline, login, importação, fechamento/reabertura e recuperação em outro dispositivo;
- remover Firebase e `flashcard_sync_entries` apenas após a sincronização relacional atingir paridade;
- arquivar/remover arquivos legados comprovadamente sem uso.

## Critérios obrigatórios antes de remover o legado

- CI legado e CI moderno verdes durante a transição;
- login Google funcional;
- cartões importados persistem após fechar/reabrir;
- estudo funciona offline depois do primeiro carregamento;
- dados reaparecem corretamente em outro dispositivo;
- conflitos e exclusões não ressuscitam dados antigos;
- backup/restore testado;
- Banco de Questões e Caderno de Erros preservam tentativas;
- PWA instalada e atualizada sem cache obsoleto.

## Decisão importante

A reorganização da árvore **não é uma reescrita completa**. Arquivos são migrados por fatias testáveis. O legado permanece como rollback até o último corte. Isso reduz o risco de perder dados ou repetir regressões já resolvidas.