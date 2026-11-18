/**
 * Testes no chat no padrão do Duelo de Dragões (scripts/testes.mjs), com as regras do Cauê (18/11/2026):
 *   1. nenhuma macro rola resistência nem aplica dano, condição ou efeito direto;
 *   2. o dano é rolado uma vez, só no conteúdo do cartão (classe roll--dano), e não em "rolls";
 *   3. um botão Rolar por personagem, e o resultado volta ao mestre;
 *   4. o mestre aplica dano, metade, condição ou efeito por botões que só ele vê;
 *   5. o cartão usa as classes "tormenta20 item-card";
 *   6. as macros já no mundo se atualizam sozinhas, guardando cópia das editadas.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { criarMundo, carregarModulo, prepararMesa, problemas, MODULO, RAIZ } from "./ajudantes.mjs";
import { politicaRoteiro, politicaPadrao, window } from "../tools/sim/dialogos.mjs";

const api = (mundo) => mundo.game.modules.get(MODULO).api;
const pedidoDe = (c) => c.flags?.[MODULO]?.pedido;

async function mesa(semente, politica, { ready = false } = {}) {
	const mundo = await criarMundo({ semente, politica });
	await carregarModulo(mundo, { ready });
	await api(mundo).puxar({ atos: ["patamar1", "patamar2", "patamar3", "patamar4", "campanha"] });
	await prepararMesa(mundo, { alvoNpc: false });
	return mundo;
}

test("macros não rolam resistência nem aplicam dano, condição ou efeito direto", () => {
	// Exceções: ferramentas de poder de jogador ou de manutenção, que só marcam uso ou consertam fichas.
	const EXCECOES = new Set(["A2 · K — Rolar novamente", "PJ · Dado de Aniversário — Rolar novamente", "CdR · Aço-rubi (aplicar ou remover)", "A2 · Lonien — Cura de Emergência"]);
	const dir = path.join(RAIZ, "src/packs/macros");
	const ruins = [];
	for (const f of fs.readdirSync(dir)) {
		const m = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
		if (!m.command || EXCECOES.has(m.name)) continue;
		for (const proibido of ["applyDamage", "toggleStatusEffect", "rollPericia", "rollAtributo", 'createEmbeddedDocuments("ActiveEffect"']) {
			if (m.command.includes(proibido)) ruins.push(`${m.name}: ${proibido}`);
		}
		// d20 somado a um valor da ficha (o PNJ Prinkster rola "1d20 + 14", que pode)
		if (/1d20 \+ ["'`]\s*\+/.test(m.command)) ruins.push(`${m.name}: 1d20 + ficha`);
	}
	assert.deepEqual(ruins, []);
});

test("Ases nas Alturas: cartão com o dano só no conteúdo, um botão por personagem, e o mestre aplica", async () => {
	const mundo = await mesa("ddd-ases", politicaRoteiro([{ botao: "canhoes" }]));
	const pjs = mundo.canvas.tokens.placeables.map((t) => t.actor).filter((a) => a?.type === "character");
	mundo.canvas.tokens.releaseAll();
	for (const t of mundo.canvas.tokens.placeables.filter((t) => t.actor?.type === "character")) t.control({ releaseOthers: false });
	const pv = Object.fromEntries(pjs.map((a) => [a.id, a.system.attributes.pv.value]));
	mundo.chat.length = 0;
	await mundo.game.macros.find((m) => m.name === "A4 · Ases nas Alturas").execute();
	await mundo.aguardarOcioso();
	const cartoes = mundo.chat.filter(pedidoDe);
	assert.equal(cartoes.length, 1, "um cartão só");
	const c = cartoes[0];
	assert.match(c.content, /class="cdr-pedido tormenta20 item-card"/);
	assert.match(c.content, /class="roll roll--dano"/);
	assert.ok(!c.rolls?.length, "a rolagem do dano não pode ir em rolls");
	const p = pedidoDe(c);
	assert.equal(p.linhas.length, pjs.length, "uma linha por personagem");
	assert.equal((c.content.match(/class="cdr-rolar"/g) ?? []).length, pjs.length, "um botão Rolar por personagem");
	assert.ok(p.linhas.every((l) => l.pericias[0] === "refl" && l.cd === 20));
	// ninguém rolou ainda, e nada foi aplicado
	assert.ok(p.linhas.every((l) => !l.feito));
	// o dono rola pela ficha (duas vezes, de propósito: só a primeira conta)
	await api(mundo)._testeTestes.clicarRolar(c, 0, "refl", {});
	await mundo.aguardarOcioso();
	await api(mundo)._testeTestes.clicarRolar(c, 0, "refl", {});
	await api(mundo).testes.registrar({ msgId: c.id, linha: 0, pericia: "refl", total: 1, d20: 1 });
	await mundo.aguardarOcioso();
	const ln = pedidoDe(c).linhas[0];
	assert.equal(ln.feito, true);
	const acoes = c.flags[MODULO].acoes.filter((a) => a.linha === 0);
	assert.equal(acoes.length, 1, "um botão de dano para o mestre");
	assert.equal(acoes[0].mult, ln.passou ? 0.5 : 1);
	assert.match(c.content, /cdr-acao cdr-mestre/);
	for (const a of pjs) assert.equal(a.system.attributes.pv.value, pv[a.id], "nada aplicado antes do mestre clicar");
	// o mestre aplica
	const idx = c.flags[MODULO].acoes.indexOf(acoes[0]);
	await api(mundo)._testeTestes.executarAcao(c, idx);
	await mundo.aguardarOcioso();
	const alvo = mundo.game.actors.get(pedidoDe(c).linhas[0].ator.split(".").pop());
	assert.ok(alvo.system.attributes.pv.value < pv[alvo.id], "o botão do mestre devia aplicar o dano");
	assert.equal(c.flags[MODULO].acoes[idx].feito, true);
	assert.deepEqual(problemas(mundo, { avisos: true }), []);
	mundo.encerrar();
});

test("os botões do mestre somem para os jogadores", async () => {
	const mundo = await mesa("ddd-botoes", politicaRoteiro([{ botao: "canhoes" }]), { ready: true });
	await mundo.game.macros.find((m) => m.name === "A4 · Ases nas Alturas").execute();
	await mundo.aguardarOcioso();
	const c = mundo.chat.find(pedidoDe);
	await api(mundo).testes.registrar({ msgId: c.id, linha: 0, pericia: "refl", total: 5, d20: 5 });
	const html = window.document.createElement("div");
	html.innerHTML = c.content;
	const isGM = Object.getOwnPropertyDescriptor(mundo.game.user, "isGM");
	Object.defineProperty(mundo.game.user, "isGM", { value: false, configurable: true });
	mundo.chamarHook("renderChatMessageHTML", c, html);
	if (isGM) Object.defineProperty(mundo.game.user, "isGM", isGM);
	else delete mundo.game.user.isGM;
	assert.equal(html.querySelectorAll(".cdr-mestre").length, 0);
	const faltam = pedidoDe(c).linhas.filter((l) => !l.feito).length;
	assert.equal(html.querySelectorAll(".cdr-rolar").length, faltam, "os botões de rolar de quem falta ficam");
	mundo.encerrar();
});

test("macros já no mundo se atualizam sozinhas e as editadas ganham cópia", async () => {
	const mundo = await criarMundo({ semente: "ddd-macros", politica: politicaPadrao });
	await carregarModulo(mundo);
	await api(mundo).puxar({ atos: ["patamar2"] });
	const ases = mundo.game.macros.find((m) => m.name === "A4 · Ases nas Alturas");
	const wyrt = mundo.game.macros.find((m) => m.name === "A3 · Partida de Wyrt");
	const novoAses = ases.command;
	await ases.update({ command: "// versão antiga\nreturn;" }); // editada à mão (não bate com nenhuma versão)
	await wyrt.update({ command: wyrt.command + "\n// minha anotação" });
	await mundo.game.settings.set(MODULO, "macrosAtualizadas", "");
	const r = await api(mundo).atualizarMacros();
	assert.equal(r.trocadas, 2);
	assert.equal(r.copias, 2);
	assert.equal(ases.command, novoAses, "o código novo entrou");
	const copias = mundo.game.macros.filter((m) => / \(sua edição\)$/.test(m.name));
	assert.equal(copias.length, 2);
	assert.ok(copias.some((m) => m.command.includes("versão antiga")));
	assert.ok(copias.every((m) => !m.getFlag("world", "cdr")), "a cópia não é mais do módulo");
	// roda uma vez só
	assert.equal(await api(mundo).atualizarMacros(), null);
	mundo.encerrar();
});

test("o manifesto liga o socket do módulo (o resultado do jogador volta ao mestre)", () => {
	const m = JSON.parse(fs.readFileSync(path.join(RAIZ, "module.json"), "utf8"));
	assert.equal(m.socket, true);
});
