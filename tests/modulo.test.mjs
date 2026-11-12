/**
 * O pacote que vai para o Foundry: compila as fontes em LevelDB com o foundryvtt-cli (o mesmo
 * formato que o Foundry v14 lê), extrai de volta e compara com as fontes.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { manifesto, criarMundo } from "./ajudantes.mjs";
import { compilar, extrair } from "../tools/pack.mjs";
import { lerPackFonte } from "../tools/sim/sistema.mjs";
import { FONTE_PACKS, RAIZ } from "../tools/caminhos.mjs";
import { PRESERVAR as preservarBuild, MODULO } from "../tools/conteudo.mjs";

test("compilar e extrair os compêndios devolve os mesmos documentos", async () => {
	await compilar({ silencioso: true });
	const destino = fs.mkdtempSync(path.join(os.tmpdir(), "cdr-extraido-"));
	try {
		await extrair(destino);
		for (const p of manifesto().packs) {
			assert.ok(fs.existsSync(path.join(RAIZ, p.path, "CURRENT")), `${p.path} não é um LevelDB`);
			const fonte = lerPackFonte(path.join(FONTE_PACKS, p.name));
			const volta = lerPackFonte(path.join(destino, p.name));
			const ids = (l) => l.map((d) => d._id).sort();
			assert.deepEqual(ids(volta.docs), ids(fonte.docs), `${p.name}: documentos diferentes`);
			assert.deepEqual(ids(volta.pastas), ids(fonte.pastas), `${p.name}: pastas diferentes`);
			const porId = new Map(fonte.docs.map((d) => [d._id, d]));
			for (const d of volta.docs) {
				const f = porId.get(d._id);
				assert.equal(d.name, f.name);
				for (const campo of ["items", "effects", "pages", "results"]) assert.equal(d[campo]?.length ?? 0, f[campo]?.length ?? 0, `${p.name}: ${d.name}.${campo}`);
			}
		}
	} finally {
		fs.rmSync(destino, { recursive: true, force: true });
	}
});

test("o script do módulo preserva os mesmos valores que o build", async () => {
	// o script do módulo usa os globais do Foundry (Hooks, game...): carrega dentro do mundo simulado
	const mundo = await criarMundo({ semente: "modulo" });
	const { PRESERVAR: preservarModulo } = await import("../scripts/cdr.mjs?modulo-test");
	mundo.encerrar();
	assert.deepEqual(preservarModulo, preservarBuild);
});

test("versão do module.json acompanha o package.json e o link de download", () => {
	const m = manifesto();
	const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, "package.json"), "utf8"));
	assert.equal(m.version, pkg.version);
	assert.equal(m.id, MODULO);
	assert.match(m.manifest, /\/releases\/latest\/download\/module\.json$/);
	assert.ok(m.download.endsWith(`/releases/download/v${m.version}/module.zip`), m.download);
	const lang = JSON.parse(fs.readFileSync(path.join(RAIZ, "lang/pt-BR.json"), "utf8"));
	const usadas = [...fs.readFileSync(path.join(RAIZ, "scripts/cdr.mjs"), "utf8").matchAll(/i18n\.(?:localize|format)\("([^"]+)"/g)].map((x) => x[1]);
	for (const k of usadas) assert.ok(k.split(".").reduce((o, p) => o?.[p], lang) ?? lang[k], `tradução ${k} não existe`);
});
