# Rumo Concursos — Flashcards para concursos públicos

Um leitor de flashcards local, responsivo e sem instalação, personalizado para o primeiro concurso TRT4 - Analista Judiciário, Área Judiciária. O app inclui:

- um baralho inicial com formato histórico, prioridades e alerta pré-edital;
- dez baralhos por disciplina, seguindo o edital verticalizado fornecido;
- virada animada do cartão;
- navegação por botões ou teclado;
- marcação “Lembrei” e “Não lembrei”;
- progresso da sessão e embaralhamento;
- retomada automática do último cartão usando `localStorage`.

## Como abrir

Abra `index.html` diretamente no navegador. Para servir localmente, execute nesta pasta:

```powershell
python -m http.server 4173
```

Depois acesse `http://localhost:4173`.

## Atalhos

- `Espaço`: virar o cartão
- `←` / `→`: navegar

Os cartões ficam definidos em `decks.js` e podem ser editados sem alterar a interface.

## Atenção ao status do concurso

O PDF fornecido é a versão 2.0 de um material **pré-edital 2026**, baseado no Edital TRT4 nº 1/2022 e na prova FCC de 2022. O próprio documento informa que a banca e o formato do novo certame ainda precisam de confirmação oficial. Quando o novo edital for publicado, ele prevalece e os baralhos devem ser revisados.
