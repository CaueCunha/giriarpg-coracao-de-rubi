/**
 * Rolagens. Implementa o suficiente de Roll/terms do Foundry para as macros e para o
 * applyDamageV2 do sistema (que lê roll.terms com operator/total/options.flavor/faces/number).
 * Os termos só têm total depois de evaluate(), como no Foundry.
 */
import { aleatorioDado } from "./sorte.mjs";

class RollTerm {
	constructor({ options = {} } = {}) {
		this.options = options;
		this._evaluated = false;
	}
	get flavor() {
		return this.options.flavor ?? "";
	}
	get expression() {
		return this.formula;
	}
}

export class OperatorTerm extends RollTerm {
	constructor({ operator, options } = {}) {
		super({ options });
		this.operator = operator;
	}
	get formula() {
		return ` ${this.operator} `;
	}
	get total() {
		return undefined;
	}
	evaluate() {
		this._evaluated = true;
		return this;
	}
}

export class NumericTerm extends RollTerm {
	constructor({ number, options } = {}) {
		super({ options });
		this.number = Number(number);
	}
	get formula() {
		return `${this.number}${this.options.flavor ? `[${this.options.flavor}]` : ""}`;
	}
	get total() {
		return this._evaluated ? this.number : undefined;
	}
	evaluate() {
		this._evaluated = true;
		return this;
	}
}

export class Die extends RollTerm {
	constructor({ number = 1, faces = 6, modifiers = [], options } = {}) {
		super({ options });
		this.number = number;
		this.faces = faces;
		this.modifiers = modifiers;
		this.results = [];
	}
	get denomination() {
		return `d${this.faces}`;
	}
	get formula() {
		return `${this.number}d${this.faces}${this.modifiers.join("")}${this.options.flavor ? `[${this.options.flavor}]` : ""}`;
	}
	get values() {
		return this.results.filter((r) => r.active).map((r) => r.result);
	}
	get total() {
		if (!this._evaluated) return undefined;
		return this.results.filter((r) => r.active).reduce((t, r) => t + r.result, 0);
	}
	evaluate({ minimize = false, maximize = false } = {}) {
		this.results = [];
		for (let i = 0; i < this.number; i++) {
			const r = maximize ? this.faces : minimize ? 1 : Math.ceil(aleatorioDado() * this.faces);
			this.results.push({ result: r, active: true });
		}
		const rolar = () => (maximize ? this.faces : minimize ? 1 : Math.ceil(aleatorioDado() * this.faces));
		const atende = (v, cmp, alvo) => (cmp === ">=" ? v >= alvo : cmp === ">" ? v > alvo : cmp === "<=" ? v <= alvo : cmp === "<" ? v < alvo : v === alvo);
		for (const m of this.modifiers) {
			const ex = /^(xo|x|rr|r)([<>]=?|=)?(\d*)$/.exec(m);
			if (ex) {
				const cmp = ex[2] ?? "=";
				const alvo = ex[3] ? Number(ex[3]) : ex[1].startsWith("x") ? this.faces : 1;
				if (ex[1].startsWith("x")) {
					// explode: cada resultado que atende rola mais um dado (xo: só uma vez)
					for (let i = 0; i < this.results.length && i < 100; i++) {
						if (ex[1] === "xo" && i >= this.number) break;
						if (atende(this.results[i].result, cmp, alvo)) this.results.push({ result: rolar(), active: true, exploded: true });
					}
				} else {
					for (const r of this.results) if (atende(r.result, cmp, alvo)) r.result = rolar();
				}
				continue;
			}
			const mm = /^(kh|kl|dh|dl|k|d)(\d*)$/.exec(m);
			if (!mm) continue;
			const n = Number(mm[2] || 1);
			const ord = [...this.results].sort((a, b) => a.result - b.result);
			let manter;
			if (mm[1] === "kh" || mm[1] === "k") manter = ord.slice(-n);
			else if (mm[1] === "kl") manter = ord.slice(0, n);
			else if (mm[1] === "dh") manter = ord.slice(0, -n);
			else manter = ord.slice(n);
			for (const r of this.results) r.active = manter.includes(r);
		}
		this._evaluated = true;
		return this;
	}
}

export class ParentheticalTerm extends RollTerm {
	constructor({ term, roll, options } = {}) {
		super({ options });
		this.term = term;
		this.roll = roll;
	}
	get formula() {
		return `(${this.term})`;
	}
	get total() {
		return this._evaluated ? this.roll.total : undefined;
	}
	evaluate(o) {
		this.roll.evaluateSync(o);
		this._evaluated = true;
		return this;
	}
}

/** Substitui @caminhos pelos valores do rollData, como Roll.replaceFormulaData. */
export function replaceFormulaData(formula, data = {}, { missing = "0", warn = false } = {}) {
	return String(formula).replace(/@([a-zA-Z0-9_.\-]+)/g, (_, path) => {
		let v = data;
		for (const p of path.split(".")) v = v?.[p];
		if (v === undefined || v === null || typeof v === "object") {
			if (warn) globalThis.__simAvisos?.push(`Roll: @${path} não encontrado nos dados`);
			return missing;
		}
		return String(v);
	});
}

function tokenizar(formula) {
	const toks = [];
	let i = 0;
	const s = formula;
	while (i < s.length) {
		const c = s[i];
		if (/\s/.test(c)) {
			i++;
			continue;
		}
		if ("+-*/".includes(c)) {
			toks.push({ t: "op", v: c });
			i++;
			continue;
		}
		if (c === "(") {
			let prof = 1;
			let j = i + 1;
			while (j < s.length && prof) {
				if (s[j] === "(") prof++;
				else if (s[j] === ")") prof--;
				j++;
			}
			if (prof) throw new Error(`Fórmula inválida (parênteses): ${formula}`);
			toks.push({ t: "par", v: s.slice(i + 1, j - 1) });
			i = j;
			continue;
		}
		if (c === "[") {
			const j = s.indexOf("]", i);
			if (j < 0) throw new Error(`Fórmula inválida (sabor): ${formula}`);
			const ult = toks[toks.length - 1];
			if (ult && ult.t !== "op") ult.flavor = s.slice(i + 1, j);
			i = j + 1;
			continue;
		}
		const m = /^(\d*)d(\d+)((?:kh|kl|dh|dl|xo|x|rr|r|min|max|cs|cf|k|d)(?:[<>]=?|=)?\d*)*/i.exec(s.slice(i));
		if (m) {
			const mods = m[0].slice(`${m[1]}d${m[2]}`.length).match(/(kh|kl|dh|dl|xo|x|rr|r|min|max|cs|cf|k|d)(?:[<>]=?|=)?\d*/g) ?? [];
			toks.push({ t: "die", number: Number(m[1] || 1), faces: Number(m[2]), mods });
			i += m[0].length;
			continue;
		}
		const n = /^\d+(\.\d+)?/.exec(s.slice(i));
		if (n) {
			toks.push({ t: "num", v: Number(n[0]) });
			i += n[0].length;
			continue;
		}
		const fn = /^(floor|ceil|round|abs|max|min)\(/.exec(s.slice(i));
		if (fn) {
			let prof = 1;
			let j = i + fn[0].length;
			while (j < s.length && prof) {
				if (s[j] === "(") prof++;
				else if (s[j] === ")") prof--;
				j++;
			}
			toks.push({ t: "fn", nome: fn[1], args: s.slice(i + fn[0].length, j - 1) });
			i = j;
			continue;
		}
		throw new Error(`Fórmula inválida: "${formula}" (perto de "${s.slice(i, i + 10)}")`);
	}
	return toks;
}

export class Roll {
	constructor(formula = "", data = {}, options = {}) {
		this.data = data;
		this.options = options;
		this._formula = replaceFormulaData(String(formula), data, { warn: true });
		this.terms = this._parse(this._formula);
		this._evaluated = false;
		this._total = undefined;
	}

	static create(formula, data, options) {
		return new this(formula, data, options);
	}

	static replaceFormulaData(f, d, o) {
		return replaceFormulaData(f, d, o);
	}

	static validate(formula) {
		try {
			new Roll(formula);
			return true;
		} catch {
			return false;
		}
	}

	_parse(formula) {
		const terms = [];
		for (const t of tokenizar(formula)) {
			const options = t.flavor ? { flavor: t.flavor } : {};
			if (t.t === "op") terms.push(new OperatorTerm({ operator: t.v }));
			else if (t.t === "num") terms.push(new NumericTerm({ number: t.v, options }));
			else if (t.t === "die") terms.push(new Die({ number: t.number, faces: t.faces, modifiers: t.mods, options }));
			else if (t.t === "par") terms.push(new ParentheticalTerm({ term: t.v, roll: new Roll(t.v, this.data), options }));
			else if (t.t === "fn") {
				const r = new Roll(t.args.split(",")[0], this.data);
				const pt = new ParentheticalTerm({ term: t.args, roll: r, options });
				pt.fn = t.nome;
				pt.args = t.args.split(",").map((a) => new Roll(a, this.data));
				terms.push(pt);
			}
		}
		if (!terms.length) terms.push(new NumericTerm({ number: 0 }));
		return terms;
	}

	get formula() {
		return this.terms.map((t) => t.formula).join("").replace(/\s+/g, " ").trim();
	}

	get total() {
		return this._total;
	}

	get result() {
		return this.terms.map((t) => (t.operator ? t.operator : t.total)).join(" ");
	}

	get dice() {
		return this.terms.filter((t) => t instanceof Die);
	}

	get isDeterministic() {
		return !this.dice.length;
	}

	evaluateSync(o = {}) {
		for (const t of this.terms) {
			if (t.fn) {
				for (const a of t.args) a.evaluateSync(o);
				const vals = t.args.map((a) => a.total);
				t.roll._total = Math[t.fn](...vals);
				t._evaluated = true;
			} else t.evaluate(o);
		}
		// precedência: * e / antes de + e -
		const vals = [];
		const ops = [];
		for (const t of this.terms) {
			if (t instanceof OperatorTerm) ops.push(t.operator);
			else vals.push(t.total);
		}
		if (vals.length !== ops.length + 1) {
			// sinal unário no começo ("-1d4")
			if (ops.length === vals.length && (ops[0] === "-" || ops[0] === "+")) {
				vals.unshift(0);
			} else throw new Error(`Fórmula inválida: ${this._formula}`);
		}
		const v2 = [vals[0]];
		const o2 = [];
		for (let i = 0; i < ops.length; i++) {
			if (ops[i] === "*") v2.push(v2.pop() * vals[i + 1]);
			else if (ops[i] === "/") v2.push(v2.pop() / vals[i + 1]);
			else {
				o2.push(ops[i]);
				v2.push(vals[i + 1]);
			}
		}
		let total = v2[0];
		for (let i = 0; i < o2.length; i++) total = o2[i] === "+" ? total + v2[i + 1] : total - v2[i + 1];
		if (!Number.isFinite(total)) throw new Error(`Rolagem resultou em ${total}: ${this._formula}`);
		this._total = total;
		this._evaluated = true;
		return this;
	}

	async evaluate(o = {}) {
		return this.evaluateSync(o);
	}

	async roll(o) {
		return this.evaluate(o);
	}

	async toMessage(messageData = {}, { create = true } = {}) {
		if (!this._evaluated) await this.evaluate();
		const data = { content: String(this.total), rolls: [this], ...messageData };
		return create ? globalThis.ChatMessage.create(data) : data;
	}

	async render() {
		return `<div class="dice-roll">${this.formula} = ${this.total}</div>`;
	}

	async getTooltip() {
		return "";
	}

	toJSON() {
		return { class: "Roll", formula: this.formula, total: this.total, evaluated: this._evaluated };
	}

	clone() {
		return new this.constructor(this._formula, this.data, this.options);
	}
}
