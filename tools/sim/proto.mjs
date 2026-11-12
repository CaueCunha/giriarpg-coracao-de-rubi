/** Extensões de protótipo que o Foundry instala no navegador (common/primitives). */
const def = (proto, nome, fn) => {
	if (!Object.hasOwn(proto, nome)) Object.defineProperty(proto, nome, { value: fn, writable: true, configurable: true });
};

def(String.prototype, "capitalize", function () {
	return this.length ? this.charAt(0).toUpperCase() + this.slice(1) : String(this);
});
def(String.prototype, "titleCase", function () {
	return this.split(" ").map((w) => (w.length ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w)).join(" ");
});
def(String.prototype, "slugify", function ({ replacement = "-", strict = false, lowercase = true } = {}) {
	let s = this.normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
	if (lowercase) s = s.toLowerCase();
	s = s.replace(/\s+/g, replacement);
	if (strict) s = s.replace(new RegExp(`[^a-zA-Z0-9${replacement}]`, "g"), "");
	return s;
});
def(String.prototype, "stripScripts", function () {
	return this.replace(/<script[\s\S]*?<\/script>/gi, "");
});

def(Number.prototype, "toNearest", function (interval = 1, method = "round") {
	return Math[method](this / interval) * interval;
});
def(Number.prototype, "between", function (a, b, inclusive = true) {
	return inclusive ? this >= a && this <= b : this > a && this < b;
});
def(Number.prototype, "signedString", function () {
	return (this < 0 ? "−" : "+") + Math.abs(this);
});
def(Number.prototype, "almostEqual", function (n, e = 1e-8) {
	return Math.abs(this - n) < e;
});
def(Number.prototype, "paddedString", function (d) {
	return String(this).padStart(d, "0");
});
def(Number.prototype, "ordinalString", function () {
	return `${this}º`;
});

def(Array.prototype, "deepFlatten", function () {
	return this.flat(Infinity);
});
def(Array.prototype, "equals", function (other) {
	return Array.isArray(other) && other.length === this.length && this.every((v, i) => v === other[i]);
});
def(Array.prototype, "partition", function (rule) {
	return this.reduce((acc, v) => {
		acc[rule(v) ? 1 : 0].push(v);
		return acc;
	}, [[], []]);
});
def(Array.prototype, "filterJoin", function (sep) {
	return this.filter((p) => !!p).join(sep);
});
def(Array.prototype, "findSplice", function (find, replace) {
	const idx = this.findIndex(find);
	if (idx === -1) return null;
	if (replace !== undefined) return this.splice(idx, 1, replace)[0];
	return this.splice(idx, 1)[0];
});
def(Array, "fromRange", function (n, min = 0) {
	return Array.from({ length: n }, (_, i) => i + min);
});

def(Set.prototype, "first", function () {
	return this.values().next().value;
});
def(Set.prototype, "equals", function (o) {
	return o instanceof Set && o.size === this.size && [...this].every((v) => o.has(v));
});
def(Set.prototype, "some", function (fn) {
	for (const v of this) if (fn(v)) return true;
	return false;
});
def(Set.prototype, "every", function (fn) {
	for (const v of this) if (!fn(v)) return false;
	return true;
});
def(Set.prototype, "filter", function (fn) {
	return new Set([...this].filter(fn));
});
def(Set.prototype, "map", function (fn) {
	return new Set([...this].map(fn));
});
def(Set.prototype, "find", function (fn) {
	return [...this].find(fn);
});
def(Set.prototype, "toObject", function () {
	return [...this];
});

if (!Math.clamp) Math.clamp = (n, min, max) => Math.min(Math.max(n, min), max);
if (!Math.clamped) Math.clamped = Math.clamp;
if (!Math.roundDecimals) Math.roundDecimals = (n, d) => Math.round(n * 10 ** d) / 10 ** d;
if (!Math.toDegrees) Math.toDegrees = (r) => (r * 180) / Math.PI;
if (!Math.toRadians) Math.toRadians = (d) => (d * Math.PI) / 180;
