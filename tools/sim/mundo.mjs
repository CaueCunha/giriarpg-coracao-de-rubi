/**
 * Mundo do Foundry simulado (v14 + Tormenta20 1.6.x), para rodar geradores e macros sem um
 * Foundry de verdade. Ver tools/sim/README.md.
 *
 *   const mundo = await criarMundo();
 *   await mundo.executar(codigo, { nome: "gerador" });
 *   mundo.relatorio  // descartes, erros de validação e usos legados
 *   mundo.erros      // exceções (inclusive de promessas soltas) e console.error
 */
import "./proto.mjs";
import vm from "node:vm";
import * as U from "./utils.mjs";
import * as F from "./fields.mjs";
import { stub, classeStub, mixinStub } from "./stub.mjs";
import { Collection, criarClasses } from "./documentos.mjs";
import { Roll, Die, NumericTerm, OperatorTerm } from "./dados.mjs";
import { window, criarDialogV2, criarFormDataExtended, politicaPadrao } from "./dialogos.mjs";
import { carregarSistema } from "./sistema.mjs";
import fs from "node:fs";

const AsyncFunction = (async () => {}).constructor;

/** Instala o mínimo de globais para o código do sistema poder ser importado. */
function globaisBase() {
	if (globalThis.__simBase) return;
	globalThis.__simBase = true;
	globalThis.__simAvisos = [];
	const foundry = stub("foundry");
	foundry.utils = { ...U, fromUuidSync: (u) => globalThis.fromUuidSync?.(u) };
	foundry.data = { fields: F.fields, ActiveEffectTypeDataModel: F.ActiveEffectTypeDataModel, validation: { DataModelValidationError: F.DataModelValidationError } };
	foundry.abstract = { DataModel: F.DataModel, TypeDataModel: F.TypeDataModel };
	const api = stub("foundry.applications.api");
	api.ApplicationV2 = classeStub("ApplicationV2");
	api.DocumentSheetV2 = classeStub("DocumentSheetV2");
	api.DialogV2 = classeStub("DialogV2");
	api.HandlebarsApplicationMixin = mixinStub;
	foundry.applications = stub("foundry.applications");
	foundry.applications.api = api;
	globalThis.foundry = foundry;
	globalThis.CONFIG = new Proxy({}, { get(t, p) { if (!(p in t)) t[p] = { compendiumIndexFields: [] }; return t[p]; } });
	for (const n of ["DocumentSheet", "FormApplication", "Application", "Dialog", "ActorSheet", "ItemSheet"]) globalThis[n] ??= classeStub(n);
	globalThis.game ??= stub("game");
	globalThis.Hooks ??= stub("Hooks");
	globalThis.ui ??= stub("ui");
}

const STATUS_FOLDER = "STATUSEFFECTS000";

export async function criarMundo({ semente = "cdr", usuario = "Mestre", gm = true, politica = politicaPadrao } = {}) {
	globaisBase();
	const sistema = await carregarSistema();
	U.fixarSemente(semente);

	const mundo = {
		sistema,
		relatorio: [],
		erros: [],
		chat: [],
		notificacoes: [],
		dialogos: [],
		eventos: [],
		politica,
		contexto: { atual: "mundo" },
		pendentes: 0,
		hooks: new Map(),
		hookId: 0,
		silencioso: 0
	};

	mundo.op = async (fn) => {
		mundo.pendentes++;
		try {
			return await fn();
		} finally {
			mundo.pendentes--;
		}
	};
	mundo.registrar = (tipo, dados) => mundo.eventos.push({ tipo, dados, origem: mundo.contexto.atual });

	mundo.chamarHook = (nome, ...args) => {
		const lista = mundo.hooks.get(nome) ?? [];
		for (const h of [...lista]) {
			try {
				const r = h.fn(...args);
				if (h.once) Hooks.off(nome, h.id);
				if (r === false) return false;
				if (r && typeof r.then === "function") r.catch((err) => mundo.erros.push({ origem: `hook ${nome}`, erro: err }));
			} catch (err) {
				mundo.erros.push({ origem: `hook ${nome}`, erro: err });
			}
		}
		return true;
	};

	const Hooks = {
		on(nome, fn) {
			const id = ++mundo.hookId;
			if (!mundo.hooks.has(nome)) mundo.hooks.set(nome, []);
			mundo.hooks.get(nome).push({ id, fn });
			return id;
		},
		once(nome, fn) {
			const id = Hooks.on(nome, fn);
			mundo.hooks.get(nome).at(-1).once = true;
			return id;
		},
		off(nome, idOuFn) {
			const l = mundo.hooks.get(nome);
			if (!l) return;
			const i = l.findIndex((h) => h.id === idOuFn || h.fn === idOuFn);
			if (i >= 0) l.splice(i, 1);
		},
		call: (n, ...a) => mundo.chamarHook(n, ...a),
		callAll: (n, ...a) => {
			mundo.chamarHook(n, ...a);
			return true;
		},
		get events() {
			return Object.fromEntries(mundo.hooks);
		}
	};
	mundo.Hooks = Hooks;

	// silencia o relatório quando estamos lendo dados do próprio sistema
	const relatorioPush = mundo.relatorio.push.bind(mundo.relatorio);
	mundo.relatorio.push = (...itens) => (mundo.silencioso ? mundo.relatorio.length : relatorioPush(...itens));

	const { Document, relatar } = criarClasses(mundo);
	mundo.relatar = relatar;

	/* ---------------------------------------------------------------- */
	/* Documentos específicos                                             */
	/* ---------------------------------------------------------------- */

	const nivelDe = (a) => {
		const s = a.system;
		if (a.type === "character") return Number(s.attributes?.nivel?.value) || 1;
		const nd = String(s.attributes?.nd ?? "1");
		if (nd.includes("/")) return 0;
		return Number(nd) || 1;
	};

	class Actor extends Document {
		static documentName = "Actor";
		static get collectionName() {
			return "actors";
		}
		prepareDerivedData() {
			const s = this.system;
			if (!s?.atributos) return;
			for (const a of Object.values(s.atributos)) a.value = (Number(a.base) || 0) + (Number(a.bonus) || 0) + (Number(a.racial) || 0);
			const nivel = nivelDe(this);
			const treino = nivel >= 15 ? 6 : nivel >= 7 ? 4 : 2;
			for (const [k, p] of Object.entries(s.pericias ?? {})) {
				const atr = s.atributos[p.atributo]?.value ?? 0;
				p.value = Math.floor(nivel / 2) + atr + (p.treinado ? treino : 0) + (Number(p.outros) || 0);
				p.mod = p.value;
				p.key ??= k;
			}
			const d = s.attributes?.defesa;
			if (d) d.value = (Number(d.base) || 0) + (s.atributos[d.atributo || "des"]?.value ?? 0) + (Number(d.outros) || 0);
		}
		get statuses() {
			const st = new Set();
			for (const e of this.allApplicableEffects()) if (!e.disabled) for (const s of e.statuses) st.add(s);
			return st;
		}
		*allApplicableEffects() {
			for (const e of this.effects ?? []) yield e;
			for (const i of this.items ?? []) for (const e of i.effects ?? []) if (e.transfer) yield e;
		}
		get appliedEffects() {
			return [...this.allApplicableEffects()].filter((e) => !e.disabled);
		}
		get temporaryEffects() {
			return this.appliedEffects.filter((e) => e.isTemporary);
		}
		get isToken() {
			return !!this._token;
		}
		get token() {
			return this._token ?? null;
		}
		get prototypeToken() {
			return { ...U.deepClone(this._source.prototypeToken ?? {}), texture: U.deepClone(this._source.prototypeToken?.texture ?? {}) };
		}
		set prototypeToken(v) {}
		hasStatusEffect(id) {
			return this.statuses.has(id);
		}
		getRollData() {
			const d = U.deepClone(this.system);
			d.nivel = nivelDe(this);
			return d;
		}
		getActiveTokens(linked = false, document = false) {
			const ts = mundo.canvas.tokens.placeables.filter((t) => t.actor?.id === this.id && (!linked || t.document.actorLink));
			return document ? ts.map((t) => t.document) : ts;
		}
		async getTokenDocument(data = {}) {
			const proto = U.deepClone(this._source.prototypeToken ?? {});
			return new TokenDocument({ ...proto, name: proto.name ?? this.name, actorId: this.id, ...data }, { parent: mundo.canvas.scene });
		}
		async toggleStatusEffect(statusId, { active, overlay = false } = {}) {
			return mundo.op(async () => {
				const st = CONFIG.statusEffects[statusId];
				if (!st) throw new Error(`Invalid status ID "${statusId}" provided to Actor#toggleStatusEffect`);
				const existentes = this.effects.filter((e) => e.statuses.has(statusId));
				const ligado = existentes.length > 0;
				active ??= !ligado;
				if (active === ligado) return active ? existentes[0] : false;
				if (!active) {
					await this.deleteEmbeddedDocuments("ActiveEffect", existentes.map((e) => e.id));
					return false;
				}
				const data = U.deepClone(st._source);
				data.statuses = [statusId];
				if (overlay) U.setProperty(data, "flags.core.overlay", true);
				// dados vêm do compêndio de condições do próprio sistema
				mundo.silencioso++;
				try {
					const [ef] = await this.createEmbeddedDocuments("ActiveEffect", [data]);
					return ef;
				} finally {
					mundo.silencioso--;
				}
			});
		}
		async applyDamageV2(roll, multiplier = 1, type = "dano") {
			const { pv, pm } = this.system.attributes;
			const rds = this.system.tracos?.resistencias ?? {};
			if (!roll?.terms) throw new TypeError("applyDamageV2 espera um Roll");
			const final = { damage: 0, loss: 0, heal: 0, tempHP: 0, mana: 0, manaGain: 0, tempMP: 0 };
			const damage = {};
			let lastOperator = "+";
			for (const { operator, total, options, faces, number } of roll.terms) {
				if (!operator) {
					const flavor = options?.flavor || roll.terms[0]?.options.flavor || type;
					damage[flavor] ??= { value: 0, porDado: 0, rd: Number(rds[flavor]?.value) || 0 };
					damage[flavor].value += lastOperator === "+" ? total : total * -1;
					if (faces) damage[flavor].porDado += number;
				} else lastOperator = operator;
			}
			const map = { curapv: "heal", curatpv: "tempHP", curapm: "manaGain", curatpm: "tempMP" };
			for (const [key, value] of Object.entries(map)) if (damage[key]) {
				final[value] += damage[key].value * -multiplier;
				delete damage[key];
			}
			if (damage.perda) {
				if (multiplier > 0) final.loss += damage.perda.value * multiplier;
				else final.heal += damage.perda.value;
				delete damage.perda;
			}
			if (rds.dano?.value) final.damage -= rds.dano.value;
			for (const [t, dmg] of Object.entries(damage)) {
				const rd = t !== "dano" ? Number(rds[t]?.value ?? 0) : 0;
				if (multiplier > 0) {
					if (rds[t]?.imunidade) dmg.value = 0;
					else if (rds[t]?.vulnerabilidade) dmg.value = Math.floor(dmg.value * 1.5);
					else if (rds[t]?.danoPorDado) dmg.value += dmg.porDado;
					final.damage += Math.max(dmg.value * multiplier - rd, 0);
				} else final.heal += dmg.value;
			}
			final.damage = Math.max(final.damage, 0);
			const hpt = Math.min(pv.temp, final.damage + final.loss);
			const mpt = Math.min(pm.temp, final.mana);
			const dhp = Math.clamp(pv.value + final.heal - (final.damage + final.loss - hpt), pv.min ?? -999, pv.max);
			const dmp = Math.clamp(pm.value + final.manaGain - (final.mana - mpt), pm.min ?? 0, pm.max);
			await this.update({
				"system.attributes.pv.temp": pv.temp - hpt + final.tempHP,
				"system.attributes.pv.value": dhp,
				"system.attributes.pm.temp": pm.temp - mpt + final.tempMP,
				"system.attributes.pm.value": dmp
			});
			await mundo.ChatMessage.create({ content: `<div class="damage-card">${this.name}: ${JSON.stringify(final)}</div>` });
		}
		async spendMana(amount = 0, adjust = 0, recover) {
			const pm = this.system.attributes.pm;
			const tmp = parseInt(pm.temp) || 0;
			let valor;
			let gastoTmp = 0;
			if (recover) valor = Math.clamp(pm.value + amount, 0, pm.max);
			else {
				amount = Math.floor(parseInt(amount) + adjust);
				gastoTmp = amount > 0 ? Math.min(tmp, amount) : 0;
				valor = Math.clamp(pm.value - (amount - gastoTmp), 0, pm.max);
			}
			await this.update({ "system.attributes.pm.temp": tmp - gastoTmp, "system.attributes.pm.value": valor });
		}
		async rollPericia(key, options = {}) {
			const p = this.system.pericias?.[key];
			if (!p) throw new Error(`Perícia "${key}" não existe em ${this.name}`);
			const roll = await new Roll(`1d20 + ${p.value}`).evaluate();
			if (options.message !== false) await roll.toMessage({ speaker: mundo.ChatMessage.getSpeaker({ actor: this }), flavor: key });
			return roll;
		}
		async rollAtributo(key, options = {}) {
			const a = this.system.atributos?.[key];
			if (!a) throw new Error(`Atributo "${key}" não existe`);
			const roll = await new Roll(`1d20 + ${a.value}`).evaluate();
			if (options.message !== false) await roll.toMessage({ speaker: mundo.ChatMessage.getSpeaker({ actor: this }) });
			return roll;
		}
	}

	class Item extends Document {
		static documentName = "Item";
		static get collectionName() {
			return "items";
		}
		get actor() {
			return this.parent?.documentName === "Actor" ? this.parent : null;
		}
		getRollData() {
			return { ...(this.actor?.getRollData() ?? {}), item: U.deepClone(this.system) };
		}
		get transferredEffects() {
			return this.effects.filter((e) => e.transfer);
		}
	}

	class ActiveEffect extends Document {
		static documentName = "ActiveEffect";
		static get collectionName() {
			return "effects";
		}
		prepareDerivedData() {
			Object.defineProperty(this, "statuses", { value: new Set(this._source.statuses ?? []), writable: true, enumerable: true, configurable: true });
		}
		get target() {
			return this.parent?.documentName === "Actor" ? this.parent : this.parent?.parent ?? null;
		}
		get active() {
			return !this.disabled;
		}
		get isTemporary() {
			return !!this.duration?.expiry || Number.isFinite(this.duration?.value);
		}
		get isSuppressed() {
			return false;
		}
		get changes() {
			return this.system?.changes ?? [];
		}
		static async fromStatusEffect(statusId) {
			const st = CONFIG.statusEffects[statusId];
			if (!st) throw new Error(`Invalid status ID "${statusId}"`);
			return new this({ ...U.deepClone(st._source), statuses: [statusId] });
		}
	}

	class JournalEntry extends Document {
		static documentName = "JournalEntry";
		static get collectionName() {
			return "journal";
		}
	}
	class JournalEntryPage extends Document {
		static documentName = "JournalEntryPage";
		static get collectionName() {
			return "pages";
		}
	}

	class TableResult extends Document {
		static documentName = "TableResult";
		static get collectionName() {
			return "results";
		}
		getHTML() {
			return this.description || this.name;
		}
		get text() {
			return this.description || this.name;
		}
		async getChatText() {
			return this.description || this.name;
		}
	}

	class RollTable extends Document {
		static documentName = "RollTable";
		static get collectionName() {
			return "tables";
		}
		async roll({ roll } = {}) {
			roll ??= await new Roll(this.formula || `1d${this.results.size}`).evaluate();
			const results = this.results.filter((r) => r.range[0] <= roll.total && roll.total <= r.range[1]);
			if (!results.length) mundo.relatar(this, "aviso", "results", roll.total, `nenhum resultado cobre o valor ${roll.total} da fórmula ${this.formula}`);
			return { roll, results };
		}
		async draw({ roll, displayChat = true, messageData = {} } = {}) {
			const r = await this.roll({ roll });
			if (displayChat) await mundo.ChatMessage.create({ ...messageData, content: `<h3>${this.name}</h3>${r.results.map((x) => x.text).join("<br>")}`, rolls: [r.roll] });
			return r;
		}
		getResultsForRoll(v) {
			return this.results.filter((r) => r.range[0] <= v && v <= r.range[1]);
		}
	}

	class Macro extends Document {
		static documentName = "Macro";
		static get collectionName() {
			return "macros";
		}
		canExecute() {
			return true;
		}
		async execute(scope = {}) {
			if (this.type === "chat") return mundo.ChatMessage.create({ content: this.command });
			return mundo.executar(this.command, { nome: `macro "${this.name}"`, macro: this, scope });
		}
	}

	class Folder extends Document {
		static documentName = "Folder";
		static get collectionName() {
			return "folders";
		}
		get contents() {
			const col = mundo.colecoes[this.type];
			return col ? col.filter((d) => d._source.folder === this.id) : [];
		}
		get children() {
			return mundo.colecoes.Folder.filter((f) => f._source.folder === this.id).map((folder) => ({ folder }));
		}
		get ancestors() {
			const out = [];
			let p = this.folder;
			while (p) {
				out.push(p);
				p = p.folder;
			}
			return out;
		}
	}

	class User extends Document {
		static documentName = "User";
		get isGM() {
			return (this._source.role ?? 1) >= 4;
		}
		get role() {
			return this._source.role ?? 1;
		}
		get active() {
			return true;
		}
		get isSelf() {
			return globalThis.game?.user === this;
		}
		get character() {
			return mundo.colecoes.Actor.get(this._source.character) ?? null;
		}
		get isActiveGM() {
			return this.isGM;
		}
		get viewedScene() {
			return mundo.canvas.scene?.id ?? null;
		}
		updateTokenTargets(ids = []) {
			this.targets.clear();
			for (const id of ids) {
				const t = mundo.canvas.tokens.get(id);
				if (t) this.targets.add(t);
			}
		}
	}

	class TokenDocument extends Document {
		static documentName = "Token";
		static get collectionName() {
			return "tokens";
		}
		get actor() {
			const base = mundo.colecoes.Actor.get(this._source.actorId);
			if (!base) return null;
			if (this._source.actorLink) return base;
			if (!this._sintetico || this._sintetico._baseVersao !== base) {
				const s = new Actor(U.mergeObject(base.toObject(), this._source.delta ?? {}, { inplace: false }), { parent: null, validar: false });
				s._token = this;
				s._baseVersao = base;
				this._sintetico = s;
			}
			return this._sintetico;
		}
		get object() {
			return mundo.canvas.tokens.get(this.id) ?? null;
		}
		get isLinked() {
			return !!this._source.actorLink;
		}
	}

	class AmbientLight extends Document {
		static documentName = "AmbientLight";
		static get collectionName() {
			return "lights";
		}
	}

	class Scene extends Document {
		static documentName = "Scene";
		static get collectionName() {
			return "scenes";
		}
	}

	class ChatMessage extends Document {
		static documentName = "ChatMessage";
		static get collectionName() {
			return "messages";
		}
		static async create(data = {}, operation = {}) {
			return mundo.op(async () => {
				const d = data instanceof Document ? data.toObject() : { ...data };
				if (d.rolls) {
					for (const r of d.rolls) if (r && !r._evaluated && r instanceof Roll) mundo.relatar({ documentName: "ChatMessage", name: "" }, "aviso", "rolls", r.formula, "rolagem não avaliada mandada ao chat");
				}
				if (typeof d.content !== "string" && d.content !== undefined) d.content = String(d.content);
				const msg = { id: U.randomID(), ...d, timestamp: Date.now(), origem: mundo.contexto.atual };
				mundo.chat.push(msg);
				verificarLinks(d.content ?? "", `chat (${mundo.contexto.atual})`);
				mundo.chamarHook("createChatMessage", msg, operation, mundo.game.user.id);
				return msg;
			});
		}
		static getSpeaker({ actor, token, alias, scene } = {}) {
			return { scene: scene?.id ?? mundo.canvas.scene?.id ?? null, actor: actor?.id ?? token?.actor?.id ?? null, token: token?.id ?? null, alias: alias ?? actor?.name ?? token?.name ?? mundo.game.user.name };
		}
		static getWhisperRecipients(name) {
			if (name === "GM" || name === "gm") return mundo.game.users.filter((u) => u.isGM);
			return mundo.game.users.filter((u) => u.name === name);
		}
		static applyMode(chatData, mode) {
			if (mode === "gmroll" || mode === "blindroll" || mode === "self") chatData.whisper = mundo.game.users.filter((u) => u.isGM).map((u) => u.id);
			return chatData;
		}
		static getRollData() {
			return {};
		}
	}

	class Combatant extends Document {
		static documentName = "Combatant";
		static get collectionName() {
			return "combatants";
		}
		get combat() {
			return this.parent;
		}
		get token() {
			const cena = mundo.colecoes.Scene.get(this._source.sceneId) ?? mundo.canvas.scene;
			return cena?.tokens.get(this._source.tokenId) ?? null;
		}
		get actor() {
			return this.token?.actor ?? mundo.colecoes.Actor.get(this._source.actorId) ?? null;
		}
		get isNPC() {
			return this.actor?.type === "npc";
		}
		get players() {
			return mundo.game.users.filter((u) => !u.isGM && this.actor?.testUserPermission(u, 3));
		}
	}

	class Combat extends Document {
		static documentName = "Combat";
		static get collectionName() {
			return "combats";
		}
		get turns() {
			return this.combatants.contents.sort((a, b) => (b.initiative ?? -99) - (a.initiative ?? -99) || a.name.localeCompare(b.name));
		}
		get combatant() {
			return this.turns[this.turn ?? 0] ?? null;
		}
		get scene() {
			return mundo.colecoes.Scene.get(this._source.scene) ?? null;
		}
		get isActive() {
			return this._source.active;
		}
		async rollAll() {
			for (const c of this.combatants) {
				const r = await new Roll(`1d20 + ${c.actor?.system?.pericias?.inic?.value ?? 0}`).evaluate();
				await c.update({ initiative: r.total });
			}
			return this;
		}
		async rollInitiative(ids) {
			for (const id of [].concat(ids)) {
				const c = this.combatants.get(id);
				const r = await new Roll(`1d20 + ${c?.actor?.system?.pericias?.inic?.value ?? 0}`).evaluate();
				await c?.update({ initiative: r.total });
			}
			return this;
		}
		async startCombat() {
			await this.rollAll();
			return this.update({ round: 1, turn: 0, started: true });
		}
		async nextTurn() {
			const n = this.combatants.size;
			const t = (this.turn ?? 0) + 1;
			if (t >= n) return this.nextRound();
			return this.update({ turn: t });
		}
		async nextRound() {
			return this.update({ round: (this.round ?? 0) + 1, turn: 0 });
		}
		async endCombat() {
			await this.delete();
			if (mundo.game.combat === this) mundo.game.combat = null;
			return this;
		}
	}

	const classes = { Actor, Item, ActiveEffect, JournalEntry, JournalEntryPage, RollTable, TableResult, Macro, Folder, User, Token: TokenDocument, AmbientLight, Scene, ChatMessage, Combat, Combatant };
	mundo.classes = classes;
	mundo.ChatMessage = ChatMessage;

	// Esquemas soltos para documentos que não validamos
	const { ESQUEMAS } = await import("./documentos.mjs");
	ESQUEMAS.User ??= () => ({ _id: new F.fields.DocumentIdField(), name: new F.fields.StringField(), role: new F.fields.NumberField({ initial: 1 }), character: new F.fields.StringField({ nullable: true, initial: null }), flags: new F.fields.ObjectField(), color: new F.fields.StringField() });

	/* ---------------------------------------------------------------- */
	/* Coleções do mundo                                                  */
	/* ---------------------------------------------------------------- */

	const nomesColecao = { Actor: "actors", Item: "items", JournalEntry: "journal", RollTable: "tables", Macro: "macros", Folder: "folders", User: "users", Scene: "scenes", ChatMessage: "messages", Combat: "combats" };
	mundo.colecoes = {};
	for (const [nome] of Object.entries(nomesColecao)) {
		const c = new Collection();
		c.documentName = nome;
		c.documentClass = classes[nome];
		c.getName = Collection.prototype.getName;
		mundo.colecoes[nome] = c;
	}

	/* ---------------------------------------------------------------- */
	/* Compêndios                                                         */
	/* ---------------------------------------------------------------- */

	class CompendiumCollection extends Collection {
		constructor(meta, docs = [], pastas = []) {
			super();
			this.metadata = { ...meta, id: meta.id, label: meta.label, type: meta.type, name: meta.name, packageName: meta.packageName, packageType: meta.packageType };
			this.collection = meta.id;
			this.documentName = meta.type;
			this.documentClass = classes[meta.type];
			this._fontes = new Map(docs.map((d) => [d._id, d]));
			this.folders = new Collection();
			this.locked = true;
			for (const p of pastas) {
				mundo.silencioso++;
				try {
					this.folders.set(p._id, new Folder(p, { pack: this.collection }));
				} finally {
					mundo.silencioso--;
				}
			}
			this.index = new Collection();
			for (const d of docs) this.index.set(d._id, this._entradaIndice(d));
		}
		get title() {
			return this.metadata.label;
		}
		_entradaIndice(d) {
			return { _id: d._id, name: d.name, type: d.type, img: d.img, folder: d.folder ?? null, uuid: `Compendium.${this.collection}.${this.documentName}.${d._id}`, system: d.system };
		}
		async getIndex({ fields = [] } = {}) {
			// como no Foundry: os campos pedidos entram no índice
			for (const [id, e] of this.index.entries()) {
				const src = this._fontes.get(id);
				for (const f of fields) {
					const v = U.getProperty(src, f);
					if (v !== undefined) U.setProperty(e, f, U.deepClone(v));
				}
			}
			return this.index;
		}
		async getDocument(id) {
			return mundo.op(async () => {
				const src = this._fontes.get(id);
				if (!src) return undefined;
				if (!this.has(id)) {
					mundo.silencioso++;
					try {
						this.set(id, new this.documentClass(U.deepClone(src), { pack: this.collection, validar: this.metadata.packageType !== "system" }));
					} finally {
						mundo.silencioso--;
					}
				}
				return this.get(id);
			});
		}
		async getDocuments(query = {}) {
			const out = [];
			for (const id of this._fontes.keys()) out.push(await this.getDocument(id));
			return out.filter((d) => Object.entries(query).every(([k, v]) => U.getProperty(d, k) === v));
		}
		async configure(o) {
			Object.assign(this, o);
		}
		async importDocument(doc, o = {}) {
			return this.documentClass.create(doc.toObject(), o);
		}
		/** createDocuments(..., { pack }): grava no compêndio (sem validar além do construtor). */
		async criar(Cls, data, { keepId = false } = {}) {
			if (this.locked) throw new Error(`O compêndio ${this.collection} está travado`);
			const out = [];
			for (const d0 of data) {
				const d = U.deepClone(typeof d0?.toObject === "function" ? d0.toObject() : d0);
				if (!keepId || !d._id || this._fontes.has(d._id)) d._id = U.randomID();
				this._fontes.set(d._id, d);
				this.index.set(d._id, this._entradaIndice(d));
				out.push(await this.getDocument(d._id));
			}
			return out;
		}
		/** Como no Foundry: cria um compêndio do mundo. */
		static async createCompendium(meta) {
			const name = meta.name ?? String(meta.label).toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
			const id = `world.${name}`;
			if (packs.has(id)) throw new Error(`O compêndio ${id} já existe`);
			const p = new CompendiumCollection({ id, name, label: meta.label, type: meta.type, packageName: "world", packageType: "world" });
			p.locked = false;
			packs.set(id, p);
			return p;
		}
	}
	mundo.CompendiumCollection = CompendiumCollection;

	const packs = new Collection();
	for (const [id, p] of Object.entries(sistema.packs)) {
		packs.set(id, new CompendiumCollection({ id, label: p.label, type: p.type, name: p.name, packageName: "tormenta20", packageType: "system" }, p.docs, p.pastas));
	}


	/* ---------------------------------------------------------------- */
	/* CONFIG, game, canvas, ui                                           */
	/* ---------------------------------------------------------------- */

	const config = globalThis.CONFIG;
	for (const [nome, Cls] of Object.entries(classes)) {
		config[nome] = { ...(config[nome] ?? {}), documentClass: Cls, compendiumIndexFields: config[nome]?.compendiumIndexFields ?? [] };
	}
	config.Actor.dataModels = sistema.modelos.Actor;
	config.Item.dataModels = sistema.modelos.Item;
	config.ActiveEffect.dataModels = sistema.modelos.ActiveEffect;
	config.T20 = sistema.T20;
	config.statusEffects = {};
	{
		const ef = sistema.packs["tormenta20.efeitos"];
		for (const d of ef.docs) {
			if (d.folder !== STATUS_FOLDER || !d.statuses?.length) continue;
			const id = d.statuses[0];
			const src = U.deepClone(d);
			delete src._id;
			delete src._key;
			config.statusEffects[id] = { id, name: d.name, img: d.img, _source: src };
		}
	}
	config.specialStatusEffects = { BLIND: "cego", DEFEATED: "morto", INVISIBLE: "invisivel" };
	config.time = { roundTime: 6 };
	config.Dice = { rolls: [Roll], terms: { d: Die } };

	const configuracoes = new Map([
		["tormenta20.showDamageCards", "all"],
		["tormenta20.automaticEffects", true],
		["core.rollMode", "publicroll"]
	]);
	const settings = {
		register(scope, key, data) {
			// como no Foundry, registrar de novo não apaga o valor já guardado no mundo
			if (!configuracoes.has(`${scope}.${key}`)) configuracoes.set(`${scope}.${key}`, data.default);
			settings._registro.set(`${scope}.${key}`, data);
		},
		registerMenu(scope, key, data) {
			settings._menus.set(`${scope}.${key}`, data);
		},
		get(scope, key) {
			const k = `${scope}.${key}`;
			if (!configuracoes.has(k)) throw new Error(`"${k}" is not a registered game setting`);
			return U.deepClone(configuracoes.get(k));
		},
		async set(scope, key, v) {
			const k = `${scope}.${key}`;
			if (!configuracoes.has(k)) throw new Error(`"${k}" is not a registered game setting`);
			configuracoes.set(k, v);
			return v;
		},
		_registro: new Map(),
		_menus: new Map()
	};

	const modules = new Collection();

	const game = {
		system: { id: "tormenta20", version: sistema.versao },
		version: "14.366",
		release: { generation: 14 },
		world: { id: "cdr-teste", title: "Coração de Rubi (simulação)" },
		ready: true,
		actors: mundo.colecoes.Actor,
		items: mundo.colecoes.Item,
		journal: mundo.colecoes.JournalEntry,
		tables: mundo.colecoes.RollTable,
		macros: mundo.colecoes.Macro,
		folders: mundo.colecoes.Folder,
		users: mundo.colecoes.User,
		scenes: mundo.colecoes.Scene,
		messages: mundo.colecoes.ChatMessage,
		packs,
		modules,
		settings,
		combat: null,
		get combats() {
			return mundo.colecoes.Combat;
		},
		time: { worldTime: 0, async advance(s) { game.time.worldTime += s; } },
		i18n: { lang: "pt-BR", localize: (k) => k, format: (k, d) => `${k} ${JSON.stringify(d ?? {})}`, has: () => false },
		keyboard: { isModifierActive: () => false },
		paused: false,
		get user() {
			return mundo.usuario;
		},
		get tormenta20() {
			return globalThis.tormenta20;
		}
	};
	mundo.game = game;

	Object.defineProperty(mundo.colecoes.User, "activeGM", { get: () => mundo.colecoes.User.find((u) => u.isGM) ?? null });
	const mestre = new User({ _id: U.randomID(), name: usuario, role: gm ? 4 : 1 });
	mestre.targets = new Set();
	mundo.colecoes.User.set(mestre.id, mestre);
	mundo.usuario = mestre;

	class TokenSim {
		constructor(doc) {
			this.document = doc;
			this.id = doc.id;
			this.controlled = false;
		}
		get actor() {
			return this.document.actor;
		}
		get name() {
			return this.document.name;
		}
		get x() {
			return this.document.x;
		}
		get y() {
			return this.document.y;
		}
		get center() {
			return { x: this.document.x + 50, y: this.document.y + 50 };
		}
		get isOwner() {
			return true;
		}
		get inCombat() {
			return false;
		}
		control({ releaseOthers = true } = {}) {
			if (releaseOthers) for (const t of mundo.canvas.tokens.placeables) t.controlled = false;
			this.controlled = true;
			return true;
		}
		release() {
			this.controlled = false;
		}
		setTarget(v = true, { user = mestre, releaseOthers = true } = {}) {
			if (releaseOthers) user.targets.clear();
			if (v) user.targets.add(this);
			else user.targets.delete(this);
		}
	}
	mundo.TokenSim = TokenSim;

	const tokensLayer = {
		_objs: new Map(),
		get placeables() {
			const cena = mundo.canvas.scene;
			if (!cena) return [];
			const out = [];
			for (const doc of cena.tokens.values()) {
				if (!this._objs.has(doc.id) || this._objs.get(doc.id).document !== doc) this._objs.set(doc.id, new TokenSim(doc));
				out.push(this._objs.get(doc.id));
			}
			return out;
		},
		get controlled() {
			return this.placeables.filter((t) => t.controlled);
		},
		get(id) {
			return this.placeables.find((t) => t.id === id);
		},
		releaseAll() {
			for (const t of this.placeables) t.controlled = false;
		}
	};
	mundo.canvas = {
		ready: true,
		scene: null,
		tokens: tokensLayer,
		grid: { size: 100, distance: 1.5, units: "m", measurePath: () => ({ distance: 1.5 }) },
		stage: { pivot: { x: 1000, y: 1000 }, scale: { x: 1, y: 1 } },
		dimensions: { size: 100, distance: 1.5, width: 4000, height: 3000 },
		animatePan: async () => {},
		ping: async () => {}
	};

	const notificar = (tipo) => (msg) => {
		mundo.notificacoes.push({ tipo, msg: String(msg), origem: mundo.contexto.atual });
		return { id: mundo.notificacoes.length };
	};
	const ui = {
		notifications: { info: notificar("info"), warn: notificar("warn"), error: notificar("error"), notify: (m, t = "info") => notificar(t)(m) },
		chat: { scrollBottom() {}, render() {} },
		sidebar: { activateTab() {}, changeTab() {} },
		actors: { render() {} },
		items: { render() {} },
		journal: { render() {} },
		macros: { render() {} },
		tables: { render() {} },
		compendium: { render() {} },
		hotbar: { render() {} }
	};

	/* ---------------------------------------------------------------- */
	/* UUIDs e links                                                       */
	/* ---------------------------------------------------------------- */

	const COLECAO_POR_NOME = { Actor: "Actor", Item: "Item", JournalEntry: "JournalEntry", RollTable: "RollTable", Macro: "Macro", Folder: "Folder", Scene: "Scene", User: "User" };
	function resolverUuid(uuid, { sincrono = false } = {}) {
		if (typeof uuid !== "string" || !uuid) return null;
		const p = uuid.split(".");
		let doc;
		let resto;
		if (p[0] === "Compendium") {
			const pack = packs.get(`${p[1]}.${p[2]}`);
			if (!pack) return null;
			const id = p[3] === pack.documentName ? p[4] : p[3];
			resto = p[3] === pack.documentName ? p.slice(5) : p.slice(4);
			if (sincrono && !pack.get(id) && pack._fontes.has(id)) {
				// documento (ou embutido) ainda não carregado: responde pela fonte, como o índice do Foundry
				let src = pack._fontes.get(id);
				for (let i = 0; src && i + 1 < resto.length; i += 2) {
					const campo = { Item: "items", ActiveEffect: "effects", JournalEntryPage: "pages", TableResult: "results" }[resto[i]];
					src = campo ? src[campo]?.find((e) => e._id === resto[i + 1]) : null;
				}
				return src ? { id: src._id, name: src.name, uuid, _indice: true } : null;
			}
			if (sincrono) doc = pack.get(id) ?? null;
			else doc = pack._fontes.has(id) ? { pack, id } : null;
			if (doc?.pack) return { pack, id, resto };
			if (!doc) return null;
		} else {
			if (p[0] === "Token" || p[0] === "Scene") {
				const cena = mundo.colecoes.Scene.get(p[1]);
				doc = cena;
				resto = p.slice(2);
			} else {
				const col = mundo.colecoes[COLECAO_POR_NOME[p[0]]];
				if (!col) return null;
				doc = col.get(p[1]);
				resto = p.slice(2);
			}
		}
		while (doc && resto?.length >= 2) {
			const [tipo, id] = resto;
			const campo = { Item: "items", ActiveEffect: "effects", JournalEntryPage: "pages", TableResult: "results", Token: "tokens" }[tipo];
			doc = campo ? doc[campo]?.get(id) : null;
			resto = resto.slice(2);
		}
		return doc ?? null;
	}
	async function fromUuid(uuid) {
		const r = resolverUuid(uuid);
		if (r?.pack) {
			let d = await r.pack.getDocument(r.id);
			let resto = r.resto;
			while (d && resto?.length >= 2) {
				const campo = { Item: "items", ActiveEffect: "effects", JournalEntryPage: "pages", TableResult: "results" }[resto[0]];
				d = campo ? d[campo]?.get(resto[1]) : null;
				resto = resto.slice(2);
			}
			return d ?? null;
		}
		return r;
	}
	function fromUuidSync(uuid) {
		const r = resolverUuid(uuid, { sincrono: true });
		if (r?.pack) return r.pack.get(r.id) ?? r.pack.index.get(r.id) ?? null;
		return r;
	}
	mundo.fromUuid = fromUuid;
	mundo.fromUuidSync = fromUuidSync;

	/** Links para o Giria T20 (módulo à parte) são conferidos contra src/giria-indice.json. */
	let _giria = null;
	const uuidsGiria = () => (_giria ??= new Set(JSON.parse(fs.readFileSync(new URL("../../src/giria-indice.json", import.meta.url), "utf8")).itens.map((i) => i.uuid)));

	/** Confere links @UUID[...] e @Compendium[...] num HTML. */
	function verificarLinks(html, onde) {
		const quebrados = [];
		for (const m of String(html).matchAll(/@UUID\[([^\]]+)\]/g)) {
			const alvo = m[1];
			if (alvo.startsWith(".")) continue;
			if (alvo.startsWith("Compendium.giria-t20.")) {
				if (!uuidsGiria().has(alvo)) quebrados.push(alvo);
				continue;
			}
			if (!fromUuidSync(alvo)) quebrados.push(alvo);
		}
		for (const q of quebrados) mundo.relatar({ documentName: "Link", name: onde }, "link-quebrado", onde, q, `@UUID[${q}] não aponta para nenhum documento`);
		return quebrados;
	}
	mundo.verificarLinks = verificarLinks;

	const TextEditor = {
		async enrichHTML(content, o = {}) {
			verificarLinks(content ?? "", o.relativeTo?.name ?? "enrichHTML");
			return String(content ?? "").replace(/@UUID\[([^\]]+)\](\{([^}]*)\})?/g, (_, u, __, l) => `<a class="content-link" data-uuid="${u}">${l ?? u}</a>`);
		},
		getDragEventData: () => ({}),
		decodeHTML: (s) => s
	};
	TextEditor.implementation = TextEditor;

	/* ---------------------------------------------------------------- */
	/* Globais                                                             */
	/* ---------------------------------------------------------------- */

	const DialogV2 = criarDialogV2(mundo);
	const FormDataExtended = criarFormDataExtended();
	mundo.FormDataExtended = FormDataExtended;

	const foundry = globalThis.foundry;
	foundry.applications.api.DialogV2 = DialogV2;
	foundry.applications.ux = { FormDataExtended, TextEditor };
	foundry.applications.handlebars = { renderTemplate: async () => "", loadTemplates: async () => {} };
	foundry.documents = {
		...classes,
		BaseActor: Actor,
		collections: { CompendiumCollection, Actors: { registerSheet() {}, unregisterSheet() {} } },
		modifyBatch: async () => []
	};
	foundry.dice = { Roll, terms: { Die, NumericTerm, OperatorTerm } };
	foundry.utils.fromUuid = fromUuid;
	foundry.utils.fromUuidSync = fromUuidSync;
	foundry.utils.randomID = U.randomID;
	foundry.audio = { AudioHelper: { play: async () => {} } };

	const CONST = {
		TOKEN_DISPOSITIONS: { SECRET: -2, HOSTILE: -1, NEUTRAL: 0, FRIENDLY: 1 },
		DOCUMENT_OWNERSHIP_LEVELS: { INHERIT: -1, NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3 },
		USER_ROLES: { NONE: 0, PLAYER: 1, TRUSTED: 2, ASSISTANT: 3, GAMEMASTER: 4 },
		CHAT_MESSAGE_STYLES: { OTHER: 0, OOC: 1, IC: 2, EMOTE: 3 },
		DICE_ROLL_MODES: { PUBLIC: "publicroll", PRIVATE: "gmroll", BLIND: "blindroll", SELF: "selfroll" },
		TOKEN_DISPLAY_MODES: { NONE: 0, CONTROL: 10, OWNER_HOVER: 20, HOVER: 30, OWNER: 40, ALWAYS: 50 },
		ACTIVE_EFFECT_MODES: { CUSTOM: 0, MULTIPLY: 1, ADD: 2, DOWNGRADE: 3, UPGRADE: 4, OVERRIDE: 5 },
		JOURNAL_ENTRY_PAGE_FORMATS: { HTML: 1, MARKDOWN: 2 },
		TABLE_RESULT_TYPES: { TEXT: "text", DOCUMENT: "document" },
		FOLDER_DOCUMENT_TYPES: ["Actor", "Adventure", "Item", "Scene", "JournalEntry", "Playlist", "RollTable", "Cards", "Macro", "Compendium"]
	};

	const globais = {
		game,
		ui,
		canvas: mundo.canvas,
		CONFIG: config,
		CONST,
		Hooks,
		Roll,
		Actor,
		Item,
		ActiveEffect,
		JournalEntry,
		JournalEntryPage,
		RollTable,
		TableResult,
		Macro,
		Folder,
		User,
		Scene,
		TokenDocument,
		ChatMessage,
		Combat,
		fromUuid,
		fromUuidSync,
		TextEditor,
		FormDataExtended,
		FormData: window.FormData,
		DOMParser: window.DOMParser,
		HTMLElement: window.HTMLElement,
		document: window.document,
		renderTemplate: async () => "",
		getDocumentClass: (n) => classes[n]
	};
	mundo.globais = globais;

	mundo.instalar = () => {
		for (const [k, v] of Object.entries(globais)) globalThis[k] = v;
		globalThis.tormenta20 = { ...(globalThis.tormenta20 ?? {}), config: sistema.T20, conditions: sistema.T20.conditions, utils: { endScene: async () => mundo.registrar("endScene") } };
	};
	mundo.instalar();

	/* ---------------------------------------------------------------- */
	/* Execução de scripts (como Macro#_executeScript do Foundry)         */
	/* ---------------------------------------------------------------- */

	let ouvinte = null;
	const instalarOuvinte = () => {
		if (ouvinte) return;
		ouvinte = (err) => mundo.erros.push({ origem: mundo.contexto.atual, erro: err, solto: true });
		process.on("unhandledRejection", ouvinte);
	};
	mundo.encerrar = () => {
		if (ouvinte) process.off("unhandledRejection", ouvinte);
		ouvinte = null;
	};

	mundo.aguardarOcioso = async (limite = 200000) => {
		let quietos = 0;
		for (let i = 0; i < limite; i++) {
			await new Promise((r) => setImmediate(r));
			if (mundo.pendentes === 0) {
				if (++quietos >= 5) {
					// deixa os eventos de promessa rejeitada sem tratamento chegarem
					await new Promise((r) => setTimeout(r, 0));
					await new Promise((r) => setTimeout(r, 0));
					if (mundo.pendentes === 0) return true;
					quietos = 0;
				}
			} else quietos = 0;
		}
		mundo.erros.push({ origem: mundo.contexto.atual, erro: new Error("O script não terminou (operações pendentes)") });
		return false;
	};

	/**
	 * Executa código como uma macro de script do Foundry. Retorna o valor de retorno e
	 * espera o mundo ficar ocioso (o código costuma disparar uma async IIFE sem await).
	 */
	mundo.executar = async (codigo, { nome = "script", macro = null, scope = {}, actor = null, token = null } = {}) => {
		instalarOuvinte();
		mundo.instalar();
		const anterior = mundo.contexto.atual;
		mundo.contexto.atual = nome;
		const consoleError = console.error;
		console.error = (...a) => {
			mundo.erros.push({ origem: nome, erro: new Error(`console.error: ${a.map((x) => x?.stack ?? x?.message ?? String(x)).join(" ")}`), console: true });
		};
		let ret;
		try {
			let fn;
			try {
				fn = new AsyncFunction("speaker", "actor", "token", "character", "scope", ...Object.keys(scope), `{${codigo}\n}`);
			} catch (err) {
				err.message = `Erro de sintaxe em ${nome}: ${err.message}`;
				throw err;
			}
			const tk = token ?? mundo.canvas.tokens.controlled[0] ?? null;
			const at = actor ?? tk?.actor ?? mestre.character ?? null;
			const speaker = ChatMessage.getSpeaker({ actor: at, token: tk?.document });
			ret = await mundo.op(() => fn.call(macro ?? {}, speaker, at, tk, mestre.character, scope, ...Object.values(scope)));
			await mundo.aguardarOcioso();
		} catch (err) {
			mundo.erros.push({ origem: nome, erro: err });
		} finally {
			console.error = consoleError;
			mundo.contexto.atual = anterior;
		}
		return ret;
	};

	/* ---------------------------------------------------------------- */
	/* Ajudantes para testes                                               */
	/* ---------------------------------------------------------------- */

	mundo.criarCena = async (nome = "Cena de teste") => {
		const cena = await Scene.create({ name: nome });
		mundo.canvas.scene = cena;
		return cena;
	};

	/** Começa um combate com todos os tokens da cena atual. */
	mundo.iniciarCombate = async () => {
		const cena = mundo.canvas.scene;
		const combate = await Combat.create({ scene: cena.id, active: true });
		await combate.createEmbeddedDocuments("Combatant", cena.tokens.contents.map((t) => ({ tokenId: t.id, sceneId: cena.id, actorId: t._source.actorId, name: t.name })));
		await combate.startCombat();
		mundo.game.combat = combate;
		return combate;
	};

	mundo.colocarToken = async (actor, dados = {}) => {
		if (!mundo.canvas.scene) await mundo.criarCena();
		const td = await actor.getTokenDocument({ x: 1000 + mundo.canvas.scene.tokens.size * 100, y: 1000, actorLink: actor.type === "character", ...dados });
		const [doc] = await mundo.canvas.scene.createEmbeddedDocuments("Token", [td.toObject()]);
		return mundo.canvas.tokens.get(doc.id);
	};

	mundo.criarPJ = async (nome, { nivel = 5, atributos = {}, treinadas = [] } = {}) => {
		const atr = { for: 2, des: 2, con: 2, int: 1, sab: 1, car: 1, ...atributos };
		const a = await Actor.create({
			name: nome,
			type: "character",
			ownership: { default: 0 },
			system: {
				atributos: Object.fromEntries(Object.entries(atr).map(([k, v]) => [k, { base: v }])),
				attributes: { nivel: { value: nivel }, pv: { value: 40, max: 40, temp: 0 }, pm: { value: 20, max: 20, temp: 0 } }
			}
		});
		if (treinadas.length) await a.update(Object.fromEntries(treinadas.map((k) => [`system.pericias.${k}.treinado`, true])));
		return a;
	};

	mundo.criarJogador = async (nome, personagem) => {
		const u = new User({ _id: U.randomID(), name: nome, role: 1, character: personagem?.id ?? null });
		u.targets = new Set();
		mundo.colecoes.User.set(u.id, u);
		if (personagem) await personagem.update({ [`ownership.${u.id}`]: 3 });
		return u;
	};

	mundo.registrarModulo = (id, dados = {}) => {
		const m = { id, active: true, title: id, ...dados };
		modules.set(id, m);
		return m;
	};

	mundo.adicionarPack = (meta, docs, pastas) => {
		const p = new CompendiumCollection(meta, docs, pastas);
		packs.set(meta.id, p);
		return p;
	};

	mundo.resumoRelatorio = () => {
		const cont = {};
		for (const r of mundo.relatorio) {
			const k = `${r.tipo} | ${r.origem} | ${r.caminho} | ${r.mensagem}`;
			cont[k] = (cont[k] ?? 0) + 1;
		}
		return cont;
	};

	vm; // (reservado)
	return mundo;
}
