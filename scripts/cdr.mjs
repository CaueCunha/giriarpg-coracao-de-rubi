/**
 * Coração de Rubi · módulo da campanha (Foundry v14 + Tormenta20 1.6.x)
 *
 * O conteúdo fica nos compêndios do módulo, um por tipo (Ameaças e NPCs, Poderes, Itens, Diários, Tabelas e
 * Macros), com uma pasta por patamar e as pastas das aventuras dentro. NADA vai para o mundo sozinho:
 *   - o Mestre arrasta do compêndio o que quiser, ou usa "Puxar do compêndio" para trazer aventuras inteiras
 *     (só cria o que falta, com os mesmos IDs, e nunca mexe no que já está no mundo);
 *   - "Atualizar do compêndio" lista os documentos do mundo que vieram do módulo e mudaram numa versão nova.
 *     Cada documento tem uma assinatura (scripts/assinatura.mjs) e o compêndio guarda as de todas as versões
 *     publicadas. Documento do mundo igual a alguma delas pode ser atualizado (vem marcado); diferente de
 *     todas foi editado à mão e fica como está.
 *
 * As macros da campanha procuram atores, tabelas, diários e outras macros no MUNDO pelas marcas
 * flags.world.cdr/cdrRole: puxe a aventura antes de usar as macros dela.
 */
import { MODULO, PRESERVAR, assinatura } from "./assinatura.mjs";
import { ligarAutomacoes, curaLonien } from "./automacoes.mjs";

export { PRESERVAR };

const TIPOS = ["Actor", "Item", "JournalEntry", "RollTable", "Macro"];
const CAMPOS_INDICE = [`flags.${MODULO}`, "flags.world.cdr", "flags.world.cdrRole", "folder"];

const modulo = () => game.modules.get(MODULO);
const colecao = (tipo) => game.collections?.get?.(tipo) ?? { Actor: game.actors, Item: game.items, JournalEntry: game.journal, RollTable: game.tables, Macro: game.macros, Folder: game.folders }[tipo];
const classe = (tipo) => CONFIG[tipo]?.documentClass ?? globalThis[tipo];
const marca = (d) => d?.flags?.world?.cdr ?? d?.getFlag?.("world", "cdr");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const nomeTipo = (t, n = 2) => {
	const k = `DOCUMENT.${t}${n > 1 ? "s" : ""}`;
	const s = game.i18n?.localize?.(k);
	return s && s !== k ? s : t;
};
const RE_COMP = new RegExp(`Compendium\\.${MODULO.replace(/-/g, "\\-")}\\.([A-Za-z0-9_-]+)\\.(Actor|Item|JournalEntry|RollTable|Macro)\\.([A-Za-z0-9]{16})`, "g");

/** Compêndios do módulo. */
export const packs = () => game.packs.filter((p) => p.metadata?.packageName === MODULO);

/** Atos descritos no module.json. */
export function atos() {
	const info = modulo()?.flags?.[MODULO]?.atos ?? {};
	return Object.entries(info).map(([id, a]) => ({ id, rotulo: a.rotulo }));
}

/* ------------------------------------------------------------------------ */
/* Catálogo: o que há nos compêndios e o que já está no mundo               */
/* ------------------------------------------------------------------------ */

/**
 * Entradas dos compêndios, com o ato e a aventura (nome da pasta) de cada uma.
 * @returns {Promise<{pack, tipo: string, id: string, uuid: string, nome: string, marca: string, ato: string, aventura: string, assinatura: string, assinaturas: string[], antigo: string}[]>}
 */
export async function catalogo() {
	const out = [];
	for (const pack of packs()) {
		const indice = await pack.getIndex({ fields: CAMPOS_INDICE });
		const pasta = (id) => pack.folders?.get?.(id);
		for (const e of indice) {
			const f = foundry.utils.getProperty(e, `flags.${MODULO}`) ?? {};
			let p = pasta(e.folder);
			// a aventura é a pasta logo abaixo da pasta do ato
			while (p?.folder && (p.folder.folder ?? null)) p = p.folder;
			const aventura = p && p.folder ? p.name : "";
			out.push({
				pack,
				tipo: pack.documentName,
				id: e._id,
				uuid: e.uuid ?? `Compendium.${pack.collection}.${pack.documentName}.${e._id}`,
				nome: e.name,
				marca: foundry.utils.getProperty(e, "flags.world.cdr"),
				role: foundry.utils.getProperty(e, "flags.world.cdrRole"),
				ato: f.ato ?? "",
				aventura,
				assinatura: f.assinatura,
				assinaturas: f.assinaturas ?? [],
				antigo: f.antigo
			});
		}
	}
	return out;
}

/**
 * Liga cada documento do mundo à entrada do compêndio de onde veio: pela origem gravada (`_stats.compendiumSource`,
 * também dos compêndios antigos por ato), pelo mesmo ID (importação com IDs) ou pela marca + tipo + nome (mundos que
 * rodaram os geradores antigos).
 * @returns {Map<string, Document>} uuid do compêndio → documento do mundo
 */
export function noMundo(cat) {
	const porId = new Map(cat.map((c) => [`${c.tipo}|${c.id}`, c]));
	const porNome = new Map();
	for (const c of cat) {
		const k = `${c.tipo}|${c.marca}|${c.nome}`;
		porNome.set(k, porNome.has(k) ? null : c);
	}
	const mapa = new Map();
	for (const tipo of TIPOS) {
		for (const d of colecao(tipo) ?? []) {
			const fonte = d._stats?.compendiumSource ?? "";
			const m = fonte.match(new RegExp(`^Compendium\\.${MODULO.replace(/-/g, "\\-")}\\.[^.]+\\.${tipo}\\.([A-Za-z0-9]{16})$`));
			const c = (m && porId.get(`${tipo}|${m[1]}`)) || porId.get(`${tipo}|${d.id}`) || (marca(d) ? porNome.get(`${tipo}|${marca(d)}|${d.name}`) : null);
			if (c && !mapa.has(c.uuid)) mapa.set(c.uuid, d);
		}
	}
	return mapa;
}

/** Troca links para o compêndio do módulo pelo documento do mundo, quando ele existe (id do compêndio → id do mundo). */
function linksParaMundo(dados, idsNoMundo) {
	const trocar = (s) => s.replace(RE_COMP, (m, _pack, tipo, id) => (idsNoMundo.has(`${tipo}|${id}`) ? `${tipo}.${idsNoMundo.get(`${tipo}|${id}`)}` : m));
	const visitar = (o, k) => {
		if (typeof o === "string") return k === "compendiumSource" ? o : trocar(o);
		if (Array.isArray(o)) return o.map((x) => visitar(x));
		if (!o || typeof o !== "object") return o;
		for (const [ck, v] of Object.entries(o)) o[ck] = visitar(v, ck);
		return o;
	};
	return visitar(dados);
}

/** id do compêndio → id do mundo, para todos os documentos do módulo que estão no mundo. */
const idsDoMundo = (cat, mapa) => new Map(cat.filter((c) => mapa.has(c.uuid)).map((c) => [`${c.tipo}|${c.id}`, mapa.get(c.uuid).id]));

/* ------------------------------------------------------------------------ */
/* Puxar do compêndio (só o que falta)                                       */
/* ------------------------------------------------------------------------ */

/** Pasta do mundo para uma pasta do compêndio: a mesma (pelo ID) se já existe; senão cria, com o pai antes. */
async function pastaNoMundo(pastaComp) {
	if (!pastaComp) return null;
	const existente = game.folders.get(pastaComp.id);
	if (existente) return existente.id;
	const pai = pastaComp.folder ? await pastaNoMundo(pastaComp.folder) : null;
	const dados = pastaComp.toObject();
	dados.folder = pai;
	const [nova] = await classe("Folder").createDocuments([dados], { keepId: true });
	return nova?.id ?? null;
}

/**
 * Traz para o mundo o que ainda não está nele. Nunca substitui nem apaga nada.
 * @param {object} filtro
 * @param {string[]} [filtro.atos]       atos inteiros (ato1, ato2, campanha)
 * @param {string[]} [filtro.aventuras]  "ato|nome da pasta da aventura"
 * @returns {Promise<{criados: number, existentes: number}|null>}
 */
export async function puxar({ atos: idsAtos = [], aventuras = [] } = {}) {
	if (!game.user.isGM) {
		ui.notifications.error("Só o Mestre pode puxar o conteúdo do Coração de Rubi.");
		return null;
	}
	const cat = await catalogo();
	const escolhidos = cat.filter((c) => idsAtos.includes(c.ato) || aventuras.includes(`${c.ato}|${c.aventura}`));
	if (!escolhidos.length) {
		ui.notifications.warn("Nada escolhido para puxar.");
		return null;
	}
	const mapa = noMundo(cat);
	const faltam = escolhidos.filter((c) => !mapa.has(c.uuid));
	const existentes = escolhidos.length - faltam.length;

	// IDs: os do compêndio, se estiverem livres no mundo (os links e as macros contam com eles)
	const ids = idsDoMundo(cat, mapa);
	for (const c of faltam) if (!colecao(c.tipo).get(c.id)) ids.set(`${c.tipo}|${c.id}`, c.id);

	let criados = 0;
	for (const tipo of TIPOS) {
		const lista = faltam.filter((c) => c.tipo === tipo);
		if (!lista.length) continue;
		const dados = [];
		const comId = [];
		for (const c of lista) {
			const doc = await c.pack.getDocument(c.id);
			if (!doc) continue;
			const o = linksParaMundo(doc.toObject(), ids);
			o.folder = await pastaNoMundo(doc.folder ?? null);
			o._stats ??= {};
			o._stats.compendiumSource = c.uuid;
			if (ids.get(`${tipo}|${c.id}`) === c.id) comId.push(o);
			else {
				delete o._id;
				dados.push(o);
			}
		}
		if (comId.length) criados += (await classe(tipo).createDocuments(comId, { keepId: true })).length;
		if (dados.length) criados += (await classe(tipo).createDocuments(dados)).length;
	}
	ui.notifications.info(`Coração de Rubi: ${criados} documento(s) puxado(s) do compêndio.${existentes ? ` ${existentes} já estavam no mundo e ficaram como estão.` : ""}`);
	Hooks.callAll(`${MODULO}.puxado`, { criados, existentes });
	return { criados, existentes };
}

/** Janela: escolha das aventuras (por ato) que vão para o mundo. */
export async function abrirPuxar() {
	if (!game.user.isGM) return ui.notifications.warn("Só o Mestre pode puxar o conteúdo do Coração de Rubi.");
	const cat = await catalogo();
	if (!cat.length) return ui.notifications.error("Coração de Rubi: nenhum compêndio do módulo foi encontrado.");
	const mapa = noMundo(cat);
	const grupos = new Map();
	for (const c of cat) {
		const k = `${c.ato}|${c.aventura}`;
		if (!grupos.has(k)) grupos.set(k, { ato: c.ato, aventura: c.aventura, total: 0, noMundo: 0 });
		const g = grupos.get(k);
		g.total++;
		if (mapa.has(c.uuid)) g.noMundo++;
	}
	const chaves = [...grupos.keys()];
	const blocos = atos()
		.map((a) => {
			const linhas = chaves
				.map((k, i) => ({ k, i, g: grupos.get(k) }))
				.filter(({ g }) => g.ato === a.id)
				.map(({ i, g }) => {
					const falta = g.total - g.noMundo;
					const estado = !falta ? "já está toda no mundo" : g.noMundo ? `${falta} de ${g.total} faltando` : `${g.total} documento(s)`;
					return `<label class="checkbox" style="display:flex;gap:.4em"><input type="checkbox" name="a${i}"${falta ? "" : " disabled"}> ${esc(g.aventura || "Avulsos")} <span class="hint">(${estado})</span></label>`;
				})
				.join("");
			return linhas ? `<fieldset><legend>${esc(a.rotulo)}</legend>${linhas}</fieldset>` : "";
		})
		.join("");
	const escolha = await foundry.applications.api.DialogV2.wait({
		window: { title: "Coração de Rubi: puxar do compêndio", icon: "fa-solid fa-gem" },
		position: { width: 520 },
		content: `<p>Marque as aventuras que quer no mundo. Só o que <b>falta</b> é criado, nas pastas do compêndio e com os mesmos IDs.
			O que já está no mundo (inclusive o que você corrigiu) não é tocado. Para um documento só, arraste-o do compêndio.</p>
			<div style="max-height:60vh;overflow-y:auto">${blocos}</div>`,
		rejectClose: false,
		buttons: [
			{
				action: "puxar",
				label: "Puxar",
				icon: "fa-solid fa-file-import",
				default: true,
				callback: (ev, button) => {
					const fd = new foundry.applications.ux.FormDataExtended(button.form).object;
					return chaves.filter((_, i) => fd[`a${i}`] === true);
				}
			},
			{ action: "cancelar", label: "Cancelar", icon: "fa-solid fa-xmark" }
		]
	});
	if (!Array.isArray(escolha)) return null;
	return puxar({ aventuras: escolha });
}

/* ------------------------------------------------------------------------ */
/* Atualizar do compêndio (opcional, sem tocar no que foi editado)           */
/* ------------------------------------------------------------------------ */

/**
 * Documentos do mundo que vieram do módulo e cuja versão no compêndio mudou.
 * @returns {Promise<{doc: Document, entrada: object, estado: "desatualizado"|"editado"}[]>}
 */
export async function procurarAtualizacoes() {
	const cat = await catalogo();
	const mapa = noMundo(cat);
	const out = [];
	for (const c of cat) {
		const doc = mapa.get(c.uuid);
		if (!doc || !c.assinatura) continue;
		const minha = assinatura(doc.toObject(), c.tipo);
		if (minha === c.assinatura) continue;
		out.push({ doc, entrada: c, estado: c.assinaturas.includes(minha) ? "desatualizado" : "editado" });
	}
	return out;
}

/**
 * Troca um documento do mundo pela versão do compêndio, com o mesmo ID (tokens em cenas continuam ligados).
 * Ficam: pasta, ordem, permissões, flags de outros módulos e os valores de PRESERVAR.
 */
export async function atualizarDocumento(doc, entrada, ids) {
	const comp = await entrada.pack.getDocument(entrada.id);
	if (!comp) throw new Error(`${entrada.uuid} não encontrado`);
	const antigo = doc.toObject();
	const novo = linksParaMundo(comp.toObject(), ids ?? new Map());
	novo._id = doc.id;
	novo.folder = antigo.folder ?? null;
	novo.sort = antigo.sort;
	novo.ownership = antigo.ownership;
	const outros = Object.fromEntries(Object.entries(antigo.flags ?? {}).filter(([k]) => !["world", "tormenta20", MODULO].includes(k)));
	novo.flags = { ...outros, ...(novo.flags ?? {}) };
	novo._stats ??= {};
	novo._stats.compendiumSource = entrada.uuid;
	const role = antigo.flags?.world?.cdrRole;
	for (const p of PRESERVAR) {
		if (p.documento !== entrada.tipo || p.role !== role) continue;
		for (const c of p.caminhos) {
			const v = foundry.utils.getProperty(antigo, c);
			if (v !== undefined) foundry.utils.setProperty(novo, c, v);
		}
	}
	await classe(entrada.tipo).deleteDocuments([doc.id]);
	const [criado] = await classe(entrada.tipo).createDocuments([novo], { keepId: true });
	return criado;
}

/**
 * Atualiza os documentos escolhidos. Só aceita os que não foram editados.
 * @param {object} [o]
 * @param {boolean} [o.confirmar=true]  false atualiza todos os não editados, sem janela
 * @returns {Promise<{atualizados: number, editados: number, falhas: object[]}|null>}
 */
export async function atualizar({ confirmar = true } = {}) {
	if (!game.user.isGM) {
		ui.notifications.error("Só o Mestre pode atualizar o conteúdo do Coração de Rubi.");
		return null;
	}
	const lista = await procurarAtualizacoes();
	const editados = lista.filter((p) => p.estado === "editado");
	if (!lista.length) {
		ui.notifications.info("Coração de Rubi: o que está no mundo já é a versão atual do compêndio.");
		return { atualizados: 0, editados: 0, falhas: [] };
	}
	let escolhidos = lista.filter((p) => p.estado === "desatualizado");
	if (confirmar) {
		const linhas = (estado) =>
			lista
				.map((p, i) => ({ p, i }))
				.filter(({ p }) => p.estado === estado)
				.map(({ p, i }) => {
					const onde = [atos().find((a) => a.id === p.entrada.ato)?.rotulo, p.entrada.aventura].filter(Boolean).join(" › ");
					return `<label class="checkbox" style="display:flex;gap:.4em"><input type="checkbox" name="d${i}"${estado === "desatualizado" ? " checked" : " disabled"}> ${esc(p.doc.name)} <span class="hint">(${esc(nomeTipo(p.entrada.tipo, 1))}${onde ? ` · ${esc(onde)}` : ""})</span></label>`;
				})
				.join("");
		const desat = linhas("desatualizado");
		const edit = linhas("editado");
		const escolha = await foundry.applications.api.DialogV2.wait({
			window: { title: "Coração de Rubi: atualizar do compêndio", icon: "fa-solid fa-rotate" },
			position: { width: 560 },
			content: `<p>Documentos do mundo que vieram do módulo e mudaram na versão nova. Os marcados são trocados pela versão do compêndio, com o mesmo ID
				(tokens nas cenas continuam ligados); pasta e permissões ficam como estão.</p>
				<div style="max-height:55vh;overflow-y:auto">
				${desat ? `<fieldset><legend>Sem alteração sua (${lista.length - editados.length})</legend>${desat}</fieldset>` : "<p>Nenhum documento sem alteração para atualizar.</p>"}
				${edit ? `<fieldset><legend>Editados por você: ficam como estão (${editados.length})</legend><p class="hint">Se quiser a versão nova de algum deles, arraste-a do compêndio.</p>${edit}</fieldset>` : ""}
				</div>`,
			rejectClose: false,
			buttons: [
				{
					action: "ok",
					label: "Atualizar marcados",
					icon: "fa-solid fa-rotate",
					default: true,
					callback: (ev, button) => {
						const fd = new foundry.applications.ux.FormDataExtended(button.form).object;
						return lista.filter((p, i) => p.estado === "desatualizado" && fd[`d${i}`] === true);
					}
				},
				{ action: "cancelar", label: "Cancelar", icon: "fa-solid fa-xmark" }
			]
		});
		if (!Array.isArray(escolha)) return null;
		escolhidos = escolha;
	}

	const cat = await catalogo();
	const ids = idsDoMundo(cat, noMundo(cat));
	const falhas = [];
	let atualizados = 0;
	for (const p of escolhidos) {
		try {
			await atualizarDocumento(p.doc, p.entrada, ids);
			atualizados++;
		} catch (erro) {
			console.error(erro);
			falhas.push({ nome: p.doc.name, erro: erro.message });
		}
	}
	const ficaram = lista.length - editados.length - escolhidos.length;
	await ChatMessage.create({
		whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id),
		speaker: { alias: "Coração de Rubi" },
		content:
			`<h3>Atualização do compêndio (v${esc(modulo()?.version)})</h3><p><b>${atualizados}</b> documento(s) atualizado(s)` +
			`${falhas.length ? `, ${falhas.length} falha(s)` : ""}${ficaram ? `; ${ficaram} desmarcado(s) ficaram como estavam` : ""}.</p>` +
			(editados.length ? `<p>Editados por você e mantidos (${editados.length}): ${editados.map((p) => esc(p.doc.name)).join(", ")}.</p>` : "") +
			(falhas.length ? `<ul>${falhas.map((f) => `<li>${esc(f.nome)}: ${esc(f.erro)}</li>`).join("")}</ul>` : "")
	});
	ui.notifications.info(`Coração de Rubi: ${atualizados} documento(s) atualizado(s).${editados.length ? ` ${editados.length} editado(s) por você ficaram como estão.` : ""}`);
	Hooks.callAll(`${MODULO}.atualizado`, { atualizados, editados: editados.length, falhas });
	return { atualizados, editados: editados.length, falhas };
}

export const abrirAtualizar = () => atualizar({ confirmar: true });

/* ------------------------------------------------------------------------ */
/* Limpar do mundo                                                            */
/* ------------------------------------------------------------------------ */

const ROTULO_TIPO = { Actor: "Ameaças e NPCs", Item: "Itens e poderes", JournalEntry: "Diários", RollTable: "Tabelas", Macro: "Macros" };

/**
 * Documentos do mundo que são do Coração de Rubi (vieram do compêndio ou dos geradores, pela marca flags.world.cdr).
 * `editado`: não bate com nenhuma versão publicada (ou não existe mais no compêndio), então pode ter correção sua.
 * @returns {Promise<{doc: Document, tipo: string, editado: boolean, preservado: boolean}[]>}
 */
export async function procurarParaLimpar() {
	const cat = await catalogo();
	const mapa = noMundo(cat);
	const entradaDe = new Map();
	for (const c of cat) if (mapa.has(c.uuid)) entradaDe.set(mapa.get(c.uuid), c);
	const out = [];
	for (const tipo of TIPOS) {
		for (const doc of colecao(tipo) ?? []) {
			const c = entradaDe.get(doc);
			if (!c && !marca(doc)) continue;
			const editado = !c || !c.assinaturas.includes(assinatura(doc.toObject(), tipo));
			const role = doc.getFlag?.("world", "cdrRole") ?? doc.flags?.world?.cdrRole;
			const preservado = PRESERVAR.some((p) => p.documento === tipo && p.role === role);
			out.push({ doc, tipo, editado, preservado });
		}
	}
	return out;
}

/** Guarda uma cópia dos documentos num compêndio do mundo por tipo ("CdR · Cópia AAAA-MM-DD · Diários"). */
async function guardarCopia(lista) {
	const Comp = foundry.documents?.collections?.CompendiumCollection ?? globalThis.CompendiumCollection;
	if (!Comp?.createCompendium) throw new Error("este Foundry não cria compêndios por script");
	const data = new Date().toISOString().slice(0, 10);
	const criados = [];
	for (const tipo of TIPOS) {
		const docs = lista.filter((l) => l.tipo === tipo).map((l) => l.doc);
		if (!docs.length) continue;
		let label = `CdR · Cópia ${data} · ${ROTULO_TIPO[tipo]}`;
		for (let n = 2; game.packs.some((p) => p.metadata?.label === label); n++) label = `CdR · Cópia ${data} (${n}) · ${ROTULO_TIPO[tipo]}`;
		const pack = await Comp.createCompendium({ label, type: tipo });
		const dados = docs.map((d) => ({ ...d.toObject(), folder: null }));
		await classe(tipo).createDocuments(dados, { pack: pack.collection, keepId: true });
		criados.push(label);
	}
	return criados;
}

/** Apaga as pastas do mundo que ficaram vazias e eram do Coração de Rubi (das aventuras, dos atos ou "CdR · ..."). */
async function apagarPastasVazias() {
	const doModulo = new Set(packs().flatMap((p) => [...(p.folders?.keys?.() ?? [])]));
	const nomesAtos = new Set(atos().map((a) => a.rotulo));
	const nossa = (f) => doModulo.has(f.id) || nomesAtos.has(f.name) || /^CdR · /.test(f.name ?? "") || !!f.flags?.[MODULO] || !!f.flags?.world?.cdr;
	let apagadas = 0;
	for (let volta = 0; volta < 5; volta++) {
		const vazias = game.folders.filter((f) => nossa(f) && TIPOS.includes(f.type) && !colecao(f.type).some((d) => (d.folder?.id ?? d.folder) === f.id) && !game.folders.some((g) => (g.folder?.id ?? g.folder) === f.id));
		if (!vazias.length) break;
		await classe("Folder").deleteDocuments(vazias.map((f) => f.id));
		apagadas += vazias.length;
	}
	return apagadas;
}

/**
 * Tira do mundo o conteúdo do Coração de Rubi, para o Mestre puxar só o que quiser do compêndio.
 * @param {object} [o]
 * @param {string[]} [o.tipos]              padrão: itens, diários, tabelas e macros (atores só se pedir)
 * @param {boolean}  [o.incluirEditados]    apaga também o que foi editado à mão (padrão: não)
 * @param {boolean}  [o.manterPreservados]  mantém os documentos de PRESERVAR (padrão: sim)
 * @param {boolean}  [o.copia]              guarda uma cópia num compêndio do mundo antes (padrão: sim)
 */
export async function limpar({ tipos = ["Item", "JournalEntry", "RollTable", "Macro"], incluirEditados = false, manterPreservados = true, copia = true } = {}) {
	if (!game.user.isGM) {
		ui.notifications.error("Só o Mestre pode limpar o conteúdo do Coração de Rubi.");
		return null;
	}
	const todos = await procurarParaLimpar();
	const lista = todos.filter((l) => tipos.includes(l.tipo) && (incluirEditados || !l.editado) && !(manterPreservados && l.preservado));
	if (!lista.length) {
		ui.notifications.info("Coração de Rubi: nada para limpar com essas opções.");
		return { apagados: 0, mantidos: todos.length, pastas: 0, copias: [] };
	}
	const copias = copia ? await guardarCopia(lista) : [];
	let apagados = 0;
	for (const tipo of TIPOS) {
		const ids = lista.filter((l) => l.tipo === tipo).map((l) => l.doc.id);
		if (ids.length) apagados += (await classe(tipo).deleteDocuments(ids)).length;
	}
	const pastas = await apagarPastasVazias();
	const mantidos = todos.length - lista.length;
	await ChatMessage.create({
		whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id),
		speaker: { alias: "Coração de Rubi" },
		content:
			`<h3>Limpeza do mundo</h3><p><b>${apagados}</b> documento(s) apagado(s) e ${pastas} pasta(s) vazia(s) removida(s); ${mantidos} mantido(s).</p>` +
			(copias.length ? `<p>Cópia guardada em: ${copias.map(esc).join(", ")}.</p>` : "") +
			`<p>Para trazer de volta, arraste do compêndio ou use <i>CdR · Puxar do compêndio</i>.</p>`
	});
	ui.notifications.info(`Coração de Rubi: ${apagados} documento(s) apagado(s), ${mantidos} mantido(s).`);
	Hooks.callAll(`${MODULO}.limpo`, { apagados, mantidos, pastas, copias });
	return { apagados, mantidos, pastas, copias };
}

/** Janela da limpeza: tipos, editados e cópia. */
export async function abrirLimpar() {
	if (!game.user.isGM) return ui.notifications.warn("Só o Mestre pode limpar o conteúdo do Coração de Rubi.");
	const todos = await procurarParaLimpar();
	if (!todos.length) return ui.notifications.info("Coração de Rubi: o mundo não tem conteúdo do módulo.");
	const linhas = TIPOS.map((t) => {
		const l = todos.filter((x) => x.tipo === t);
		if (!l.length) return "";
		const ed = l.filter((x) => x.editado).length;
		const aviso = t === "Actor" ? ' <span class="hint">(tokens nas cenas perdem a ficha)</span>' : "";
		return `<label class="checkbox" style="display:flex;gap:.4em"><input type="checkbox" name="t${t}"${t === "Actor" ? "" : " checked"}> ${ROTULO_TIPO[t]}: ${l.length - ed} sem alteração${ed ? `, ${ed} editado(s)` : ""}${aviso}</label>`;
	}).join("");
	const editados = todos.filter((x) => x.editado);
	const escolha = await foundry.applications.api.DialogV2.wait({
		window: { title: "Coração de Rubi: limpar do mundo", icon: "fa-solid fa-broom" },
		position: { width: 540 },
		content: `<p>Apaga do mundo o conteúdo do Coração de Rubi, para você puxar do compêndio só o que precisar. Os itens nas fichas dos personagens não são tocados.</p>
			<fieldset><legend>O que apagar</legend>${linhas}</fieldset>
			<fieldset><legend>Proteções</legend>
				<label class="checkbox" style="display:flex;gap:.4em"><input type="checkbox" name="editados"> Apagar também os que você editou (${editados.length})</label>
				${editados.length ? `<p class="hint">Editados: ${editados.slice(0, 30).map((x) => esc(x.doc.name)).join(", ")}${editados.length > 30 ? "..." : ""}</p>` : ""}
				<label class="checkbox" style="display:flex;gap:.4em"><input type="checkbox" name="copia" checked> Guardar uma cópia num compêndio do mundo antes de apagar</label>
			</fieldset>`,
		rejectClose: false,
		buttons: [
			{
				action: "limpar",
				label: "Apagar do mundo",
				icon: "fa-solid fa-broom",
				callback: (ev, button) => {
					const fd = new foundry.applications.ux.FormDataExtended(button.form).object;
					return { tipos: TIPOS.filter((t) => fd[`t${t}`] === true), incluirEditados: fd.editados === true, manterPreservados: true, copia: fd.copia === true };
				}
			},
			{ action: "cancelar", label: "Cancelar", icon: "fa-solid fa-xmark", default: true }
		]
	});
	if (!escolha || typeof escolha !== "object") return null;
	if (!escolha.tipos.length) return ui.notifications.warn("Nenhum tipo marcado.");
	return limpar(escolha);
}

/** Os dois caminhos numa janela só (botão da aba de Compêndios). */
export async function abrirMenu() {
	if (!game.user.isGM) return null;
	const acao = await foundry.applications.api.DialogV2.wait({
		window: { title: "Coração de Rubi", icon: "fa-solid fa-gem" },
		position: { width: 440 },
		content: `<p><b>Puxar do compêndio</b> traz aventuras inteiras para o mundo (só o que falta).</p>
			<p><b>Atualizar do compêndio</b> mostra o que mudou na versão nova do módulo; nada que você editou é tocado.</p>
			<p><b>Limpar do mundo</b> tira do mundo o conteúdo do módulo (com cópia e sem tocar no que você editou, se não pedir).</p>`,
		rejectClose: false,
		buttons: [
			{ action: "puxar", label: "Puxar do compêndio", icon: "fa-solid fa-file-import", default: true },
			{ action: "atualizar", label: "Atualizar do compêndio", icon: "fa-solid fa-rotate" },
			{ action: "limpar", label: "Limpar do mundo", icon: "fa-solid fa-broom" }
		]
	});
	if (acao === "limpar") return abrirLimpar();
	if (acao === "puxar") return abrirPuxar();
	if (acao === "atualizar") return abrirAtualizar();
	return null;
}

/* ------------------------------------------------------------------------ */
/* UUIDs antigos (compêndios por ato até a v0.16)                           */
/* ------------------------------------------------------------------------ */

/** Redireciona `Compendium.<mod>.ato1-ameacas.Actor.X` para o compêndio novo. */
export async function registrarRedirecionamentos() {
	const red = CONFIG.compendium?.uuidRedirects;
	if (!red || typeof red !== "object") return 0;
	let n = 0;
	for (const c of await catalogo()) {
		if (!c.antigo) continue;
		red[`Compendium.${MODULO}.${c.antigo}.${c.tipo}.${c.id}`] ??= c.uuid;
		n++;
	}
	return n;
}

/* ------------------------------------------------------------------------ */
/* Ganchos                                                                    */
/* ------------------------------------------------------------------------ */

Hooks.once("init", () => {
	game.settings.register(MODULO, "avisarVersao", {
		name: "Avisar quando houver melhorias",
		hint: "Quando sai uma versão nova do módulo, o Mestre recebe no chat (uma vez) quantos documentos do mundo têm melhorias no compêndio. Nada é mudado sem a macro CdR · Atualizar do compêndio.",
		scope: "world",
		config: true,
		type: Boolean,
		default: true
	});
	game.settings.register(MODULO, "avisado", { scope: "world", config: false, type: String, default: "" });

	const Base = foundry.applications?.api?.ApplicationV2;
	if (Base) {
		const menu = (chave, abrir, dados) => {
			class Janela extends Base {
				render() {
					abrir();
					return this;
				}
			}
			game.settings.registerMenu(MODULO, chave, { ...dados, type: Janela, restricted: true });
		};
		menu("puxar", () => abrirPuxar(), {
			name: "Puxar do compêndio",
			label: "Puxar aventuras",
			hint: "Traz para o mundo as aventuras escolhidas. Só cria o que falta; nada é substituído.",
			icon: "fa-solid fa-file-import"
		});
		menu("atualizar", () => abrirAtualizar(), {
			name: "Atualizar do compêndio",
			label: "Ver atualizações",
			hint: "Lista o que mudou na versão nova. Só os documentos que você não editou podem ser atualizados, e só os que você marcar.",
			icon: "fa-solid fa-rotate"
		});
		menu("limpar", () => abrirLimpar(), {
			name: "Limpar do mundo",
			label: "Limpar conteúdo",
			hint: "Apaga do mundo o conteúdo do módulo para você puxar só o que quiser. Guarda uma cópia e não toca no que você editou, a não ser que você marque.",
			icon: "fa-solid fa-broom"
		});
	}

	const m = modulo();
	if (m) {
		m.api = {
			puxar,
			abrirPuxar,
			atualizar,
			abrirAtualizar,
			procurarAtualizacoes,
			atualizarDocumento,
			limpar,
			abrirLimpar,
			procurarParaLimpar,
			abrirMenu,
			catalogo,
			atos,
			assinatura,
			PRESERVAR,
			curaLonien
		};
	}
});

Hooks.once("ready", async () => {
	await registrarRedirecionamentos();
	ligarAutomacoes();
	if (!game.user.isGM || (game.users.activeGM && game.users.activeGM !== game.user)) return;
	// Versão nova: só um aviso no chat, nada muda no mundo
	const versao = modulo()?.version;
	if (!game.settings.get(MODULO, "avisarVersao") || game.settings.get(MODULO, "avisado") === versao) return;
	await game.settings.set(MODULO, "avisado", versao);
	const lista = await procurarAtualizacoes();
	if (!lista.length) return;
	const desat = lista.filter((p) => p.estado === "desatualizado").length;
	await ChatMessage.create({
		whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id),
		speaker: { alias: "Coração de Rubi" },
		content: `<p><b>Coração de Rubi v${esc(versao)}</b>: ${desat} documento(s) do mundo têm melhorias no compêndio${lista.length - desat ? ` e ${lista.length - desat} que você editou ficam como estão` : ""}.
			Nada foi mudado. Para escolher o que atualizar, rode a macro <i>CdR · Atualizar do compêndio</i> ou use o botão <i>Coração de Rubi</i> na aba de Compêndios.</p>`
	});
});

Hooks.on("renderCompendiumDirectory", (app, html) => {
	if (!game.user.isGM) return;
	const raiz = html instanceof HTMLElement ? html : html?.[0];
	if (!raiz || raiz.querySelector(".cdr-importar")) return;
	const botao = document.createElement("button");
	botao.type = "button";
	botao.className = "cdr-importar";
	botao.innerHTML = '<i class="fa-solid fa-gem"></i> Coração de Rubi';
	botao.addEventListener("click", () => abrirMenu());
	const alvo = raiz.querySelector(".header-actions") ?? raiz.querySelector(".directory-header") ?? raiz;
	alvo.append(botao);
});
