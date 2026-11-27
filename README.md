# Trilha Flashcard — Estudos para concursos públicos

Um leitor de flashcards local, responsivo e instalável para organizar estudos de diferentes concursos públicos. O perfil inicial continua preparado para TRT4 — Analista Judiciário, Área Judiciária, mas cada novo concurso pode ter banco de matérias, cartões e desempenho próprios.

O app inclui:

- perfis separados por concurso, com cargo, banca e ano do edital;
- Banco de Matérias com disciplinas mesmo antes de terem cartões, peso no edital, assuntos e subassuntos;

- uma matriz V4 alinhada ao Anexo II do Edital nº 01/2026, com 285 recortes didáticos em 11 disciplinas e 137 novos cartões de conteúdo;
- baralhos por disciplina e material complementar de Estudo de Caso Jurídico com protocolo e cartões de treino;
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
- sincronização incremental opcional com Google e Supabase, modo offline e escolha segura em caso de conflito;
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

No leitor legado, os cartões ficam definidos em `decks.js` e podem ser editados sem alterar a interface. Cada baralho começa vazio (`cards: []`); adicione cartões no formato:

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

O Supabase armazena cada chave de estudo separadamente em `flashcard_sync_entries`. Somente chaves alteradas são enviadas, e exclusões usam tombstones para que dados antigos não reapareçam em outro dispositivo. As políticas RLS restringem leitura e escrita ao proprietário autenticado. Na primeira conexão, os dados locais são enviados automaticamente se a nuvem estiver vazia. Se existirem duas versões, o aplicativo exige uma escolha antes de substituir qualquer dado.

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

O banco TRT-4 AJAJ acompanha o **Edital nº 1/2026**, publicado em 22/10/2026. Para AJAJ, a prova terá 30 questões de Conhecimentos Gerais (peso 1), 30 de Conhecimentos Específicos (peso 2) e uma questão prática de Estudo de Caso. A matriz oficial acrescenta Noções de Direitos Humanos, Noções de Informática e Direito Civil.

A FCC é a organizadora. As inscrições vão de 26/10 a 25/11/2026 e as provas estão previstas para 31/01/2027, em Porto Alegre. A aplicação para Analista será à tarde.

Fonte oficial: [Edital nº 1/2026 no Diário Oficial da União](https://www.in.gov.br/web/dou/-/edital-n-1/2026-739927397).


### Estudo guiado — matriz V4

A versão moderna tem **Aprender**, **Questões** e **Estudo de Caso**, além da revisão de cartões. Os 285 recortes são divisões didáticas do conteúdo do Anexo II, não uma contagem oficial de tópicos da FCC. Os percentuais das disciplinas permanecem como referência histórica de 2022.

- Roteiros de leitura não entram na fila de recuperação nem no indicador de autoavaliação. A leitura de Lei Seca distingue roteiro de transcrição.
- O banco autoral tem 31 questões de cinco alternativas em nove disciplinas e 11 minicasos para escrita com espelho e checklist. Não são questões da FCC nem simulados oficiais; não cobrem todos os assuntos.
- Tentativas objetivas na conta usam `questions`/`question_attempts`, respeitando RLS e os gatilhos existentes do caderno de erros. Autoavaliações de casos não entram no percentual objetivo. Visitantes podem explorar sem registro; o estudo de caso possui cronômetro, rascunho local e histórico de tentativas.
- Atualizações preservam IDs relacionais e históricos de cartões, inclusive leitura, suspensão e exclusão. Consulte as migrations aplicáveis à versão instalada antes de atualizar o banco.
- A jurisprudência inclui alertas sobre os itens cancelados pela Resolução TST 225/2025. Atualização monetária é roteiro de consulta, sem fórmula automática apresentada como vigente.

Validação: testes Vitest, build TypeScript/Vite e teste visual do fluxo público. O funcionamento com uma conta real depende da sessão autenticada e das políticas já existentes no Supabase.

## Auditoria de cobertura V4

- A matriz cadastrada e a cobertura por cartões de conteúdo são indicadores distintos. Um recorte cadastrado não implica material disponível nem domínio do assunto.
- Os 137 novos cartões V4 complementam o catálogo legado; não representam o total ativo de uma conta.
- Em Edital, o estado **Sem material** distingue ausência de conteúdo de **Não iniciado**.
- O Painel de Saúde audita cartões ativos, possíveis duplicidades, vínculos fora da matriz e fundamentos legais ausentes. Campo vazio não comprova desatualização jurídica.
- O remapeamento sugerido de cartões legados exige confirmação e preserva IDs e revisões. Cartões pessoais e casos ambíguos não são remapeados automaticamente.
- Antes de ampliar o catálogo, conferir os recortes sem material e a equivalência temática dos cartões existentes. Não criar cartões artificiais apenas para aumentar cobertura.

Referências de implementação: [PR #111](https://github.com/ValerioBarbosa/trilha-flashcard/pull/111), [PR #112](https://github.com/ValerioBarbosa/trilha-flashcard/pull/112), [PR #113](https://github.com/ValerioBarbosa/trilha-flashcard/pull/113).
