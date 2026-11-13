/**
 * Gera src/giria-docs.json: cópia dos itens refinados do Giria T20 que o conteúdo da campanha usa.
 *
 * O build (tools/ligar-sistema.mjs) troca cada arma, poder, consumível, equipamento, tesouro ou magia
 * que tenha o mesmo nome e tipo de um item do Giria pela versão do Giria (arte, descrição, automação),
 * ajustando só os números da ficha do livro. Habilidades que só existem dentro de ameaças do Giria
 * emprestam a arte. Como o repositório do Giria é privado (o CI não o alcança), a cópia fica versionada aqui.
 *
 * Para atualizar (depois de rodar `npm run build` uma vez, para os nomes novos aparecerem em src/packs):
 *   cd ../giria-t20 && node tools/abrir-lotes.mjs && node tools/build-packs.mjs && cd -
 *   node tools/giria-indice.mjs ../giria-t20
 *   node tools/giria-docs.mjs ../giria-t20
 *   npm run build
 */
import fs from "node:fs";
import path from "node:path";
import { normalizar, GENERICOS } from "./ligar-sistema.mjs";
import { RAIZ } from "./caminhos.mjs";

const giria = path.resolve(process.argv[2] ?? process.env.GIRIA_T20 ?? "../giria-t20");
const STAGING = path.join(giria, "dist", "staging");
if (!fs.existsSync(STAGING)) {
	console.error(`✖ ${STAGING} não existe. Rode no Giria: node tools/abrir-lotes.mjs && node tools/build-packs.mjs`);
	process.exit(1);
}
const TIPOS = new Set(["arma", "poder", "consumivel", "equipamento", "tesouro", "magia"]);
const chave = (nome, tipo) => `${normalizar(nome)}|${tipo}`;

// Nomes e tipos usados pela campanha (itens soltos e itens dentro de atores).
const usados = new Set();
const varrer = (dir) => {
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) varrer(p);
		else if (e.name.endsWith(".json")) {
			const d = JSON.parse(fs.readFileSync(p, "utf8"));
			for (const i of Array.isArray(d.items) ? d.items : [d]) if (TIPOS.has(i.type)) usados.add(chave(i.name, i.type));
		}
	}
};
varrer(path.join(RAIZ, "src", "packs"));

const limpar = (d) => {
	const c = structuredClone(d);
	for (const k of ["folder", "sort", "ownership", "_key"]) delete c[k];
	return c;
};

const itens = {};
const imagens = {};
for (const pack of fs.readdirSync(STAGING).sort()) {
	const dir = path.join(STAGING, pack);
	if (!fs.statSync(dir).isDirectory()) continue;
	for (const f of fs.readdirSync(dir).sort()) {
		if (!f.endsWith(".json")) continue;
		const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
		if (!d.type || d._key?.startsWith("!folders")) continue;
		if (d.type === "npc") {
			for (const i of d.items ?? []) {
				const k = chave(i.name, i.type);
				if (usados.has(k) && i.img && !imagens[k]) imagens[k] = i.img;
			}
		} else if (TIPOS.has(d.type) && usados.has(chave(d.name, d.type)) && !GENERICOS.has(normalizar(d.name))) {
			itens[`Compendium.giria-t20.${pack}.Item.${d._id}`] = limpar(d);
		}
	}
}

const commit = (() => {
	try {
		const head = fs.readFileSync(path.join(giria, ".git/HEAD"), "utf8").trim();
		return head.startsWith("ref:") ? fs.readFileSync(path.join(giria, ".git", head.slice(5)), "utf8").trim() : head;
	} catch {
		return null;
	}
})();

const ord = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
const linhas = (o) => Object.entries(ord(o)).map(([k, v]) => `\t\t${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(",\n");
fs.writeFileSync(
	path.join(RAIZ, "src/giria-docs.json"),
	`{\n\t"commit": ${JSON.stringify(commit)},\n\t"itens": {\n${linhas(itens)}\n\t},\n\t"imagens": {\n${linhas(imagens)}\n\t}\n}\n`
);
console.log(`Itens do Giria T20 copiados: ${Object.keys(itens).length}; artes de habilidades de ameaças: ${Object.keys(imagens).length} (commit ${commit?.slice(0, 8) ?? "?"})`);
