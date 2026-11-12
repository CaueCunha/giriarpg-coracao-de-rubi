/**
 * Documentos do Foundry simulados: Collection, Document (create/update/delete, flags, coleções
 * embutidas) e os esquemas do núcleo (v14) para os campos fora de "system". O "system" de
 * Actor/Item/ActiveEffect é limpo e validado pelo modelo de dados REAL do sistema Tormenta20.
 *
 * Tudo que o Foundry descartaria ou recusaria vai para mundo.relatorio, com o documento e o
 * caminho do campo. Erros de validação lançam exceção, como no Foundry.
 */
import * as U from "./utils.mjs";
import * as F from "./fields.mjs";

const f = F.fields;

/* ------------------------------------------------------------------------ */
/* Collection                                                                */
/* ------------------------------------------------------------------------ */

export class Collection extends Map {
	get contents() {
		return [...this.values()];
	}
	find(fn) {
		for (const v of this.values()) if (fn(v)) return v;
		return undefined;
	}
	filter(fn) {
		return this.contents.filter(fn);
	}
	map(fn) {
		return this.contents.map(fn);
	}
	some(fn) {
		return this.contents.some(fn);
	}
	every(fn) {
		return this.contents.every(fn);
	}
	reduce(fn, i) {
		return this.contents.reduce(fn, i);
	}
	forEach(fn) {
		this.contents.forEach(fn);
	}
	getName(name, { strict = false } = {}) {
		const r = this.find((d) => d.name === name);
		if (!r && strict) throw new Error(`Nenhum documento com nome "${name}"`);
		return r;
	}
	get(key, { strict = false } = {}) {
		const r = super.get(key);
		if (r === undefined && strict) throw new Error(`O id "${key}" não existe na coleção`);
		return r;
	}
	toJSON() {
		return this.contents.map((d) => d.toJSON?.() ?? d);
	}
	[Symbol.iterator]() {
		return this.values();
	}
}

/* ------------------------------------------------------------------------ */
/* Esquemas do núcleo (Foundry v14)                                          */
/* ------------------------------------------------------------------------ */

const IMG = () => new f.FilePathField({ categories: ["IMAGE"], nullable: true, initial: null });
const comuns = () => ({
	_id: new f.DocumentIdField(),
	name: new f.StringField({ required: true, blank: false, textSearch: true }),
	folder: new f.ForeignDocumentField(null),
	sort: new f.IntegerSortField(),
	ownership: new f.DocumentOwnershipField(),
	flags: new f.ObjectField(),
	_stats: new f.ObjectField()
});

export const ESQUEMAS = {
	Actor: () => ({
		...comuns(),
		type: new f.StringField({ required: true, blank: false }),
		img: IMG(),
		system: new f.ObjectField(),
		prototypeToken: new f.ObjectField(),
		items: new f.EmbeddedCollectionField("Item"),
		effects: new f.EmbeddedCollectionField("ActiveEffect")
	}),
	Item: () => ({
		...comuns(),
		type: new f.StringField({ required: true, blank: false }),
		img: IMG(),
		system: new f.ObjectField(),
		effects: new f.EmbeddedCollectionField("ActiveEffect")
	}),
	ActiveEffect: () => ({
		_id: new f.DocumentIdField(),
		name: new f.StringField({ required: true, blank: false }),
		img: IMG(),
		type: new f.StringField({ required: true, blank: false, initial: "base" }),
		system: new f.ObjectField(),
		origin: new f.StringField({ nullable: true, blank: false, initial: null }),
		tint: new f.ColorField({ nullable: false, initial: "#ffffff" }),
		transfer: new f.BooleanField({ initial: true }),
		disabled: new f.BooleanField(),
		start: new f.ObjectField({ nullable: true, initial: null }),
		duration: new f.SchemaField({
			value: new f.NumberField({ nullable: true, min: 0, initial: null }),
			units: new f.StringField({ required: true, blank: false, initial: "seconds", choices: ["years", "months", "weeks", "days", "hours", "minutes", "seconds", "rounds", "turns"] }),
			expiry: new f.StringField({ nullable: true, blank: false, initial: null }),
			expired: new f.BooleanField()
		}),
		description: new f.HTMLField(),
		statuses: new f.SetField(new f.StringField({ required: true, blank: false })),
		showIcon: new f.NumberField({ initial: 1 }),
		folder: new f.ForeignDocumentField(null),
		sort: new f.IntegerSortField(),
		flags: new f.ObjectField(),
		_stats: new f.ObjectField()
	}),
	JournalEntry: () => ({
		...comuns(),
		pages: new f.EmbeddedCollectionField("JournalEntryPage"),
		categories: new f.ArrayField(new f.ObjectField())
	}),
	JournalEntryPage: () => ({
		_id: new f.DocumentIdField(),
		name: new f.StringField({ required: true, blank: false }),
		type: new f.StringField({ required: true, blank: false, initial: "text", choices: ["text", "image", "pdf", "video"] }),
		system: new f.ObjectField(),
		title: new f.SchemaField({ show: new f.BooleanField({ initial: true }), level: new f.NumberField({ integer: true, min: 1, max: 6, initial: 1 }) }),
		image: new f.SchemaField({ caption: new f.StringField({ required: false, initial: undefined }) }),
		text: new f.SchemaField({
			content: new f.HTMLField({ required: false, blank: true, initial: "" }),
			markdown: new f.StringField({ required: false, initial: undefined }),
			format: new f.NumberField({ initial: 1, choices: [1, 2] })
		}),
		video: new f.ObjectField(),
		src: new f.StringField({ nullable: true, blank: false, initial: null }),
		category: new f.StringField({ nullable: true, blank: false, initial: null }),
		sort: new f.IntegerSortField(),
		ownership: new f.DocumentOwnershipField({ initial: { default: -1 } }),
		flags: new f.ObjectField(),
		_stats: new f.ObjectField()
	}),
	RollTable: () => ({
		...comuns(),
		img: IMG(),
		description: new f.HTMLField(),
		results: new f.EmbeddedCollectionField("TableResult"),
		formula: new f.StringField(),
		replacement: new f.BooleanField({ initial: true }),
		displayRoll: new f.BooleanField({ initial: true })
	}),
	TableResult: () => ({
		_id: new f.DocumentIdField(),
		type: new f.StringField({ required: true, blank: false, initial: "text", choices: ["text", "document"] }),
		name: new f.StringField({ required: true, blank: true, initial: "" }),
		img: IMG(),
		description: new f.HTMLField(),
		documentUuid: new f.DocumentUUIDField({ required: false, nullable: true, initial: null }),
		weight: new f.NumberField({ required: true, integer: true, positive: true, nullable: false, initial: 1 }),
		range: new f.ArrayField(new f.NumberField({ integer: true }), { validate: (r) => r.length === 2 }),
		drawn: new f.BooleanField(),
		flags: new f.ObjectField(),
		_stats: new f.ObjectField()
	}),
	Macro: () => ({
		...comuns(),
		type: new f.StringField({ required: true, blank: false, initial: "script", choices: ["script", "chat"] }),
		author: new f.StringField({ nullable: true, initial: null }),
		img: IMG(),
		scope: new f.StringField({ required: true, blank: false, initial: "global", choices: ["global", "actors", "actor"] }),
		command: new f.StringField({ required: true, blank: true, trim: false }),
		_stats: new f.ObjectField()
	}),
	Folder: () => ({
		_id: new f.DocumentIdField(),
		name: new f.StringField({ required: true, blank: false }),
		type: new f.StringField({ required: true, blank: false, choices: ["Actor", "ActiveEffect", "Adventure", "Card", "Cards", "Item", "JournalEntry", "Macro", "Playlist", "RollTable", "Scene", "Compendium"] }),
		description: new f.HTMLField(),
		folder: new f.ForeignDocumentField(null),
		sorting: new f.StringField({ required: true, blank: false, initial: "a", choices: ["a", "m"] }),
		sort: new f.IntegerSortField(),
		color: new f.ColorField(),
		flags: new f.ObjectField(),
		_stats: new f.ObjectField()
	})
};

/** SchemaField que preenche os padrões conhecidos e mantém chaves extras sem reclamar. */
class SchemaAberto extends f.SchemaField {
	_cleanType(data, options = {}) {
		const extras = {};
		for (const k of Object.keys(data)) if (!this.has(k)) extras[k] = data[k];
		const limpo = super._cleanType(data, { ...options, report: undefined });
		return Object.assign(limpo, extras);
	}
}
const luz = () => new SchemaAberto({
	dim: new f.NumberField({ initial: 0, min: 0 }),
	bright: new f.NumberField({ initial: 0, min: 0 }),
	color: new f.ColorField(),
	alpha: new f.NumberField({ initial: 0.5 }),
	angle: new f.NumberField({ initial: 360 }),
	animation: new SchemaAberto({ type: new f.StringField({ nullable: true, blank: false, initial: null }), speed: new f.NumberField({ initial: 5 }), intensity: new f.NumberField({ initial: 5 }) })
});
ESQUEMAS.Token = () => ({
	_id: new f.DocumentIdField(),
	name: new f.StringField({ blank: true }),
	actorId: new f.StringField({ nullable: true, initial: null }),
	actorLink: new f.BooleanField(),
	delta: new f.ObjectField(),
	x: new f.NumberField({ initial: 0 }),
	y: new f.NumberField({ initial: 0 }),
	elevation: new f.NumberField({ initial: 0 }),
	width: new f.NumberField({ initial: 1 }),
	height: new f.NumberField({ initial: 1 }),
	hidden: new f.BooleanField(),
	disposition: new f.NumberField({ initial: -1 }),
	texture: new SchemaAberto({ src: new f.StringField({ nullable: true, initial: null }) }),
	light: luz(),
	sight: new SchemaAberto({ enabled: new f.BooleanField(), range: new f.NumberField({ initial: 0 }), visionMode: new f.StringField({ initial: "basic" }) }),
	flags: new f.ObjectField()
});
ESQUEMAS.Scene = () => ({
	_id: new f.DocumentIdField(),
	name: new f.StringField({ required: true, blank: false }),
	active: new f.BooleanField({ initial: true }),
	environment: new SchemaAberto({
		darknessLevel: new f.NumberField({ initial: 0, min: 0, max: 1 }),
		globalLight: new SchemaAberto({ enabled: new f.BooleanField() })
	}),
	grid: new f.ObjectField({ initial: () => ({ size: 100, distance: 1.5, units: "m" }) }),
	tokens: new f.EmbeddedCollectionField("Token"),
	lights: new f.EmbeddedCollectionField("AmbientLight"),
	flags: new f.ObjectField()
});
ESQUEMAS.AmbientLight = () => ({
	_id: new f.DocumentIdField(),
	x: new f.NumberField({ initial: 0 }),
	y: new f.NumberField({ initial: 0 }),
	config: luz(),
	flags: new f.ObjectField()
});

ESQUEMAS.Combat = () => ({
	_id: new f.DocumentIdField(),
	scene: new f.StringField({ nullable: true, initial: null }),
	active: new f.BooleanField({ initial: true }),
	round: new f.NumberField({ initial: 0, min: 0, integer: true }),
	turn: new f.NumberField({ initial: null, nullable: true, integer: true }),
	started: new f.BooleanField(),
	combatants: new f.EmbeddedCollectionField("Combatant"),
	flags: new f.ObjectField()
});
ESQUEMAS.Combatant = () => ({
	_id: new f.DocumentIdField(),
	actorId: new f.StringField({ nullable: true, initial: null }),
	tokenId: new f.StringField({ nullable: true, initial: null }),
	sceneId: new f.StringField({ nullable: true, initial: null }),
	name: new f.StringField({ blank: true }),
	initiative: new f.NumberField({ nullable: true, initial: null }),
	hidden: new f.BooleanField(),
	defeated: new f.BooleanField(),
	flags: new f.ObjectField()
});

const esquemaCache = {};
export function esquema(nome) {
	if (!ESQUEMAS[nome]) return null;
	const Cls = ["Token", "Scene", "AmbientLight", "Combat", "Combatant"].includes(nome) ? SchemaAberto : f.SchemaField;
	esquemaCache[nome] ??= new Cls(ESQUEMAS[nome]());
	return esquemaCache[nome];
}

/** Migrações do núcleo que o Foundry aplica sozinho a dados antigos (só as que nos interessam). */
function migrarNucleo(nome, data, avisar) {
	if (nome === "TableResult") {
		if ("text" in data) {
			avisar("legado", "text", data.text, "TableResult.text é do v12; no v13+ use name/description");
			if (data.type === "document" || data.type === 1 || data.type === 2) data.name ??= data.text;
			else data.description ??= data.text;
			delete data.text;
		}
		if (typeof data.type === "number") {
			avisar("legado", "type", data.type, "TableResult.type numérico é do v12; use \"text\" ou \"document\"");
			data.type = data.type === 0 ? "text" : "document";
		}
		if (data.documentCollection && data.documentId) {
			avisar("legado", "documentCollection", data.documentCollection, "use documentUuid");
			data.documentUuid ??= data.documentCollection.includes(".") ? `Compendium.${data.documentCollection}.${data.documentId}` : `${data.documentCollection}.${data.documentId}`;
		}
		delete data.documentCollection;
		delete data.documentId;
	}
	if (nome === "ActiveEffect") {
		if (Array.isArray(data.changes)) {
			avisar("legado", "changes", data.changes, "no v14 as mudanças ficam em system.changes");
			data.system ??= {};
			data.system.changes ??= data.changes;
			delete data.changes;
		}
		const d = data.duration;
		if (d && typeof d === "object") {
			for (const k of ["rounds", "turns", "seconds", "startRound", "startTurn", "startTime", "combat"]) {
				if (k in d) {
					avisar("legado", `duration.${k}`, d[k], "duração do v13; no v14 é {value, units, expiry}");
					if (k === "rounds" && d.value == null) Object.assign(d, { value: d.rounds, units: "rounds" });
					if (k === "turns" && d.value == null) Object.assign(d, { value: d.turns, units: "turns" });
					if (k === "seconds" && d.value == null) Object.assign(d, { value: d.seconds, units: "seconds" });
					delete d[k];
				}
			}
		}
		if ("label" in data) {
			avisar("legado", "label", data.label, "ActiveEffect.label foi trocado por name");
			data.name ??= data.label;
			delete data.label;
		}
		if ("icon" in data) {
			avisar("legado", "icon", data.icon, "ActiveEffect.icon foi trocado por img");
			data.img ??= data.icon;
			delete data.icon;
		}
	}
	if (nome === "JournalEntryPage" && data.type === "text" && typeof data.text === "string") {
		avisar("erro", "text", data.text, "text deve ser {content, format}");
	}
}

/* ------------------------------------------------------------------------ */
/* Document                                                                  */
/* ------------------------------------------------------------------------ */

const EMBUTIDOS = {
	Actor: { Item: "items", ActiveEffect: "effects" },
	Item: { ActiveEffect: "effects" },
	JournalEntry: { JournalEntryPage: "pages" },
	RollTable: { TableResult: "results" },
	Scene: { Token: "tokens", AmbientLight: "lights" },
	Combat: { Combatant: "combatants" }
};

export function criarClasses(mundo) {
	const { modelos } = mundo.sistema;

	const relatar = (doc, tipo, caminho, valor, mensagem) => {
		mundo.relatorio.push({
			tipo,
			documento: doc ? `${doc.documentName ?? "?"} "${doc.name ?? doc._source?.name ?? "?"}"` : "?",
			origem: mundo.contexto.atual,
			caminho,
			valor: typeof valor === "string" ? valor.slice(0, 120) : valor,
			mensagem
		});
	};

	class Document {
		static documentName = "Document";
		static get collectionName() {
			return null;
		}
		static get implementation() {
			return this;
		}
		static get metadata() {
			return { name: this.documentName, embedded: EMBUTIDOS[this.documentName] ?? {} };
		}
		static get TYPES() {
			return Object.keys(modelos[this.documentName] ?? {});
		}

		constructor(data = {}, { parent = null, pack = null, validar = true } = {}) {
			Object.defineProperty(this, "parent", { value: parent, writable: true, enumerable: false });
			Object.defineProperty(this, "pack", { value: pack, writable: true, enumerable: false });
			Object.defineProperty(this, "apps", { value: {}, enumerable: false });
			this._initSource(data, validar);
		}

		_initSource(data, validar = true) {
			const nome = this.constructor.documentName;
			const src = U.deepClone(data);
			const avisos = [];
			migrarNucleo(nome, src, (tipo, caminho, valor, msg) => avisos.push([tipo, caminho, valor, msg]));
			const s = esquema(nome);
			const rep = [];
			// coleções embutidas são tratadas à parte
			const emb = EMBUTIDOS[nome] ?? {};
			const brutos = {};
			for (const campo of Object.values(emb)) {
				brutos[campo] = src[campo] ?? [];
				delete src[campo];
			}
			let limpo = s ? s.clean(src, { report: rep }) : src;
			for (const campo of Object.values(emb)) delete limpo[campo];
			if (s && validar) {
				const erros = s.validate(limpo).filter((e) => !Object.values(emb).includes(e.path));
				if (erros.length) this._falhar(erros, limpo);
			}
			// system
			if (s?.has("system") || nome === "Token") {
				const Modelo = modelos[nome]?.[limpo.type];
				if (Modelo) {
					const repSys = [];
					const m = new Modelo(src.system ?? data.system ?? {}, { parent: this, report: repSys });
					for (const r of repSys) rep.push({ ...r, path: `system.${r.path}` });
					if (validar) {
						const erros = Modelo.schema.validate(m._source).map((e) => ({ ...e, path: `system.${e.path}` }));
						if (erros.length) this._falhar(erros, limpo);
					}
					limpo.system = m._source;
				} else if (modelos[nome] && validar) {
					this._falhar([{ path: "type", message: `"${limpo.type}" não é um tipo de ${nome} do sistema (${Object.keys(modelos[nome]).join(", ")})`, value: limpo.type }], limpo);
				}
			}
			Object.defineProperty(this, "_source", { value: limpo, writable: true, enumerable: false });
			for (const [tipo, caminho, valor, msg] of avisos) relatar(this, tipo, caminho, valor, msg);
			for (const r of rep) relatar(this, "descartado", r.path, r.value, "o Foundry descarta esta chave (não existe no modelo de dados)");
			// embutidos
			for (const [docName, campo] of Object.entries(emb)) {
				const Cls = mundo.classes[docName];
				const col = new Collection();
				for (const d of brutos[campo]) {
					const e = new Cls(d, { parent: this, validar });
					if (!e._source._id) e._source._id = U.randomID();
					col.set(e._source._id, e);
				}
				Object.defineProperty(this, campo, { value: col, writable: true, enumerable: false, configurable: true });
			}
			this.prepareData();
		}

		_falhar(erros, limpo) {
			const nome = this.constructor.documentName;
			for (const e of erros) relatar({ documentName: nome, name: limpo.name }, "erro", e.path, e.value, e.message);
			const err = new Error(`${nome} "${limpo.name}" falhou na validação: ${erros.map((e) => `${e.path}: ${e.message}`).join("; ")}`);
			err.simValidacao = true;
			throw err;
		}

		prepareData() {
			const src = this._source;
			for (const [k, v] of Object.entries(src)) {
				if (k === "system" || k === "folder" || k === "statuses") continue;
				Object.defineProperty(this, k, { value: U.deepClone(v), writable: true, enumerable: true, configurable: true });
			}
			if ("system" in src) {
				const Modelo = modelos[this.constructor.documentName]?.[src.type];
				const sys = Modelo ? Object.assign(Object.create(Modelo.prototype), U.deepClone(src.system)) : U.deepClone(src.system);
				if (Modelo) {
					Object.defineProperty(sys, "parent", { value: this, enumerable: false });
					Object.defineProperty(sys, "_source", { value: src.system, enumerable: false });
				}
				Object.defineProperty(this, "system", { value: sys, writable: true, enumerable: true, configurable: true });
			}
			this.prepareDerivedData?.();
		}

		get id() {
			return this._source._id ?? null;
		}
		get _id() {
			return this._source._id ?? null;
		}
		get documentName() {
			return this.constructor.documentName;
		}
		get collectionName() {
			return this.constructor.collectionName;
		}
		get isEmbedded() {
			return !!this.parent;
		}
		get uuid() {
			const base = this.parent ? `${this.parent.uuid}.` : this.pack ? `Compendium.${this.pack}.` : "";
			return `${base}${this.documentName}.${this.id}`;
		}
		get isOwner() {
			return true;
		}
		get compendium() {
			return this.pack ? mundo.game.packs.get(this.pack) : undefined;
		}
		get sheet() {
			return { render: () => mundo.registrar("sheet.render", this.uuid), close() {} };
		}
		get link() {
			return `@UUID[${this.uuid}]{${this.name}}`;
		}
		get folder() {
			const id = this._source.folder;
			if (!id) return null;
			if (this.pack) return mundo.game.packs.get(this.pack)?.folders.get(id) ?? null;
			return mundo.game.folders?.get(id) ?? null;
		}
		set folder(v) {
			this._source.folder = v?.id ?? v ?? null;
		}
		testUserPermission(user, nivel) {
			if (user?.isGM) return true;
			const niveis = { NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3 };
			const n = typeof nivel === "string" ? niveis[nivel] : nivel;
			const o = this._source.ownership ?? {};
			return (o[user?.id] ?? o.default ?? 0) >= n;
		}
		getUserLevel(user) {
			return this.testUserPermission(user, 3) ? 3 : 0;
		}
		get hasPlayerOwner() {
			const o = this._source.ownership ?? {};
			return mundo.game.users.some((u) => !u.isGM && (o[u.id] ?? o.default ?? 0) >= 3);
		}

		toObject(source = true) {
			const out = U.deepClone(this._source);
			for (const campo of Object.values(EMBUTIDOS[this.documentName] ?? {})) {
				out[campo] = this[campo]?.contents.map((d) => d.toObject(source)) ?? [];
			}
			return out;
		}
		toJSON() {
			return this.toObject();
		}
		clone(data = {}, { save = false, keepId = false } = {}) {
			const obj = U.mergeObject(this.toObject(), data, { inplace: false });
			if (!keepId) delete obj._id;
			if (save) return this.constructor.create(obj, { parent: this.parent });
			return new this.constructor(obj, { parent: this.parent });
		}
		toAnchor() {
			return { outerHTML: `<a class="content-link" data-uuid="${this.uuid}">${this.name}</a>` };
		}

		getFlag(scope, key) {
			if (!["world", "core", "tormenta20"].includes(scope) && !mundo.game.modules.get(scope)?.active) {
				throw new Error(`Flag scope "${scope}" is not valid or not currently active`);
			}
			return U.getProperty(this._source.flags?.[scope] ?? {}, key);
		}
		async setFlag(scope, key, value) {
			this.getFlag(scope, key);
			return this.update({ [`flags.${scope}.${key}`]: value });
		}
		async unsetFlag(scope, key) {
			const head = key.split(".");
			const tail = `-=${head.pop()}`;
			const k = ["flags", scope, ...head, tail].join(".");
			return this.update({ [k]: null });
		}

		/* --- CRUD --- */

		static _colecaoDe(parent) {
			if (parent) {
				const campo = EMBUTIDOS[parent.documentName]?.[this.documentName];
				if (!campo) throw new Error(`${this.documentName} não pode ser embutido em ${parent.documentName}`);
				return parent[campo];
			}
			return mundo.colecoes[this.documentName];
		}

		static async create(data, operation = {}) {
			const r = await this.createDocuments([data], operation);
			return r[0];
		}

		static async createDocuments(data = [], operation = {}) {
			return mundo.op(async () => {
				const { parent = null, keepId = false, pack = null } = operation;
				if (pack) return mundo.game.packs.get(pack).criar(this, data, operation);
				const col = this._colecaoDe(parent);
				const criados = [];
				for (const d0 of data) {
					const d = d0 instanceof Document ? d0.toObject() : U.deepClone(d0);
					if (!keepId || !d._id) d._id = U.randomID();
					else if (col.has(d._id)) throw new Error(`O id ${d._id} já existe em ${this.documentName}`);
					const doc = new this(d, { parent });
					if (mundo.chamarHook(`preCreate${this.documentName}`, doc, d, operation, mundo.game.user.id) === false) continue;
					await doc._preCreateSistema?.(d, operation);
					col.set(doc.id, doc);
					criados.push(doc);
				}
				for (const doc of criados) mundo.chamarHook(`create${this.documentName}`, doc, operation, mundo.game.user.id);
				if (parent) parent._aposEmbutidos?.();
				mundo.registrar(`create${this.documentName}`, criados.map((d) => d.name));
				return criados;
			});
		}

		static async updateDocuments(updates = [], operation = {}) {
			return mundo.op(async () => {
				const col = this._colecaoDe(operation.parent);
				const out = [];
				for (const u of updates) {
					const doc = col.get(u._id);
					if (!doc) throw new Error(`${this.documentName} com id "${u._id}" não existe`);
					const { _id, ...resto } = u;
					out.push(await doc._aplicarUpdate(resto, operation));
				}
				return out.filter(Boolean);
			});
		}

		static async deleteDocuments(ids = [], operation = {}) {
			return mundo.op(async () => {
				const col = this._colecaoDe(operation.parent);
				const out = [];
				for (const id of ids) {
					const doc = col.get(id);
					if (!doc) throw new Error(`${this.documentName} com id "${id}" não existe`);
					if (mundo.chamarHook(`preDelete${this.documentName}`, doc, operation, mundo.game.user.id) === false) continue;
					col.delete(id);
					if (this.documentName === "Folder") {
						for (const c of Object.values(mundo.colecoes)) for (const d of c.values()) if (d._source.folder === id) d._source.folder = null, d.prepareData();
					}
					out.push(doc);
					mundo.chamarHook(`delete${this.documentName}`, doc, operation, mundo.game.user.id);
				}
				operation.parent?._aposEmbutidos?.();
				return out;
			});
		}

		async update(changes = {}, operation = {}) {
			return mundo.op(() => this._aplicarUpdate(changes, operation));
		}

		async _aplicarUpdate(changes, operation = {}) {
			if (changes instanceof Document) changes = changes.toObject();
			changes = U.expandObject(U.deepClone(changes));
			if (mundo.chamarHook(`preUpdate${this.documentName}`, this, changes, operation, mundo.game.user.id) === false) return null;
			const novo = this.toObject();
			const emb = EMBUTIDOS[this.documentName] ?? {};
			for (const campo of Object.values(emb)) {
				if (campo in changes) throw new Error(`Atualizar ${campo} por update() não é suportado: use updateEmbeddedDocuments`);
			}
			U.mergeObject(novo, changes, { performDeletions: true });
			const embutidos = {};
			for (const campo of Object.values(emb)) {
				embutidos[campo] = this[campo];
				delete novo[campo];
			}
			this._initSource({ ...novo, ...Object.fromEntries(Object.keys(embutidos).map((c) => [c, []])) });
			for (const [campo, col] of Object.entries(embutidos)) {
				Object.defineProperty(this, campo, { value: col, writable: true, enumerable: false, configurable: true });
			}
			this.prepareData();
			this.parent?._aposEmbutidos?.();
			mundo.chamarHook(`update${this.documentName}`, this, changes, operation, mundo.game.user.id);
			return this;
		}

		async delete(operation = {}) {
			const r = await this.constructor.deleteDocuments([this.id], { ...operation, parent: this.parent });
			return r[0];
		}

		getEmbeddedCollection(nome) {
			const campo = EMBUTIDOS[this.documentName]?.[nome];
			if (!campo) throw new Error(`${nome} não é embutido em ${this.documentName}`);
			return this[campo];
		}
		getEmbeddedDocument(nome, id) {
			return this.getEmbeddedCollection(nome).get(id);
		}
		async createEmbeddedDocuments(nome, data = [], operation = {}) {
			const Cls = mundo.classes[nome];
			if (this.pack) throw new Error("Documento de compêndio é somente leitura na simulação");
			return Cls.createDocuments(data, { ...operation, parent: this });
		}
		async updateEmbeddedDocuments(nome, updates = [], operation = {}) {
			return mundo.classes[nome].updateDocuments(updates, { ...operation, parent: this });
		}
		async deleteEmbeddedDocuments(nome, ids = [], operation = {}) {
			return mundo.classes[nome].deleteDocuments(ids, { ...operation, parent: this });
		}
		_aposEmbutidos() {
			this.prepareData();
		}
	}

	return { Document, relatar };
}
