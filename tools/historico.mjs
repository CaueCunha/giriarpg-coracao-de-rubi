/**
 * Semeia src/historico.json com as assinaturas de cada documento em todas as versões já commitadas de src/packs
 * (todas as branches). A atualização opcional do módulo usa essa lista para saber se um documento do mundo é
 * igual a alguma versão publicada (pode atualizar) ou se foi editado à mão (fica como está).
 *
 * O build acrescenta a assinatura atual a cada build; este script só precisa rodar de novo se a função de
 * assinatura (scripts/assinatura.mjs) mudar. Uso: node tools/historico.mjs
 */
import fs from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { assinatura } from "../scripts/assinatura.mjs";
import { RAIZ, HISTORICO } from "./caminhos.mjs";

const DOCUMENTO = { actors: "Actor", items: "Item", journal: "JournalEntry", tables: "RollTable", macros: "Macro" };
const git = (...args) => execFileSync("git", args, { cwd: RAIZ, encoding: "utf8", maxBuffer: 1 << 28 });

export function semear({ base = {} } = {}) {
	const commits = git("log", "--all", "--format=%H", "--", "src/packs").split("\n").filter(Boolean);
	const blobs = new Set();
	for (const c of commits) {
		for (const linha of git("ls-tree", "-r", c, "--", "src/packs").split("\n")) {
			const m = linha.match(/^\d+ blob ([0-9a-f]+)\t(.+\.json)$/);
			if (m && !m[2].split("/").at(-1).startsWith("_Folder")) blobs.add(m[1]);
		}
	}
	// lê todos os blobs de uma vez
	const r = spawnSync("git", ["cat-file", "--batch"], { cwd: RAIZ, input: [...blobs].join("\n") + "\n", maxBuffer: 1 << 30 });
	const saida = r.stdout;
	const historico = structuredClone(base);
	let pos = 0;
	while (pos < saida.length) {
		const fim = saida.indexOf(10, pos);
		const [, , tamanho] = saida.subarray(pos, fim).toString().split(" ");
		const corpo = saida.subarray(fim + 1, fim + 1 + Number(tamanho)).toString("utf8");
		pos = fim + 1 + Number(tamanho) + 1;
		let doc;
		try {
			doc = JSON.parse(corpo);
		} catch {
			continue;
		}
		const documento = DOCUMENTO[doc._key?.split("!")[1]];
		if (!documento || !doc._id) continue;
		const lista = (historico[doc._id] ??= []);
		const a = assinatura(doc, documento);
		if (!lista.includes(a)) lista.push(a);
	}
	return { historico, commits: commits.length, versoes: blobs.size };
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const { historico, commits, versoes } = semear();
	fs.writeFileSync(HISTORICO, `${JSON.stringify(Object.fromEntries(Object.entries(historico).sort(([a], [b]) => a.localeCompare(b))), null, "\t")}\n`);
	console.log(`${Object.keys(historico).length} documentos, ${versoes} versões de ${commits} commits → src/historico.json`);
}
