/**
 * Reimplementação enxuta de foundry.data.fields e foundry.abstract.DataModel (Foundry v12–v14),
 * com a mesma semântica de limpeza e validação que o Foundry aplica ao criar ou atualizar um
 * documento. O objetivo é carregar o modelo de dados REAL do sistema Tormenta20 e descobrir,
 * sem um Foundry rodando, o que o Foundry descartaria (chaves desconhecidas) ou recusaria
 * (escolha inválida, tipo errado, campo obrigatório vazio).
 *
 * Toda ocorrência vai para options.report (quando existe), com o caminho do campo.
 */
import { deepClone, getType, mergeObject, isPlainObject } from "./utils.mjs";

export class DataModelValidationError extends Error {
	constructor(failures, message) {
		super(message ?? failures.map((f) => `${f.path}: ${f.message}`).join("; "));
		this.failures = failures;
	}
}

const juntar = (base, nome) => (base ? `${base}.${nome}` : String(nome));

export class DataField {
	constructor(options = {}, context = {}) {
		this.options = options;
		const { validate: validarExtra, ...resto } = options;
		Object.assign(this, mergeObject(this.constructor._defaults, resto, { inplace: false }));
		this._validarExtra = validarExtra;
		this.name = context.name;
		this.parent = context.parent;
	}

	static get _defaults() {
		return { required: false, nullable: false, initial: undefined, readonly: false, gmOnly: false, persisted: true, label: "", hint: "", validationError: "is not a valid value" };
	}

	get fieldPath() {
		return [this.parent?.fieldPath, this.name].filter((p) => p !== undefined && p !== "").join(".");
	}

	getInitialValue(data) {
		return typeof this.initial === "function" ? this.initial(data) : deepClone(this.initial);
	}

	clean(value, options = {}) {
		if (value === null) {
			if (this.nullable) return value;
			value = undefined;
		}
		if (value === undefined) return this.getInitialValue(options.source);
		value = this._cast(value);
		return this._cleanType(value, options);
	}

	_cast(value) {
		return value;
	}

	_cleanType(value) {
		return value;
	}

	/** Retorna uma lista de falhas [{path, message, value}] (vazia quando válido). */
	validate(value, options = {}) {
		const path = options.path ?? this.fieldPath;
		if (value === undefined) return this.required ? [{ path, message: "is required", value }] : [];
		if (value === null) return this.nullable ? [] : [{ path, message: "may not be null", value }];
		try {
			const special = this._validateSpecial?.(value);
			if (special === true) return [];
			const r = this._validateType(value, { ...options, path });
			if (Array.isArray(r) && r.length) return r;
			if (r === false) return [{ path, message: this.validationError, value }];
			if (this._validarExtra && this._validarExtra(value) === false) return [{ path, message: this.validationError, value }];
		} catch (err) {
			return [{ path, message: err.message, value }];
		}
		return [];
	}

	_validateSpecial() {
		return undefined;
	}

	_validateType() {
		return true;
	}

	initialize(value) {
		return value;
	}

	toObject(value) {
		return deepClone(value);
	}

	_getField(path) {
		return path.length ? undefined : this;
	}

	getField(path) {
		const p = typeof path === "string" ? path.split(".") : path;
		return this._getField(p);
	}
}

export class AnyField extends DataField {}

export class StringField extends DataField {
	constructor(options = {}, context = {}) {
		super(options, context);
		if (this.choices) {
			this.nullable = options.nullable ?? false;
			this.blank = options.blank ?? false;
		}
		if (this.initial === undefined) {
			if (this.nullable) this.initial = null;
			else if (this.blank) this.initial = "";
		}
	}

	static get _defaults() {
		return mergeObject(super._defaults, { blank: true, trim: true, nullable: false, initial: undefined, choices: undefined, textSearch: false }, { inplace: false });
	}

	clean(value, options) {
		if (typeof value === "string" && this.trim) value = value.trim();
		if (value === "") {
			if (this.blank) return value;
			value = undefined;
		}
		return super.clean(value, options);
	}

	_cast(value) {
		return String(value);
	}

	_validateSpecial(value) {
		if (value === "") {
			if (this.blank) return true;
			throw new Error("may not be a blank string");
		}
		return undefined;
	}

	get _choices() {
		let c = this.choices;
		if (typeof c === "function") c = c();
		if (Array.isArray(c)) return c.map(String);
		if (c && typeof c === "object") return Object.keys(c);
		return null;
	}

	_validateType(value) {
		if (typeof value !== "string") throw new Error("must be a string");
		const c = this._choices;
		if (c && !c.includes(value)) throw new Error(`"${value}" is not a valid choice (${c.slice(0, 12).join(", ")}${c.length > 12 ? ", ..." : ""})`);
		return true;
	}
}

export class HTMLField extends StringField {
	static get _defaults() {
		return mergeObject(super._defaults, { required: true, blank: true }, { inplace: false });
	}
}
export class JavaScriptField extends StringField {}
export class ColorField extends StringField {
	static get _defaults() {
		return mergeObject(super._defaults, { nullable: true, initial: null, blank: false }, { inplace: false });
	}
	_validateType(value) {
		if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error("must be a valid color string");
		return true;
	}
}
export class FilePathField extends StringField {
	static get _defaults() {
		return mergeObject(super._defaults, { categories: [], base64: false, wildcard: false, nullable: true, blank: false, initial: null }, { inplace: false });
	}
	_validateType(value) {
		if (typeof value !== "string") throw new Error("must be a string");
		const cat = this.categories ?? [];
		if (!cat.length || value.startsWith("data:")) return true;
		const ext = value.split("?")[0].split(".").pop().toLowerCase();
		const EXT = {
			IMAGE: ["apng", "avif", "bmp", "gif", "jpeg", "jpg", "png", "svg", "tiff", "webp"],
			VIDEO: ["m4v", "mp4", "ogv", "webm"],
			AUDIO: ["aac", "flac", "m4a", "mid", "mp3", "ogg", "opus", "wav", "webm"],
			TEXT: ["csv", "json", "md", "pdf", "tsv", "txt", "xml", "yml", "yaml"]
		};
		const ok = cat.flatMap((c) => EXT[c] ?? []);
		if (!ok.includes(ext)) throw new Error(`does not have a valid file extension for ${cat.join("/")}`);
		return true;
	}
}
export class DocumentIdField extends StringField {
	static get _defaults() {
		return mergeObject(super._defaults, { required: true, blank: false, nullable: true, initial: null, readonly: true }, { inplace: false });
	}
	_validateType(value) {
		if (!/^[a-zA-Z0-9]{16}$/.test(value)) throw new Error("must be a valid 16-character alphanumeric ID");
		return true;
	}
}
export class ForeignDocumentField extends DocumentIdField {
	constructor(model, options = {}, context = {}) {
		super(options, context);
		this.model = model;
	}
	static get _defaults() {
		return mergeObject(super._defaults, { nullable: true, readonly: false, idOnly: false }, { inplace: false });
	}
	_cast(value) {
		if (typeof value === "string") return value;
		if (value?.id) return value.id;
		return value;
	}
}
export class DocumentUUIDField extends StringField {
	static get _defaults() {
		return mergeObject(super._defaults, { required: true, blank: false, nullable: true, initial: null }, { inplace: false });
	}
}
export class JSONField extends StringField {
	static get _defaults() {
		return mergeObject(super._defaults, { blank: false, trim: false, initial: undefined }, { inplace: false });
	}
	clean(value, options) {
		if (value === "") return '""';
		return super.clean(value, options);
	}
	_cast(value) {
		if (typeof value !== "string") return JSON.stringify(value);
		return value;
	}
	_validateType(value) {
		if (typeof value !== "string") throw new Error("must be a serialized JSON string");
		JSON.parse(value);
		return true;
	}
}

export class NumberField extends DataField {
	static get _defaults() {
		return mergeObject(super._defaults, { initial: null, nullable: true, min: undefined, max: undefined, step: undefined, integer: false, positive: false, choices: undefined }, { inplace: false });
	}

	_cast(value) {
		if (value === "" && this.nullable) return null;
		return Number(value);
	}

	clean(value, options) {
		if (value === "" ) value = this.nullable ? null : undefined;
		return super.clean(value, options);
	}

	_cleanType(value) {
		if (typeof value !== "number" || Number.isNaN(value)) return value;
		if (this.integer) value = Math.round(value);
		if (Number.isFinite(this.min)) value = Math.max(value, this.min);
		if (Number.isFinite(this.max)) value = Math.min(value, this.max);
		return value;
	}

	_validateType(value) {
		if (typeof value !== "number" || Number.isNaN(value)) throw new Error("must be a number");
		if (this.integer && !Number.isInteger(value)) throw new Error("must be an integer");
		if (this.positive && value <= 0) throw new Error("must be a positive number");
		if (Number.isFinite(this.min) && value < this.min) throw new Error(`must be at least ${this.min}`);
		if (Number.isFinite(this.max) && value > this.max) throw new Error(`may be at most ${this.max}`);
		let c = this.choices;
		if (typeof c === "function") c = c();
		if (c) {
			const keys = Array.isArray(c) ? c.map(Number) : Object.keys(c).map(Number);
			if (!keys.includes(value)) throw new Error(`${value} is not a valid choice`);
		}
		return true;
	}
}

export class BooleanField extends DataField {
	static get _defaults() {
		return mergeObject(super._defaults, { required: true, nullable: false, initial: false }, { inplace: false });
	}
	_cast(value) {
		if (typeof value === "string") return value === "true";
		if (typeof value === "object") return false;
		return Boolean(value);
	}
	_validateType(value) {
		if (typeof value !== "boolean") throw new Error("must be a boolean");
		return true;
	}
}

export class ObjectField extends DataField {
	static get _defaults() {
		return mergeObject(super._defaults, { required: true, nullable: false, initial: () => ({}) }, { inplace: false });
	}
	_cast(value) {
		return getType(value) === "Object" ? value : {};
	}
	_validateType(value) {
		if (getType(value) !== "Object") throw new Error("must be an object");
		return true;
	}
	_getField(path) {
		return path.length ? this : this;
	}
}

export class TypedObjectField extends ObjectField {
	constructor(element, options = {}, context = {}) {
		super(options, context);
		this.element = element;
		element.parent = this;
	}
	_cleanType(data, options = {}) {
		for (const k of Object.keys(data)) {
			if (this.validateKey && !this.validateKey(k)) {
				options.report?.push({ kind: "dropped", path: juntar(options.path, k), value: data[k] });
				delete data[k];
				continue;
			}
			data[k] = this.element.clean(data[k], { ...options, path: juntar(options.path, k) });
		}
		return data;
	}
	_validateType(value, options = {}) {
		if (getType(value) !== "Object") throw new Error("must be an object");
		return Object.entries(value).flatMap(([k, v]) => this.element.validate(v, { ...options, path: juntar(options.path, k) }));
	}
	_getField(path) {
		if (!path.length) return this;
		return this.element._getField(path.slice(1));
	}
}

export class ArrayField extends DataField {
	constructor(element, options = {}, context = {}) {
		super(options, context);
		this.element = element;
		if (element) element.parent = this;
	}
	static get _defaults() {
		return mergeObject(super._defaults, { required: true, nullable: false, empty: true, exact: undefined, min: 0, max: Infinity, initial: () => [] }, { inplace: false });
	}
	_cast(value) {
		const t = getType(value);
		if (t === "Object") {
			const arr = [];
			for (const [k, v] of Object.entries(value)) {
				const i = Number(k);
				if (Number.isInteger(i) && i >= 0) arr[i] = v;
			}
			return arr;
		}
		if (t === "Set") return Array.from(value);
		return Array.isArray(value) ? value : [value];
	}
	_cleanType(value, options = {}) {
		return value.map((v, i) => this.element.clean(v, { ...options, path: juntar(options.path, i) }));
	}
	_validateType(value, options = {}) {
		if (!Array.isArray(value)) throw new Error("must be an Array");
		return value.flatMap((v, i) => this.element.validate(v, { ...options, path: juntar(options.path, i) }));
	}
	_getField(path) {
		if (!path.length) return this;
		if (/^\d+$/.test(path[0])) path = path.slice(1);
		return this.element._getField(path);
	}
}

export class SetField extends ArrayField {
	_cleanType(value, options = {}) {
		return [...new Set(super._cleanType(value, options))];
	}
	_validateType(value, options = {}) {
		const erros = super._validateType(value, options);
		if (new Set(value).size !== value.length) erros.push({ path: options.path, message: "must contain only unique values", value });
		return erros;
	}
	initialize(value) {
		return new Set(value);
	}
}

export class SchemaField extends DataField {
	constructor(fields, options = {}, context = {}) {
		super(options, context);
		this.fields = this._initialize(fields);
	}
	static get _defaults() {
		return mergeObject(super._defaults, { required: true, nullable: false, initial() { return this.clean({}); } }, { inplace: false });
	}
	_initialize(fields) {
		const out = {};
		for (const [name, field] of Object.entries(fields ?? {})) {
			if (!(field instanceof DataField)) throw new Error(`O campo "${name}" não é um DataField`);
			field.name = name;
			field.parent = this;
			out[name] = field;
		}
		return out;
	}
	getInitialValue(data) {
		if (typeof this.initial === "function") return this.initial.call(this, data);
		return deepClone(this.initial);
	}
	has(k) {
		return Object.hasOwn(this.fields, k);
	}
	get(k) {
		return this.fields[k];
	}
	keys() {
		return Object.keys(this.fields);
	}
	entries() {
		return Object.entries(this.fields);
	}
	*[Symbol.iterator]() {
		yield* Object.values(this.fields);
	}
	_cast(value) {
		return getType(value) === "Object" ? value : {};
	}
	_cleanType(data, options = {}) {
		options.source ??= data;
		for (const [name, field] of this.entries()) {
			// v14: campos com persisted:false são derivados e não ficam no banco
			if (field.persisted === false) {
				delete data[name];
				continue;
			}
			if (!(name in data) && options.partial) continue;
			data[name] = field.clean(data[name], { ...options, path: juntar(options.path, name) });
		}
		for (const k of Object.keys(data)) {
			if (!this.has(k)) {
				if (!k.startsWith("-=") && !k.startsWith("==")) options.report?.push({ kind: "dropped", path: juntar(options.path, k), value: data[k] });
				delete data[k];
			}
		}
		return data;
	}
	_validateType(data, options = {}) {
		if (getType(data) !== "Object") throw new Error("must be an object");
		const erros = [];
		for (const [name, field] of this.entries()) {
			if (field.persisted === false) continue;
			if (options.partial && !(name in data)) continue;
			erros.push(...field.validate(data[name], { ...options, path: juntar(options.path, name) }));
		}
		return erros;
	}
	_getField(path) {
		if (!path.length) return this;
		const f = this.fields[path[0]];
		return f?._getField(path.slice(1));
	}
	initialize(value) {
		return value;
	}
}

export class EmbeddedDataField extends SchemaField {
	constructor(model, options = {}, context = {}) {
		super(model.defineSchema(), options, context);
		this.model = model;
	}
	clean(value, options = {}) {
		if (value && typeof value === "object") {
			try {
				value = this.model.migrateData(value) ?? value;
			} catch {
				/* migração é opcional */
			}
		}
		return super.clean(value, options);
	}
}

/** Coleção embutida (itens, efeitos, páginas...). A limpeza dos elementos é feita pelo documento. */
export class EmbeddedCollectionField extends ArrayField {
	constructor(documentName, options = {}, context = {}) {
		super(new ObjectField(), options, context);
		this.documentName = documentName;
	}
	_cleanType(value) {
		return value;
	}
	_validateType(value) {
		if (!Array.isArray(value)) throw new Error("must be an Array");
		return [];
	}
}

export class DocumentStatsField extends ObjectField {}
export class DocumentOwnershipField extends ObjectField {
	static get _defaults() {
		return mergeObject(super._defaults, { initial: () => ({ default: 0 }) }, { inplace: false });
	}
}
export class DocumentFlagsField extends ObjectField {}
export class AngleField extends NumberField {}
export class AlphaField extends NumberField {}
export class IntegerSortField extends NumberField {
	static get _defaults() {
		return mergeObject(super._defaults, { integer: true, initial: 0 }, { inplace: false });
	}
}
export class DocumentTypeField extends StringField {}
export class EmbeddedDocumentField extends SchemaField {}

/* ------------------------------------------------------------------------ */
/* DataModel                                                                 */
/* ------------------------------------------------------------------------ */

export class DataModel {
	constructor(data = {}, { parent = null, strict = false, report } = {}) {
		Object.defineProperty(this, "parent", { value: parent, writable: true, enumerable: false });
		const src = this.constructor.migrateDataSafe(deepClone(data ?? {}));
		const limpo = this.constructor.cleanData(src, { report });
		Object.defineProperty(this, "_source", { value: limpo, writable: true, enumerable: false });
		Object.assign(this, deepClone(limpo));
	}

	static defineSchema() {
		return {};
	}

	static get schema() {
		if (Object.hasOwn(this, "_schema")) return this._schema;
		const s = new SchemaField(Object.freeze(this.defineSchema()));
		Object.defineProperty(this, "_schema", { value: s, writable: false });
		return s;
	}

	get schema() {
		return this.constructor.schema;
	}

	static cleanData(source = {}, options = {}) {
		return this.schema.clean(source, options);
	}

	static migrateData(source) {
		return source;
	}

	static migrateDataSafe(source) {
		try {
			return this.migrateData(source) ?? source;
		} catch (err) {
			globalThis.__simAvisos?.push(`migrateData de ${this.name} falhou: ${err.message}`);
			return source;
		}
	}

	static shimData(data) {
		return data;
	}

	static validateJoint() {}

	static getInitialValue() {
		return this.schema.getInitialValue({});
	}

	static _getField(path) {
		return this.schema._getField(path);
	}

	toObject() {
		return deepClone(this._source);
	}

	toJSON() {
		return this.toObject();
	}

	getField(path) {
		return this.schema.getField(path);
	}

	validate({ changes } = {}) {
		return this.schema.validate(changes ?? this._source);
	}

	updateSource(changes = {}) {
		Object.assign(this._source, changes);
		return changes;
	}

	clone() {
		return new this.constructor(this.toObject(), { parent: this.parent });
	}

	static fromSource(source, options) {
		return new this(source, options);
	}

	static get LOCALIZATION_PREFIXES() {
		return [];
	}
}

export class TypeDataModel extends DataModel {
	prepareBaseData() {}
	prepareDerivedData() {}
	async _preCreate() {}
	async _preUpdate() {}
	_onCreate() {}
	_onUpdate() {}
	_onDelete() {}
}

/** Modelo de tipo dos efeitos ativos no v14: as mudanças moram em system.changes. */
export class ActiveEffectTypeDataModel extends TypeDataModel {
	static defineSchema() {
		return {
			changes: new ArrayField(
				new SchemaField({
					key: new StringField({ required: true, blank: false }),
					value: new AnyField({ required: true, nullable: true, initial: "" }),
					type: new StringField({ required: true, blank: false, initial: "add", choices: ["add", "multiply", "override", "upgrade", "downgrade", "custom", "subtract"] }),
					phase: new StringField({ required: true, blank: false, initial: "initial" }),
					priority: new NumberField()
				})
			)
		};
	}
}

export const fields = {
	DataField,
	AnyField,
	StringField,
	HTMLField,
	JavaScriptField,
	ColorField,
	FilePathField,
	DocumentIdField,
	ForeignDocumentField,
	DocumentUUIDField,
	JSONField,
	NumberField,
	BooleanField,
	ObjectField,
	TypedObjectField,
	ArrayField,
	SetField,
	SchemaField,
	EmbeddedDataField,
	EmbeddedCollectionField,
	EmbeddedDocumentField,
	DocumentStatsField,
	DocumentOwnershipField,
	DocumentFlagsField,
	AngleField,
	AlphaField,
	IntegerSortField,
	DocumentTypeField,
	ModelValidationError: DataModelValidationError
};

export { isPlainObject };
