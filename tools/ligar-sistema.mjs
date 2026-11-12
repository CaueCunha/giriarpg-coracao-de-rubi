/**
 * Liga o conteúdo da campanha ao que já existe no sistema Tormenta20, para não duplicar regra:
 *
 *  - Magia de NPC com o nome de uma magia do sistema: vira a magia do sistema (descrição completa,
 *    aprimoramentos e efeitos de automação do sistema), com o custo, a CD, as rolagens e os efeitos
 *    próprios da ficha do livro por cima. A nota da ficha fica no topo da descrição.
 *  - Poder, habilidade, arma, armadura ou consumível com o nome de um item do sistema: mantém os
 *    números da ficha da aventura (o NPC do livro não é igual ao poder de personagem), ganha
 *    _stats.compendiumSource apontando para o item do sistema e um link "No sistema" na descrição.
 *  - Habilidade com o nome de uma habilidade de ameaça do sistema (ex.: Drenar Sangue do Vampiro):
 *    ganha o link para a habilidade dentro da ameaça.
 *
 *  - Giria T20 (o compêndio de automações do Cauê): quando o Giria tem o item com o mesmo nome e tipo,
 *    a origem (_stats.compendiumSource) passa a ser a versão do Giria, que é a automatizada, e a
 *    descrição ganha o link "No Giria T20". Magia continua mesclada com a do sistema (a ficha do NPC
 *    precisa dos números dela), mas também ganha o link do Giria. O índice vem de src/giria-indice.json
 *    (tools/giria-indice.mjs), porque o repositório do Giria é privado.
 *
 * Tudo que é próprio da campanha fica como o gerador criou.
 */
import { deepClone, mergeObject } from "./sim/utils.mjs";

export const normalizar = (s) =>
	String(s)
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/\(.*?\)/g, "")
		.replace(/[^a-z0-9]+/g, " ")
		.trim();

/** Nomes genéricos demais para ligar a uma habilidade embutida numa ameaça qualquer. */
const GENERICOS = new Set(["garra", "garras", "mordida", "pancada", "pincas", "chifres", "chifrada", "cauda", "ferrao", "toque", "soco", "tentaculos", "bico", "pisotear"]);

/** Quando o sistema tem mais de um item com o mesmo nome. */
const PREFERIDOS = {
	engenhosidade: "Engenhosidade (Kliren)",
	evasao: "Evasão (Ladino)",
	emboscar: "Emboscar (Ladino)",
	"empatia selvagem": "Empatia Selvagem (Druida)",
	"escudo leve": "Escudo leve (Arma)"
};

const ORDEM_PC = ["tormenta20.magias", "tormenta20.poderes", "tormenta20.habilidades-de-criaturas", "tormenta20.equipamentos", "tormenta20.equipamentos-magicos", "tormenta20.pocoes", "tormenta20.parceiros"];
const ORDEM_NPC = ["tormenta20.magias", "tormenta20.habilidades-de-criaturas", "tormenta20.poderes", "tormenta20.equipamentos", "tormenta20.equipamentos-magicos", "tormenta20.pocoes", "tormenta20.parceiros"];

/** Índice nome → itens do Giria T20, a partir de src/giria-indice.json. */
export function indiceGiria(lista = []) {
	const m = new Map();
	for (const i of lista) {
		const k = normalizar(i.nome);
		if (!m.has(k)) m.set(k, []);
		m.get(k).push(i);
	}
	return m;
}

/** O item do Giria com o mesmo nome e tipo (o mais automatizado, se houver mais de um). */
const PESO_NIVEL = { script: 0, uso: 1, temporario: 2, alternavel: 3, passivo: 4, manual: 5 };
function escolherGiria(giria, item) {
	const cands = (giria?.get(normalizar(item.name)) ?? []).filter((c) => c.tipo === item.type);
	const exato = cands.filter((c) => c.nome === item.name);
	const lista = (exato.length ? exato : cands).sort((a, b) => (PESO_NIVEL[a.nivel] ?? 9) - (PESO_NIVEL[b.nivel] ?? 9));
	return lista[0] ?? null;
}

const linkGiria = (g) => `<p class="cdr-ref"><i>No Giria T20:</i> @UUID[${g.uuid}]{${g.nome}}</p>`;

export function indiceSistema(packs) {
	const itens = new Map();
	const embutidos = new Map();
	for (const [pid, p] of Object.entries(packs)) {
		if (p.type === "Item") {
			for (const d of p.docs) {
				const k = normalizar(d.name);
				if (!itens.has(k)) itens.set(k, []);
				itens.get(k).push({ pack: pid, doc: d, uuid: `Compendium.${pid}.Item.${d._id}` });
			}
		} else if (p.type === "Actor") {
			for (const a of p.docs) {
				for (const i of a.items ?? []) {
					const k = normalizar(i.name);
					if (!embutidos.has(k)) embutidos.set(k, []);
					embutidos.get(k).push({ pack: pid, ator: a, doc: i, uuid: `Compendium.${pid}.Actor.${a._id}.Item.${i._id}` });
				}
			}
		}
	}
	return { itens, embutidos };
}

function escolher(indice, item, donoNpc) {
	const k = normalizar(item.name);
	const cands = indice.itens.get(k) ?? [];
	const preferido = PREFERIDOS[k];
	const ordem = donoNpc ? ORDEM_NPC : ORDEM_PC;
	const porOrdem = (a, b) => ordem.indexOf(a.pack) - ordem.indexOf(b.pack);
	const mesmoTipo = cands.filter((c) => c.doc.type === item.type).sort(porOrdem);
	const pick = (lista) => (preferido && lista.find((c) => c.doc.name === preferido)) || lista[0];
	if (mesmoTipo.length) return { ...pick(mesmoTipo), mesmoTipo: true };
	if (cands.length && !GENERICOS.has(k)) return { ...pick([...cands].sort(porOrdem)), mesmoTipo: false };
	if (!GENERICOS.has(k)) {
		const emb = indice.embutidos.get(k)?.find((c) => c.doc.type === item.type) ?? indice.embutidos.get(k)?.[0];
		if (emb) return { ...emb, mesmoTipo: false, embutido: true };
	}
	return null;
}

const linkSistema = (ref) => `<p class="cdr-ref"><i>No sistema:</i> @UUID[${ref.uuid}]{${ref.doc.name}${ref.embutido ? ` (${ref.ator.name})` : ""}}</p>`;

/** Mescla a magia do sistema com a versão da ficha do NPC. */
function mesclarMagia(gerado, ref) {
	const s = deepClone(ref.doc);
	for (const k of ["_id", "_key", "folder", "sort", "ownership"]) delete s[k];
	const g = gerado.system;
	const out = {
		...s,
		_id: gerado._id,
		name: gerado.name,
		flags: mergeObject(deepClone(s.flags ?? {}), deepClone(gerado.flags ?? {}), { inplace: false }),
		_stats: { ...(s._stats ?? {}), compendiumSource: ref.uuid }
	};
	const sys = out.system;
	sys.preparada = true;
	if (g.ativacao?.custo !== undefined) sys.ativacao = { ...sys.ativacao, custo: g.ativacao.custo };
	if (g.rolls?.length) sys.rolls = deepClone(g.rolls);
	if (g.resistencia?.txt) sys.resistencia = { ...sys.resistencia, txt: g.resistencia.txt };
	const nota = g.description?.value ? `<div class="cdr-nota"><p><b>Nesta ficha (Coração de Rubi):</b></p>${g.description.value}</div><hr>` : "";
	sys.description = { ...sys.description, value: `${nota}${sys.description?.value ?? ""}` };
	// Efeitos: os aprimoramentos (onuse) do sistema sempre; o efeito base do sistema só se a ficha
	// não trouxe um efeito próprio (que tem os números do NPC).
	const proprios = deepClone(gerado.effects ?? []);
	const temBase = proprios.some((e) => !e.system?.onuse);
	const doSistema = (s.effects ?? []).filter((e) => e.system?.onuse || !temBase).map((e) => {
		const c = deepClone(e);
		delete c._key;
		return c;
	});
	const ids = new Set(proprios.map((e) => e._id));
	out.effects = [...doSistema.filter((e) => !ids.has(e._id)), ...proprios];
	return out;
}

/**
 * Aplica as ligações a todos os documentos capturados de um ato. Retorna um registro
 * [{ ato, dono, item, tipo, acao, uuid }] para o relatório do build.
 */
export function ligarAoSistema(docs, indice, ato, giria = null) {
	const registro = [];
	const tratar = (item, dono) => {
		if (!["magia", "poder", "arma", "equipamento", "consumivel", "tesouro"].includes(item.type)) return item;
		const g = GENERICOS.has(normalizar(item.name)) ? null : escolherGiria(giria, item);
		const comGiria = (doc) => {
			if (!g) return doc;
			if (doc.type !== "magia") doc._stats = { ...(doc._stats ?? {}), compendiumSource: g.uuid };
			const desc = doc.system?.description?.value ?? "";
			if (!desc.includes(g.uuid)) {
				doc.system ??= {};
				doc.system.description = { ...(doc.system.description ?? {}), value: `${desc}${linkGiria(g)}` };
			}
			registro.push({ ato, dono: dono?.name ?? "(item)", item: item.name, tipo: item.type, acao: doc.type === "magia" ? "link para o Giria T20" : `origem no Giria T20 (${g.nivel ?? "?"})`, uuid: g.uuid });
			return doc;
		};
		const ligado = tratarSistema(item, dono);
		return comGiria(ligado === item ? deepClone(item) : ligado);
	};
	const tratarSistema = (item, dono) => {
		if (item._stats?.compendiumSource?.startsWith("Compendium.tormenta20.")) {
			registro.push({ ato, dono: dono?.name ?? "(item)", item: item.name, tipo: item.type, acao: "já era cópia do sistema", uuid: item._stats.compendiumSource });
			return item;
		}
		const ref = escolher(indice, item, dono?.type === "npc");
		if (!ref) return item;
		if (item.type === "magia" && ref.mesmoTipo) {
			registro.push({ ato, dono: dono?.name ?? "(item)", item: item.name, tipo: item.type, acao: "magia do sistema + ficha do NPC", uuid: ref.uuid });
			return mesclarMagia(item, ref);
		}
		const novo = deepClone(item);
		if (ref.mesmoTipo && !ref.embutido) novo._stats = { ...(novo._stats ?? {}), compendiumSource: ref.uuid };
		const desc = novo.system?.description?.value ?? "";
		if (!desc.includes(ref.uuid)) {
			novo.system ??= {};
			novo.system.description = { ...(novo.system.description ?? {}), value: `${desc}${linkSistema(ref)}` };
		}
		registro.push({ ato, dono: dono?.name ?? "(item)", item: item.name, tipo: item.type, acao: ref.mesmoTipo && !ref.embutido ? "ficha do livro + origem no sistema" : "link para o sistema", uuid: ref.uuid });
		return novo;
	};
	for (const d of docs.Actor ?? []) d.items = (d.items ?? []).map((i) => tratar(i, d));
	docs.Item = (docs.Item ?? []).map((i) => tratar(i, null));
	return registro;
}

/**
 * Troca os marcadores do Giria nos documentos gerados:
 *   @GIRIA[Nome|livro]{rótulo} → @UUID[uuid do Giria]{rótulo}
 *   @GIRIA_UUID[Nome|livro]    → uuid do Giria (para flags de automação)
 * O livro (T20, AdA...) escolhe entre versões com o mesmo nome. Marcador sem item no índice quebra o build.
 */
export function resolverGiria(docs, lista) {
	const porNome = new Map();
	for (const i of lista) {
		const k = normalizar(i.nome);
		if (!porNome.has(k)) porNome.set(k, []);
		porNome.get(k).push(i);
	}
	const faltando = new Set();
	const achar = (nome, livro) => {
		const c = porNome.get(normalizar(nome)) ?? [];
		const r = c.find((i) => i.nome === nome && (!livro || i.livro === livro)) ?? c.find((i) => !livro || i.livro === livro);
		if (!r) faltando.add(`${nome}${livro ? ` (${livro})` : ""}`);
		return r?.uuid;
	};
	const RE = /@GIRIA(_UUID)?\[([^\]|]+)(?:\|([^\]]+))?\]/g;
	for (const [tipo, lista2] of Object.entries(docs)) {
		docs[tipo] = lista2.map((d) => {
			const txt = JSON.stringify(d);
			if (!txt.includes("@GIRIA")) return d;
			return JSON.parse(txt.replace(RE, (_, soUuid, nome, livro) => {
				const u = achar(nome, livro);
				return u ? (soUuid ? u : `@UUID[${u}]`) : _;
			}));
		});
	}
	if (faltando.size) throw new Error(`Marcadores @GIRIA sem item no índice do Giria: ${[...faltando].join(", ")}`);
}

