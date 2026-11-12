/**
 * DialogV2 simulado. Monta o conteúdo num <form> real (jsdom), deixa uma "política" escolher
 * valores e botão, e chama o callback do botão com (event, button, dialog), como o Foundry v14.
 */
import { JSDOM } from "jsdom";
import { aleatorioDado } from "./sorte.mjs";

export const dom = new JSDOM("<!doctype html><html><body></body></html>");
export const { window } = dom;

/** Política padrão: mantém os valores do formulário e aperta o botão padrão (ou o primeiro). */
export const politicaPadrao = {
	nome: "padrão",
	escolher(d) {
		const b = d.botoes.find((x) => x.default) ?? d.botoes[0];
		return b?.action ?? null;
	}
};

/** Sorteia valores de selects, checkboxes, radios e números, e um botão qualquer. */
export function politicaAleatoria({ cancelar = 0.05 } = {}) {
	return {
		nome: "aleatória",
		escolher(d) {
			const sortear = (n) => Math.floor(aleatorioDado() * n);
			for (const el of d.form.querySelectorAll("select")) {
				const op = [...el.options].filter((o) => !o.disabled);
				if (!op.length) continue;
				if (el.multiple) for (const o of op) o.selected = aleatorioDado() < 0.5;
				else el.value = op[sortear(op.length)].value;
			}
			for (const el of d.form.querySelectorAll("input[type=checkbox]")) el.checked = aleatorioDado() < 0.5;
			const radios = {};
			for (const el of d.form.querySelectorAll("input[type=radio]")) (radios[el.name] ??= []).push(el);
			for (const lista of Object.values(radios)) lista[sortear(lista.length)].checked = true;
			for (const el of d.form.querySelectorAll("input[type=number]")) {
				if (aleatorioDado() < 0.5) continue;
				const min = el.min !== "" ? Number(el.min) : 0;
				const max = el.max !== "" ? Number(el.max) : Math.max(min + 10, Number(el.value || 0) * 2, 10);
				el.value = String(min + sortear(Math.max(1, max - min + 1)));
			}
			if (aleatorioDado() < cancelar) return null;
			const b = d.botoes[sortear(d.botoes.length)];
			return b?.action ?? null;
		}
	};
}

/**
 * Roteiro: lista de respostas na ordem em que os diálogos aparecem. Cada resposta é
 * { botao, campos: {nome: valor} } ou uma função (d) => action. Esgotado, usa a política padrão.
 */
export function politicaRoteiro(passos, depois = politicaPadrao) {
	const fila = [...passos];
	return {
		nome: "roteiro",
		escolher(d) {
			const p = fila.shift();
			if (p === undefined) return depois.escolher(d);
			if (typeof p === "function") return p(d);
			for (const [nome, valor] of Object.entries(p.campos ?? {})) {
				// o diálogo pode ter mudado de forma (estado da macro): campo ausente é ignorado
				if (!d.form.querySelector(`[name="${nome}"]`)) continue;
				const el = d.form.querySelector(`[name="${nome}"]`);
				if (el.tagName === "SELECT" && ![...el.options].some((o) => o.value === String(valor))) continue;
				preencher(d.form, nome, valor);
			}
			if (p.botao === null) return null;
			return p.botao ?? (d.botoes.find((x) => x.default) ?? d.botoes[0])?.action ?? null;
		}
	};
}

export function preencher(form, nome, valor) {
	const els = [...form.querySelectorAll(`[name="${nome}"]`)];
	if (!els.length) throw new Error(`Campo "${nome}" não existe no diálogo`);
	for (const el of els) {
		if (el.type === "checkbox") el.checked = !!valor;
		else if (el.type === "radio") el.checked = el.value === String(valor);
		else if (el.tagName === "SELECT") {
			if (![...el.options].some((o) => o.value === String(valor))) throw new Error(`Opção "${valor}" não existe em ${nome}`);
			el.value = String(valor);
		} else el.value = String(valor);
	}
}

/** Descreve os campos de um formulário (para enumerar ramos nos testes). */
export function camposDoForm(form) {
	return [...form.querySelectorAll("select")].map((s) => ({ nome: s.name, opcoes: [...s.options].map((o) => o.value) }));
}

export function criarDialogV2(mundo) {
	class DialogV2 {
		constructor(options = {}) {
			this.options = options;
			this.element = window.document.createElement("div");
			this.element.className = "application dialog";
			this.form = window.document.createElement("form");
			this.form.className = "dialog-form standard-form";
			this.element.appendChild(this.form);
			const c = options.content ?? "";
			if (typeof c === "string") this.form.innerHTML = c;
			else if (c?.outerHTML) this.form.innerHTML = c.outerHTML;
			this.botoes = (options.buttons ?? []).map((b, i) => ({ ...b, action: b.action ?? `b${i}` }));
			for (const b of this.botoes) {
				const el = window.document.createElement("button");
				el.type = "submit";
				el.dataset.action = b.action;
				el.textContent = b.label ?? b.action;
				this.form.appendChild(el);
				b.el = el;
			}
			this.window = { title: options.window?.title ?? "" };
		}

		get title() {
			return this.window.title;
		}

		async render() {
			return this;
		}

		async close() {}

		querySelector(s) {
			return this.element.querySelector(s);
		}

		static async _rodar(options) {
			return mundo.op(async () => {
				const d = new this(options);
				const ev = new window.Event("render");
				try {
					options.render?.(ev, d);
				} catch (err) {
					throw new Error(`render do diálogo "${d.title}" falhou: ${err.message}`);
				}
				const politica = mundo.politica;
				const action = politica.escolher({ tipo: options._tipo, titulo: d.title, form: d.form, botoes: d.botoes, dialogo: d });
				mundo.dialogos.push({ titulo: d.title, tipo: options._tipo, escolha: action, campos: camposDoForm(d.form), origem: mundo.contexto.atual });
				if (action === null || action === undefined) {
					if (options.rejectClose) throw new Error("Dialog was dismissed without pressing a button.");
					return null;
				}
				const b = d.botoes.find((x) => x.action === action);
				if (!b) throw new Error(`Botão "${action}" não existe no diálogo "${d.title}"`);
				const event = new window.Event("submit");
				let r = b.action;
				if (b.callback) r = await b.callback(event, b.el, d);
				await options.submit?.(r, d);
				return r;
			});
		}

		static async wait(options = {}) {
			return this._rodar({ ...options, _tipo: "wait" });
		}

		static async prompt(options = {}) {
			const ok = { action: "ok", label: "Confirm", default: true, ...(options.ok ?? {}) };
			return this._rodar({ ...options, _tipo: "prompt", buttons: [ok] });
		}

		static async confirm(options = {}) {
			const yes = { action: "yes", label: "Yes", default: true, callback: () => true, ...(options.yes ?? {}) };
			const no = { action: "no", label: "No", callback: () => false, ...(options.no ?? {}) };
			return this._rodar({ ...options, _tipo: "confirm", buttons: [yes, no] });
		}

		static async input(options = {}) {
			const ok = { action: "ok", label: "Confirm", default: true, callback: (e, b) => new mundo.FormDataExtended(b.form).object, ...(options.ok ?? {}) };
			return this._rodar({ ...options, _tipo: "input", buttons: [ok] });
		}
	}
	return DialogV2;
}

export function criarFormDataExtended() {
	return class FormDataExtended extends window.FormData {
		constructor(form, { dtypes = {} } = {}) {
			super(form);
			const obj = {};
			for (const el of form.elements) {
				if (!el.name || el.disabled) continue;
				if (el.type === "checkbox") obj[el.name] = el.checked;
				else if (el.type === "radio") {
					if (el.checked) obj[el.name] = el.value;
				} else if (el.type === "number" || el.dataset?.dtype === "Number" || dtypes[el.name] === "Number") obj[el.name] = el.value === "" ? null : Number(el.value);
				else if (el.tagName === "SELECT" && el.multiple) obj[el.name] = [...el.selectedOptions].map((o) => o.value);
				else obj[el.name] = el.value;
			}
			this.object = obj;
		}
	};
}
