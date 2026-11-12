/**
 * Roda TODAS as macros do módulo num mundo simulado com o conteúdo importado, como um Mestre faria:
 *   1. uma vez com os valores padrão dos diálogos;
 *   2. uma vez para cada opção do primeiro <select> do primeiro diálogo (os ramos da macro);
 *   3. algumas vezes com valores sorteados (checkboxes, números, selects e botões).
 * Cada macro roda numa cena com os 4 PJs e os NPCs da mesma aventura, em combate, com um PJ
 * selecionado (que recebe os itens da aventura, como se o Mestre os arrastasse) e um NPC como alvo.
 * Depois de cada execução, o combate anda alguns turnos e um PJ sofre dano, para exercitar os
 * ganchos (Hooks) que as macros de automação registram. Falha se houver exceção, console.error,
 * documento inválido, chave descartada pelo modelo de dados, link quebrado ou rolagem não avaliada.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { criarMundo, carregarModulo, prepararMesa, problemas, limparRegistros, MODULO } from "./ajudantes.mjs";
import { politicaPadrao, politicaAleatoria, politicaRoteiro } from "../tools/sim/dialogos.mjs";
import { semearDados } from "../tools/sim/sorte.mjs";

const SORTEIOS = Number(process.env.CDR_SORTEIOS ?? 6);

const mundo = await criarMundo({ semente: "macros" });
await carregarModulo(mundo);
await mundo.game.modules.get(MODULO).api.puxar({ atos: ["campanha", "patamar1"] });
await prepararMesa(mundo, { alvoNpc: false });
const pjs = mundo.game.actors.filter((a) => a.type === "character");

/** Uma cena por aventura, com os PJs e os NPCs daquela marca. */
const cenas = new Map();
async function cenaDa(marca) {
	if (cenas.has(marca)) {
		const { cena, combate } = cenas.get(marca);
		mundo.canvas.scene = cena;
		mundo.game.combat = combate;
		return;
	}
	await mundo.criarCena(`Cena ${marca}`);
	for (const pj of pjs) await mundo.colocarToken(pj);
	const npcs = mundo.game.actors.filter((a) => a.type === "npc" && a.getFlag("world", "cdr") === marca).slice(0, 40);
	for (const n of npcs) await mundo.colocarToken(n);
	// O primeiro PJ recebe os itens da aventura (presentes, guloseimas, poderes de grupo...).
	const itens = mundo.game.items.filter((i) => i.getFlag("world", "cdr") === marca).map((i) => i.toObject());
	if (itens.length) await pjs[0].createEmbeddedDocuments("Item", itens);
	await mundo.iniciarCombate();
	cenas.set(marca, { cena: mundo.canvas.scene, combate: mundo.game.combat });
}

/** Faz o mundo andar: turnos de combate e dano num PJ (dispara os ganchos das automações). */
async function andarMundo() {
	const c = mundo.game.combat;
	if (c) for (let i = 0; i < 3; i++) await c.nextTurn();
	const pj = pjs[1];
	await pj.update({ "system.attributes.pv.value": Math.max(pj.system.attributes.pv.value - 1, 1) });
	await mundo.aguardarOcioso();
}

async function rodar(macro, politica, rotulo) {
	const marca = macro.getFlag("world", "cdr");
	await cenaDa(marca);
	mundo.canvas.tokens.releaseAll();
	const tokens = mundo.canvas.tokens.placeables;
	tokens.find((t) => t.actor?.type === "character")?.control();
	const alvo = tokens.find((t) => t.actor?.type === "npc");
	mundo.usuario.targets.clear();
	if (alvo) alvo.setTarget(true);
	limparRegistros(mundo);
	mundo.politica = politica;
	await macro.execute();
	await andarMundo();
	return { rotulo, problemas: problemas(mundo, { avisos: true }), dialogos: [...mundo.dialogos] };
}

const macros = mundo.game.macros.contents.filter((m) => !["importador", "atualizador", "limpador"].includes(m.getFlag("world", "cdrRole")));

test("o módulo tem macros para testar", () => {
	assert.ok(macros.length >= 7, `só ${macros.length} macros`);
});

for (const macro of macros) {
	test(`macro: ${macro.name}`, async () => {
		const falhas = [];
		semearDados(macro.name.length * 7919);
		const base = await rodar(macro, politicaPadrao, "padrão");
		falhas.push(...base.problemas.map((p) => `padrão: ${p}`));

		// Ramos do primeiro diálogo
		const primeiro = base.dialogos[0];
		const select = primeiro?.campos?.[0];
		if (select) {
			for (const valor of select.opcoes) {
				const r = await rodar(macro, politicaRoteiro([{ campos: { [select.nome]: valor } }]), `${select.nome}=${valor}`);
				falhas.push(...r.problemas.map((p) => `${r.rotulo}: ${p}`));
			}
		}

		// Sorteios
		for (let i = 0; i < SORTEIOS; i++) {
			semearDados(1000 + i * 31 + macro.name.length);
			const r = await rodar(macro, politicaAleatoria({ cancelar: 0.02 }), `sorteio ${i + 1}`);
			falhas.push(...r.problemas.map((p) => `${r.rotulo}: ${p}`));
		}
		const unicas = [...new Set(falhas)];
		assert.equal(unicas.length, 0, `Problemas em "${macro.name}":\n${unicas.slice(0, 12).join("\n")}`);
	});
}

test("nenhuma macro deixou promessa ou operação pendurada", async () => {
	assert.equal(await mundo.aguardarOcioso(), true);
	mundo.encerrar();
});
