// Automações da campanha, ligadas sempre que o módulo está ativo (só o mestre ativo executa).
// Fichas e itens ligam o que precisam por flags em flags.world (entram na assinatura e vão junto ao puxar do compêndio):
//   Ator: flags.world.cdrAutomacoes.curaAcelerada = { valor: 15, excecao: "ácido" }
//       No início do turno da criatura (em combate), recupera "valor" PV e avisa no chat.
//       Dano do tipo "excecao" não pode ser curado assim: o aviso lembra o mestre de descontar.
//   Item: flags.world.cdrParceiro = "lonien" (ou o nome "Parceira: Lonien (Veterana)")
//       Quem tem o poder da Lonien na ficha e cai a 0 PV ou menos cura 4d8+4 na hora, 1x por cena
//       (a marca "Lonien — cura de emergência usada" some no fim da cena).
// Novas aventuras acrescentam chaves aqui.
// Só um cliente executa automações: o mestre ativo.
const souMestreAtivo = () => (game.users.activeGM ?? game.users.find((u) => u.isGM && u.active))?.isSelf ?? false;
const MODULO = "giriarpg-coracao-de-rubi";

const pvDe = (a) => a?.system?.attributes?.pv?.value ?? 0;
const auto = (a) => a?.flags?.world?.cdrAutomacoes ?? {};

// PV antes da atualização, por documento. preUpdateActor roda no cliente que fez a mudança;
// o cache serve de reserva para mudanças feitas por outro cliente.
const pvCache = new Map();
const lembrar = (a) => a && pvCache.set(a.uuid, pvDe(a));

const SEM_USO = { description: "", automatic: false, aumenta: false, custo: 0, names: [], types: [] };
const marca = (name, img, description) => ({
  name, img, type: "base",
  duration: { value: null, units: "seconds", expiry: "sceneEnd" },
  description,
  flags: { [MODULO]: { automacao: "marca" } },
  system: { changes: [], targets: [], status: null, onuse: false, abilityUse: SEM_USO, aura: { isAura: false, range: 0 } },
});

// ---------- Lonien: cura de emergência ----------
export const LONIEN = { marca: "Lonien — cura de emergência usada", img: "icons/consumables/potions/potion-flask-corked-pink.webp" };
// Também reconhece pelo nome as cópias antigas do poder, criadas pela macro Criar_Parceira_Lonien.
const temLonien = (a) => a?.items.some((i) => i.flags?.world?.cdrParceiro === "lonien" || i.name === "Parceira: Lonien (Veterana)");

export async function curaLonien(actor, { automatico = false } = {}) {
  if (!temLonien(actor)) return ui.notifications.warn(`${actor.name} não tem o poder da Lonien na ficha.`);
  if (actor.effects.some((e) => e.name === LONIEN.marca)) {
    if (!automatico) ui.notifications.warn(`Lonien já curou ${actor.name} nesta cena.`);
    return;
  }
  const { value, max } = actor.system.attributes.pv;
  const roll = await new Roll("4d8+4").evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `<strong>Lonien — Cura de Emergência</strong>${automatico ? ` (${actor.name} caiu a ${value} PV)` : ""}`,
  });
  // A marca vem antes da cura, para a atualização de PV não disparar a cura de novo.
  await actor.createEmbeddedDocuments("ActiveEffect", [marca(LONIEN.marca, LONIEN.img, "<p>A cura de emergência da Lonien já foi usada nesta cena.</p>")]);
  await actor.update({ "system.attributes.pv.value": Math.min(max, value + roll.total) });
}

// ---------- Cura acelerada ----------
async function curaAcelerada(actor) {
  const c = auto(actor).curaAcelerada;
  if (!c?.valor) return;
  if (actor.statuses?.has("morto")) return;
  const { value: antes, max } = actor.system.attributes.pv;
  if (antes >= max) return;
  const novo = Math.min(max, antes + Number(c.valor));
  await actor.update({ "system.attributes.pv.value": novo });
  const aviso = c.excecao ? `<br><small>Dano de ${c.excecao} não é curado assim: se ${actor.name} sofreu ${c.excecao}, desconte essa parte.</small>` : "";
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    whisper: ChatMessage.getWhisperRecipients("GM"),
    content: `<b>Cura acelerada ${c.valor}:</b> ${antes} → ${novo} PV.${aviso}`,
  });
}

async function aoMudarPV(actor, antes, agora) {
  if (antes > 0 && agora <= 0 && temLonien(actor)) await curaLonien(actor, { automatico: true });
}

export function ligarAutomacoes() {
  for (const t of canvas.tokens?.placeables ?? []) lembrar(t.actor);
  Hooks.on("canvasReady", () => { pvCache.clear(); for (const t of canvas.tokens.placeables) lembrar(t.actor); });
  Hooks.on("createToken", (tok) => lembrar(tok.actor));
  Hooks.on("preUpdateActor", (actor, changes, options) => {
    if (foundry.utils.hasProperty(changes, "system.attributes.pv.value")) options[MODULO] = { pv: pvDe(actor) };
  });
  Hooks.on("updateActor", async (actor, changes, options) => {
    if (!foundry.utils.hasProperty(changes, "system.attributes.pv.value")) return;
    const antes = options[MODULO]?.pv ?? options.tormenta20?.pv ?? pvCache.get(actor.uuid);
    const agora = pvDe(actor);
    pvCache.set(actor.uuid, agora);
    if (antes === undefined || !souMestreAtivo()) return;
    await aoMudarPV(actor, antes, agora);
  });
  // Início do turno de cada combatente.
  Hooks.on("updateCombat", async (combat, changes) => {
    if (!("turn" in changes || "round" in changes) || !combat.started) return;
    if (!souMestreAtivo()) return;
    const actor = combat.combatant?.actor;
    if (actor) await curaAcelerada(actor);
  });
}
