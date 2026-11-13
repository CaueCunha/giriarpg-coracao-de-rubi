/**
 * Build do módulo: roda os geradores (src/geradores) num Foundry simulado com o sistema
 * Tormenta20 real (modelo de dados e compêndios), captura o que eles criam e grava:
 *   - src/packs/<pack>/*.json  fontes dos compêndios (formato do foundryvtt-cli, revisáveis no git)
 *   - module.json              com a lista de compêndios e pastas
 *   - build/relatorio.md       o que foi ligado ao sistema e qualquer aviso
 * Depois, "npm run pack" compila as fontes em packs/ (LevelDB), que é o que o Foundry lê.
 *
 * Uso: node tools/build.mjs [--sem-pack]
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { criarMundo } from "./sim/mundo.mjs";
import { ATOS, PACKS, MODULO } from "./conteudo.mjs";
import { assinatura } from "../scripts/assinatura.mjs";
import { ligarAoSistema, indiceSistema, indiceGiria, resolverGiria } from "./ligar-sistema.mjs";
import { RAIZ, GERADORES, FONTE_PACKS, HISTORICO } from "./caminhos.mjs";
import { deepClone } from "./sim/utils.mjs";

const COLECAO = { Actor: "actors", Item: "items", JournalEntry: "journal", RollTable: "tables", Macro: "macros", Folder: "folders" };
const EMBUTIDOS = { Actor: { items: "Item", effects: "ActiveEffect" }, Item: { effects: "ActiveEffect" }, JournalEntry: { pages: "JournalEntryPage" }, RollTable: { results: "TableResult" } };

const lerGerador = (nome) => fs.readFileSync(path.join(GERADORES, `${nome}.js`), "utf8");

/* ------------------------------------------------------------------------ */
/* 1. Captura                                                                */
/* ------------------------------------------------------------------------ */

export async function capturarAto(ato, { semente } = {}) {
	const mundo = await criarMundo({ semente: semente ?? ato.id });
	try {
		for (const g of ato.geradores) await mundo.executar(lerGerador(g), { nome: g });
		const problemas = [
			...mundo.erros.map((e) => `${e.origem}: ${e.erro?.message ?? e.erro}`),
			...mundo.notificacoes.filter((n) => n.tipo === "error").map((n) => `${n.origem}: notificação de erro: ${n.msg}`),
			...mundo.relatorio.filter((r) => r.tipo === "erro").map((r) => `${r.origem}: ${r.documento} ${r.caminho}: ${r.mensagem}`)
		];
		if (problemas.length) throw new Error(`Geradores do ${ato.rotulo} falharam:\n  ${problemas.join("\n  ")}`);
		const docs = {};
		for (const tipo of Object.keys(COLECAO)) {
			docs[tipo] = mundo.colecoes[tipo].contents.map((d) => d.toObject());
		}
		for (const [i, m] of (ato.macros ?? []).entries()) {
			docs.Macro.push({
				_id: `${i + 1}x`,
				name: m.nome,
				type: "script",
				img: m.img,
				scope: "global",
				command: m.comando ?? fs.readFileSync(path.join(GERADORES, `${m.arquivo}.js`), "utf8"),
				folder: null,
				flags: { world: { cdr: "cdrcampanha", cdrRole: m.role } }
			});
		}
		return { docs, relatorio: mundo.relatorio.filter((r) => r.tipo !== "erro"), mundo };
	} finally {
		mundo.encerrar();
	}
}

/* ------------------------------------------------------------------------ */
/* 2. IDs estáveis                                                           */
/* ------------------------------------------------------------------------ */

const BASE62 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function idEstavel(chave) {
	const h = crypto.createHash("sha256").update(chave).digest();
	let id = "";
	for (let i = 0; i < 16; i++) id += BASE62[h[i] % 62];
	return id;
}

/**
 * Troca os IDs aleatórios por IDs derivados de (marca, tipo, nome, ocorrência). Assim, gerar de
 * novo dá os mesmos IDs, e reimportar o módulo não quebra tokens já colocados em cenas.
 */
export function estabilizarIds(docs) {
	const mapa = new Map();
	const contagem = new Map();
	const novoId = (chave) => {
		const n = contagem.get(chave) ?? 0;
		contagem.set(chave, n + 1);
		return idEstavel(`${chave}#${n}`);
	};
	const visitar = (doc, tipo, prefixo) => {
		const marca = doc.flags?.world?.cdr ?? "sem-marca";
		const chave = prefixo ? `${prefixo}|${tipo}|${doc.name}` : `${MODULO}|${marca}|${tipo}${doc.type && tipo === "Folder" ? `:${doc.type}` : ""}|${doc.name}`;
		const id = novoId(chave);
		if (doc._id) mapa.set(doc._id, id);
		for (const [campo, sub] of Object.entries(EMBUTIDOS[tipo] ?? {})) for (const e of doc[campo] ?? []) visitar(e, sub, id);
	};
	for (const tipo of ["Folder", "Actor", "Item", "JournalEntry", "RollTable", "Macro"]) for (const d of docs[tipo] ?? []) visitar(d, tipo, null);
	let json = JSON.stringify(docs);
	// UUIDs de compêndios do sistema ficam intactos: um item clonado de uma ameaça do sistema
	// carrega o mesmo ID do original, e trocar o ID dentro do link quebraria a referência.
	const protegidos = [];
	json = json.replace(/Compendium\.tormenta20\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9]+)+/g, (m) => `\u0000${protegidos.push(m) - 1}\u0000`);
	// IDs do Foundry são 16 caracteres alfanuméricos; troca só ocorrências isoladas.
	json = json.replace(/(?<![A-Za-z0-9])[A-Za-z0-9]{16}(?![A-Za-z0-9])/g, (m) => mapa.get(m) ?? m);
	json = json.replace(/\u0000(\d+)\u0000/g, (_, i) => protegidos[Number(i)]);
	// IDs temporários das macros avulsas
	json = json.replace(/"_id":"(\d+x)"/g, (_, t) => `"_id":"${mapa.get(t) ?? idEstavel(t)}"`);
	return JSON.parse(json);
}

/* ------------------------------------------------------------------------ */
/* 3. Escrita das fontes                                                     */
/* ------------------------------------------------------------------------ */

const STATS = (versaoSistema, origem) => ({
	coreVersion: "14.366",
	systemId: "tormenta20",
	systemVersion: versaoSistema,
	createdTime: null,
	modifiedTime: null,
	lastModifiedBy: null,
	compendiumSource: origem ?? null,
	duplicateSource: null,
	exportSource: null
});

function comChaves(doc, tipo, colecaoPai, idsPai, versao) {
	const out = deepClone(doc);
	const colecao = colecaoPai ?? COLECAO[tipo];
	const ids = [...idsPai, out._id];
	out._key = `!${colecao}!${ids.join(".")}`;
	out._stats = STATS(versao, doc._stats?.compendiumSource);
	for (const [campo, sub] of Object.entries(EMBUTIDOS[tipo] ?? {})) {
		out[campo] = (out[campo] ?? []).map((e) => comChaves(e, sub, `${colecao}.${campo}`, ids, versao));
	}
	return out;
}

const slug = (s) =>
	String(s)
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^A-Za-z0-9]+/g, "_")
		.replace(/^_|_$/g, "")
		.slice(0, 60) || "doc";

/** Assinaturas de todas as versões publicadas, por ID (src/historico.json, semeado por tools/historico.mjs). */
export function lerHistorico() {
	return fs.existsSync(HISTORICO) ? JSON.parse(fs.readFileSync(HISTORICO, "utf8")) : {};
}

/** Troca os links para documentos do módulo (`Actor.X`) pelo endereço no compêndio, para funcionarem no compêndio. */
export function linksParaCompendio(doc, packDe) {
	const re = /(?<![.\w])(Actor|Item|JournalEntry|RollTable|Macro)\.([A-Za-z0-9]{16})/g;
	const trocar = (s) => s.replace(re, (m, tipo, id) => (packDe.has(id) ? `Compendium.${MODULO}.${packDe.get(id)}.${tipo}.${id}` : m));
	const visitar = (o) => {
		if (Array.isArray(o)) return o.map(visitar);
		if (!o || typeof o !== "object") return o;
		const out = {};
		// o comando das macros e a origem dos efeitos ficam: o código procura no mundo
		for (const [k, v] of Object.entries(o)) out[k] = typeof v === "string" && k !== "command" && k !== "origin" ? trocar(v) : visitar(v);
		return out;
	};
	return visitar(doc);
}

/**
 * Monta os compêndios por tipo. Em cada um: uma pasta por ato e, dentro, as pastas das aventuras.
 * Cada documento leva em flags.<módulo>: o ato, o compêndio antigo (para redirecionar UUIDs) e as assinaturas
 * de todas as versões publicadas (a última é a atual).
 * @param {{ato: object, docs: object}[]} porAto
 */
export function montarPacks(porAto, historico = {}) {
	const packDe = new Map();
	for (const { docs } of porAto) {
		for (const p of PACKS) for (const d of (docs[p.documento] ?? []).filter(p.filtro ?? (() => true))) packDe.set(d._id, p.nome);
	}
	const novoHistorico = structuredClone(historico);
	const packs = [];
	for (const p of PACKS) {
		const pastas = [];
		const docs = [];
		for (const [i, { ato, docs: doAto }] of porAto.entries()) {
			const lista = (doAto[p.documento] ?? []).filter(p.filtro ?? (() => true));
			if (!lista.length) continue;
			const raiz = { _id: idEstavel(`${MODULO}|pasta|${p.nome}|${ato.id}`), name: ato.rotulo, type: p.documento, folder: null, sorting: "a", sort: (i + 1) * 100000, color: ato.cor, description: "", flags: { [MODULO]: { ato: ato.id } } };
			pastas.push(raiz);
			// a mesma pasta de aventura pode estar em Poderes e em Itens: o segundo ganha outro ID
			const idPasta = (id) => (p.nome === "poderes" ? idEstavel(`${MODULO}|poderes|${id}`) : id);
			const usadas = new Set(lista.map((d) => d.folder).filter(Boolean));
			const fontes = (doAto.Folder ?? []).filter((f) => f.type === p.documento);
			for (const f of fontes) if (usadas.has(f._id)) for (let pai = fontes.find((x) => x._id === f.folder); pai; pai = fontes.find((x) => x._id === pai.folder)) usadas.add(pai._id);
			for (const f of fontes.filter((x) => usadas.has(x._id))) {
				pastas.push({ ...deepClone(f), color: ato.cor, _id: idPasta(f._id), folder: f.folder ? idPasta(f.folder) : raiz._id, flags: { ...deepClone(f.flags ?? {}), [MODULO]: { ato: ato.id } } });
			}
			for (const d of lista) {
				const out = linksParaCompendio(deepClone(d), packDe);
				out.folder = d.folder ? idPasta(d.folder) : raiz._id;
				const atual = assinatura(out, p.documento);
				const todas = [...(historico[d._id] ?? []).filter((x) => x !== atual), atual];
				novoHistorico[d._id] = todas;
				out.flags = { ...(out.flags ?? {}), [MODULO]: { ato: ato.id, antigo: `${ato.id}-${p.antigo}`, assinatura: atual, assinaturas: todas } };
				docs.push(out);
			}
		}
		if (docs.length) packs.push({ ...p, pastas, docs });
	}
	return { packs, historico: novoHistorico };
}

export function escreverFontes(packs, versaoSistema) {
	const saida = [];
	for (const dir of fs.existsSync(FONTE_PACKS) ? fs.readdirSync(FONTE_PACKS) : []) fs.rmSync(path.join(FONTE_PACKS, dir), { recursive: true, force: true });
	for (const p of packs) {
		const dir = path.join(FONTE_PACKS, p.nome);
		fs.mkdirSync(dir, { recursive: true });
		for (const f of p.pastas) {
			const out = comChaves(f, "Folder", null, [], versaoSistema);
			fs.writeFileSync(path.join(dir, `_Folder_${slug(f.name)}_${f._id}.json`), `${JSON.stringify(out, null, 2)}\n`);
		}
		for (const d of p.docs) {
			const out = comChaves(d, p.documento, null, [], versaoSistema);
			fs.writeFileSync(path.join(dir, `${p.documento}_${slug(d.name)}_${d._id}.json`), `${JSON.stringify(out, null, 2)}\n`);
		}
		saida.push({ nome: p.nome, tipo: p.documento, rotulo: p.rotulo, documentos: p.docs.length, pastas: p.pastas.length });
	}
	return saida;
}

/* ------------------------------------------------------------------------ */
/* 4. module.json                                                            */
/* ------------------------------------------------------------------------ */

export function escreverManifesto(packs) {
	const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, "package.json"), "utf8"));
	const versao = pkg.version;
	const repo = "https://github.com/CaueCunha/giriarpg-coracao-de-rubi";
	const manifesto = {
		id: MODULO,
		title: "Giria T20 - Coração de Rubi (Campanha)",
		description:
			"<p>Conteúdo da campanha <b>Coração de Rubi</b> para o sistema Tormenta20: ameaças, perigos, parceiros, itens, diários e macros de cada aventura, organizados por patamar, e as ferramentas e poderes dos jogadores. Regras e itens que já existem no sistema ou no Giria T20 são ligados a eles, não duplicados. Nada é importado sozinho: puxe dos compêndios o que precisar. A macro <i>CdR · Atualizar do compêndio</i> traz as melhorias de versões novas só para o que você não editou.</p>",
		version: versao,
		compatibility: { minimum: "14", verified: "14" },
		authors: [{ name: "Cauê", url: "https://github.com/CaueCunha" }],
		relationships: {
			systems: [{ id: "tormenta20", type: "system", compatibility: { minimum: "1.6.0" } }],
			recommends: [{ id: "giria-t20", type: "module", reason: "Itens, poderes e magias citados nas aventuras apontam para o compêndio do Giria T20." }]
		},
		esmodules: ["scripts/cdr.mjs"],
		styles: ["styles/cdr.css"],
		languages: [{ lang: "pt-BR", name: "Português (Brasil)", path: "lang/pt-BR.json" }],
		packs: packs.map((p) => ({
			name: p.nome,
			label: p.rotulo,
			path: `packs/${p.nome}`,
			type: p.tipo,
			system: "tormenta20",
			ownership: { PLAYER: "NONE", ASSISTANT: "OWNER" }
		})),
		packFolders: [{ name: "Giria T20 - Coração de Rubi (Campanha)", sorting: "m", color: "#6b2f2f", packs: packs.map((p) => p.nome) }],
		flags: { [MODULO]: { atos: Object.fromEntries(ATOS.map((a) => [a.id, { rotulo: a.rotulo }])) } },
		url: repo,
		manifest: `${repo}/releases/latest/download/module.json`,
		download: `${repo}/releases/download/v${versao}/module.zip`,
		readme: `${repo}#readme`,
		bugs: `${repo}/issues`
	};
	fs.writeFileSync(path.join(RAIZ, "module.json"), `${JSON.stringify(manifesto, null, 2)}\n`);
	return manifesto;
}

/* ------------------------------------------------------------------------ */
/* main                                                                       */
/* ------------------------------------------------------------------------ */

async function main() {
	const linhas = ["# Relatório do build", ""];
	const porAto = [];
	let indice = null;
	const listaGiria = JSON.parse(fs.readFileSync(path.join(RAIZ, "src/giria-indice.json"), "utf8")).itens;
	const giria = indiceGiria(listaGiria);
	const arqDocs = path.join(RAIZ, "src/giria-docs.json");
	const giriaDocs = fs.existsSync(arqDocs) ? JSON.parse(fs.readFileSync(arqDocs, "utf8")) : null;
	let versaoSistema = "1.6.4";
	for (const ato of ATOS) {
		console.log(`» ${ato.rotulo}: ${ato.geradores.length} gerador(es)`);
		const { docs, relatorio, mundo } = await capturarAto(ato);
		versaoSistema = mundo.sistema.versao;
		indice ??= indiceSistema(mundo.sistema.packs);
		const semMarca = Object.entries(docs).flatMap(([t, l]) => l.filter((d) => !d.flags?.world?.cdr).map((d) => `${t} "${d.name}"`));
		if (semMarca.length) throw new Error(`Documentos sem a marca flags.world.cdr: ${semMarca.join(", ")}`);
		resolverGiria(docs, listaGiria);
		const ligacoes = ligarAoSistema(docs, indice, ato.id, giria, giriaDocs);
		porAto.push({ ato, docs: estabilizarIds(docs) });
		linhas.push(`## ${ato.rotulo}`, "");
		for (const p of PACKS) {
			const n = (docs[p.documento] ?? []).filter(p.filtro ?? (() => true)).length;
			if (n) linhas.push(`- ${p.rotulo}: ${n} documento(s)`);
		}
		linhas.push("", `### Ligações com o sistema e o Giria T20 (${ligacoes.length})`, "", "| Dono | Item | Tipo | O que foi feito |", "|---|---|---|---|");
		for (const l of ligacoes) linhas.push(`| ${l.dono} | ${l.item} | ${l.tipo} | ${l.acao} |`);
		const avisos = relatorio.filter((r) => r.tipo !== "descartado");
		const descartes = relatorio.filter((r) => r.tipo === "descartado");
		linhas.push("", `### Avisos do Foundry simulado (${avisos.length + descartes.length})`, "");
		for (const r of [...descartes, ...avisos]) linhas.push(`- ${r.tipo}: ${r.origem} · ${r.documento} · \`${r.caminho}\` · ${r.mensagem}`);
		linhas.push("");
		console.log(`  ${ligacoes.length} ligações · ${descartes.length} descartes · ${avisos.length} avisos`);
	}
	const { packs, historico } = montarPacks(porAto, lerHistorico());
	const escritos = escreverFontes(packs, versaoSistema);
	fs.writeFileSync(HISTORICO, `${JSON.stringify(Object.fromEntries(Object.entries(historico).sort(([a], [b]) => a.localeCompare(b))), null, "\t")}\n`);
	linhas.push("## Compêndios", "");
	for (const p of escritos) linhas.push(`- \`${p.nome}\` (${p.rotulo}): ${p.documentos} documento(s), ${p.pastas} pasta(s)`);
	linhas.push("");
	const m = escreverManifesto(escritos);
	fs.mkdirSync(path.join(RAIZ, "build"), { recursive: true });
	fs.writeFileSync(path.join(RAIZ, "build", "relatorio.md"), `${linhas.join("\n")}\n`);
	console.log(`module.json ${m.version}: ${escritos.map((p) => `${p.nome}(${p.documentos})`).join(" ")}. Relatório em build/relatorio.md`);
	if (!process.argv.includes("--sem-pack")) {
		const { compilar } = await import("./pack.mjs");
		await compilar();
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}
