# Laboratório React/TypeScript

Este diretório é uma camada de migração isolada. Ele não substitui `index.html` nem `app.js` e não é publicado pelo GitHub Pages atual.

## Objetivo atual

Validar React + TypeScript + Supabase Auth sobre a `AuthStore` nova, preservando o aplicativo legado e o modelo local-first durante a migração.

## Executar localmente

1. Na raiz do repositório, rode `npm ci`.
2. Entre em `modern/` e rode `npm install`.
3. Copie `.env.example` para `.env` e preencha a URL e a publishable key do Supabase.
4. Rode `npm run dev`.

## Validar

- `npm run typecheck`
- `npm run build`

A validação automatizada também roda em `.github/workflows/react-foundation.yml`.
