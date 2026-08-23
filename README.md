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
- armazenamento durável em IndexedDB, com migração automática do conteúdo local;
- conferência dos cartões antes de confirmar uma importação;
- lixeira com restauração e desfazer exclusão;
- backup completo de cartões, desempenho e lixeira;
- sincronização opcional com Google e Firebase, com modo offline e escolha segura em caso de conflito;
- sessões personalizadas por quantidade, escopo e prioridade.

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

No botão "Gerenciar cartões", adicione, edite ou exclua cartões do baralho selecionado no topo — inclusive os baralhos por disciplina, sem precisar editar `decks.js`. Também é possível importar cartões em JSON ou PDF e exportar os cartões do baralho atual.

O JSON aceita tanto `front`/`back` quanto `pergunta`/`resposta`. Os campos `disciplina`, `assunto`, `subassunto`, `fundamentoLegal`, `tipo`, `prioridade` e `dificuldade` também são reconhecidos. Quando `disciplina` corresponde a um baralho do edital, o cartão é enviado automaticamente para ele; sem esse campo, vai para o baralho atualmente selecionado. Cartões repetidos são ignorados.

Edições em baralhos por disciplina ficam salvas no navegador (via `localStorage`) por cima do conteúdo original de `decks.js`; ao editar `decks.js` diretamente, essas edições salvas continuam valendo até serem removidas ou sobrescritas.

## Ativar sincronização na nuvem

1. Crie um projeto no Firebase e um aplicativo Web.
2. Ative **Authentication > Google**.
3. Crie o banco **Cloud Firestore** e publique as regras de `firestore.rules.example`.
4. Adicione `valeriobarbosa.github.io` aos domínios autorizados do Authentication.
5. Copie a configuração Web para `firebase-config.js`, substituindo `null` pelo objeto `firebaseConfig`.

Os documentos ficam em `flashcardUsers/{uid}/decks/{deckId}` (e sua subcoleção `cards`), `flashcardUsers/{uid}/ratings/{cardId}` e `flashcardUsers/{uid}/graves/{id}` — um documento por baralho/cartão/avaliação, não mais um blob único. As regras permitem que cada usuário leia e altere somente os próprios documentos. A cada sincronização, cada cartão/baralho/avaliação é comparado individualmente pelo mais recente (`updatedAt`) e mesclado automaticamente — não há mais uma tela pedindo para escolher entre "este aparelho" ou "a nuvem".

**Atualizando de uma versão anterior:** se o projeto Firebase já estava em uso com o esquema antigo (um documento único em `flashcardUsers/{uid}`), publique as regras atualizadas de `firestore.rules.example` no console do Firebase antes de sincronizar novamente — as regras antigas bloqueiam as novas subcoleções. Os dados antigos nesse documento único não são lidos pelo novo código (ele não apaga nada, apenas não os usa mais); qualquer aparelho que ainda tenha os baralhos localmente vai reenviá-los no novo formato na primeira sincronização.

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
