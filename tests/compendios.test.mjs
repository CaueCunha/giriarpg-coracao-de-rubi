/**
 * Confere o conteúdo dos compêndios (as fontes em src/packs que viram LevelDB):
 *   - formato do foundryvtt-cli (_key, IDs únicos de 16 caracteres, pastas existentes);
 *   - cada documento passa pelos modelos de dados do Foundry v14 e do Tormenta20 sem perder campos;
 *   - chaves dos efeitos existem na ficha ou são chaves especiais que o próprio sistema usa;
 *   - imagens do sistema existem, links @UUID e resultados de tabela apontam para algo;
 *   - o comando de toda macro compila como o Foundry compila (AsyncFunction).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { criarMundo, carregarModulo, problemas, limparRegistros, manifesto, MODULO } from "./ajudantes.mjs";
import { lerPackFonte } from "../tools/sim/sistema.mjs";
import { FONTE_PACKS, T20_DIR } from "../tools/caminhos.mjs";
import { getProperty } from "../tools/sim/utils.mjs";

const m = manifesto();
const packs = m.packs.map((p) => ({ ...p, ...lerPackFonte(path.join(FONTE_PACKS, p.name)) }));
const COLECAO = { Actor: "actors", Item: "items", JournalEntry: "journal", RollTable: "tables", Macro: "macros" };

/** Visita os documentos embutidos com a chave que o foundryvtt-cli espera. */
function* embutidos(doc, prefixo) {
	for (const [campo, nome] of [["items", "items"], ["effects", "effects"], ["pages", "pages"], ["results", "results"]]) {
		for (const e of doc[campo] ?? []) {
			yield { e, chave: `!${prefixo}.${nome}!` };
			yield* embutidos(e, `${prefixo}.${nome}`);
		}
	}
}

test("compêndios têm o formato do foundryvtt-cli", () => {
	const ids = new Set();
	for (const p of packs) {
		assert.ok(p.docs.length > 0, `${p.name} está vazio`);
		const pastas = new Set(p.pastas.map((f) => f._id));
		const col = COLECAO[p.type];
		for (const d of p.docs) {
			assert.match(d._id, /^[A-Za-z0-9]{16}$/, `${p.name}: ID inválido em ${d.name}`);
			assert.equal(d._key, `!${col}!${d._id}`, `${p.name}: _key errada em ${d.name}`);
			assert.ok(!ids.has(d._id), `ID repetido entre compêndios: ${d._id} (${d.name})`);
			ids.add(d._id);
			if (d.folder) assert.ok(pastas.has(d.folder), `${p.name}: ${d.name} está numa pasta que não existe`);
			for (const { e, chave } of embutidos(d, col)) {
				assert.ok(e._key?.startsWith(chave), `${p.name}: embutido ${e.name ?? e._id} de ${d.name} com _key ${e._key} (esperava ${chave}...)`);
			}
		}
		for (const f of p.pastas) {
			assert.equal(f.type, p.type, `${p.name}: pasta ${f.name} de tipo ${f.type}`);
			if (f.folder) assert.ok(pastas.has(f.folder), `${p.name}: pasta ${f.name} dentro de pasta inexistente`);
		}
	}
});

test("module.json descreve os compêndios por tipo, com pastas por ato", () => {
	assert.equal(m.id, MODULO);
	assert.deepEqual(Object.keys(m.flags[MODULO].atos).sort(), ["campanha", "patamar1"]);
	const nomes = m.packs.map((p) => p.name);
	assert.deepEqual(nomes, ["ameacas", "poderes", "itens", "diarios", "macros"]);
	assert.deepEqual(m.packFolders.flatMap((f) => f.packs ?? []).sort(), [...nomes].sort(), "packFolders deve conter todos os compêndios");
	for (const p of m.packs) assert.equal(p.path, `packs/${p.name}`);
	for (const f of [...m.esmodules, ...m.styles, ...m.languages.map((l) => l.path)]) assert.ok(fs.existsSync(f), `${f} não existe`);
	for (const p of packs) {
		const raizes = p.pastas.filter((f) => !f.folder);
		assert.ok(raizes.every((f) => f.flags?.[MODULO]?.ato), `${p.name}: pasta de cima sem ato`);
		for (const d of p.docs) {
			assert.ok(d.folder, `${p.name}: ${d.name} fora das pastas`);
			const f = d.flags?.[MODULO] ?? {};
			assert.match(f.assinatura ?? "", /^[0-9a-f]{8}$/, `${p.name}: ${d.name} sem assinatura`);
			assert.equal(f.assinaturas?.at(-1), f.assinatura, `${p.name}: ${d.name}: a última assinatura deve ser a atual`);
		}
		if (p.name === "poderes") assert.ok(p.docs.every((d) => d.type === "poder"));
		if (p.name === "itens") assert.ok(p.docs.every((d) => d.type !== "poder"));
	}
});

test("imagens do sistema e do módulo existem", () => {
	const faltando = new Set();
	const visitar = (o) => {
		if (Array.isArray(o)) return o.forEach(visitar);
		if (!o || typeof o !== "object") return;
		for (const [k, v] of Object.entries(o)) {
			if (typeof v === "string" && (k === "img" || k === "src" || k === "icon")) {
				if (v.startsWith("systems/tormenta20/") && !fs.existsSync(path.join(T20_DIR, v.slice("systems/tormenta20/".length)))) faltando.add(v);
				if (v.startsWith(`modules/${MODULO}/`) && !fs.existsSync(v.slice(`modules/${MODULO}/`.length))) faltando.add(v);
			} else visitar(v);
		}
	};
	for (const p of packs) visitar(p.docs);
	assert.deepEqual([...faltando], []);
});

test("macros compilam como no Foundry", () => {
	const AsyncFunction = (async () => {}).constructor;
	for (const p of packs.filter((x) => x.type === "Macro")) {
		for (const d of p.docs) {
			assert.equal(d.type, "script", `${d.name} não é script`);
			assert.doesNotThrow(() => new AsyncFunction("speaker", "actor", "token", "character", "scope", d.command), `${d.name} não compila`);
		}
	}
});

// ---- Validação no mundo simulado (modelos reais do T20) ----

const mundo = await criarMundo({ semente: "compendios" });
await carregarModulo(mundo);

test("todo documento passa pelos modelos de dados sem perder campos", async () => {
	limparRegistros(mundo);
	await mundo.game.modules.get(MODULO).api.puxar({ atos: ["campanha", "patamar1"] });
	await mundo.aguardarOcioso();
	assert.deepEqual(problemas(mundo, { avisos: true }), []);
	for (const p of packs) {
		const col = mundo.game[COLECAO[p.type] === "journal" ? "journal" : COLECAO[p.type]];
		for (const d of p.docs) assert.ok(col.get(d._id), `${d.name} (${p.name}) não chegou ao mundo`);
	}
});

test("chaves dos efeitos existem na ficha ou são chaves do sistema", async () => {
	// Chaves especiais: as que o próprio sistema usa nos compêndios dele (efeitos de uso, condições...)
	const doSistema = new Set();
	for (const pk of mundo.game.packs.filter((x) => x.metadata.packageName === "tormenta20")) {
		for (const src of pk._fontes.values()) {
			for (const e of [...(src.effects ?? []), ...(src.items ?? []).flatMap((i) => i.effects ?? [])]) for (const c of e.system?.changes ?? []) doSistema.add(c.key);
		}
	}
	assert.ok(doSistema.size > 20, "não consegui ler as chaves dos compêndios do sistema");
	// Chaves com * que o sistema replica para cada perícia/atributo (ActiveEffect._prepareProxyChange).
	for (const k of ["system.atributos.*.bonus", "system.pericias.*.bonus", "system.pericias.*.condi"]) doSistema.add(k);
	// Chaves das condições do sistema (CONFIG.statusEffects) e dos efeitos de uso (ability-use: ignoraRD).
	for (const s of Object.values(globalThis.CONFIG.statusEffects ?? {})) for (const c of s._source?.system?.changes ?? s.system?.changes ?? []) doSistema.add(c.key);
	doSistema.add("ignoraRD");
	const pj = await mundo.criarPJ("Teste de chaves", { nivel: 5 });
	// O campo bonus das perícias é do esquema; na ficha simulada ele só aparece depois de alguma edição.
	for (const k of Object.keys(pj.system.pericias)) doSistema.add(`system.pericias.${k}.bonus`);
	const npc = mundo.game.actors.find((a) => a.type === "npc");
	const ruins = new Set();
	const conferir = (e, dono) => {
		for (const c of e.system.changes ?? []) {
			if (doSistema.has(c.key)) continue;
			if (c.key.startsWith("system.")) {
				const alvos = e.transfer === false && dono?.documentName === "Item" ? [dono] : [pj, npc];
				if (alvos.some((a) => getProperty(a, c.key) !== undefined)) continue;
			}
			ruins.add(`${dono?.name} › ${e.name}: ${c.key}`);
		}
	};
	for (const a of mundo.game.actors) {
		for (const e of a.effects) conferir(e, a);
		for (const i of a.items) for (const e of i.effects) conferir(e, i);
	}
	for (const i of mundo.game.items) for (const e of i.effects) conferir(e, i);
	assert.deepEqual([...ruins], []);
});

test("links @UUID e resultados de tabela apontam para documentos", () => {
	limparRegistros(mundo);
	const html = [];
	for (const j of mundo.game.journal) for (const pg of j.pages) html.push([`${j.name} › ${pg.name}`, pg.text?.content ?? ""]);
	for (const i of [...mundo.game.items, ...mundo.game.actors.contents.flatMap((a) => a.items.contents)]) html.push([i.name, i.system?.description?.value ?? ""]);
	for (const a of mundo.game.actors) html.push([a.name, a.system?.details?.biography?.value ?? a.system?.detalhes?.biography?.value ?? ""]);
	for (const [onde, h] of html) mundo.verificarLinks(h, onde);
	const quebrados = mundo.relatorio.filter((r) => r.tipo === "link-quebrado").map((r) => `${r.documento}: ${r.caminho} ${r.mensagem}`);
	for (const t of mundo.game.tables) {
		for (const r of t.results) {
			if (r.type === "document" && !mundo.fromUuidSync(r.documentUuid)) quebrados.push(`${t.name}: resultado ${r.name} → ${r.documentUuid}`);
		}
	}
	assert.deepEqual(quebrados, []);
});

test("tabelas sorteiam", async () => {
	for (const t of mundo.game.tables) {
		const r = await t.draw({ displayChat: false });
		assert.ok(r.results.length > 0, `${t.name} não sorteou nada (fórmula ${t.formula})`);
	}
	mundo.encerrar();
});
