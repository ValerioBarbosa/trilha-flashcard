# Integração com a Quest.API

O Trilha Flashcard consome a Quest.API por uma Supabase Edge Function. A chave B2B nunca deve ser colocada no frontend, em `VITE_*`, no GitHub Pages ou em qualquer arquivo versionado.

## Arquitetura

```text
Trilha (React)
  -> Supabase Edge Function `quest-api`
     -> Quest.API `GET /questoes`
```

A integração inicial é somente de consulta. Ela não replica o catálogo completo da Quest.API no Supabase e não persiste conteúdo de terceiros automaticamente.

## Segredos da Edge Function

Configure no projeto Supabase:

- `QUEST_API_BASE_URL`: URL pública do Gateway B2B informada pela Quest.API.
- `QUEST_API_KEY`: chave B2B criada no dashboard da Quest.API.
- `QUEST_API_KEY_HEADER`: nome do header dedicado usado pela Quest.API. Se omitido, o proxy usa `x-api-key`.

Nunca cole esses valores no código, em variáveis `VITE_*`, em um comentário do GitHub ou em uma conversa. O caminho preferencial é cadastrá-los diretamente em **Supabase Dashboard > Edge Functions > Secrets** no projeto `trilha-flashcard` (`rslehgcmskalwkwkotbv`).

Alternativa com Supabase CLI: copie `supabase/functions/.env.example` para `supabase/functions/.env.local`, preencha apenas a cópia local (já ignorada pelo Git) e execute:

```bash
supabase secrets set \
  --env-file supabase/functions/.env.local \
  --project-ref rslehgcmskalwkwkotbv
```

Confirme apenas os nomes cadastrados — nunca imprima ou copie os valores. Depois publique a função, mantendo a validação JWT configurada em `supabase/config.toml`:

```bash
supabase functions deploy quest-api --project-ref rslehgcmskalwkwkotbv
```

Os secrets ficam disponíveis imediatamente para funções já publicadas; alterar um secret não exige nova publicação.

## Controles de segurança

- JWT de usuário Supabase obrigatório (`verify_jwt = true`);
- chave B2B adicionada somente pela Edge Function;
- somente `POST` e filtros previamente permitidos;
- `per_page` limitado a 50;
- filtros textuais limitados a 160 caracteres;
- timeout de 12 segundos na chamada externa;
- respostas não JSON do provedor não são repassadas ao navegador;
- respostas marcadas com `Cache-Control: no-store`.

## Verificação após a publicação

1. Entre no Trilha com Google para obter uma sessão válida.
2. Invoque `listQuestApiQuestions({ page: 1, per_page: 1 })` pelo cliente autenticado.
3. Confirme resposta `200` e verifique os logs da função.
4. Confirme que `QUEST_API_KEY` não aparece no Network do navegador, no bundle, nos logs ou na resposta.
5. Sem sessão válida, confirme resposta `401`.

## Filtros aceitos

O proxy permite apenas os parâmetros de catálogo já documentados publicamente pela Quest.API:

- `page`
- `per_page`
- `after_id`
- `banca`
- `orgao`
- `cargo`
- `materia`
- `ano`
- `codigo`
- `tipo`

Parâmetros desconhecidos são descartados antes da chamada externa.

## Cliente React

Use `modern/src/questions/quest-api-client.ts`:

```ts
const result = await listQuestApiQuestions({
  banca: 'FCC',
  materia: 'Direito Administrativo',
  ano: 2026,
  page: 1,
  per_page: 10,
});
```

## Política de dados

Até que os termos comerciais/licenciamento confirmem expressamente o direito de armazenamento e redistribuição, o conector deve operar em modo de consulta. Se a persistência for autorizada futuramente, a identidade externa deverá usar:

- `source_provider = 'quest-api'`
- `external_id = ID da Quest.API`
- `source_url = referência externa quando fornecida`

O índice único já existente em `questions` deve continuar impedindo duplicação da mesma questão externa dentro de um perfil.
