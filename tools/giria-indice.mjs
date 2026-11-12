/**
 * Gera src/giria-indice.json: índice (nome → uuid) dos itens do módulo Giria T20, o compêndio de
 * automações do Cauê. O build usa esse índice para apontar itens, poderes e magias das aventuras
 * para a versão automatizada do Giria em vez de duplicar a regra.
 *
 * O repositório do Giria é privado, então o índice fica versionado aqui e o CI não precisa dele.
 * Para atualizar: clone o giria-t20 e rode
 *   node tools/giria-indice.mjs ../giria-t20
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const giria = path.resolve(process.argv[2] ?? process.env.GIRIA_T20 ?? "../giria-t20");
const { mapearFontes } = await import(pathToFileURL(path.join(giria, "tools/rotas.mjs")).href);
const commit = (() => {
	try {
		const head = fs.readFileSync(path.join(giria, ".git/HEAD"), "utf8").trim();
		return head.startsWith("ref:") ? fs.readFileSync(path.join(giria, ".git", head.slice(5)), "utf8").trim() : head;
	} catch {
		return null;
	}
})();

const { entradas } = await mapearFontes();
const itens = entradas
	.filter((e) => e.fonte.type === "Item" && e.doc?._id && e.doc?.name)
	.map((e) => ({
		nome: e.doc.name,
		tipo: e.doc.type,
		uuid: `Compendium.giria-t20.${e.pack}.Item.${e.doc._id}`,
		nivel: e.doc.flags?.["giria-t20"]?.automacao?.nivel ?? null,
		livro: e.doc.flags?.["giria-t20"]?.fonte?.livro ?? null
	}))
	.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR") || a.uuid.localeCompare(b.uuid));

const saida = { commit, gerado: new Date().toISOString().slice(0, 10), itens };
// Uma linha por item: o diff fica legível quando o Giria muda.
const linhas = itens.map((i) => `\t\t${JSON.stringify(i)}`).join(",\n");
fs.writeFileSync(path.join(RAIZ, "src/giria-indice.json"), `{\n\t"commit": ${JSON.stringify(commit)},\n\t"gerado": "${saida.gerado}",\n\t"itens": [\n${linhas}\n\t]\n}\n`);
console.log(`Índice do Giria T20: ${itens.length} itens (commit ${commit?.slice(0, 8) ?? "?"})`);
