/**
 * Poder customizado: DADO DE ANIVERSÁRIO   ·   Tormenta20, Foundry v14
 *
 * Execute uma vez como Mestre. Cria:
 *  1) O poder "Dado de Aniversário" (pasta de Itens "Coração de Rubi — Poderes Customizados").
 *     Arraste para a ficha do jogador aniversariante.
 *  2) A macro "Dado de Aniversário — Rolar novamente" (pasta de Macros "Coração de Rubi").
 *     Arraste para a barra de atalhos. Com o token do personagem selecionado, mostra as
 *     últimas rolagens dele no chat (ataque, dano, perícia, magia...) para escolher qual
 *     rolar de novo, e desconta um uso.
 *     Rodada pelo Mestre SEM token selecionado: abre a tela para devolver usos a um personagem.
 *
 * Ajuste aqui antes de executar:
 */
const USOS = 1;            // quantos rerolls o poder concede
const RECARGA = "nunca";   // "nunca" | "sessao" (o Mestre devolve pela macro) | "cena" (volta no fim da cena)

const NOME_PODER = "Dado de Aniversário";
const NOME_MACRO = "PJ · Dado de Aniversário — Rolar novamente";
const IMG = "icons/sundries/gaming/dice-runed-brown.webp";

if (!game.user.isGM) return ui.notifications.error("Execute esta macro como Mestre.");

// Marca do módulo giriarpg-coracao-de-rubi (o build exige em todo documento gerado).
const TAG = "pjs";
const FLAGS = (role) => ({ world: role ? { cdr: TAG, cdrRole: role } : { cdr: TAG } });
async function pasta(type) {
	return game.folders.find((f) => f.type === type && f.getFlag?.("world", "cdr") === TAG)
		?? await Folder.create({ name: "CdR · Poderes dos jogadores", type, color: "#8b1a1a", flags: FLAGS() });
}

const textoRecarga = { nunca: "Os usos não se recuperam.", sessao: "Os usos se recuperam a cada sessão (o Mestre devolve).", cena: "Os usos se recuperam no fim de cada cena." }[RECARGA];

// ---------- 1) Poder ----------
const poder = {
	name: NOME_PODER,
	type: "poder",
	img: IMG,
	folder: (await pasta("Item")).id,
	flags: { ...FLAGS("dadoAniversario"), tormenta20: { dadoAniversario: { usos: USOS, max: USOS, recarga: RECARGA } } },
	system: {
		description: {
			value: `<p><em>Um presente de aniversário dos deuses do acaso — Nimb sorri para você hoje.</em></p>
<p>Você pode rolar novamente <strong>qualquer rolagem</strong> que acabou de fazer (teste de perícia, ataque, dano, magia ou qualquer outra ação) e ficar com o novo resultado. <strong>${USOS} uso${USOS > 1 ? "s" : ""}.</strong> ${textoRecarga}</p>
<p><em>Automação:</em> use a macro <strong>${NOME_MACRO}</strong> logo após a rolagem.</p>`,
			unidentified: ""
		},
		source: "Poder customizado — mesa Coração de Rubi",
		tipo: "geral",
		subtipo: "Customizado",
		ativacao: { execucao: "free", custo: 0, qtd: "", condicao: "", special: "" },
		duracao: { value: 0, units: "inst", special: "" },
		alcance: "self",
		rolls: []
	}
};
const velhoPoder = game.items.filter((i) => i.getFlag?.("world", "cdrRole") === "dadoAniversario");
if (velhoPoder.length) await Item.deleteDocuments(velhoPoder.map((i) => i.id));
await Item.create(poder);

// ---------- 2) Macro ----------
const comando = `// ${NOME_MACRO}
const PODER = "${NOME_PODER}";
const MARCA_CENA = "Dado de Aniversário — usos da cena";

// Mestre sem token: devolver usos
actor = canvas.tokens.controlled[0]?.actor ?? (game.user.isGM ? null : game.user.character);
if (!actor) {
	if (!game.user.isGM) return ui.notifications.warn("Selecione o token do seu personagem.");
	const donos = game.actors.filter((a) => a.items.some((i) => i.name === PODER));
	if (!donos.length) return ui.notifications.warn("Nenhum personagem tem o poder " + PODER + ".");
	for (const a of donos) {
		const it = a.items.find((i) => i.name === PODER);
		const f = it.getFlag("tormenta20", "dadoAniversario") ?? {};
		await it.setFlag("tormenta20", "dadoAniversario", { ...f, usos: f.max ?? 1 });
		const marca = a.effects.find((e) => e.name === MARCA_CENA);
		if (marca) await marca.delete();
	}
	return ui.notifications.info("Usos do " + PODER + " devolvidos: " + donos.map((a) => a.name).join(", ") + ".");
}

const item = actor.items.find((i) => i.name === PODER);
if (!item) return ui.notifications.warn(actor.name + " não tem o poder " + PODER + ".");
const cfg = item.getFlag("tormenta20", "dadoAniversario") ?? { usos: 1, max: 1, recarga: "nunca" };
let restantes = cfg.usos;
if (cfg.recarga === "cena") {
	const marca = actor.effects.find((e) => e.name === MARCA_CENA);
	restantes = cfg.max - (marca?.getFlag("tormenta20", "gastos") ?? 0);
}
if (restantes <= 0) return ui.notifications.warn(actor.name + " já usou o " + PODER + (cfg.recarga === "cena" ? " nesta cena." : "."));

// últimas rolagens deste personagem
const msgs = game.messages.contents.slice().reverse()
	.filter((m) => m.speaker?.actor === actor.id && m.rolls?.length)
	.slice(0, 6);
if (!msgs.length) return ui.notifications.warn("Nenhuma rolagem recente de " + actor.name + " no chat.");
const opcoes = [];
for (const m of msgs) {
	const titulo = (m.flavor || m.content.replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim().slice(0, 50)) || "Rolagem";
	m.rolls.forEach((r, i) => opcoes.push({ m, i, r, label: titulo + " — " + r.formula + " = " + r.total }));
}
const lista = opcoes.map((o, k) => '<label style="display:block;margin:.2em 0"><input type="radio" name="op" value="' + k + '"' + (k === 0 ? " checked" : "") + "> " + o.label + "</label>").join("");

const escolha = await foundry.applications.api.DialogV2.prompt({
	window: { title: "${NOME_MACRO}" },
	content: "<p>Usos restantes: <strong>" + restantes + "</strong>. Qual rolagem rolar de novo?</p>" + lista,
	ok: { label: "Rolar novamente", callback: (ev, btn) => btn.form.querySelector("input[name=op]:checked")?.value },
	rejectClose: false
});
if (escolha === undefined || escolha === null) return;
const alvo = opcoes[Number(escolha)];

const nova = await alvo.r.reroll();
await nova.toMessage({
	speaker: ChatMessage.getSpeaker({ actor }),
	flavor: "<strong>🎂 Dado de Aniversário!</strong> Rolando novamente: " + alvo.label + " → <strong>" + nova.total + "</strong>"
});

if (cfg.recarga === "cena") {
	const marca = actor.effects.find((e) => e.name === MARCA_CENA);
	const gastos = (marca?.getFlag("tormenta20", "gastos") ?? 0) + 1;
	if (marca) await marca.setFlag("tormenta20", "gastos", gastos);
	else await actor.createEmbeddedDocuments("ActiveEffect", [{
		name: MARCA_CENA, img: "${IMG}", type: "base",
		duration: { value: null, units: "seconds", expiry: "sceneEnd" },
		flags: { tormenta20: { gastos } },
		system: { changes: [], targets: [], status: null, onuse: false,
			abilityUse: { description: "", automatic: false, aumenta: false, custo: 0, names: [], types: [] },
			aura: { isAura: false, range: 0 } }
	}]);
} else {
	await item.setFlag("tormenta20", "dadoAniversario", { ...cfg, usos: restantes - 1 });
}
ui.notifications.info(PODER + ": restam " + (restantes - 1) + " uso(s) para " + actor.name + ".");`;

const pastaMacro = await pasta("Macro");
const velhaMacro = game.macros.filter((m) => m.getFlag?.("world", "cdrRole") === "dadoAniversarioMacro");
if (velhaMacro.length) await Macro.deleteDocuments(velhaMacro.map((m) => m.id));
await Macro.create({
	name: NOME_MACRO,
	type: "script",
	img: IMG,
	command: comando,
	folder: pastaMacro.id,
	flags: FLAGS("dadoAniversarioMacro"),
	ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER }
});

ui.notifications.info(`Criados: poder "${NOME_PODER}" (${USOS} uso(s), recarga: ${RECARGA}) e macro "${NOME_MACRO}".`);
