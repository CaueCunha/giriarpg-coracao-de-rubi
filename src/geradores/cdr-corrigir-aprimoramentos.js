/**
 * Corrigir Aprimoramentos (efeitos "ao usar" no formato antigo) — Tormenta20 v1.6.x, Foundry v14
 *
 * Problema: itens vindos de módulos (ex.: Deuses de Arton, Heróis de Arton) guardam os
 * aprimoramentos no formato antigo, em flags.tormenta20 (onuse, custo, aumenta...). O sistema
 * atual só lê system.onuse/system.abilityUse, então esses aprimoramentos não aparecem na janela
 * do Shift+clique. Ex.: Flecha de Luz.
 *
 * O que a macro faz: aplica a mesma conversão que o próprio sistema usa na migração v14
 * (module/data/migrations/v14.mjs, migrateEffectsV2) só nos efeitos que ainda estão no formato
 * antigo. Efeitos já convertidos não são tocados.
 *
 * Como usar:
 *  • Com um token selecionado: corrige só os itens desse personagem.
 *  • Sem token: pergunta e corrige todos os personagens e itens do mundo (aba Itens).
 * Itens dentro de compêndios de módulos não são alterados: rode de novo depois de puxar um item novo.
 */

const TIPOS = ["self", "ability", "attack", "consumable", "equipment", "power", "skill", "spell"];

function precisaCorrigir(ef) {
	return ef.flags?.tormenta20?.onuse && !ef.system.onuse;
}

function conversao(ef) {
	const f = ef.flags.tormenta20;
	const item = ef.parent;
	const ehMagia = item?.type === "magia" || (item?.type === "consumivel" && item?.system.tipo === "scroll");
	const types = ehMagia && !ef.isTemporary ? ["self"] : TIPOS.filter((k) => f[k]);
	const names = (f.items ?? "").replaceAll(",", ";").split(";").map((s) => s.trim()).filter(Boolean);
	const custo = Number.isNumeric(f.custo) ? Number(f.custo) : null;

	const update = {
		_id: ef.id,
		disabled: true,
		"system.onuse": true,
		"system.abilityUse.automatic": false,
		"system.abilityUse.aumenta": !!f.aumenta,
		"system.abilityUse.custo": custo,
		"system.abilityUse.names": names,
		"system.abilityUse.types": types
	};
	// Na magia, o texto do aprimoramento vai para a descrição (como o sistema faz)
	if (ehMagia && ef.name !== item.name && !ef.description) {
		update.name = "Aprimoramento";
		update.description = `<p>${ef.name}</p>`;
	}
	if (f.durationScene) update.duration = { expiry: "sceneEnd", value: null, units: "rounds" };
	return update;
}

async function corrigirItem(item) {
	const updates = item.effects.filter(precisaCorrigir).map(conversao);
	if (updates.length) await item.updateEmbeddedDocuments("ActiveEffect", updates);
	return updates.length;
}

async function corrigirAtor(actor) {
	let n = 0;
	for (const item of actor.items) n += await corrigirItem(item);
	const proprios = actor.effects.filter(precisaCorrigir).map(conversao);
	if (proprios.length) await actor.updateEmbeddedDocuments("ActiveEffect", proprios);
	return n + proprios.length;
}

const selecionado = canvas.tokens?.controlled[0]?.actor;
const relatorio = [];
let total = 0;

if (selecionado) {
	total = await corrigirAtor(selecionado);
	relatorio.push(`${selecionado.name}: ${total}`);
} else {
	const ok = await foundry.applications.api.DialogV2.confirm({
		window: { title: "Corrigir Aprimoramentos" },
		content: "<p>Nenhum token selecionado. Corrigir os aprimoramentos de <b>todos os personagens e itens do mundo</b>?</p>"
	});
	if (!ok) return;
	for (const actor of game.actors) {
		const n = await corrigirAtor(actor);
		if (n) relatorio.push(`${actor.name}: ${n}`);
		total += n;
	}
	let nItens = 0;
	for (const item of game.items) nItens += await corrigirItem(item);
	if (nItens) relatorio.push(`Itens do mundo: ${nItens}`);
	total += nItens;
}

ChatMessage.create({
	whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id),
	content: `<h3>Corrigir Aprimoramentos</h3><p>${total} efeito(s) convertido(s).</p>${relatorio.length ? `<p>${relatorio.join("<br>")}</p>` : ""}`
});
ui.notifications.info(`Aprimoramentos corrigidos: ${total}.`);
