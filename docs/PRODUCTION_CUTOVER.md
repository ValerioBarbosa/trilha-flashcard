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

## Estratégia de rollback

O corte deve ser feito em PR própria. Os arquivos legados não serão removidos no mesmo commit que troca o entrypoint público. A remoção só acontece depois de uma janela de validação. Em caso de regressão, basta reverter a PR de corte para restaurar o entrypoint anterior.

## Próxima etapa

Depois da validação real em navegador e em pelo menos dois dispositivos, promover `modern/dist` para o root publicado e iniciar a retirada progressiva de Firebase e dos arquivos legados que deixarem de ser referenciados.
