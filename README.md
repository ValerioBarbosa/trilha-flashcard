# Trilha Flashcard — Estudos para concursos públicos

Um leitor de flashcards local, responsivo e sem instalação, personalizado para o primeiro concurso TRT4 - Analista Judiciário, Área Judiciária. O app inclui:

- um baralho inicial com formato histórico, prioridades e alerta pré-edital;
- doze baralhos por disciplina, seguindo o edital verticalizado, prontos para receber os cartões (os cartões ficam a cargo de quem estuda, conforme o edital atualizado);
- virada animada do cartão;
- navegação por botões ou teclado;
- marcação “Lembrei” e “Não lembrei”;
- progresso por disciplina e embaralhamento;
- retomada automática do último cartão usando `localStorage`;
- histórico persistente de tentativas e taxa de acerto;
- revisão espaçada em 1, 7 e 30 dias, incluindo um modo "revisar errados";
- painel de desempenho com sequência de estudos e revisões pendentes;
- busca de cartões por palavra-chave ou tag, em todos os baralhos;
- tema claro/escuro, com detecção automática da preferência do sistema;
- exportação e importação do progresso em arquivo `.json`, para levar o histórico a outro dispositivo;
- importação de baralhos próprios em `.json`, sem precisar editar código;
- gerenciamento de cartões pelo próprio navegador: adicionar, editar, excluir e importar/exportar cartões de qualquer baralho (incluindo os baralhos por disciplina), sem editar `decks.js`;
- instalação como app (PWA) e uso offline após o primeiro carregamento.

## Como abrir

Abra `index.html` diretamente no navegador. Para servir localmente, execute nesta pasta:

```powershell
python -m http.server 4173
```

Depois acesse `http://localhost:4173`.

## Atalhos

- `Espaço`: virar o cartão
- `←` / `→`: navegar

Os cartões ficam definidos em `decks.js` e podem ser editados sem alterar a interface. Cada baralho começa vazio (`cards: []`); adicione cartões no formato:

```js
{ front: "Pergunta", back: "Resposta", topic: "Assunto (opcional, usado no filtro)", example: "Observação opcional" }
```

Campos opcionais adicionais usados pelo leitor: `tag` (rótulo curto no topo do cartão), `complement`, `pitfall` e `mnemonic` (blocos extras exibidos no verso).

Cada baralho já tem um array `topics` com os assuntos do edital verticalizado (usado pelo filtro de Assunto na barra de busca). Para o filtro funcionar, use exatamente uma dessas strings no campo `topic` de cada cartão que você adicionar.

## Gerenciar cartões pelo navegador

No painel de Desempenho, em "Cartões do baralho atual", clique em "Gerenciar cartões" para adicionar, editar ou excluir cartões do baralho selecionado no topo — inclusive os baralhos por disciplina, sem precisar editar `decks.js`. Também é possível importar cartões (`.json`, mesmo formato usado na seção abaixo) ou exportar os cartões do baralho atual.

Edições em baralhos por disciplina ficam salvas no navegador (via `localStorage`) por cima do conteúdo original de `decks.js`; ao editar `decks.js` diretamente, essas edições salvas continuam valendo até serem removidas ou sobrescritas.

## Importar seu próprio baralho

No painel de Desempenho, em "Meus baralhos", importe um arquivo `.json` no formato:

```json
{
  "title": "Meu baralho",
  "cards": [
    { "front": "Pergunta", "back": "Resposta", "example": "Observação opcional" }
  ]
}
```

Também aceita um array de baralhos (`[{...}, {...}]`) ou `{"decks": [...]}` para importar vários de uma vez.
Baralhos importados ficam salvos no navegador e podem ser removidos a qualquer momento na lista de progresso.

## Testes

O projeto usa [Vitest](https://vitest.dev) para testar a lógica de repetição espaçada (`spaced-repetition.js`):

```bash
npm install
npm test
```

Um workflow do GitHub Actions (`.github/workflows/ci.yml`) roda os testes a cada push e pull request.

## Atenção ao status do concurso

O PDF fornecido é a versão 2.0 de um material **pré-edital 2026**, baseado no Edital TRT4 nº 1/2022 e na prova FCC de 2022. O próprio documento informa que a banca e o formato do novo certame ainda precisam de confirmação oficial. Quando o novo edital for publicado, ele prevalece e os baralhos devem ser revisados.
