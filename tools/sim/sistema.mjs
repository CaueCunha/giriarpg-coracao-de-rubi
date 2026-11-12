/**
 * Carrega, do código-fonte do sistema Tormenta20, o que a simulação usa de verdade:
 *  - T20 (config: perícias, tipos de dano, condições...)
 *  - os modelos de dados (Actor/Item/ActiveEffect), para validar documentos como o Foundry
 *  - os compêndios (fontes JSON em src/packs), para clonar ameaças e referenciar magias e poderes
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { T20_DIR } from "../caminhos.mjs";

let carregado = null;

// O sistema não declara "type": "module"; o Node avisa ao importar o T20.js. O aviso é inofensivo
// e, sem isso, apareceria como console.error no meio da execução das macros.
const emitirAviso = process.emitWarning.bind(process);
process.emitWarning = (aviso, ...resto) => {
	const codigo = typeof resto[0] === "object" ? resto[0]?.code : resto[1];
	if (codigo === "MODULE_TYPELESS_PACKAGE_JSON" || String(aviso).includes("MODULE_TYPELESS_PACKAGE_JSON")) return;
	return emitirAviso(aviso, ...resto);
};

/** Lê as fontes JSON de um compêndio do sistema (formato do foundryvtt-cli, com pastas). */
export function lerPackFonte(dir) {
	const docs = [];
	const pastas = [];
	const visitar = (d) => {
		for (const nome of fs.readdirSync(d)) {
			const p = path.join(d, nome);
			if (fs.statSync(p).isDirectory()) visitar(p);
			else if (nome.endsWith(".json")) {
				const data = JSON.parse(fs.readFileSync(p, "utf8"));
				if (data._key?.startsWith("!folders!")) pastas.push(data);
				else docs.push(data);
			}
		}
	};
	visitar(dir);
	return { docs, pastas };
}

export function infoSistema() {
	return JSON.parse(fs.readFileSync(path.join(T20_DIR, "system.json"), "utf8"));
}

/**
 * Importa os módulos do sistema. Precisa que globalThis.foundry/CONFIG já existam
 * (ver globais.mjs). Retorna { T20, modelos: {Actor, Item, ActiveEffect}, packs }.
 */
export async function carregarSistema() {
	if (carregado) return carregado;
	if (!fs.existsSync(path.join(T20_DIR, "system.json"))) {
		throw new Error(`Sistema Tormenta20 não encontrado em ${T20_DIR}. Rode "npm run setup".`);
	}
	const url = (rel) => pathToFileURL(path.join(T20_DIR, rel)).href;

	const { T20 } = await import(url("module/config/T20.js"));
	globalThis.T20 = T20;
	globalThis.CONFIG.T20 = T20;
	const fieldsSis = await import(url("module/dataModel/fields/_module.mjs"));
	globalThis.tormenta20 ??= {};
	globalThis.tormenta20.data = { fields: fieldsSis };
	globalThis.tormenta20.config = T20;
	const dm = await import(url("module/dataModel/_module.mjs"));
	globalThis.tormenta20.data.models = dm;
	const efeito = await import(url("module/data/effect/_module.mjs"));

	const modelos = {
		Actor: { bases: dm.BasesData, character: dm.CharacterData, npc: dm.MenaceData, simple: dm.SimpleData, hazard: dm.HazardData },
		Item: {
			arma: dm.WeaponData, classe: dm.ClassData, comodo: dm.RoomData, consumivel: dm.ConsumableData, equipamento: dm.EquipmentData,
			magia: dm.SpellData, mobilia: dm.FurnitureData, poder: dm.PowerData, race: dm.RaceData, tesouro: dm.LootData
		},
		ActiveEffect: { base: efeito.BaseEffect }
	};

	const sys = infoSistema();
	const packs = {};
	for (const p of sys.packs) {
		const dir = path.join(T20_DIR, "src", "packs", p.name);
		if (!fs.existsSync(dir)) continue;
		packs[`tormenta20.${p.name}`] = { ...p, ...lerPackFonte(dir) };
	}

	carregado = { T20, modelos, packs, versao: sys.version };
	return carregado;
}
