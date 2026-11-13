/**
 * Token padrão das ameaças (scripts/cdr.mjs): PV na barra 1 e PM (azul) na barra 2, mesmo que o mundo tenha
 * outro padrão de token, e conserto das ameaças que já estavam no mundo.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { criarMundo, carregarModulo, MODULO } from "./ajudantes.mjs";
import { politicaPadrao } from "../tools/sim/dialogos.mjs";

const api = (mundo) => mundo.game.modules.get(MODULO).api;

test("ameaça do módulo criada sem barras ganha PV e PM; ameaça de fora fica como está", async () => {
	const mundo = await criarMundo({ semente: "token-criar", politica: politicaPadrao });
	await carregarModulo(mundo);
	const [nossa, outra] = await globalThis.Actor.createDocuments([
		{ name: "Nossa", type: "npc", prototypeToken: { bar2: { attribute: "attributes.carga" } }, _stats: { compendiumSource: `Compendium.${MODULO}.ameacas.Actor.aaaaaaaaaaaaaaaa` } },
		{ name: "Outra", type: "npc", prototypeToken: { bar2: { attribute: "attributes.carga" } } }
	]);
	assert.equal(nossa.prototypeToken.bar1.attribute, "attributes.pv");
	assert.equal(nossa.prototypeToken.bar2.attribute, "attributes.pm");
	assert.equal(nossa.prototypeToken.displayName, 30);
	// Bar Brawl: PM azul na barra 2 (sem isso ele copia as cores da barra 1)
	const bb = nossa.prototypeToken.flags.barbrawl.resourceBars;
	assert.equal(bb.bar2.attribute, "attributes.pm");
	assert.equal(bb.bar2.id, "bar2");
	assert.equal(bb.bar2.maxcolor, "#80B3FF");
	assert.equal(bb.bar1.maxcolor, "#80FF00");
	assert.equal(bb.bar1.position, "bottom-inner");
	assert.equal(bb.bar2.position, "top-inner");
	assert.equal(outra.prototypeToken.bar2.attribute, "attributes.carga");
	mundo.encerrar();
});

test("corrigirTokens conserta as ameaças do módulo que já estão no mundo", async () => {
	const mundo = await criarMundo({ semente: "token-corrigir", politica: politicaPadrao });
	await carregarModulo(mundo);
	await api(mundo).puxar({ atos: ["patamar1"] });
	const ameacas = mundo.game.actors.filter((a) => a.type === "npc" && a.getFlag("world", "cdr"));
	assert.ok(ameacas.length > 5);
	for (const a of ameacas.slice(0, 2)) await a.update({ "prototypeToken.bar2.attribute": "" });
	// como o Bar Brawl deixava: barra 2 com id e cores da barra 1
	await ameacas[2].update({ "prototypeToken.flags.barbrawl.resourceBars.bar2": { id: "bar1", attribute: "attributes.pm", mincolor: "#FF0000", maxcolor: "#80FF00" } });
	const r = await api(mundo).corrigirTokens();
	assert.equal(r.atores, 3);
	for (const a of ameacas) {
		assert.equal(a.prototypeToken.bar2.attribute, "attributes.pm", a.name);
		assert.equal(a.prototypeToken.flags.barbrawl.resourceBars.bar2.maxcolor, "#80B3FF", a.name);
	}
	mundo.encerrar();
});
