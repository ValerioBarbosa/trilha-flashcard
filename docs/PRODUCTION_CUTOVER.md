# Corte do app React para produção

Este documento define o gate para substituir a interface legada pelo app React sem perder rollback.

## Estado atual

**Corte concluído.** `valeriobarbosa.github.io/trilha-flashcard` publica o app React via `pages-deploy.yml` (Source do Pages em "GitHub Actions"). Todo push em `main` publica automaticamente. Os critérios abaixo foram validados manualmente em produção antes do corte. Os arquivos legados continuam no repositório (não removidos ainda) para permitir rollback e referência durante a janela de validação — ver "Próxima etapa".

## Critérios obrigatórios antes do corte

1. Login e logout Supabase funcionando no domínio final.
2. Sessão persistida após fechar e reabrir o navegador.
3. Cartões, revisões, questões, tentativas, jurisprudência e caderno de erros carregando pelo modelo relacional.
4. PWA instalável e shell abrindo sem rede após a primeira visita.
5. Nenhuma chamada Supabase/API externa interceptada pelo cache do service worker.
6. Fluxos de importação e migração legada preservados durante a janela de transição.
7. CI legado e React verdes.
8. Candidato `modern/dist` inspecionado antes de substituir o root público.

## Mecanismo de corte

`.github/workflows/pages-deploy.yml` builda `modern/dist` e publica via `actions/deploy-pages`, sem mover nenhum arquivo legado do lugar. Isso evita reescrever caminhos relativos usados pelos testes, pelo `sw.js` do legado e pelo `vendor/`.

Histórico da ativação:
1. Workflow criado com gatilho só `workflow_dispatch` (manual) — mesclar em `main` não publicou nada sozinho.
2. Source do Pages trocado para "GitHub Actions" nas configurações do repositório, deploy manual disparado e validado em produção.
3. Gatilho `push: branches: [main]` adicionado — a partir daqui, todo merge em `main` publica automaticamente.

## Estratégia de rollback

Reverter o corte é trocar o Source do Pages de volta para "Deploy from a branch" nas configurações do repositório — não depende de reverter nenhum commit, já que nenhum arquivo legado foi movido ou removido pelo corte.

## Próxima etapa

Janela de validação em produção (monitorar login, revisões salvando, console sem erros, PWA). Depois dela, abrir a PR de limpeza: remover os arquivos legados da raiz, `firebase-config.js`/`firebase.json`/`firestore.rules` e o workflow `react-preview.yml`, que deixam de ser necessários.
