/**
 * Stub "elástico": serve como classe base, função, objeto ou valor para partes da API do Foundry
 * que o código do sistema toca durante o import mas que a simulação não usa (folhas, apps, canvas).
 */
export function stub(nome = "stub") {
	const alvo = function () {};
	const cache = new Map();
	return new Proxy(alvo, {
		get(t, prop) {
			if (prop === Symbol.toPrimitive) return () => `[${nome}]`;
			if (prop === "toString") return () => `[${nome}]`;
			if (prop === "prototype") return t.prototype;
			if (prop === Symbol.iterator) return function* () {};
			if (prop === "then") return undefined;
			if (typeof prop === "symbol") return undefined;
			if (!cache.has(prop)) cache.set(prop, stub(`${nome}.${String(prop)}`));
			return cache.get(prop);
		},
		set(t, prop, v) {
			cache.set(prop, v);
			return true;
		},
		apply() {
			return stub(`${nome}()`);
		},
		construct() {
			return stub(`new ${nome}`);
		}
	});
}

/** Classe base vazia, para "class X extends foundry.applications.api.ApplicationV2". */
export function classeStub(nome) {
	const C = class {
		constructor(...args) {
			this._args = args;
		}
		static get DEFAULT_OPTIONS() {
			return {};
		}
		static get PARTS() {
			return {};
		}
		render() {
			return this;
		}
		close() {}
	};
	Object.defineProperty(C, "name", { value: nome });
	return C;
}

/** Mixin que devolve a classe recebida. */
export const mixinStub = (Base) => class extends (Base ?? classeStub("Base")) {};
