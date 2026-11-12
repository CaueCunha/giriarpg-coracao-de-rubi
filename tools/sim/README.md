# Foundry simulado

Um Foundry VTT v14 mínimo que roda no Node, sem servidor nem navegador. Ele tem duas funções:

- rodar os geradores no build;
- rodar as macros nos testes.

Não é um emulador do Foundry. Implementa só o que os geradores e as macros da campanha usam, e é rígido onde o Foundry é rígido, para que os problemas apareçam aqui e não na mesa.

## Arquivos

| Arquivo | O que implementa |
|---|---|
| `fields.mjs` | `foundry.data.fields` e `DataModel`/`TypeDataModel`. Cobre limpeza, validação, `initial`, `persisted: false` e a opção `validate`. Uma chave que o esquema descarta (o Foundry descartaria em silêncio) vai para o relatório. |
| `documentos.mjs` | Esquemas do núcleo (Actor, Item, ActiveEffect com `system.changes` e `duration` do v14, JournalEntry/Page, RollTable/TableResult, Macro, Folder) e a classe base `Document`: CRUD, embutidos, flags, ganchos. Campos no formato do v12/v13 (`changes` na raiz, `duration.rounds`...) são marcados como `legado`. |
| `sistema.mjs` | Carrega o código **real** do Tormenta20 em `.cache/tormenta20`: a configuração `T20`, os modelos de dados (Actor/Item/ActiveEffect) e as fontes dos compêndios do sistema. |
| `mundo.mjs` | `criarMundo()`: `game`, `CONFIG`, `ui`, `canvas` (tokens, seleção, alvos), `ChatMessage`, `Combat`, compêndios, configurações, `fromUuid` e os métodos de ator do Tormenta20 que as macros usam (`applyDamageV2`, `spendMana`, `rollPericia`...). `mundo.executar(código)` roda o código como o Foundry roda uma macro. |
| `dialogos.mjs` | `DialogV2` sobre jsdom. O conteúdo vira um `<form>` de verdade, e uma *política* escolhe os valores e o botão: padrão, roteiro ou sorteio. |
| `dados.mjs` | `Roll` e termos (dados, `kh/kl`, explosão, rerrolagem, parênteses, funções). O total só existe depois de `evaluate()`. |

## O que é conferido

Em toda execução, o `mundo` junta:

- `mundo.erros`: exceções, rejeições não tratadas e `console.error`;
- `mundo.relatorio`:
  - documentos inválidos;
  - chaves descartadas;
  - campos em formato antigo;
  - links `@UUID` quebrados;
  - rolagens mandadas ao chat sem avaliar;
- `mundo.notificacoes`: `ui.notifications`, incluindo as de erro.

Os testes em `tests/` falham quando alguma dessas listas tem algo.

## Calibração

Os 1844 documentos dos compêndios do Tormenta20 1.6.4 passam pelos mesmos validadores. O único ruído são chaves obsoletas que o próprio sistema carrega nos dados, e essas são silenciadas. Sem essa calibração, uma chave descartada poderia ser culpa do simulador e não do conteúdo.
