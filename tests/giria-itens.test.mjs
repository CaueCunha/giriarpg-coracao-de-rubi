/**
 * Regra do Cauê (13/11/2026): os itens refinados do Giria T20 vêm primeiro. Todo item da campanha com o
 * mesmo nome e tipo de um item do Giria (copiado em src/giria-docs.json) tem que ser a cópia do Giria:
 * mesma arte e origem no Giria.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { normalizar, GENERICOS } from "../tools/ligar-sistema.mjs";

const RAIZ = path.resolve(import.meta.dirname, "..");
const giria = JSON.parse(fs.readFileSync(path.join(RAIZ, "src/giria-docs.json"), "utf8"));
const porNome = new Map();
for (const [uuid, d] of Object.entries(giria.itens)) porNome.set(`${normalizar(d.name)}|${d.type}`, [...(porNome.get(`${normalizar(d.name)}|${d.type}`) ?? []), { uuid, d }]);

function* itens(dir) {
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) yield* itens(p);
		else if (e.name.endsWith(".json")) {
			const d = JSON.parse(fs.readFileSync(p, "utf8"));
			for (const i of Array.isArray(d.items) ? d.items : [d]) if (i.system) yield { dono: d.name, i };
		}
	}
}

test("itens que o Giria T20 tem são a cópia do Giria (arte e origem)", () => {
	const erros = [];
	let copiados = 0;
	for (const { dono, i } of itens(path.join(RAIZ, "src/packs"))) {
		const k = normalizar(i.name);
		if (GENERICOS.has(k) || ["sumo sacerdote", "marrada"].includes(k)) continue;
		const cands = porNome.get(`${k}|${i.type}`);
		if (!cands) continue;
		const fonte = i._stats?.compendiumSource ?? "";
		const c = cands.find((x) => x.uuid === fonte);
		if (!c) erros.push(`${dono} › ${i.name}: origem ${fonte || "nenhuma"}, devia ser o Giria`);
		else if (c.d.img && i.img !== c.d.img) erros.push(`${dono} › ${i.name}: arte ${i.img}, no Giria ${c.d.img}`);
		else copiados++;
	}
	assert.deepEqual(erros, []);
	assert.ok(copiados > 50, `esperava muitos itens copiados do Giria (${copiados})`);
});

test("a Espada longa do Humano Mercenário (A2) é a do Giria, com os números da ficha", () => {
	const f = fs.readdirSync(path.join(RAIZ, "src/packs/ameacas")).find((n) => n.startsWith("Actor_Humano_Mercenario_"));
	const a = JSON.parse(fs.readFileSync(path.join(RAIZ, "src/packs/ameacas", f), "utf8"));
	const e = a.items.find((i) => i.name === "Espada longa");
	assert.match(e._stats.compendiumSource, /^Compendium\.giria-t20\./);
	assert.equal(e.img, "systems/tormenta20/icons/itens/equipamentos/espada-longa.webp");
	assert.equal(e.system.rolls.find((r) => r.type === "dano").parts[0][0], "1d8+6");
});
