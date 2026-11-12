/** Subconjunto de foundry.utils com o mesmo comportamento do Foundry (v12–v14). */

export function getType(v) {
	if (v === null) return "null";
	if (v === undefined) return "undefined";
	if (Array.isArray(v)) return "Array";
	if (v instanceof Set) return "Set";
	if (v instanceof Map) return "Map";
	if (typeof v === "object") {
		const p = Object.getPrototypeOf(v);
		if (p === Object.prototype || p === null) return "Object";
		return v.constructor?.name === "Object" ? "Object" : v.constructor?.name ?? "Object";
	}
	return typeof v === "function" ? "function" : typeof v === "string" ? "string" : typeof v === "number" ? "number" : typeof v === "boolean" ? "boolean" : typeof v;
}

export const isPlainObject = (v) => getType(v) === "Object";

export function deepClone(original, { strict = false } = {}) {
	if (typeof original !== "object" || original === null) return original;
	if (Array.isArray(original)) return original.map((o) => deepClone(o, { strict }));
	if (original instanceof Set) return new Set([...original].map((o) => deepClone(o)));
	if (original instanceof Date) return new Date(original);
	if (typeof original.toObject === "function" && !isPlainObject(original)) return deepClone(original.toObject());
	if (!isPlainObject(original) && !(original instanceof Object)) return original;
	const out = {};
	for (const k of Object.keys(original)) out[k] = deepClone(original[k], { strict });
	return out;
}

export function expandObject(obj) {
	const expanded = {};
	for (const [k, v] of Object.entries(obj ?? {})) {
		const val = isPlainObject(v) ? expandObject(v) : v;
		setProperty(expanded, k, val);
	}
	return expanded;
}

export function flattenObject(obj, _d = 0) {
	const flat = {};
	if (_d > 100) throw new Error("Maximum depth exceeded");
	for (const [k, v] of Object.entries(obj ?? {})) {
		if (isPlainObject(v) && Object.keys(v).length) {
			const inner = flattenObject(v, _d + 1);
			for (const [ik, iv] of Object.entries(inner)) flat[`${k}.${ik}`] = iv;
		} else flat[k] = v;
	}
	return flat;
}

export function getProperty(object, key) {
	if (!key || object == null) return undefined;
	if (key in Object(object)) return object[key];
	let target = object;
	for (const p of String(key).split(".")) {
		if (target == null) return undefined;
		const t = typeof target;
		if (t !== "object" && t !== "function") return undefined;
		if (target instanceof Map) target = target.get(p);
		else target = target[p];
	}
	return target;
}

export function hasProperty(object, key) {
	if (!key || object == null) return false;
	let target = object;
	for (const p of String(key).split(".")) {
		if (target == null || typeof target !== "object") return false;
		if (!(p in target)) return false;
		target = target[p];
	}
	return true;
}

export function setProperty(object, key, value) {
	let target = object;
	let changed = false;
	const parts = String(key).split(".");
	if (parts.length > 1) {
		const last = parts.pop();
		for (const p of parts) {
			if (!(p in target) || target[p] === null || typeof target[p] !== "object") target[p] = {};
			target = target[p];
		}
		key = last;
	}
	if (target[key] !== value) {
		changed = true;
		target[key] = value;
	}
	return changed;
}

export function mergeObject(original, other = {}, {
	insertKeys = true, insertValues = true, overwrite = true, recursive = true, inplace = true, enforceTypes = false, performDeletions = false
} = {}, _d = 0) {
	other = other || {};
	if (!(original instanceof Object) || !(other instanceof Object)) throw new Error("One of original or other are not Objects!");
	const options = { insertKeys, insertValues, overwrite, recursive, inplace, enforceTypes, performDeletions };
	if (_d === 0) {
		if (Object.keys(other).some((k) => k.includes("."))) other = expandObject(other);
		if (Object.keys(original).some((k) => k.includes("."))) {
			const expanded = expandObject(original);
			if (inplace) {
				for (const k of Object.keys(original)) delete original[k];
				Object.assign(original, expanded);
			} else original = expanded;
		} else if (!inplace) original = deepClone(original);
	}
	for (const k of Object.keys(other)) {
		const v = other[k];
		if (Object.hasOwn(original, k)) mergeUpdate(original, k, v, options, _d + 1);
		else mergeInsert(original, k, v, options, _d + 1);
	}
	return original;
}

function mergeInsert(original, k, v, { insertKeys, insertValues, performDeletions } = {}, _d) {
	if (k.startsWith("-=") && performDeletions) {
		delete original[k.slice(2)];
		return;
	}
	if (k.startsWith("==") && performDeletions) {
		original[k.slice(2)] = deepClone(v);
		return;
	}
	const canInsert = (_d <= 1 && insertKeys) || (_d > 1 && insertValues);
	if (!canInsert) return;
	if (isPlainObject(v)) {
		original[k] = mergeObject({}, v, { insertKeys: true, inplace: true, performDeletions });
		return;
	}
	original[k] = v;
}

function mergeUpdate(original, k, v, { insertKeys, insertValues, enforceTypes, overwrite, recursive, performDeletions } = {}, _d) {
	const x = original[k];
	const tv = getType(v);
	const tx = getType(x);
	if (tx === "Object" && tv === "Object" && recursive) {
		return mergeObject(x, v, { insertKeys, insertValues, overwrite, enforceTypes, performDeletions, inplace: true }, _d);
	}
	if (overwrite) {
		if (tx !== "undefined" && tv !== tx && enforceTypes) throw new Error("Mismatched data types encountered during object merge.");
		original[k] = v;
	}
}

export function diffObject(original, other, { inner = false, deletionKeys = false } = {}) {
	const diff = {};
	for (const [k, v] of Object.entries(other ?? {})) {
		if (inner && !(k in original)) continue;
		const o = original?.[k];
		if (isPlainObject(v) && isPlainObject(o)) {
			const d = diffObject(o, v, { inner, deletionKeys });
			if (Object.keys(d).length) diff[k] = d;
		} else if (JSON.stringify(o) !== JSON.stringify(v)) diff[k] = v;
	}
	return diff;
}

export function isEmpty(v) {
	const t = getType(v);
	if (t === "undefined" || t === "null") return true;
	if (t === "Array" || t === "string") return v.length === 0;
	if (t === "Object") return Object.keys(v).length === 0;
	if (t === "Set" || t === "Map") return v.size === 0;
	return false;
}

export function duplicate(o) {
	return JSON.parse(JSON.stringify(o));
}

export function isNewerVersion(v1, v0) {
	const a = String(v1).split(".").map(Number);
	const b = String(v0).split(".").map(Number);
	for (let i = 0; i < Math.max(a.length, b.length); i++) {
		const x = a[i] ?? 0;
		const y = b[i] ?? 0;
		if (x !== y) return x > y;
	}
	return false;
}

/** Gerador de IDs. Determinístico quando a semente é fixada (builds reprodutíveis). */
let semente = null;
export function fixarSemente(s) {
	let h = 2166136261;
	for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
	semente = h || 1;
}
function aleatorio() {
	if (semente === null) return Math.random();
	semente ^= semente << 13;
	semente >>>= 0;
	semente ^= semente >>> 17;
	semente ^= semente << 5;
	semente >>>= 0;
	return semente / 4294967296;
}
export function randomID(length = 16) {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	let id = "";
	for (let i = 0; i < length; i++) id += chars[Math.floor(aleatorio() * chars.length)];
	return id;
}

export function debounce(fn, ms) {
	let t;
	return (...args) => {
		clearTimeout(t);
		t = setTimeout(() => fn(...args), ms);
	};
}

export function escapeHTML(s) {
	return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function objectsEqual(a, b) {
	return JSON.stringify(a) === JSON.stringify(b);
}

export function parseUuid(uuid) {
	const parts = String(uuid).split(".");
	if (parts[0] === "Compendium") return { collection: `${parts[1]}.${parts[2]}`, documentType: parts[3], id: parts[4], embedded: parts.slice(5) };
	return { documentType: parts[0], id: parts[1], embedded: parts.slice(2) };
}

/** foundry.utils.saveDataToFile: no Foundry simulado só guarda o último "download" para os testes conferirem. */
export const downloads = [];
export function saveDataToFile(data, type, filename) {
	downloads.push({ data, type, filename });
}
