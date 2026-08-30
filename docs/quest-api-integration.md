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

Exemplo com Supabase CLI:

```bash
supabase secrets set QUEST_API_BASE_URL="https://SEU-GATEWAY" \
  QUEST_API_KEY="SUA-CHAVE" \
  QUEST_API_KEY_HEADER="x-api-key"
```

Depois publique a função:

```bash
supabase functions deploy quest-api
```

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
