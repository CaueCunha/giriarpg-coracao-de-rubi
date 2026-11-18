// Pedidos de teste no chat. Motor copiado do módulo Duelo de Dragões (scripts/testes.mjs, 0.21.x), que é o padrão
// do Cauê para todas as campanhas (pedido de 18/11/2026). As regras:
//   1. Nenhuma macro rola perícia de resistência nem aplica dano, condição ou efeito direto.
//   2. A macro manda ao chat um cartão com o dano já rolado uma vez para todos, como uma magia em área. A rolagem fica
//      só no conteúdo, com a classe roll--dano, e não em "rolls" (senão o Foundry a desenha de novo embaixo do cartão).
//   3. O cartão tem um botão Rolar por personagem, e o dono rola pela ficha. O resultado volta ao mestre pelo socket do
//      módulo ("socket": true no module.json).
//   4. O mestre aplica dano, metade, condição ou efeito por botões que só ele vê.
//   5. O cartão usa as classes "tormenta20 item-card", para os botões de dano ficarem em linha como nos poderes.
//
// API (game.modules.get("giriarpg-coracao-de-rubi").api.testes):
//   await pedir({ titulo, texto, testes: [{ ator, pericia | pericias: [..], cd, bonus, rotulo }], dano, sucesso, sucessoTexto, falha, esperar })
//     ator: Actor, token ou uuid. pericia: id da perícia ("fort") ou "atr:des" para teste de atributo.
//     pericias: o jogador escolhe uma delas (um botão para cada). bonus: soma no total (situacional).
//     cd: null = teste oposto (só mostra o total; a macro compara).
//     dano: fórmula ("1d6[frio]") ou Roll, rolada uma vez para todos e mostrada no cartão.
//     sucesso: "metade" (passou = metade do dano) ou "evita" (passou = nada). Sem sucesso, o dano vale para todos.
//     falha: { status: "fraco", efeito: {dados de ActiveEffect}, texto } oferecidos ao mestre em quem falhar.
//     esperar (padrão true): devolve uma Promise com os resultados quando todos rolarem:
//       [{ ator, nome, pericia, total, d20, cd, passou, margem, rotulo, indice }]
//     esperar false: devolve a mensagem na hora.
//   acoes(): monta botões do mestre para mensagens de resumo:
//     const A = api.testes.acoes(); A.dano(ator, roll, mult, rotulo); A.status(ator, "vulneravel");
//     A.efeito(ator, dadosDoEfeito, rotulo); A.cura(ator, roll); A.pm(ator, n); cada um devolve o HTML do botão.
//     await A.enviar({ content, whisper, speaker })
//   rolarDano(formula, titulo): Roll avaliada, com o título que os botões de dano do sistema usam.
//
// Se a página do mestre recarregar no meio, o cartão continua valendo (rolagens e botões de aplicar), só a parte da
// macro que vinha depois (o placar) não roda: rode a macro de novo ou anote à mão.
import { MODULO } from "./assinatura.mjs";

// Só um cliente anota os resultados: o mestre ativo.
const souMestreAtivo = () => (game.users.activeGM ?? game.users.find((u) => u.isGM && u.active))?.isSelf ?? false;

const SOCKET = `module.${MODULO}`;
const ATRIBUTOS = { for: "Força", des: "Destreza", con: "Constituição", int: "Inteligência", sab: "Sabedoria", car: "Carisma" };
const esperando = new Map();
let fila = Promise.resolve();

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export function nomePericia(p) {
  if (String(p).startsWith("atr:")) return ATRIBUTOS[p.slice(4)] ?? p;
  const l = CONFIG.T20?.pericias?.[p]?.label ?? CONFIG.T20?.pericias?.[p] ?? p;
  return game.i18n.localize(String(l));
}
const uuidDe = (a) => (typeof a === "string" ? a : (a?.actor ?? a)?.uuid);
const atorDe = (u) => fromUuidSync(u) ?? game.actors.find((a) => a.uuid === u) ?? null;
const d20De = (roll) => roll?.dice?.find((d) => d.faces === 20)?.results?.find((r) => r.active !== false)?.result ?? null;

export async function rolarDano(formula, titulo = "Dano") {
  const r = formula instanceof Roll ? formula : new Roll(String(formula), {}, { title: titulo, type: "damage" });
  if (!r._evaluated) await r.evaluate();
  r.options ??= {};
  r.options.title ??= titulo;
  return r;
}

// ---------------- Ações do mestre (botões de aplicar) ----------------
function rotuloAcao(a) {
  if (a.rotulo) return a.rotulo;
  if (a.tipo === "dano") return a.mult === 0.5 ? `Aplicar metade (${Math.floor(a.total / 2)})` : `Aplicar ${Math.floor(a.total * a.mult)}`;
  if (a.tipo === "cura") return `Curar ${a.total}`;
  if (a.tipo === "pm") return `Tirar ${a.total} PM`;
  if (a.tipo === "status") return `Aplicar ${game.i18n.localize(Object.values(CONFIG.statusEffects ?? {}).find((s) => s.id === a.id)?.name ?? a.id)}`;
  return `Aplicar ${a.dados?.name ?? "efeito"}`;
}
const botaoAcao = (a, i) => a.feito
  ? `<span class="cdr-feito">✔ ${esc(rotuloAcao(a))}</span>`
  : `<button type="button" class="cdr-acao cdr-mestre" data-acao="${i}" style="width:auto;line-height:1.4;padding:0 6px;margin:2px 0">${esc(rotuloAcao(a))}</button>`;

function novaAcao(tipo, ator, extra) {
  const a = { tipo, ator: uuidDe(ator), nome: (ator?.actor ?? ator)?.name ?? "", feito: false, ...extra };
  if (extra.roll) { a.roll = extra.roll.toJSON(); a.total = extra.roll.total; }
  return a;
}

export function acoes() {
  const lista = [];
  const add = (a) => { lista.push(a); return `{{acao:${lista.length - 1}}}`; };
  return {
    lista,
    dano: (ator, roll, mult = 1, rotulo) => add(novaAcao("dano", ator, { roll, mult, rotulo })),
    cura: (ator, roll, rotulo) => add(novaAcao("cura", ator, { roll, mult: 1, rotulo })),
    status: (ator, id, rotulo) => add(novaAcao("status", ator, { id, rotulo })),
    efeito: (ator, dados, rotulo) => add(novaAcao("efeito", ator, { dados, rotulo })),
    pm: (ator, n, rotulo) => add(novaAcao("pm", ator, { total: Number(n) || 0, rotulo })),
    async enviar(dadosMsg = {}) {
      const modelo = dadosMsg.content ?? "";
      return ChatMessage.create({
        ...dadosMsg,
        content: comAcoes(modelo, lista),
        flags: foundry.utils.mergeObject(dadosMsg.flags ?? {}, { [MODULO]: { acoes: lista, modelo } }),
      });
    },
  };
}
const comAcoes = (modelo, lista) => modelo.replace(/\{\{acao:(\d+)\}\}/g, (_, i) => (lista[i] ? botaoAcao(lista[i], i) : ""));

async function executarAcao(msg, i) {
  if (!game.user.isGM) return ui.notifications.warn("Só o mestre aplica o resultado.");
  const f = msg.flags?.[MODULO] ?? {};
  const lista = foundry.utils.deepClone(f.acoes ?? []);
  const a = lista[i];
  if (!a || a.feito) return;
  const ator = atorDe(a.ator);
  if (!ator) return ui.notifications.warn(`Não achei ${a.nome} no mundo.`);
  if (a.tipo === "dano" || a.tipo === "cura") {
    const roll = Roll.fromData(a.roll);
    await ator.applyDamageV2(roll, a.tipo === "cura" ? -1 : a.mult);
  } else if (a.tipo === "status") await ator.toggleStatusEffect(a.id, { active: true });
  else if (a.tipo === "efeito") await ator.createEmbeddedDocuments("ActiveEffect", [a.dados]);
  else if (a.tipo === "pm") await ator.update({ "system.attributes.pm.value": Math.max(0, (ator.system.attributes.pm?.value ?? 0) - a.total) });
  a.feito = true;
  const pedido = f.pedido;
  const content = pedido ? await renderPedido(pedido, lista) : comAcoes(f.modelo ?? "", lista);
  await msg.update({ content, [`flags.${MODULO}.acoes`]: lista });
}

// ---------------- Pedido de teste ----------------
function textoDano(p, ln) {
  if (!p.dano) return "";
  const total = p.dano.total;
  if (!ln.feito) return "";
  if (ln.passou && p.sucesso === "evita") return " · evita o dano";
  if (ln.passou && p.sucesso === "metade") return ` · sofre metade (${Math.floor(total / 2)})`;
  return ` · sofre ${total}`;
}

async function renderPedido(p, acoesLista = []) {
  const linhas = p.linhas.map((ln, l) => {
    const alvo = `<b>${esc(ln.nome)}</b>${ln.rotulo ? ` (${esc(ln.rotulo)})` : ""}`;
    const bon = ln.bonus ? ` ${ln.bonus > 0 ? "+" : ""}${ln.bonus}` : "";
    if (!ln.feito) {
      const botoes = ln.pericias.map((pe) => `<button type="button" class="cdr-rolar" data-linha="${l}" data-pericia="${pe}" style="width:auto;line-height:1.4;padding:0 6px;margin:2px 0">`
        + `<i class="fas fa-dice-d20"></i> ${esc(nomePericia(pe))}${bon}</button>`).join(" ");
      return `<li style="margin:4px 0">${alvo}: ${ln.cd == null ? "teste oposto" : `CD ${ln.cd}`} ${botoes}</li>`;
    }
    const res = ln.cd == null ? "" : ln.passou ? `: <span style="color:#1b6b1b">✔ passou</span>` : `: <span style="color:#9b1c1c">✘ falhou</span>`;
    const minhas = acoesLista.map((a, i) => [a, i]).filter(([a]) => a.linha === l).map(([a, i]) => botaoAcao(a, i)).join(" ");
    const refazer = p.fechado ? "" : ` <a class="cdr-refazer cdr-mestre" data-linha="${l}" title="Mestre: deixar rolar de novo">↻</a>`;
    return `<li style="margin:4px 0">${alvo}: ${esc(nomePericia(ln.pericia))} <b>${ln.total}</b>${bon ? ` (com${bon})` : ""}${ln.cd == null ? "" : ` contra CD ${ln.cd}`}${res}${ln.cd == null ? "" : textoDano(p, ln)}`
      + `${ln.cd == null ? "" : ln.passou ? (p.sucessoTexto ? ` · ${esc(p.sucessoTexto)}` : "") : (p.falha?.texto ? ` · ${esc(p.falha.texto)}` : "")}${refazer}${minhas ? `<br>${minhas}` : ""}</li>`;
  });
  const regra = p.dano ? `<p><b>Dano:</b> ${esc(p.dano.formula)}${p.sucesso === "metade" ? " (passar reduz à metade)" : p.sucesso === "evita" ? " (passar evita)" : ""}</p>` : "";
  return `<div class="cdr-pedido tormenta20 item-card">${p.titulo ? `<h3>${esc(p.titulo)}</h3>` : ""}${p.texto ? `<p>${p.texto}</p>` : ""}${regra}`
    + (p.danoHtml ? `<div class="roll roll--dano" data-roll-title="${esc(p.dano.titulo)}">${p.danoHtml}</div>` : "")
    + `<ul style="list-style:none;padding-left:0">${linhas.join("")}</ul>`
    + (p.fechado ? "" : `<p style="font-size:0.85em;opacity:0.8">Cada jogador clica no botão do seu herói e rola pela ficha. O mestre aplica o resultado com os botões que aparecem.</p>`)
    + `</div>`;
}

export async function pedir({ titulo = "", texto = "", testes = [], dano = null, sucesso = null, sucessoTexto = "", falha = null, esperar = true, whisper, speaker } = {}) {
  const linhas = testes.filter((t) => t?.ator).map((t) => {
    const ator = t.ator?.actor ?? t.ator;
    const u = uuidDe(t.ator);
    return {
      ator: u, nome: t.nome ?? (typeof ator === "string" ? atorDe(u)?.name : ator.name) ?? "?",
      pericias: [...new Set([].concat(t.pericias ?? t.pericia ?? "fort"))], cd: t.cd == null ? null : Number(t.cd) || 0,
      bonus: Number(t.bonus) || 0, rotulo: t.rotulo ?? "", feito: false,
    };
  });
  if (!linhas.length) return esperar ? [] : null;
  const p = { titulo, texto, linhas, sucesso, sucessoTexto, falha, fechado: false };
  let roll = null;
  if (dano) {
    roll = await rolarDano(dano, "Dano");
    p.dano = { formula: roll.formula, total: roll.total, titulo: roll.options?.title ?? "Dano", roll: roll.toJSON() };
    p.danoHtml = await roll.render();
    await game.dice3d?.showForRoll?.(roll, game.user, true, whisper?.length ? whisper : null);
  }
  const msg = await ChatMessage.create({
    speaker: speaker ?? { alias: titulo || "Teste" },
    content: await renderPedido(p),
    // A rolagem vai só no conteúdo (com a classe roll--dano, para os botões de aplicar do sistema).
    // Pôr também em "rolls" fazia o Foundry desenhá-la de novo embaixo do card.
    sound: roll ? CONFIG.sounds?.dice : undefined,
    whisper,
    flags: { [MODULO]: { pedido: p, acoes: [] } },
  });
  if (!esperar) return msg;
  return new Promise((resolve) => esperando.set(msg.id, resolve));
}

function resultados(p) {
  return p.linhas.map((ln, indice) => ({
    ator: atorDe(ln.ator), uuid: ln.ator, nome: ln.nome, pericia: ln.pericia, total: ln.total, d20: ln.d20, cd: ln.cd,
    passou: ln.passou, margem: ln.cd == null ? null : ln.total - ln.cd, rotulo: ln.rotulo, indice,
  }));
}

// Mestre: anota um resultado no cartão (um de cada vez, na ordem em que chegam).
export function registrar(dados) {
  fila = fila.then(() => anotar(dados)).catch((e) => console.error(`${MODULO} | teste`, e));
  return fila;
}
async function anotar({ msgId, linha, pericia, total, d20, refazer = false }) {
  const msg = game.messages.get(msgId);
  const f = msg?.flags?.[MODULO];
  if (!f?.pedido) return;
  const p = foundry.utils.deepClone(f.pedido);
  let lista = foundry.utils.deepClone(f.acoes ?? []);
  const ln = p.linhas[linha];
  if (!ln || p.fechado) return;
  if (refazer) {
    Object.assign(ln, { feito: false, total: null, d20: null, passou: null, pericia: null });
    lista = lista.filter((a) => a.linha !== linha);
  } else {
    if (ln.feito) return;
    Object.assign(ln, { feito: true, pericia, d20, total: Number(total) + ln.bonus });
    ln.passou = ln.cd == null ? null : ln.total >= ln.cd;
    // Botões padrão do mestre para esta linha (teste oposto não tem resultado padrão).
    if (p.dano && ln.cd != null) {
      const mult = ln.passou ? (p.sucesso === "metade" ? 0.5 : p.sucesso === "evita" ? 0 : 1) : 1;
      if (mult) lista.push({ tipo: "dano", ator: ln.ator, nome: ln.nome, roll: p.dano.roll, total: p.dano.total, mult, linha, feito: false });
    }
    if (ln.passou === false && p.falha?.status) lista.push({ tipo: "status", ator: ln.ator, nome: ln.nome, id: p.falha.status, linha, feito: false });
    if (ln.passou === false && p.falha?.efeito) lista.push({ tipo: "efeito", ator: ln.ator, nome: ln.nome, dados: p.falha.efeito, linha, feito: false });
  }
  p.fechado = p.linhas.every((x) => x.feito);
  await msg.update({ content: await renderPedido(p, lista), [`flags.${MODULO}.pedido`]: p, [`flags.${MODULO}.acoes`]: lista });
  verificarFim(msg.id, p);
}
function verificarFim(id, p) {
  const fim = esperando.get(id);
  if (fim && p.linhas.every((x) => x.feito)) { esperando.delete(id); fim(resultados(p)); }
}

async function clicarRolar(msg, linha, pericia, event) {
  const ln = msg.flags?.[MODULO]?.pedido?.linhas?.[linha];
  if (!ln || ln.feito) return;
  const ator = atorDe(ln.ator);
  if (!ator) return ui.notifications.warn(`Não achei ${ln.nome} no mundo.`);
  if (!ator.isOwner) return ui.notifications.warn(`Esse teste é de ${ln.nome}: o jogador dele clica.`);
  const res = pericia.startsWith("atr:") ? await ator.rollAtributo(pericia.slice(4), { event }) : await ator.rollPericia(pericia, { event });
  const roll = res?.rolls?.[0] ?? (typeof res?.total === "number" ? res : null);
  if (!roll) return; // fechou a janela de configuração
  const dados = { msgId: msg.id, linha, pericia, total: roll.total, d20: d20De(roll) };
  if (game.user.isGM) return registrar(dados);
  if (!game.users.activeGM) return ui.notifications.warn("Nenhum mestre conectado para anotar o resultado: ele confere pela rolagem no chat.");
  game.socket.emit(SOCKET, { tipo: "resultado", ...dados });
}

// Botões do cartão (todos os clientes).
function ligarBotoes(msg, html) {
  const raiz = html instanceof HTMLElement ? html : html?.[0];
  if (!raiz || !msg.flags?.[MODULO]) return;
  if (!game.user.isGM) raiz.querySelectorAll(".cdr-mestre").forEach((b) => b.remove());
  raiz.querySelectorAll(".cdr-rolar").forEach((b) => b.addEventListener("click", (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    clicarRolar(msg, Number(b.dataset.linha), b.dataset.pericia, ev);
  }));
  raiz.querySelectorAll(".cdr-acao").forEach((b) => b.addEventListener("click", (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    b.disabled = true;
    executarAcao(msg, Number(b.dataset.acao));
  }));
  raiz.querySelectorAll(".cdr-refazer").forEach((b) => b.addEventListener("click", (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    registrar({ msgId: msg.id, linha: Number(b.dataset.linha), refazer: true });
  }));
}

export function ligarTestes() {
  Hooks.on("renderChatMessageHTML", (msg, html) => ligarBotoes(msg, html));
  Hooks.on("updateChatMessage", (msg) => { const p = msg.flags?.[MODULO]?.pedido; if (p) verificarFim(msg.id, p); });
  game.socket?.on(SOCKET, (d) => { if (d?.tipo === "resultado" && souMestreAtivo()) registrar(d); });
}

// Usado pelos testes automáticos (Foundry simulado): o "jogador" clica no botão de uma linha, o mestre clica numa ação.
export const _teste = { clicarRolar, executarAcao, esperando };

export const api = { pedir, acoes, rolarDano, nomePericia, registrar };
