/**
 * Cartão de teste no chat: o Mestre pede, o jogador rola (pedido do Cauê, 18/11/2026).
 *
 * As macros da campanha não rolam mais os testes pelos personagens. Elas chamam `pedirTeste`, que manda ao chat um
 * cartão no formato dos poderes (como o botão de resistência do Giria T20):
 *   - o texto da situação e o teste pedido ("Reflexos reduz à metade (CD 20)"; a CD só aparece para o Mestre);
 *   - a rolagem do dano, quando há, com os botões do sistema para aplicar o dano todo, em dobro ou a metade;
 *   - o botão do teste ("Reflexos"): quem clica rola o teste dos tokens selecionados (ou do seu personagem), e o
 *     chat diz se passou e o que acontece. Nada é aplicado sozinho: o dano fica nos botões do cartão.
 * Placar de testes com estado (Julgamento, teste estendido, Bebida Amarga do Wyrt) é contado pelo Mestre ativo
 * quando o resultado chega ao chat (GANCHOS).
 */
import { MODULO } from "./assinatura.mjs";

const SALVA = { fort: "Fortitude", refl: "Reflexos", vont: "Vontade" };
const EFEITO = { metade: "reduz à metade", evita: "evita" };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const flag = (msg, chave) => msg?.getFlag?.(MODULO, chave) ?? msg?.flags?.[MODULO]?.[chave];
const sussurroGM = () => ChatMessage.getWhisperRecipients("GM").map((u) => u.id ?? u);
const souMestreAtivo = () => game.user.isGM && (!game.users.activeGM || game.users.activeGM === game.user);

/** Nome da perícia ("Reflexos", "Acrobacia"). */
export function nomePericia(id) {
	if (SALVA[id]) return SALVA[id];
	const v = CONFIG.T20?.pericias?.[id];
	const s = typeof v === "string" ? v : v?.label;
	return s ? game.i18n.localize(s) : id;
}

/**
 * O que acontece com um resultado (função pura: o cliente de quem rola usa, e os testes também).
 * @param {object} pedido  as opções do cartão
 * @param {number} total   resultado final do teste
 * @returns {{passou: boolean|null, texto: string, dano: string|null}}
 */
export function resolver(pedido, total) {
	if (pedido.faixas?.length) {
		const f = pedido.faixas.find(([max]) => total <= max) ?? pedido.faixas.at(-1);
		return { passou: null, texto: f[1], dano: f[2] ?? null };
	}
	const passou = total >= (Number(pedido.cd) || 0);
	let texto = passou ? pedido.sucesso : pedido.falha;
	if (!texto && pedido.dano) {
		if (passou) texto = pedido.efeito === "metade" ? "sofre metade do dano (botão ½ no cartão)." : "não sofre o dano.";
		else texto = "sofre o dano todo (botão de dano no cartão).";
	}
	return { passou, texto: texto ?? "", dano: !passou && pedido.danoNaFalha ? pedido.danoNaFalha : null };
}

/** HTML da rolagem de dano no formato do sistema (os botões de aplicar dano entram sozinhos). */
async function htmlDoDano(roll) {
	const dentro = roll.render ? await roll.render() : `<div class="dice-roll"><div class="dice-result"><div class="dice-formula">${esc(roll.formula)}</div><h4 class="dice-total">${roll.total}</h4></div></div>`;
	return `<div class="roll roll--dano">${dentro}</div>`;
}

/**
 * Manda ao chat o cartão do teste. Só o Mestre.
 * @param {object} o
 * @param {string} o.titulo
 * @param {string} [o.img]
 * @param {string} [o.texto]           HTML da situação
 * @param {string} o.pericia           id da perícia (fort, refl, vont, acro...)
 * @param {number} [o.cd]
 * @param {string} [o.dano]            fórmula do dano que o teste reduz ("6d6[impacto]")
 * @param {"metade"|"evita"} [o.efeito]
 * @param {string} [o.sucesso]         texto para quem passa
 * @param {string} [o.falha]           texto para quem falha
 * @param {string} [o.danoNaFalha]     fórmula rolada para quem falha (cartão de dano à parte)
 * @param {Array<[number,string,string?]>} [o.faixas] resultado por faixa: [máximo, texto, dano?] (sem CD)
 * @param {Array<[string,string]>} [o.escolherPericia] quem rola escolhe a perícia: [id, rótulo]
 * @param {boolean} [o.voo]            pergunta a quem rola se tem voo (+5)
 * @param {number} [o.bonus]           bônus para todos (ajuste do Mestre)
 * @param {string[]} [o.alvos]         ids dos atores que podem rolar (vazio: qualquer um)
 * @param {string} [o.gancho]          contador do Mestre (GANCHOS)
 * @param {object} [o.dados]           dados do contador
 */
export async function pedirTeste(o) {
	if (!game.user.isGM) return ui.notifications.warn("Só o mestre pede testes.");
	const pedido = {
		titulo: o.titulo,
		pericia: o.pericia ?? null,
		cd: o.cd ?? null,
		dano: o.dano ?? null,
		efeito: o.efeito ?? null,
		sucesso: o.sucesso ?? null,
		falha: o.falha ?? null,
		danoNaFalha: o.danoNaFalha ?? null,
		faixas: o.faixas ?? null,
		escolherPericia: o.escolherPericia ?? null,
		voo: !!o.voo,
		bonus: Number(o.bonus) || 0,
		alvos: o.alvos?.length ? o.alvos : null,
		gancho: o.gancho ?? null,
		dados: o.dados ?? {},
		rolaram: []
	};
	const roll = o.dano ? await new Roll(o.dano).evaluate() : null;
	const teste = pedido.escolherPericia ? "Teste da perícia escolhida" : nomePericia(pedido.pericia);
	const cd = pedido.cd != null && !pedido.faixas ? ` <span class="cdr-cd">(CD ${pedido.cd})</span>` : "";
	const quem = pedido.alvos ? `<br><i>Rola: ${pedido.alvos.map((id) => esc(game.actors.get(id)?.name ?? "?")).join(", ")}</i>` : "";
	const content =
		`<div class="tormenta20 chat-card item-card cdr-pedido">` +
		`<header class="card-header flexrow"><img src="${esc(o.img ?? "icons/svg/d20-highlight.svg")}" title="${esc(o.titulo)}" width="36" height="36" style="flex:0"><h3 class="item-name"><div>${esc(o.titulo)}</div></h3></header>` +
		`<div class="card-item-header"><p><b>${esc(teste)}</b>${pedido.efeito ? ` ${EFEITO[pedido.efeito] ?? ""}` : ""}${cd}${quem}</p></div>` +
		(o.texto ? `<div class="card-content">${o.texto}</div>` : "") +
		(roll ? await htmlDoDano(roll) : "") +
		`</div>`;
	return ChatMessage.create({
		speaker: { alias: o.titulo },
		content,
		rolls: roll ? [roll] : [],
		flags: { [MODULO]: { pedido } }
	});
}

/** Atores que rolam: tokens selecionados de quem clicou, senão o personagem do jogador. */
function quemRola(pedido) {
	let atores = [...new Set((canvas?.tokens?.controlled ?? []).map((t) => t.actor).filter((a) => a?.isOwner))];
	if (!atores.length && game.user.character) atores = [game.user.character];
	if (pedido.alvos) {
		const daLista = atores.filter((a) => pedido.alvos.includes(a.id));
		if (daLista.length) return daLista;
		return pedido.alvos.map((id) => game.actors.get(id)).filter((a) => a?.isOwner);
	}
	return atores;
}

/** Janela de quem rola: perícia (quando o cartão deixa escolher) e voo. */
async function perguntar(pedido) {
	if (!pedido.escolherPericia && !pedido.voo) return { pericia: pedido.pericia, extra: 0 };
	const opcoes = (pedido.escolherPericia ?? [[pedido.pericia, nomePericia(pedido.pericia)]]).map(([id, r]) => `<option value="${esc(id)}">${esc(r)}</option>`).join("");
	const r = await foundry.applications.api.DialogV2.wait({
		window: { title: pedido.titulo },
		rejectClose: false,
		content: `<label>Perícia <select name="pericia">${opcoes}</select></label>` + (pedido.voo ? '<label><input type="checkbox" name="voo"> Tenho deslocamento de voo (+5)</label>' : ""),
		buttons: [{ action: "rolar", label: "Rolar", default: true, callback: (e, b) => ({ pericia: b.form.elements.pericia.value, voo: !!b.form.elements.voo?.checked }) }]
	});
	if (!r) return null;
	return { pericia: r.pericia, extra: r.voo ? 5 : 0 };
}

/** Cartão só com a rolagem de dano (para quem falhou, ou para a queda do salto). */
async function cartaoDeDano(titulo, formula, actor) {
	const roll = await new Roll(formula).evaluate();
	return ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor }),
		content: `<div class="tormenta20 chat-card item-card cdr-pedido"><header class="card-header flexrow"><h3 class="item-name"><div>${esc(titulo)}: dano de ${esc(actor.name)}</div></h3></header>${await htmlDoDano(roll)}</div>`,
		rolls: [roll]
	});
}

/**
 * Clique no botão do cartão: rola o teste e diz no chat o resultado.
 * @param {ChatMessage} message  o cartão
 * @param {Event} [event]
 */
export async function rolarPedido(message, event) {
	event?.preventDefault?.();
	const pedido = flag(message, "pedido");
	if (!pedido) return;
	const atores = quemRola(pedido);
	if (!atores.length) return ui.notifications.warn("Selecione o seu token (ou tenha um personagem) para rolar o teste.");
	const escolha = await perguntar(pedido);
	if (!escolha) return;
	for (const actor of atores) {
		if (pedido.rolaram?.includes(actor.id)) {
			ui.notifications.warn(`${actor.name} já rolou este teste.`);
			continue;
		}
		const roll = await actor.rollPericia(escolha.pericia, { event, message: false });
		if (!roll) continue;
		const extra = escolha.extra + pedido.bonus;
		const total = roll.total + extra;
		const r = resolver(pedido, total);
		const mod = extra ? ` ${extra > 0 ? "+" : "−"} ${Math.abs(extra)} = <b>${total}</b>` : "";
		const estado = r.passou === null ? "" : `<b>${r.passou ? "Passou" : "Falhou"}</b>: `;
		const flavor = `<b>${esc(pedido.titulo)}</b> · ${esc(nomePericia(escolha.pericia))}${mod}<br>${estado}${esc(actor.name)} ${r.texto}`;
		await roll.toMessage({
			speaker: ChatMessage.getSpeaker({ actor }),
			flavor,
			flags: { [MODULO]: { resultado: { cartao: message.id, ator: actor.id, total, passou: r.passou, pericia: escolha.pericia } } }
		});
		if (r.dano) await cartaoDeDano(pedido.titulo, r.dano, actor);
	}
}

/* -------------------------------------------- */
/*  Contadores do Mestre                        */
/* -------------------------------------------- */

const pausa = (s) => `<h3>${esc(s)}</h3>`;

/** Contadores por nome de gancho. Rodam no cliente do Mestre ativo, um resultado por vez. */
export const GANCHOS = {
	/** A1 · O Julgamento: 5 sucessos antes de 3 falhas; testemunha dá +1d6 numa falha. */
	async julgamento(pedido, res) {
		const FLAG = "cdrJulgamento";
		const st = foundry.utils.deepClone(game.user.getFlag("world", FLAG) ?? { s: 0, f: 0, ultimo: null, testemunhas: 0, fim: false });
		if (st.fim) return;
		let ok = res.passou;
		let extra = "";
		if (!ok && st.testemunhas > 0) {
			const usar = await foundry.applications.api.DialogV2.confirm({ window: { title: "Testemunha" }, content: `<p>${esc(res.nome)} tirou <b>${res.total}</b> contra CD ${pedido.cd}. Gastar uma testemunha (+1d6)?</p>` });
			if (usar) {
				const d6 = await new Roll("1d6").evaluate();
				await d6.toMessage({ flavor: "<b>O Julgamento</b>: uma testemunha fala a favor do grupo (+1d6)" });
				st.testemunhas -= 1;
				ok = res.total + d6.total >= pedido.cd;
				extra = ` + testemunha ${d6.total} = ${res.total + d6.total}`;
			}
		}
		if (ok) st.s += 1;
		else st.f += 1;
		st.ultimo = pedido.dados.grupo ?? st.ultimo;
		let veredito = "";
		if (st.s >= 5) {
			st.fim = true;
			veredito = "<p><b>Culpado!</b> Rodford é sentenciado à prisão perpétua. Vá para o Epílogo.</p>";
		} else if (st.f >= 3) {
			st.fim = true;
			veredito = "<p><b>Absolvido.</b> Rodford bane o grupo e Ezequias da cidade (Derrota no Tribunal).</p>";
		}
		await game.user.setFlag("world", FLAG, st);
		await ChatMessage.create({
			whisper: sussurroGM(),
			content: `${pausa("O Julgamento")}<p>${esc(res.nome)}: ${res.total}${extra} contra CD ${pedido.cd} → ${ok ? "sucesso" : "falha"}.</p><p><b>${st.s}/5</b> sucessos, <b>${st.f}/3</b> falhas, ${st.testemunhas} testemunha(s) restante(s).</p>${veredito}`
		});
	},

	/** CdR · Teste estendido: conta sucessos e falhas do teste salvo. */
	async estendido(pedido, res) {
		const FLAG = "cdr-testes";
		const testes = foundry.utils.deepClone(game.user.getFlag("world", FLAG) ?? {});
		const nome = pedido.dados.nome;
		const t = testes[nome];
		if (!t || t.fim) return;
		if (res.passou) t.s++;
		else t.f++;
		let fim = "";
		if (t.s >= t.need) fim = `<p><b>Sucesso!</b> ${t.s} sucessos.</p>`;
		else if (t.f >= t.maxF) fim = `<p><b>Fracasso.</b> ${t.f} falhas.</p>`;
		if (fim) delete testes[nome];
		await game.user.unsetFlag("world", FLAG);
		if (Object.keys(testes).length) await game.user.setFlag("world", FLAG, testes);
		await ChatMessage.create({
			whisper: sussurroGM(),
			content: `${pausa(nome)}<p>${esc(res.nome)}: ${res.total} ${res.passou ? "✔" : "✘"}</p><p>Progresso: ${t.s}/${t.need} sucessos, ${t.f}/${t.maxF} falhas. Rolagens feitas: ${t.n} (× ${esc(t.tempo)}).</p>${fim}`
		});
	},

	/** A3 · Partida de Wyrt: Bebida Amarga. Falhas: frustrado, esmorecido, inconsciente (fora do jogo). */
	async wyrtBebida(pedido, res) {
		const FLAG = "cdrWyrt";
		const st = foundry.utils.deepClone(game.user.getFlag("world", FLAG) ?? null);
		const j = st?.jogadores?.[res.ator];
		if (!j) return;
		let html = `<p>${esc(j.nome)}: Fortitude ${res.total} vs CD ${pedido.cd} → resiste.</p>`;
		if (!res.passou) {
			j.falhas++;
			const cond = ["frustrado", "esmorecido", "inconsciente"][Math.min(j.falhas, 3) - 1];
			if (j.falhas >= 3) j.fora = true;
			html = `<p>${esc(j.nome)}: Fortitude ${res.total} vs CD ${pedido.cd} → <b>${cond}</b>${j.fora ? " (sai do jogo)" : ""}.</p>`;
			try {
				await game.actors.get(res.ator)?.toggleStatusEffect?.(cond, { active: true });
			} catch (e) {
				console.warn(e);
			}
		}
		await game.user.setFlag("world", FLAG, st);
		await ChatMessage.create({ whisper: sussurroGM(), content: `${pausa("Partida de Wyrt")}${html}` });
	}
};

let fila = Promise.resolve();

/** Resultado de um cartão chegou ao chat: o Mestre ativo marca quem rolou e roda o contador. */
async function aoResultado(msg) {
	const res = flag(msg, "resultado");
	if (!res || !souMestreAtivo()) return;
	const cartao = game.messages.get(res.cartao);
	const pedido = flag(cartao, "pedido");
	if (!pedido) return;
	if (pedido.rolaram?.includes(res.ator)) return;
	const rolaram = [...(pedido.rolaram ?? []), res.ator];
	await cartao.update?.({ [`flags.${MODULO}.pedido.rolaram`]: rolaram });
	if (!cartao.update) pedido.rolaram = rolaram;
	const fn = GANCHOS[pedido.gancho];
	if (fn) await fn(pedido, { ...res, nome: game.actors.get(res.ator)?.name ?? "?" });
}

/** Botão no cartão e CD escondida dos jogadores. */
function aoRenderizar(message, html) {
	const pedido = flag(message, "pedido");
	const el = html instanceof HTMLElement ? html : html?.[0];
	if (!pedido || !el) return;
	if (!game.user.isGM) for (const s of el.querySelectorAll(".cdr-cd")) s.remove();
	const card = el.querySelector(".cdr-pedido");
	if (!card || card.querySelector(".cdr-rolar")) return;
	const footer = document.createElement("footer");
	footer.className = "card-item-template flexcol cdr-rolar";
	const botao = document.createElement("button");
	botao.type = "button";
	botao.title = "Rola o teste dos seus tokens selecionados (ou do seu personagem).";
	const rotulo = pedido.escolherPericia ? "Rolar o teste" : nomePericia(pedido.pericia);
	botao.innerHTML = `<i class="fas fa-shield-halved"></i> ${esc(rotulo)}`;
	botao.addEventListener("click", (ev) => rolarPedido(message, ev));
	footer.append(botao);
	card.append(footer);
}

/** Promessa que resolve quando o Mestre terminou de contar os resultados que já chegaram. */
export const resultadosContados = () => fila;

export function ligarTestesNoChat() {
	Hooks.on("renderChatMessageHTML", aoRenderizar);
	Hooks.on("createChatMessage", (msg) => {
		fila = fila.then(() => aoResultado(msg)).catch((e) => console.error(`${MODULO} | resultado de teste`, e));
	});
}
