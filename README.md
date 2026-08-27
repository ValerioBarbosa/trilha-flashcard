# Trilha Flashcard — Estudos para concursos públicos

Um leitor de flashcards local, responsivo e instalável para organizar estudos de diferentes concursos públicos. O perfil inicial continua preparado para TRT4 — Analista Judiciário, Área Judiciária, mas cada novo concurso pode ter banco de matérias, cartões e desempenho próprios.

O app inclui:

- perfis separados por concurso, com cargo, banca e ano do edital;
- Banco de Matérias com disciplinas mesmo antes de terem cartões, peso no edital, assuntos e subassuntos;

- um baralho inicial com formato histórico, prioridades e alerta pré-edital;
- doze baralhos por disciplina, seguindo o edital verticalizado, prontos para receber os cartões (os cartões ficam a cargo de quem estuda, conforme o edital atualizado);
- virada animada do cartão;
- navegação por botões ou teclado;
- marcação “Lembrei” e “Não lembrei”;
- progresso por disciplina e embaralhamento;
- retomada automática do último cartão usando armazenamento local e IndexedDB;
- histórico persistente de tentativas e taxa de acerto;
- revisão espaçada em 1, 7 e 30 dias, incluindo um modo "revisar errados";
- painel de desempenho com sequência de estudos e revisões pendentes;
- busca de cartões por palavra-chave ou tag, em todos os baralhos;
- tema claro/escuro, com detecção automática da preferência do sistema;
- exportação e importação do progresso em arquivo `.json`, para levar o histórico a outro dispositivo;
- importação de baralhos próprios em `.json`, sem precisar editar código;
- gerenciamento de cartões pelo próprio navegador: adicionar, editar, excluir e importar/exportar cartões de qualquer baralho (incluindo os baralhos por disciplina), sem editar `decks.js`;
- instalação como app (PWA) e uso offline após o primeiro carregamento;
- armazenamento durável em IndexedDB, com migração automática do conteúdo local;
- conferência dos cartões antes de confirmar uma importação;
- lixeira com restauração e desfazer exclusão;
- backup completo de cartões, desempenho e lixeira;
- sincronização opcional com Google e Firebase, com backup dividido em partes para crescer além do limite de um único documento, modo offline e escolha segura em caso de conflito;
- sincronização incremental opcional com Supabase, mantendo o Firebase como compatibilidade durante a migração;
- sessões personalizadas por quantidade, escopo e prioridade.

## Banco de Matérias

Abra **Matérias** na navegação principal. Ali você pode criar uma disciplina, registrar o peso percentual previsto no edital e colar os assuntos, um por linha. A disciplina aparece no banco mesmo vazia e pode receber cartões depois.

Em **Mais > Perfis de concurso**, crie um perfil para cada certame. Concurso, cargo, banca e ano ajudam a identificar o edital ativo. A exclusão de um perfil também remove seus dados locais e a cópia durável no IndexedDB, sem afetar os demais perfis.

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
{ id: "card-id-permanente", front: "Pergunta", back: "Resposta", topic: "Assunto (opcional, usado no filtro)", example: "Observação opcional" }
```

O `id` é criado automaticamente pelo aplicativo e mantém o histórico do cartão mesmo quando a pergunta é editada. Arquivos antigos, sem `id`, são migrados automaticamente. Campos opcionais adicionais: `tag` (rótulo curto no topo), `complement`, `pitfall` e `mnemonic` (blocos extras no verso).

Cada baralho já tem um array `topics` com os assuntos do edital verticalizado (usado pelo filtro de Assunto na barra de busca). Para o filtro funcionar, use exatamente uma dessas strings no campo `topic` de cada cartão que você adicionar.

## Gerenciar cartões pelo navegador

No botão "Gerenciar cartões", adicione, edite ou exclua cartões do baralho selecionado no topo — inclusive os baralhos por disciplina, sem precisar editar `decks.js`. Também é possível importar cartões em JSON ou PDF e exportar os cartões do baralho atual.

O JSON aceita tanto `front`/`back` quanto `pergunta`/`resposta`. Os campos `disciplina`, `assunto`, `subassunto`, `fundamentoLegal`, `tipo`, `prioridade` e `dificuldade` também são reconhecidos. Quando `disciplina` corresponde a um baralho do edital, o cartão é enviado automaticamente para ele; sem esse campo, vai para o baralho atualmente selecionado. Cartões repetidos são ignorados.

Edições em baralhos por disciplina ficam salvas no navegador (via `localStorage`) por cima do conteúdo original de `decks.js`; ao editar `decks.js` diretamente, essas edições salvas continuam valendo até serem removidas ou sobrescritas.

## Ativar sincronização na nuvem

### Supabase (recomendado)

1. Crie um projeto no Supabase e execute a migration em `supabase/migrations`.
2. Em **Authentication > Providers**, ative o Google.
3. Configure `https://valeriobarbosa.github.io/trilha-flashcard/` como Site URL e redirect permitido.
4. Copie a URL e a **publishable key** do projeto para `supabase-config.js`.
5. Nunca use `service_role`, secret key ou senha do banco no navegador.

O Supabase armazena cada chave de estudo separadamente em `flashcard_sync_entries`. Somente chaves alteradas são enviadas, e exclusões usam tombstones para que dados antigos não reapareçam em outro dispositivo. As políticas RLS restringem leitura e escrita ao proprietário autenticado.

Durante a transição, deixe `firebase-config.js` intacto. Com `supabase-config.js` vazio, o aplicativo continua usando Firebase; ao preencher a configuração Supabase, passa a usar o novo banco. Faça a primeira conexão no aparelho que contém a cópia local mais completa e confirme um backup JSON antes da troca.

### Firebase (compatibilidade)

1. Crie um projeto no Firebase e um aplicativo Web.
2. Ative **Authentication > Google**.
3. Crie o banco **Cloud Firestore** e publique `firestore.rules` (o `firebase.json` já aponta para esse arquivo).
4. Adicione `valeriobarbosa.github.io` aos domínios autorizados do Authentication.
5. Copie a configuração Web para `firebase-config.js`, substituindo `null` pelo objeto `firebaseConfig`.

Os metadados ficam em `flashcardUsers/{uid}` e o conteúdo é dividido em `flashcardUsers/{uid}/chunks/{chunkId}`. Isso evita concentrar todo o banco no limite de um único documento do Firestore. O leitor continua compatível com backups antigos que ainda tenham o campo `snapshot`. As regras permitem que cada usuário leia e altere somente os próprios documentos. Na primeira conexão, os dados locais são enviados automaticamente se a nuvem estiver vazia. Se existirem duas versões, o aplicativo exige uma escolha antes de substituir qualquer dado.

Para publicar as regras pelo Firebase CLI:

```bash
firebase deploy --only firestore:rules --project trilha-flashcard
```

## Importar seu próprio baralho

Na área **Cartões**, use **Importar cartões** para adicionar um arquivo `.json` no formato:

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

O projeto usa [Vitest](https://vitest.dev) para testar repetição espaçada, importação, armazenamento, identidade dos cartões, perfis, sincronização e os fluxos principais da interface:

```bash
npm install
npm test
```

Um workflow do GitHub Actions (`.github/workflows/ci.yml`) roda os testes a cada push e pull request.

## Atenção ao status do concurso

O PDF fornecido é a versão 2.0 de um material **pré-edital 2026**, baseado no Edital TRT4 nº 1/2022 e na prova FCC de 2022. O próprio documento informa que a banca e o formato do novo certame ainda precisam de confirmação oficial. Quando o novo edital for publicado, ele prevalece e os baralhos devem ser revisados.
