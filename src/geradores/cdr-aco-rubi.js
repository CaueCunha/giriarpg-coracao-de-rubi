/**
 * Coração de Rubi — Material especial: AÇO-RUBI (Tormenta20, Foundry v14)
 *
 * Aplica (ou remove) o aço-rubi em armas, munições, armaduras, escudos e esotéricos:
 *  • Arma: ignora 10 pontos de redução de dano (automático em todo ataque).
 *    Ignorar a imunidade a crítico de lefeu fica com o mestre (o sistema não tem esse campo).
 *  • Munição: opção "Munição de aço-rubi" na janela de ataque (Shift+clique) — ignora 10 de RD.
 *  • Esotérico: magias que causam dano ignoram 10 de RD (automático) e há a opção
 *    "contra lefeu" na janela de uso, que faz o dano ignorar as imunidades a dano.
 *  • Armadura / escudo: rolagem "Aço-rubi" no item para ignorar o dano extra de
 *    crítico ou ataque furtivo (leve/escudo 25% = 1 no 1d4; pesada 50% = par; somam).
 *
 * Como usar: selecione o token (ou nenhum, para itens da aba Itens) e execute.
 */

const FLAG = "acoRubi";

actor = canvas.tokens?.controlled[0]?.actor ?? null;
const pool = actor ? actor.items.contents : game.items.contents;

function categoria(item) {
	if (item.type === "arma") return "arma";
	if (item.type === "consumivel" && item.system.tipo === "ammo") return "ammo";
	if (item.type === "equipamento" && ["leve", "pesada", "escudo", "esoterico"].includes(item.system.tipo)) return item.system.tipo;
	return null;
}

const elegiveis = pool.filter((i) => categoria(i));
if (!elegiveis.length) return ui.notifications.warn(actor
	? `${actor.name} não tem armas, munições, armaduras, escudos ou esotéricos.`
	: "Nenhum item elegível na aba Itens. Selecione um token para aplicar nos itens dele.");

const temAco = (i) => i.getFlag("tormenta20", FLAG) || i.system.upgrades?.material === "ruby-steel";
const linhas = elegiveis
	.sort((a, b) => a.name.localeCompare(b.name))
	.map((i) => `<label style="display:flex;gap:.5em;align-items:center;margin:.15em 0">
		<input type="checkbox" name="itens" value="${i.id}">
		<img src="${i.img}" width="24" height="24" style="border:none">
		<span>${i.name}</span>
		<em style="margin-left:auto;opacity:.7">${categoria(i)}${temAco(i) ? " · já é aço-rubi" : ""}</em>
	</label>`).join("");

const escolha = await foundry.applications.api.DialogV2.wait({
	window: { title: `Aço-Rubi — ${actor?.name ?? "Itens do mundo"}` },
	content: `<p>Marque os itens:</p><div style="max-height:400px;overflow:auto">${linhas}</div>`,
	buttons: [
		{ action: "aplicar", label: "Aplicar aço-rubi", default: true,
			callback: (ev, btn) => ({ modo: "aplicar", ids: [...btn.form.querySelectorAll("input[name=itens]:checked")].map((e) => e.value) }) },
		{ action: "remover", label: "Remover aço-rubi",
			callback: (ev, btn) => ({ modo: "remover", ids: [...btn.form.querySelectorAll("input[name=itens]:checked")].map((e) => e.value) }) }
	],
	rejectClose: false
});
if (!escolha?.ids?.length) return;

// Um único checkbox não vira lista em form.elements; trata esse caso
function ids() { return escolha.ids; }

function efeitoUso(nome, changes, types, automatic, descricao) {
	return {
		name: nome,
		img: "icons/commodities/gems/gem-rough-cushion-red.webp",
		type: "base",
		transfer: false,
		disabled: true,
		description: descricao,
		flags: { tormenta20: { [FLAG]: true } },
		system: {
			changes: changes.map(([key, value, type]) => ({ key, value, type, priority: null, phase: "initial" })),
			targets: [],
			status: null,
			onuse: true,
			abilityUse: { description: "", automatic, aumenta: false, custo: null, names: [], types },
			aura: { isAura: false, range: 0 }
		}
	};
}

const RD10 = [["ignoraRD", "10", "add"]];
const DESC_ARMA = "<p>Aço-rubi: a arma ignora 10 pontos de redução de dano, além de ignorar a imunidade a crítico de lefeu.</p>";
const DESC_ESO = "<p>Aço-rubi: magias que causam dano ignoram 10 pontos de redução de dano, além de ignorar as imunidades a dano de lefeu.</p>";

for (const id of ids()) {
	const item = pool.find((i) => i.id === id);
	if (!item) continue;
	const cat = categoria(item);
	// limpa o que já existir
	const antigos = item.effects.filter((e) => e.getFlag("tormenta20", FLAG)).map((e) => e.id);
	if (antigos.length) await item.deleteEmbeddedDocuments("ActiveEffect", antigos);
	const rolls = (item.system.rolls ?? []).filter((r) => r.key !== "acorubi").map((r) => r.toObject?.() ?? r);

	if (escolha.modo === "remover") {
		await item.update({
			"system.rolls": rolls,
			"flags.tormenta20.-=acoRubi": null
		});
		continue;
	}

	// O material fica marcado pela flag: o campo antigo system.upgrades.material (texto) o T20 1.6 descarta.
	const update = { [`flags.tormenta20.${FLAG}`]: true };

	if (cat === "arma") {
		await item.createEmbeddedDocuments("ActiveEffect", [
			efeitoUso("Aço-rubi: ignora RD 10", RD10, ["self"], true, DESC_ARMA)
		]);
	} else if (cat === "ammo") {
		await item.createEmbeddedDocuments("ActiveEffect", [
			efeitoUso(`Munição de aço-rubi (${item.name}): ignora RD 10`, RD10, ["attack"], false, DESC_ARMA)
		]);
	} else if (cat === "esoterico") {
		await item.createEmbeddedDocuments("ActiveEffect", [
			efeitoUso("Aço-rubi: magia ignora RD 10", RD10, ["spell"], true, DESC_ESO),
			efeitoUso("Aço-rubi: contra lefeu (ignora imunidades a dano)", [["tipoDano", "dano", "override"]], ["spell"], false, DESC_ESO)
		]);
	} else {
		const pct = cat === "pesada" ? 50 : 25;
		rolls.push({
			name: `Aço-rubi: ignora crítico/furtivo se ≤ ${pct} (some armadura + escudo)`,
			key: "acorubi", type: "formula", parts: [["1d100", "", ""]], versatil: "", adaptavel: ""
		});
		update["system.rolls"] = rolls;
	}
	await item.update(update);
}

ui.notifications.info(`Aço-rubi ${escolha.modo === "remover" ? "removido de" : "aplicado em"} ${ids().length} item(ns).`);
