/**
 * Assinatura de um documento do Coração de Rubi: um resumo (8 dígitos hexadecimais) do conteúdo que o Mestre
 * poderia corrigir à mão. Serve para a atualização opcional saber, sem perguntar, se um documento do mundo
 * ainda é igual a alguma versão publicada do módulo (então pode ser atualizado) ou se foi editado (fica como está).
 *
 * Entra: nome, imagem, tipo, system, flags.world e flags.tormenta20, comando, fórmula, texto das páginas,
 * resultados de tabela, efeitos e itens embutidos (recursivo).
 * Fica de fora o que muda sozinho na mesa ou na importação: IDs, _stats, pasta, ordem, permissões, flags de
 * outros módulos, ligado/desligado dos efeitos, PV e PM atuais e os valores de PRESERVAR.
 * Links para documentos do módulo contam iguais no mundo e no compêndio (`Actor.X` = `Compendium.<mod>.<pack>.Actor.X`),
 * e o ID dentro deles não conta (um documento arrastado do compêndio ganha outro ID no mundo).
 *
 * Este arquivo não usa globais do Foundry: o build (Node) e o módulo usam a mesma função.
 */
export const MODULO = "giriarpg-coracao-de-rubi";

/**
 * Token padrão de toda ameaça do módulo (pedido do Cauê, 13/11/2026): nome ao passar o mouse (qualquer um), visão
 * ligada, barras sempre visíveis para o dono, PV na barra 1 e PM na barra 2 (attributes.pm, azul).
 * O Cauê usa o Bar Brawl (fork T20), que desenha as barras com as cores gravadas em flags.barbrawl.resourceBars e,
 * sem elas, cria a barra 2 com as cores da barra 1 (vermelho/verde). Por isso as duas barras vão explícitas,
 * com as cores padrão do Bar Brawl (PV vermelho→verde, PM azul).
 */
const barra = (id, order, attribute, mincolor, maxcolor) => ({
	id,
	order,
	attribute,
	mincolor,
	maxcolor,
	position: "bottom-inner",
	gmVisibility: -1, // herda do dono
	ownerVisibility: 50, // sempre
	otherVisibility: 0 // nunca
});
export const BARRAS_BARBRAWL = Object.freeze({
	bar1: barra("bar1", 0, "attributes.pv", "#FF0000", "#80FF00"),
	bar2: barra("bar2", 1, "attributes.pm", "#000080", "#80B3FF")
});
export const TOKEN_PADRAO = Object.freeze({
	displayName: 30, // CONST.TOKEN_DISPLAY_MODES.HOVER
	displayBars: 40, // CONST.TOKEN_DISPLAY_MODES.OWNER
	sight: { enabled: true },
	bar1: { attribute: "attributes.pv" },
	bar2: { attribute: "attributes.pm" },
	flags: { barbrawl: { resourceBars: BARRAS_BARBRAWL } }
});

/** Valores que a mesa muda e que sobrevivem a uma atualização. Mantenha igual a tools/conteudo.mjs. */
export const PRESERVAR = [];

const FORA = new Set(["_id", "_key", "_stats", "folder", "sort", "ownership", "disabled", "origin"]);
const ESTADO_DA_MESA = [
	["attributes", "pv", "value"],
	["attributes", "pv", "temp"],
	["attributes", "pm", "value"],
	["attributes", "pm", "temp"]
];

const RE_LINK = new RegExp(`Compendium\\.${MODULO.replace(/-/g, "\\-")}\\.[A-Za-z0-9_-]+\\.(Actor|Item|JournalEntry|RollTable|Macro)\\.`, "g");

/** Troca os links para o compêndio do módulo pela forma do mundo (para comparar). */
export const linkDoMundo = (s) => String(s).replace(RE_LINK, "$1.");

/** Para comparar, o ID dentro dos links não conta: um documento arrastado para o mundo ganha outro ID. */
const semIds = (s) => linkDoMundo(s).replace(/(?<![.\w])(Actor|Item|JournalEntry|RollTable|Macro)\.[A-Za-z0-9]{16}/g, "$1.*");

const vazio = (v) => v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length) || (typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length);

/** Cópia limpa: sem chaves de fora, sem valores vazios, links normalizados e arrays de documentos em ordem. */
function limpar(v, chave) {
	if (typeof v === "string") return semIds(v);
	if (Array.isArray(v)) {
		const lista = v.map((x) => limpar(x)).filter((x) => !vazio(x));
		// embutidos (efeitos, itens, páginas, resultados) vêm em ordem qualquer: ordena pelo conteúdo
		if (["effects", "items", "pages", "results"].includes(chave)) lista.sort((a, b) => estavel(a).localeCompare(estavel(b)));
		return lista;
	}
	if (v && typeof v === "object") {
		const out = {};
		for (const k of Object.keys(v)) {
			if (FORA.has(k)) continue;
			const x = limpar(v[k], k);
			if (!vazio(x)) out[k] = x;
		}
		return out;
	}
	return v;
}

/** JSON com as chaves em ordem: a mesma estrutura dá o mesmo texto. */
export function estavel(v) {
	if (Array.isArray(v)) return `[${v.map(estavel).join(",")}]`;
	if (v && typeof v === "object") {
		return `{${Object.keys(v)
			.sort()
			.filter((k) => v[k] !== undefined)
			.map((k) => `${JSON.stringify(k)}:${estavel(v[k])}`)
			.join(",")}}`;
	}
	return JSON.stringify(v ?? null);
}

const apagar = (o, partes) => {
	let p = o;
	for (let i = 0; p && i < partes.length - 1; i++) p = p[partes[i]];
	if (p && typeof p === "object") delete p[partes.at(-1)];
};

/** Só as partes do documento que contam. */
function projetar(doc, documento) {
	const flags = { world: structuredClone(doc.flags?.world ?? {}), tormenta20: doc.flags?.tormenta20 ?? null };
	const system = structuredClone(doc.system ?? {});
	if (documento === "Actor" || doc.items) for (const c of ESTADO_DA_MESA) apagar(system, c);
	const role = doc.flags?.world?.cdrRole;
	for (const p of PRESERVAR) {
		if (p.documento !== documento || p.role !== role) continue;
		for (const c of p.caminhos) apagar({ system, flags }, c.split("."));
	}
	const sub = (lista, tipo) => (lista ?? []).map((e) => projetar(e, tipo));
	return {
		name: doc.name,
		type: doc.type,
		img: doc.img,
		system,
		flags,
		command: doc.command,
		formula: doc.formula,
		replacement: doc.replacement,
		text: doc.text,
		src: doc.src,
		range: doc.range,
		weight: doc.weight,
		description: doc.description,
		documentUuid: doc.documentUuid,
		changes: doc.changes,
		statuses: doc.statuses,
		duration: doc.duration ? { value: doc.duration.value, units: doc.duration.units } : undefined,
		token: doc.prototypeToken ? { name: doc.prototypeToken.name, src: doc.prototypeToken.texture?.src, w: doc.prototypeToken.width, h: doc.prototypeToken.height } : undefined,
		items: sub(doc.items, "Item"),
		effects: sub(doc.effects, "ActiveEffect"),
		pages: sub(doc.pages, "JournalEntryPage"),
		results: sub(doc.results, "TableResult")
	};
}

/**
 * @param {object} doc        documento (toObject() no Foundry ou o JSON das fontes)
 * @param {string} documento  Actor, Item, JournalEntry, RollTable ou Macro
 * @returns {string} 8 dígitos hexadecimais
 */
export function assinatura(doc, documento) {
	const texto = estavel(limpar(projetar(doc, documento)));
	let h = 0x811c9dc5;
	for (let i = 0; i < texto.length; i++) {
		h ^= texto.charCodeAt(i);
		h = Math.imul(h, 0x01000193) >>> 0;
	}
	return h.toString(16).padStart(8, "0");
}
