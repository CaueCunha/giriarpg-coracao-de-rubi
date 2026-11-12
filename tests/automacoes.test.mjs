/**
 * Automações da campanha (scripts/automacoes.mjs), ligadas no ready e executadas pelo mestre ativo:
 *   - cura acelerada por flag da ficha (Troll Rubi 15, com o lembrete do ácido);
 *   - cura de emergência da Lonien ao cair a 0 PV, uma vez por cena.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { criarMundo, carregarModulo, problemas, MODULO } from "./ajudantes.mjs";

test("cura acelerada: o Troll Rubi recupera 15 PV no turno dele e lembra do ácido", async () => {
	const mundo = await criarMundo({ semente: "cdr-cura-acelerada" });
	await carregarModulo(mundo, { ready: true });
	await mundo.game.modules.get(MODULO).api.puxar({ atos: ["patamar1"] });
	const troll = mundo.game.actors.find((a) => a.name === "Troll Rubi");
	assert.ok(troll, "Troll Rubi não veio do compêndio");
	assert.deepEqual(troll.getFlag("world", "cdrAutomacoes"), { curaAcelerada: { valor: 15, excecao: "ácido" } });
	await mundo.criarCena("Andar 3");
	const pj = await mundo.criarPJ("Rak", { nivel: 5 });
	await mundo.colocarToken(pj);
	const tokTroll = await mundo.colocarToken(troll);
	const combate = await mundo.iniciarCombate();
	const ator = tokTroll.actor;
	const max = ator.system.attributes.pv.max;
	await ator.update({ "system.attributes.pv.value": max - 40 });
	await mundo.aguardarOcioso();
	mundo.chat.length = 0;
	for (let i = 0; i < 4 && !mundo.chat.some((c) => /Cura acelerada/.test(c.content ?? "")); i++) {
		await combate.nextTurn();
		await mundo.aguardarOcioso();
	}
	assert.equal(ator.system.attributes.pv.value, max - 25, "devia curar 15");
	const aviso = mundo.chat.find((c) => /Cura acelerada 15/.test(c.content ?? ""));
	assert.ok(aviso, "faltou o aviso no chat");
	assert.match(aviso.content, new RegExp(`${max - 40} → ${max - 25}`));
	assert.match(aviso.content, /ácido/);
	assert.deepEqual(problemas(mundo, { avisos: true }), []);
	mundo.encerrar();
});

test("Lonien: cura 4d8+4 ao cair a 0 PV, só uma vez por cena", async () => {
	const mundo = await criarMundo({ semente: "cdr-lonien" });
	await carregarModulo(mundo, { ready: true });
	await mundo.game.modules.get(MODULO).api.puxar({ atos: ["patamar1"] });
	const lonien = mundo.game.items.find((i) => i.getFlag("world", "cdrParceiro") === "lonien");
	assert.ok(lonien, "o poder da Lonien não veio do compêndio");
	await mundo.criarCena("Andar 2");
	const pj = await mundo.criarPJ("Aela", { nivel: 5 });
	await pj.createEmbeddedDocuments("Item", [lonien.toObject()]);
	await mundo.colocarToken(pj);

	await pj.update({ "system.attributes.pv.value": -3 });
	await mundo.aguardarOcioso();
	const pv1 = pj.system.attributes.pv.value;
	assert.ok(pv1 >= -3 + 8 && pv1 <= Math.min(40, -3 + 36), `devia curar 4d8+4 (ficou com ${pv1})`);
	assert.ok(pj.effects.some((e) => e.name === "Lonien — cura de emergência usada"), "faltou a marca da cena");

	await pj.update({ "system.attributes.pv.value": 10 });
	await pj.update({ "system.attributes.pv.value": 0 });
	await mundo.aguardarOcioso();
	assert.equal(pj.system.attributes.pv.value, 0, "na mesma cena não pode curar de novo");
	assert.deepEqual(problemas(mundo, { avisos: true }), []);
	mundo.encerrar();
});

test("Meiose Glópica: no par, um glop surge ao lado da Mamãe Glop e entra no combate", async () => {
	const mundo = await criarMundo({ semente: "cdr-meiose" });
	await carregarModulo(mundo, { ready: true });
	await mundo.game.modules.get(MODULO).api.puxar({ atos: ["patamar1"] });
	const mamae = mundo.game.actors.find((a) => a.name === "Mamãe Glop");
	assert.ok(mamae, "Mamãe Glop não veio do compêndio");
	assert.equal(mamae.getFlag("world", "cdrAutomacoes")?.meiose?.ator, "Glop");
	// O Giria T20 não está no mundo simulado: o glop vem do ator do mundo com o nome.
	await globalThis.Actor.create({ name: "Glop", type: "npc", system: { attributes: { pv: { value: 5, max: 5 } } } });
	await mundo.criarCena("Fundição");
	await mundo.colocarToken(await mundo.criarPJ("Rak", { nivel: 1 }));
	await mundo.colocarToken(mamae);
	const combate = await mundo.iniciarCombate();
	await mundo.aguardarOcioso();
	const antes = combate.combatants.size;
	const glopsAntes = mundo.canvas.scene.tokens.filter((t) => t.name === "Glop").length;
	let pares = 0;
	for (let i = 0; i < 8; i++) {
		mundo.chat.length = 0;
		await combate.nextTurn();
		await mundo.aguardarOcioso();
		const msg = mundo.chat.find((c) => /Meiose Glópica/.test(c.flavor ?? c.content ?? ""));
		if (msg && /par, um glop/.test(msg.flavor ?? "")) pares++;
	}
	assert.ok(pares > 0, "em 8 turnos devia sair pelo menos um par");
	assert.equal(combate.combatants.size, antes + pares, "cada par devia pôr um glop no combate");
	assert.equal(mundo.canvas.scene.tokens.filter((t) => t.name === "Glop").length, glopsAntes + pares);
	assert.deepEqual(problemas(mundo, { avisos: true }), []);
	mundo.encerrar();
});
