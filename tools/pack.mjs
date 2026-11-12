/**
 * Compila as fontes JSON (src/packs) nos compêndios LevelDB (packs/) que o Foundry lê.
 * Uso: node tools/pack.mjs            compila
 *      node tools/pack.mjs --extrair  extrai packs/ de volta para build/extraido (conferência)
 */
import fs from "node:fs";
import path from "node:path";
import { compilePack, extractPack } from "@foundryvtt/foundryvtt-cli";
import { FONTE_PACKS, PACKS, RAIZ } from "./caminhos.mjs";

export async function compilar({ silencioso = false } = {}) {
	const manifesto = JSON.parse(fs.readFileSync(path.join(RAIZ, "module.json"), "utf8"));
	fs.rmSync(PACKS, { recursive: true, force: true });
	fs.mkdirSync(PACKS, { recursive: true });
	for (const p of manifesto.packs) {
		const fonte = path.join(FONTE_PACKS, p.name);
		if (!fs.existsSync(fonte)) throw new Error(`Fonte do compêndio ${p.name} não existe (${fonte}). Rode npm run build.`);
		await compilePack(fonte, path.join(RAIZ, p.path), { log: false, recursive: true });
		if (!silencioso) console.log(`  compilado ${p.name}`);
	}
}

export async function extrair(destino = path.join(RAIZ, "build", "extraido")) {
	const manifesto = JSON.parse(fs.readFileSync(path.join(RAIZ, "module.json"), "utf8"));
	fs.rmSync(destino, { recursive: true, force: true });
	for (const p of manifesto.packs) {
		await extractPack(path.join(RAIZ, p.path), path.join(destino, p.name), { log: false, documentType: p.type, clean: false });
	}
	return destino;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	(process.argv.includes("--extrair") ? extrair().then((d) => console.log(`extraído em ${d}`)) : compilar()).catch((err) => {
		console.error(err);
		process.exit(1);
	});
}
