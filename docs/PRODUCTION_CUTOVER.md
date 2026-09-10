# Corte do app React para produção

Este documento define o gate para substituir a interface legada pelo app React sem perder rollback.

## Estado atual

O app React já gera um candidato de produção em `modern/dist`, com manifesto PWA, service worker e ícones. O CI publica esse diretório como artefato temporário em cada validação relevante.

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

`.github/workflows/pages-deploy.yml` builda `modern/dist` e publica via `actions/deploy-pages`, sem mover nenhum arquivo legado do lugar. Isso evita reescrever caminhos relativos usados pelos testes, pelo `sw.js` do legado e pelo `vendor/`. A ativação é em duas etapas propositalmente separadas, para que mesclar o workflow em `main` não troque nada sozinho:

1. **Preparação (feita)**: workflow criado com gatilho só `workflow_dispatch` (manual). Mesclar essa mudança em `main` não publica nada — o job só roda se alguém disparar manualmente pela aba Actions.
2. **Corte de fato** (ação humana, feita com aprovação explícita): em Settings → Pages → Build and deployment → Source, trocar de "Deploy from a branch" para "GitHub Actions". Isso precisa ser feito na UI do GitHub; não há chamada de API disponível neste ambiente para isso. Depois disso, disparar o workflow manualmente uma vez para validar, e só então adicionar o gatilho `push: branches: [main]` ao arquivo (ou continuar disparando manualmente a cada release, se preferir mais controle).

Enquanto o Source do Pages continuar em "Deploy from a branch", o site publicado continua sendo servido a partir da raiz de `main` (legado) exatamente como hoje, independente de este workflow existir ou ser mesclado.

## Estratégia de rollback

Reverter o corte é trocar o Source do Pages de volta para "Deploy from a branch" nas configurações do repositório — não depende de reverter nenhum commit, já que nenhum arquivo legado é movido ou removido pelo corte. Os arquivos legados só são removidos numa PR de limpeza separada, depois de uma janela de validação em produção.

## Próxima etapa

Depois da validação real em navegador e em pelo menos dois dispositivos (critérios 1, 2, 4, 5, 8 acima):
1. Trocar o Source do Pages para "GitHub Actions" e disparar `pages-deploy.yml` manualmente para confirmar que o deploy funciona no domínio final.
2. Adicionar o gatilho automático (`push: branches: [main]`) ao workflow.
3. Após a janela de validação em produção, abrir a PR de limpeza: remover os arquivos legados da raiz, `firebase-config.js`/`firebase.json`/`firestore.rules` e o workflow `react-preview.yml`, que deixam de ser necessários.
