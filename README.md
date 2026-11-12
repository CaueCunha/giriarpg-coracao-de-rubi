# Giria T20 - Coração de Rubi (Campanha) · módulo para Foundry VTT

Este é o conteúdo da campanha **Coração de Rubi** (Tormenta20) num módulo do Foundry VTT: ameaças, perigos, parceiros, itens, diários e macros com automação. Os compêndios ficam na pasta **Giria T20 - Coração de Rubi (Campanha)** da aba de Compêndios, um por tipo, com uma pasta por patamar e as pastas das aventuras dentro:

| Compêndio | Patamar 1 · Iniciante | Patamar 2 · Veterano | Patamar 3 · Campeão | Patamar 4 · Lenda | Campanha |
|---|---|---|---|---|---|
| **Ameaças e NPCs**, **Poderes**, **Itens**, **Diários**, **Tabelas**, **Macros** | A1 · Forja de Heróis, A2 · O Segredo das Minas | A3 · Blefe Fatal, A4 · Caravana Cartesiana | A5 · Mentes Malignas | A6 · Horizonte de Sangue | ferramentas do mestre e o Dado de Aniversário |

É um módulo da família **Giria**: o que já existe no [Giria T20](https://github.com/CaueCunha/giria-t20) não é duplicado aqui (veja [Ligação com o sistema e o Giria T20](#ligação-com-o-sistema-e-o-giria-t20)). A contagem de cada compêndio está em [`build/relatorio.md`](build/relatorio.md).

Requisitos: **Foundry VTT v14** e o sistema **Tormenta20** (Vizael) **1.6.x**. Recomendado: o módulo **Giria T20**.

## Instalação

### Pelo link do manifesto (recomendado)

1. No Foundry, vá em **Configuração › Módulos Adicionais › Instalar Módulo**.
2. Em **URL do Manifesto**, cole o link abaixo e clique em **Instalar**:

   ```
   https://github.com/CaueCunha/giriarpg-coracao-de-rubi/releases/latest/download/module.json
   ```

3. Entre no mundo da campanha e ative o módulo em **Configurações do Jogo › Gerenciar Módulos**.

Quando sair uma versão nova, o botão **Atualizar** do Foundry baixa a nova versão.

### Instalação manual

Baixe o `module.zip` da [última versão](https://github.com/CaueCunha/giriarpg-coracao-de-rubi/releases/latest). Descompacte-o em `Data/modules/giriarpg-coracao-de-rubi/`, de modo que o `module.json` fique direto nessa pasta, e reinicie o Foundry.

## Usando na mesa

**Nada vai para o mundo sozinho.** O módulo só oferece os compêndios, e você escolhe o que entra no mundo:

- **Um documento:** arraste-o do compêndio para a barra lateral (ou para a cena, no caso de ameaças).
- **Uma aventura inteira:** use **Puxar do compêndio**. Ele fica no botão **Coração de Rubi**, no topo da aba de Compêndios, em **Configurações › Giria T20 - Coração de Rubi (Campanha)** e na macro **CdR · Puxar do compêndio**. Marque as aventuras e ele cria só o que falta, nas pastas do compêndio (Patamar › aventura) e com os mesmos IDs, para os links dos diários e as macros funcionarem. O que já está no mundo nunca é substituído.

As macros da campanha procuram as ameaças, as tabelas e os diários **no mundo**, pelas marcas que os geradores sempre usaram. Por isso, puxe a aventura antes de usar as macros dela. Se faltar alguma coisa, a macro avisa.

### Limpar do mundo

**Limpar do mundo** (no botão **Coração de Rubi**, em **Configurações › Giria T20 - Coração de Rubi (Campanha)** e na macro **CdR · Limpar do mundo**) apaga do mundo o conteúdo do módulo, para você puxar do compêndio só o que precisar. Por padrão:

- apaga itens e poderes, diários, tabelas e macros; ameaças e NPCs só se você marcar (tokens nas cenas perdem a ficha);
- **não apaga o que você editou** (o que não bate com nenhuma versão publicada), a não ser que você marque;
- antes de apagar, guarda uma cópia num compêndio do mundo por tipo (*CdR · Cópia AAAA-MM-DD · Diários*...).

Itens nas fichas dos personagens e documentos que não são do módulo nunca são tocados. As pastas do módulo que ficam vazias são removidas.

### Versões novas: atualizar só o que você quiser

Quando sai uma versão nova, o Foundry atualiza os compêndios, mas o mundo não muda. O Mestre recebe uma mensagem no chat, uma vez só, dizendo quantos documentos do mundo têm melhorias. O aviso pode ser desligado em **Configurações › Giria T20 - Coração de Rubi (Campanha)**.

**Atualizar do compêndio** (no mesmo botão, nas configurações e na macro **CdR · Atualizar do compêndio**) lista os documentos do mundo que vieram do módulo e mudaram:

- **Sem alteração sua:** o documento é igual a alguma versão já publicada do módulo. Ele vem marcado e você desmarca o que não quiser trocar.
- **Editado por você:** o documento não bate com nenhuma versão publicada, então foi corrigido à mão. Ele aparece travado e **fica como está**. Se quiser a versão nova de um deles, arraste-a do compêndio.

Para saber isso, cada documento leva uma **assinatura** do conteúdo que pode ser corrigido (nome, imagem, dados da ficha, efeitos, itens, páginas, resultados, comando). O compêndio guarda as assinaturas de todas as versões publicadas desde a v0.1.0. O que muda sozinho na mesa não conta como edição: PV e PM atuais, efeitos ligados ou desligados, pasta e permissões.

A atualização troca o documento pela versão do compêndio com o **mesmo ID**, então os tokens nas cenas continuam ligados. Pasta, ordem, permissões e flags de outros módulos ficam como estavam. No fim, o chat mostra o que foi atualizado e o que ficou.

**Vindo do pacote antigo (v0.1 do zip `coracao-de-rubi`) ou das macros de importação:** aquele conteúdo não é reconhecido pelo módulo novo. Apague as pastas antigas ("Coração de Rubi — Aventura 2", "Coração de Rubi — Parceiros", "Coração de Rubi — Poderes Customizados") e puxe do compêndio. Tokens já nas cenas apontam para as fichas antigas: troque-os. Os poderes já nas fichas dos jogadores continuam valendo, e a cura automática da Lonien reconhece também a cópia antiga pelo nome.

### Automações (sempre ligadas, executadas pelo mestre ativo)

| Flag | O que faz | Usado em |
|---|---|---|
| `flags.world.cdrAutomacoes.curaAcelerada = { valor, excecao }` (ficha) | No início do turno da criatura em combate, recupera `valor` PV e sussurra ao mestre ("antes → depois"); com `excecao`, lembra de descontar esse tipo de dano | Troll Rubi (15, ácido), Abominação Rubi (10) |
| `flags.world.cdrAutomacoes.meiose = { ator, giria }` (ficha) | No início do turno em combate, rola 1d6; no par, um glop surge ao lado e entra no combate (ator do mundo com esse nome ou, se não houver, o do Giria) | Mamãe Glop (A1) |
| `flags.world.cdrParceiro = "lonien"` (item) | Quem tem o poder da Lonien e cai a 0 PV ou menos cura 4d8+4 sozinho, 1x por cena (marca "Lonien — cura de emergência usada", que some no fim da cena) | Parceira: Lonien (Veterana) |

As flags ficam em `flags.world` porque entram na assinatura e vão junto ao puxar. Para uma aventura nova, acrescente a chave em [`scripts/automacoes.mjs`](scripts/automacoes.mjs). A API fica em `game.modules.get("giriarpg-coracao-de-rubi").api` (`abrirPuxar`, `abrirAtualizar`, `abrirLimpar`, `curaLonien(ator)`).

### O que fica aqui e o que fica no Giria T20

Este módulo ajuda o **mestre** a rodar a campanha e traz os **artefatos da campanha** que os jogadores usam (parceiros K e Lonien, itens de aço-rubi, o poder Dado de Aniversário). Regras gerais de personagem (poderes, magias e itens dos livros) ficam no **Giria T20**, a base dos jogadores em todas as campanhas. Por isso Armas da Destruição, Caminhos do Arcanista, Devoto de Nimb e Missa: Elevação do Espírito não estão aqui.

A pasta **Campanha** traz o poder **Dado de Aniversário** com a macro **PJ · Dado de Aniversário — Rolar novamente** e as ferramentas do mestre: **CdR · Teste estendido**, **CdR · Aço-rubi (aplicar ou remover)**, **CdR · Corrigir aprimoramentos antigos**, **CdR · Corrigir condições (T20 1.6.5)** e **CdR · Diagnóstico de condições**.

### Ligação com o sistema e o Giria T20

Poderes, magias e armas que já existem no sistema ou no Giria T20 são reaproveitados:

- As **magias** dos NPCs são a magia do sistema, com os efeitos de aprimoramento dela. Por cima vêm o custo, a CD e as rolagens da ficha do NPC, uma nota "Nesta ficha (Coração de Rubi)" e o link "No Giria T20".
- **Armas, poderes e itens** com o mesmo nome mantêm os números da ficha da aventura. Se o Giria T20 tem o item, a origem (`compendiumSource`) aponta para a versão do Giria, que é a automatizada; senão, para o sistema. A descrição ganha os links "No sistema" e "No Giria T20".
- Ataques naturais genéricos (Pancada, Mordida, Garra...) não são ligados ao Giria.
- **Ameaças do livro básico** (glop, bandido, gorlogg...) não são copiadas: o gerador escreve `@GIRIA[Nome|T20]{rótulo}` e o build troca pelo link da ficha no compêndio de ameaças do Giria. `@GIRIA_UUID[Nome|T20]` vira só o uuid, para flags de automação. Marcador sem ficha no índice quebra o build.

O índice do Giria fica em [`src/giria-indice.json`](src/giria-indice.json), porque o repositório do Giria é privado e o CI não o alcança. Para atualizar depois de uma versão nova do Giria: clone o `giria-t20` ao lado deste repositório, abra os lotes de ameaças com `node ../giria-t20/tools/abrir-lotes.mjs` e rode `node tools/giria-indice.mjs ../giria-t20`, depois `npm run build`. Os testes conferem cada link do Giria contra esse índice.

O relatório completo do que foi ligado está em [`build/relatorio.md`](build/relatorio.md).

### Artes

Os tokens feitos para a campanha ficam em [`assets/`](assets), uma pasta por aventura (A2: Guardião de Rubi, Abominação Rubi e K), em WebP de 512 px. As originais estão no Drive, em *Coração de Rubi / 2. NPCs*. Os geradores apontam para `modules/giriarpg-coracao-de-rubi/assets/...`.

## Testes

```bash
npm ci
npm run setup   # baixa o código do sistema Tormenta20 1.6.4 (modelos de dados e compêndios)
npm test
```

Os testes rodam num **Foundry v14 simulado**, sem servidor (veja [`tools/sim/README.md`](tools/sim/README.md)). A simulação usa os modelos de dados reais do Tormenta20, então cada documento é validado e limpo como o Foundry faria. Um campo que o Foundry descartaria em silêncio faz o teste falhar. Os testes cobrem:

- **Macros:** todas são executadas numa cena da aventura, em combate, com um PJ selecionado e um NPC como alvo. Cada uma roda com os valores padrão, com cada opção do primeiro menu do diálogo e com 6 rodadas de escolhas sorteadas. Depois de cada execução o combate avança turnos e um PJ sofre dano, para disparar os ganchos das automações. Falham exceções, `console.error`, documentos inválidos, campos descartados, links quebrados e rolagens não avaliadas.
- **Automações:** a Mamãe Glop põe um glop no combate a cada par; o Troll Rubi recupera 15 PV no turno dele com o aviso do ácido; a Lonien cura 4d8+4 ao cair a 0 PV e não cura de novo na mesma cena.
- **Geradores:** cada patamar roda limpo num mundo vazio, e rodar de novo substitui em vez de duplicar.
- **Compêndios:**
  - formato do `foundryvtt-cli` e IDs únicos;
  - validação de todos os documentos;
  - chaves de efeitos (cada uma existe na ficha ou é usada pelo próprio sistema);
  - imagens do sistema;
  - links `@UUID` (os do Giria T20, contra o índice) e resultados de tabela;
  - compilação de todas as macros;
- **Pacote:** os compêndios são compilados em LevelDB e extraídos de volta, e o resultado é comparado com as fontes.
- **Puxar e atualizar:**
  - abrir o mundo não importa nada;
  - o botão da aba de Compêndios puxa só a aventura marcada, nas pastas do compêndio;
  - puxar de novo só cria o que falta;
  - links do compêndio funcionam no compêndio e viram links do mundo ao puxar;
  - o que foi puxado é igual ao compêndio;
  - a atualização troca só o marcado e não editado, e preserva pasta e tokens;
  - cancelar não muda nada;
  - jogador não puxa nem atualiza;
  - o aviso de versão nova aparece uma vez e não muda nada;
  - limpar do mundo apaga só o não editado, guarda cópia, mantém atores e fichas dos PJs, e apaga as pastas vazias.

**Limite importante:** é uma simulação, não o Foundry de verdade. A interface (fichas, canvas, animações, arrastar e soltar) não é testada. Antes de usar na sessão, vale abrir o mundo uma vez, puxar uma aventura e rodar algumas macros.

## Desenvolvimento

O conteúdo nasce dos **geradores** em [`src/geradores/`](src/geradores): as macros de importação de cada aventura e as macros dos jogadores, as mesmas da pasta *3. Scripts* do Drive.

| Comando | O que faz |
|---|---|
| `npm run build` | Roda os geradores no Foundry simulado, liga o conteúdo ao sistema e fixa IDs estáveis. Grava as fontes JSON em `src/packs/`, o `module.json` e `build/relatorio.md`, e compila os compêndios em `packs/`. |
| `npm run pack` | Só compila `src/packs/` em `packs/` (LevelDB). |
| `node tools/historico.mjs` | Recalcula `src/historico.json` (as assinaturas de cada documento em todas as versões commitadas). O build acrescenta a assinatura atual sozinho; só é preciso rodar isto se a função de `scripts/assinatura.mjs` mudar. |
| `npm run pack -- --extrair` | Extrai `packs/` para `build/extraido/`, para conferência. |

Para incluir uma aventura nova:

1. Ponha o gerador em `src/geradores/`.
2. Acrescente o nome dele no patamar certo em [`tools/conteudo.mjs`](tools/conteudo.mjs).
3. Rode `npm run build` e `npm test`.

Marque cada gerador com `flags.world.cdr` (a marca da aventura) e `flags.world.cdrRole` (o papel do documento), inclusive nas pastas: o build falha se faltar a marca. Hoje as seis aventuras do livro têm gerador.

### Versões

Para lançar uma versão, suba o `version` no `package.json`, rode `npm run build` (que atualiza o `module.json`) e faça merge na `main`. Aí o GitHub Actions compila os compêndios e publica a release `vX.Y.Z` com o `module.json` e o `module.zip`. O link do manifesto passa a apontar para ela.
