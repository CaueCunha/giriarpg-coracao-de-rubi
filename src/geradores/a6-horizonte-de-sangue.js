/* =====================================================================
 * CORAÇÃO DE RUBI · AVENTURA 6 · "HORIZONTE DE SANGUE"
 * Gerador de conteúdo para Foundry VTT v14 + sistema Tormenta20 (Vizael 1.6.x)
 *
 * Fonte do compêndio do módulo giriarpg-coracao-de-rubi (o build roda este arquivo num Foundry
 * simulado). Também funciona como macro de Script, colado inteiro e executado pelo Mestre.
 * Cria, na pasta "A6 · Horizonte de Sangue" de cada tipo:
 *  • Ameaças novas do livro (pp. 122–127): Adramalek, Elemental Corrompido, Eridibus (três formas),
 *    Esmagador Coletivo, Ezequias Heldret (epílogo), Hashmalan, Queklain, Rhond, Sarektril, Zirradak
 *    e as três variações de ezzayn (burodrons, hurobakks e veridaks). O ezzayn comum, o sacerdote de
 *    Aharadak e o thuwarokk ficam como links para o Giria T20.
 *  • Perigos e testes: Prova da Câmara Planar, Duelo com Rhond, Travessia Cáustica, Rumo à Cidade na
 *    Tormenta, A Câmara de Eridibus, Enigmas de Hashmalan e O Ritual da Essência.
 *  • Tabela A6 · Encontros na Tormenta (2d6).
 *  • Itens: Coração de Rubi, Espada da Tormenta, essências cardeais, armaduras rubras, armas de Rhond,
 *    chave de Wynna, mapa de Reynard, seiva rubra, sementes carmesim; parceiros Reynard e Esquadrão Escarlate.
 *  • Macro A6 · Ritual da Essência (pilares energizados e lefeu que surgem a cada rodada).
 *  • Diários: Como usar no Foundry, Roteiro e Documentos para os jogadores.
 * Rodar de novo apaga (depois de confirmar) o que tem a marca flags.world.cdr = "a6" e recria tudo.
 *
 * Os links @GIRIA[nome|livro] viram links para o compêndio do Giria T20 no build do módulo.
 * Fichas conferidas com o livro Coração de Rubi, pp. 105–127.
 * ===================================================================== */

if (!game.user.isGM) return ui.notifications.error("Só o Mestre pode rodar este gerador.");

const TAG = "a6";
const FLAGS = (role) => ({ world: role ? { cdr: TAG, cdrRole: role } : { cdr: TAG } });
const NOME_PASTA = "A6 · Horizonte de Sangue";
const FONTE = "Coração de Rubi — Horizonte de Sangue";
const ICONE = (n) => `systems/tormenta20/icons/ameacas/${n}.png`;
const P = (...t) => t.map((x) => `<p style="text-align:justify">${x}</p>`).join("");
const G = (nome, rotulo) => `@GIRIA[${nome}|T20]{${rotulo ?? nome}}`;
const relatorio = { criados: [], avisos: [] };

// ---------------------------------------------------------------------------
// 0. Limpeza do que foi gerado antes
// ---------------------------------------------------------------------------
const isOurs = (d) => d.getFlag?.("world", "cdr") === TAG;
const colecoes = [game.actors, game.items, game.journal, game.tables, game.macros];
const antigos = colecoes.flatMap((c) => c.filter(isOurs));
if (antigos.length) {
	const ok = await foundry.applications.api.DialogV2.confirm({
		window: { title: "Aventura 6: recriar conteúdo" },
		content: `<p>Já existem <b>${antigos.length}</b> documentos gerados para a Aventura 6.</p>
			<p>Eles serão <b>apagados e recriados</b>. Tokens já colocados em cenas continuam lá, mas perdem o vínculo com os atores antigos.</p><p>Continuar?</p>`
	});
	if (!ok) return;
	for (const c of colecoes) {
		const ids = c.filter(isOurs).map((d) => d.id);
		if (ids.length) await c.documentClass.deleteDocuments(ids);
	}
	const pastasVelhas = game.folders.filter(isOurs).map((f) => f.id);
	if (pastasVelhas.length) await Folder.deleteDocuments(pastasVelhas);
}

// Pastas: uma por tipo, com subpastas
const pasta = {};
for (const type of ["Actor", "Item", "JournalEntry", "RollTable", "Macro"]) {
	pasta[type] = await Folder.create({ name: NOME_PASTA, type, color: "#7a1f1f", flags: FLAGS() });
}
const subpasta = (nome, type) => Folder.create({ name: nome, type, folder: pasta[type].id, color: "#7a1f1f", flags: FLAGS() });

// ---------------------------------------------------------------------------
// Compêndios do sistema
// ---------------------------------------------------------------------------
const normaliza = (s) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

async function doCompendio(pack, nome) {
	const p = game.packs.get(`tormenta20.${pack}`);
	if (!p) return null;
	const idx = await p.getIndex();
	const entrada = idx.find((e) => normaliza(e.name) === normaliza(nome));
	if (!entrada) return null;
	const doc = await p.getDocument(entrada._id);
	const obj = doc.toObject();
	delete obj._id;
	delete obj.folder;
	obj._stats = { compendiumSource: doc.uuid };
	return obj;
}

// ---------------------------------------------------------------------------
// Efeitos
// ---------------------------------------------------------------------------
const mudancas = (lista) => lista.map(([key, value, type = "add"]) => ({ key, value: String(value), type, priority: null, phase: "initial" }));
const AURA = { isAura: false, range: 0 };

/** Efeito "ao usar". automatic = Sempre aplicar. types: ["self"] = só este item; ["attack"] = qualquer ataque. */
function efUso(nome, changes, { automatic = false, types = ["self"], names = [], custo = null, img, desc = "" } = {}) {
	return {
		name: nome,
		img: img ?? "icons/svg/upgrade.svg",
		type: "base",
		transfer: false,
		disabled: true, // padrão do sistema para efeitos "ao usar"
		description: desc,
		system: {
			changes: mudancas(changes),
			targets: [],
			status: null,
			onuse: true,
			abilityUse: { description: "", automatic, aumenta: false, custo, names, types },
			aura: AURA
		}
	};
}

/** Efeito passivo que vale enquanto o item estiver na ficha. */
function efPassivo(nome, changes, { img, desc = "" } = {}) {
	return {
		name: nome,
		img: img ?? "icons/svg/aura.svg",
		type: "base",
		transfer: true,
		disabled: false,
		description: desc,
		system: { changes: mudancas(changes), targets: [], status: null, onuse: false, abilityUse: { description: "", automatic: false, aumenta: false, custo: null, names: [], types: [] }, aura: AURA }
	};
}

/** Efeito que aparece como botão no cartão do chat (aplica nos tokens selecionados). */
function efCartao(nome, changes, { img, rodadas = null, cena = false, desc = "" } = {}) {
	const duration = rodadas ? { value: rodadas, units: "rounds", expiry: "turnStart" } : cena ? { value: null, units: "seconds", expiry: "sceneEnd" } : {};
	return {
		name: nome,
		img: img ?? "icons/svg/aura.svg",
		type: "base",
		transfer: false,
		disabled: false,
		description: desc,
		duration,
		system: { changes: mudancas(changes), targets: [], status: null, onuse: false, abilityUse: { description: "", automatic: false, aumenta: false, custo: null, names: [], types: [] }, aura: AURA }
	};
}

/**
 * Condição do sistema como botão no cartão do chat.
 * Com o nome original, o sistema aplica a condição padrão (dura a cena, como no livro básico).
 * Com "rodadas", a condição vira uma cópia com duração própria (ex.: Atordoado por 1 rodada),
 * mantendo os efeitos filhos (Atordoado → Desprevenido) que somem junto com ela.
 */
function efCondicao(id, { rodadas = null } = {}) {
	const status = CONFIG.statusEffects[id];
	if (!status) {
		relatorio.avisos.push(`Condição "${id}" não encontrada no sistema.`);
		return efCartao(id, []);
	}
	const ef = foundry.utils.deepClone(status._source);
	for (const k of ["_id", "_stats", "_key", "folder", "sort", "origin"]) delete ef[k];
	ef.transfer = false;
	ef.disabled = false;
	if (ef.system?.aura) delete ef.system.aura.disposition;
	if (rodadas) {
		ef.name = `${status.name} (${rodadas} rodada${rodadas > 1 ? "s" : ""})`;
		ef.duration = { value: rodadas, units: "rounds", expiry: "turnStart" };
	}
	return ef;
}

// ---------------------------------------------------------------------------
// Itens de ameaça
// ---------------------------------------------------------------------------
const PROP_VAZIA = {};

/** Arma de ameaça. O ataque usa o total da perícia (Luta/Pontaria) + "extra". Dano já com bônus. */
function arma(nome, { img, pericia = "luta", extra = 0, dano, tipo, critM = 20, critX = 2, alcance = "", proposito = "corpo-a-corpo", proficiencia = "natural", desc = "", efeitos = [] }) {
	return {
		name: nome,
		type: "arma",
		img: img ?? "icons/svg/sword.svg",
		effects: efeitos,
		system: {
			description: { value: desc },
			source: FONTE,
			rolls: [
				{ name: "Ataque", key: "ataque0", type: "ataque", parts: [["1d20", "", ""], [pericia, "", ""], [String(extra), "", ""]], versatil: "", adaptavel: "" },
				{ name: "Dano", key: "dano1", type: "dano", parts: [[dano, tipo, ""], ["", "", ""]], versatil: "", adaptavel: "" }
			],
			criticoM: critM,
			criticoX: critX,
			alcance,
			proposito,
			proficiencia,
			empunhadura: "leve"
		}
	};
}

/** Habilidade de ameaça (item poder do tipo "ability"). */
function habilidade(nome, desc, { img, execucao = "passive", alcance = "", area = "", resistencia = "", rolls = [], efeitos = [], duracao = null, custo = 0 } = {}) {
	return {
		name: nome,
		type: "poder",
		img: img ?? "icons/svg/aura.svg",
		effects: efeitos,
		system: {
			description: { value: P(desc) },
			source: FONTE,
			tipo: "ability",
			ativacao: { execucao, custo },
			alcance,
			area,
			duracao: duracao ?? { value: 0, units: "inst", special: "" },
			resistencia: { pericia: "", atributo: "", bonus: 0, txt: resistencia },
			rolls
		}
	};
}

const rolagemDano = (nome, formula, tipo, i = 0) => ({ name: nome, key: `dano${i}`, type: "dano", parts: [[formula, tipo, ""]], versatil: "", adaptavel: "" });
const rolagemFormula = (nome, formula, i = 0) => ({ name: nome, key: `formula${i}`, type: "formula", parts: [[formula, "", ""]], versatil: "", adaptavel: "" });

const EQ = (n) => `systems/tormenta20/icons/itens/equipamentos/${n}.webp`;
const HAB = (n) => `systems/tormenta20/icons/poderes/ameacas/${n}.webp`;
const GER = (n) => `systems/tormenta20/icons/itens/gerais/${n}.webp`;
const IMG = {
	machadoBatalha: EQ("machado-de-batalha"),
	machadoAnao: EQ("machado-anao"),
	machadoGuerra: EQ("machado-de-guerra"),
	martelo: EQ("martelo-de-guerra"),
	escudo: EQ("escudo-pesado"),
	espada: EQ("espada-longa"),
	espadaCurta: EQ("espada-curta"),
	adaga: EQ("adaga"),
	arco: EQ("arco-longo"),
	besta: EQ("besta-pesada"),
	pancada: HAB("pancada"),
	garra: HAB("garras"),
	mordida: HAB("mordida"),
	dilacerar: HAB("dilacerar"),
	olho: HAB("visao-ampla"),
	cura: "icons/svg/regen.svg",
	fort: "icons/magic/defensive/shield-barrier-glowing-triangle-red.webp",
	fogo: "icons/magic/fire/flame-burning-embers-yellow.webp",
	ordens: HAB("comandar"),
	forja: "icons/magic/symbols/elements-air-earth-fire-water.webp",
	bomba: GER("acido"),
	golpe: HAB("ataque-furtivo"),
	arcano: HAB("magias"),
	bloqueio: "icons/skills/melee/shield-damaged-broken-blue.webp",
	atordoar: "icons/magic/control/debuff-energy-hold-blue-yellow.webp",
	rd: "icons/svg/downgrade.svg"
};

/** Magia que o sistema só tem dentro de uma ameaça (ex.: Soco de Arsenal, no Capelão de Guerra). */
async function magiaDeAmeaca(nome) {
	const p = game.packs.get("tormenta20.ameacas");
	if (!p) return null;
	for (const ator of await p.getDocuments()) {
		const i = ator.items.find((x) => x.type === "magia" && normaliza(x.name) === normaliza(nome));
		if (!i) continue;
		const obj = i.toObject();
		delete obj._id;
		obj._stats = { compendiumSource: i.uuid };
		return obj;
	}
	return null;
}

function nivelDoND(nd) {
	if (["S", "S+"].includes(nd)) return 20;
	return Number(nd) || 1;
}

async function criarAmeaca(a, folder) {
	const tam = { min: 0.5, peq: 1, med: 1, gra: 2, eno: 3, col: 4 }[a.tamanho] ?? 1;
	const resist = {};
	for (const t of a.imune ?? []) resist[t] = { imunidade: true };
	for (const t of a.vulneravel ?? []) resist[t] = { ...(resist[t] ?? {}), vulnerabilidade: true };

	const data = {
		name: a.nome,
		type: "npc",
		img: a.img,
		folder: folder.id,
		prototypeToken: {
			name: a.nome,
			width: tam,
			height: tam,
			texture: { src: a.img },
			disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
			actorLink: false,
			bar1: { attribute: "attributes.pv" }
		},
		system: {
			atributos: Object.fromEntries(Object.entries(a.atr).map(([k, v]) => [k, { base: v }])),
			attributes: {
				nd: a.nd,
				cd: a.cd ?? 10,
				pv: { value: a.pv, max: a.pv },
				pm: { value: a.pm ?? 0, max: a.pm ?? 0 },
				defesa: { base: a.defesa - (a.atr.des ?? 0) },
				movement: { walk: { base: a.desl }, ...(a.escalar ? { climb: { base: a.escalar } } : {}) },
				sentidos: { value: a.sentidos ?? [] }
			},
			detalhes: {
				tipo: a.tipo,
				raca: a.raca ?? "",
				resistencias: a.resistencias ?? "",
				ataquescac: a.ataquescac ?? "",
				ataquesad: a.ataquesad ?? "",
				equipamento: a.equipamento ?? "",
				tesouro: a.tesouro ?? "Nenhum.",
				biography: { value: P(a.bio ?? ""), public: "" }
			},
			tracos: { tamanho: a.tamanho, resistencias: resist, ic: { value: a.ic ?? [], custom: "" } }
		},
		flags: { tormenta20: { coracaoDeRubi: "aventura6" }, world: { cdr: TAG, ...(a?.automacoes ? { cdrAutomacoes: a.automacoes } : {}) } }
	};
	const actor = await Actor.implementation.create(data);

	// Perícias: o sistema soma metade do ND + atributo; "outros" completa o total do livro.
	const meio = Math.floor(nivelDoND(a.nd) / 2);
	const upd = {};
	for (const [k, total] of Object.entries(a.pericias ?? {})) {
		const per = actor.system.pericias?.[k];
		if (!per) {
			relatorio.avisos.push(`${a.nome}: perícia "${k}" não existe na ficha.`);
			continue;
		}
		const atr = actor.system.atributos[per.atributo]?.value ?? 0;
		upd[`system.pericias.${k}.outros`] = total - meio - atr;
	}
	if (Object.keys(upd).length) await actor.update(upd);

	// Itens: habilidades, armas e magias do compêndio
	const itens = a.itens();
	for (const nomeMagia of a.magias ?? []) {
		const m = (await doCompendio("magias", nomeMagia)) ?? (await magiaDeAmeaca(nomeMagia));
		// Algumas magias do sistema trazem mudanças sem chave (ex.: Mão Poderosa), que o Foundry recusa.
		for (const e of m?.effects ?? []) if (e.system?.changes) e.system.changes = e.system.changes.filter((c) => c.key);
		if (m) itens.push(m);
		else relatorio.avisos.push(`${a.nome}: magia "${nomeMagia}" não encontrada no compêndio.`);
	}
	await actor.createEmbeddedDocuments("Item", itens);
	relatorio.criados.push(`${a.nome} (ND ${a.nd})`);
	return actor;
}

async function criarPerigo(h, folder) {
	const actor = await Actor.implementation.create({
		name: h.nome,
		type: "hazard",
		img: "icons/environment/traps/saw-steel-grey.webp",
		folder: folder.id,
		system: {
			attributes: { nd: h.nd },
			detalhes: { goal: P(`<b>${h.local}.</b>`) + h.goal, effects: h.effects, actions: h.actions }
		},
		flags: { tormenta20: { coracaoDeRubi: "aventura6" }, world: { cdr: TAG } }
	});
	relatorio.criados.push(`Perigo: ${h.nome}`);
	return actor;
}


const GL = (nome, livro, rotulo) => `@GIRIA[${nome}|${livro}]{${rotulo ?? nome}}`;

// ---------------------------------------------------------------------------
// Ameaças (livro, pp. 122–127)
// ---------------------------------------------------------------------------
IMG.acido = GER("acido");
IMG.tormenta = "icons/svg/eye.svg";
IMG.trevas = "icons/svg/skull.svg";
IMG.raio = "icons/svg/lightning.svg";
IMG.frio = "icons/svg/frozen.svg";
IMG.veneno = "icons/svg/poison.svg";
IMG.bando = "icons/svg/combat.svg";
IMG.tempo = "icons/svg/clockwork.svg";
IMG.reparo = "icons/svg/regen.svg";
IMG.lanca = EQ("lanca");
IMG.marreta = EQ("martelo-de-guerra");
IMG.bastarda = EQ("espada-bastarda");
IMG.montante = EQ("montante");

const INSANIDADE = (formula, cd) => habilidade("Insanidade da Tormenta", `Criaturas que comecem o turno em alcance curto ou que vejam a criatura pela primeira vez na cena perdem ${formula} PM (Vontade CD ${cd} evita).`, { img: IMG.tormenta, alcance: "short", resistencia: "Vontade evita", rolls: [rolagemFormula("PM perdidos", formula)] });
const DISTORCAO_TEMPORAL = (quem, acoes) => habilidade("Distorção Temporal", `${quem} ${acoes} a cada turno.`, { img: IMG.tempo });
const AGARRAR = (ataque, bonus) => habilidade("Agarrar Aprimorado", `Quando acerta um ataque de ${ataque}, pode fazer a manobra agarrar como ação livre (teste +${bonus}).`, { img: IMG.garra, execucao: "free", rolls: [rolagemFormula("Agarrar", `1d20+${bonus}`)] });
const MATERIA = (n = "1d6") => efUso("Matéria vermelha", [["dano", n]], { automatic: true, img: IMG.tormenta, desc: `+${n} de matéria vermelha.` });
const BANDO = (nome) => habilidade("Bando", `${nome} é um grupo de indivíduos. Se um ataque do bando exceder a Defesa do inimigo por 10 ou mais, causa o dobro do dano; se errar, ainda causa metade. Imune a manobras de combate e a efeitos de alvo único que não causam dano; vulnerável a dano de área.`, { img: IMG.bando });

/** Ezzayn base (p. 125), com ajustes de variação. */
function ezzayn(nome, { ajuste = 0, pv = 650, fort = 27, inic = 15, refl = 25, voo = 0, extra, bio }) {
	return {
		nome, nd: "17", tipo: "mon", raca: "Lefeu", tamanho: "eno", img: ICONE("formiga-aberrante-maior"), voo,
		atr: { for: 12, des: 5, con: 3, int: 0, sab: 3, car: -3 },
		pv, defesa: 46, desl: 9, cd: 44, sentidos: ["escuro"],
		resistencias: "redução de dano 10",
		pericias: { inic, perc: 18, fort, refl, vont: 16, luta: 49 + ajuste },
		ataquescac: `[bando] Garra +${49 + ajuste} (4d8+${29 + ajuste}, 19).`,
		bio,
		itens: () => [
			arma("Garra", { img: IMG.garra, dano: `4d8+${29 + ajuste}`, tipo: "corte", critM: 19 }),
			habilidade("Anarquia Lacerante", "Faz um ataque de garra contra cada criatura adjacente ou num quadrado ocupado por ele: um único teste de ataque comparado com a Defesa de cada alvo.", { img: IMG.dilacerar, execucao: "action" }),
			DISTORCAO_TEMPORAL("O ezzayn", "pode realizar uma ação padrão ou de movimento adicional"),
			habilidade("Enxame", "Criaturas no espaço do ezzayn no fim do turno dele sofrem 14d8 de corte.", { img: IMG.dilacerar, rolls: [rolagemDano("Enxame", "14d8", "corte")] }),
			INSANIDADE("4d6", 44),
			habilidade("Subjugar", "No fim de cada turno, usa a manobra derrubar (teste +54) contra cada criatura no seu espaço: um único teste comparado com o de cada uma. Quem perde por 5 ou mais ainda sofre 8d8 de corte.", { img: IMG.pancada, execucao: "free", rolls: [rolagemFormula("Derrubar", "1d20+54", 0), rolagemDano("Dano", "8d8", "corte", 1)], efeitos: [efCondicao("caido")] }),
			BANDO("O ezzayn"),
			...(extra ? [extra] : [])
		]
	};
}

const eridibus = (forma, extra) => ({
	tipo: "mon", raca: "Lefeu", tamanho: "eno", nd: "20", cd: 49, sentidos: ["cegas"],
	...extra,
	nome: `Eridibus, Cardeal da Evolução (${forma})`,
	bio: `${extra.bio} Eridibus é a forma lefeu em mudança constante. No início da 1ª, 4ª e 7ª rodadas (e quando a forma atual chega a 0 PV), ele e a câmara mudam e a nova forma surge com PV máximos: troque o token pela próxima forma. Veja o perigo A Câmara de Eridibus.`
});

const AMEACAS = [
	{
		nome: "Adramalek, Cardeal da Dominação", nd: "20", tipo: "mon", raca: "Lefeu", tamanho: "gra", img: ICONE("cavaleiro-supremacista"),
		atr: { for: 16, des: 13, con: 15, int: 1, sab: 2, car: -2 },
		pv: 1200, defesa: 63, desl: 12, cd: 49, sentidos: ["cegas"],
		resistencias: "fortificação 25%, resistência a magia +5",
		pericias: { inic: 31, perc: 23, fort: 34, refl: 30, vont: 20, luta: 45 },
		ataquescac: "Lâmina Carmesim +45 (4d6+40, 16, mais 1d6 matéria vermelha).",
		equipamento: "Lâmina Carmesim (montante aumentado de matéria vermelha, certeira, cruel, precisa, ameaçadora e magnífica), couraça de matéria vermelha.",
		bio: "Outrora Velk, o Galo Louco, guerreiro humano da Companhia Rubra de Reynard, capturado e corrompido na incursão deles. Máquina de morte: sempre ataca quem mais o feriu na rodada anterior (ou o mais próximo). Não dialoga. Parte 3, Cena 3. Ao cair, vira pó e deixa a Essência da Dominação (pirâmide alaranjada).",
		itens: () => [
			arma("Lâmina Carmesim", { img: IMG.montante, dano: "4d6+40", tipo: "corte", critM: 16, proficiencia: "marcial", desc: P("Mais 1d6 de matéria vermelha (entra sozinho)."), efeitos: [MATERIA()] }),
			habilidade("Assimilar", "Usa uma habilidade da qual tenha sido alvo desde o início do seu turno anterior, com os parâmetros originais, mas CD 49.", { img: IMG.arcano, execucao: "move" }),
			habilidade("Defesa Adaptativa", "Escudo elemental (role 1d4 no início do combate e sempre que se reformar: 1 ácido, 2 eletricidade, 3 fogo, 4 frio). Com o escudo ativo, Adramalek é imune a todo dano exceto o do tipo escolhido e, no início de cada turno, causa 10d10 desse tipo em todas as criaturas em alcance curto (Ref CD 49 reduz à metade). O escudo some se ele sofrer 50 de dano do tipo escolhido e volta duas rodadas depois.", { img: IMG.fort, alcance: "short", resistencia: "Reflexos reduz à metade", rolls: [rolagemFormula("Tipo do escudo (1d4)", "1d4", 0), rolagemFormula("Dano do escudo", "10d10", 1)] }),
			DISTORCAO_TEMPORAL("Adramalek", "faz duas ações padrão e duas de movimento"),
			habilidade("Fúria Rubra", "Entra em fúria: +10 em testes de ataque e rolagens de dano e cura acelerada 30. Termina se, no fim da rodada, ele não atacou nem foi alvo de efeito hostil.<br><b>Automação:</b> opção no ataque; a cura acelerada fica com o mestre.", { img: IMG.fogo, execucao: "move", efeitos: [efUso("Fúria Rubra (+10)", [["ataque", 10], ["dano", 10]], { types: ["attack"], img: IMG.fogo, desc: "+10 no ataque e no dano." })], rolls: [rolagemDano("Cura acelerada", "30", "curapv")] }),
			INSANIDADE("3d12", 49),
			habilidade("Sangue dos Inimigos", "Em fúria, cada acerto crítico ou inimigo reduzido a 0 PV dá +1 cumulativo em ataque e dano até a fúria acabar.", { img: IMG.dilacerar }),
			habilidade("Tornado da Morte", "Ataca todos os inimigos ao redor: uma única jogada de ataque comparada com a Defesa de cada criatura no alcance e uma única rolagem de dano aplicada a todas as atingidas.", { img: IMG.dilacerar, execucao: "action" })
		]
	},
	{
		nome: "Elemental Corrompido", nd: "16", tipo: "esp", raca: "Elemental", tamanho: "col", img: ICONE("troll-aquatico"), nadar: 15,
		atr: { for: 12, des: 5, con: 13, int: -1, sab: 0, car: 0 },
		pv: 800, defesa: 53, desl: 15, cd: 42, sentidos: ["cegas"], imune: ["eletricidade", "fogo", "frio", "luz", "trevas"], ic: ["atordoado", "fatigado", "exausto", "paralisado"],
		resistencias: "imunidade a acertos críticos e a atordoamento, cansaço, eletricidade, fogo, frio, luz, metabolismo, paralisia e trevas",
		pericias: { inic: 19, perc: 14, fort: 30, refl: 24, vont: 16, luta: 46 },
		ataquescac: "Mordida +46 (3d12+15 mais 4d6 ácido) e duas pancadas +46 (3d8+15 mais 4d6 ácido).",
		bio: "Outrora um grande elemental da água protetor do Rio Panteão, assimilado pela Tormenta: larva de corpo líquido com presas de gelo vermelho, feita de sangue e ácido. Parte 2, Cena 2 (Travessia Cáustica). No rio, tem cura acelerada 50.",
		itens: () => [
			arma("Mordida", { img: IMG.mordida, dano: "3d12+15", tipo: "perfuracao", desc: P("Mais 4d6 de ácido (entra sozinho)."), efeitos: [efUso("Ácido", [["dano", "4d6[acido]"]], { automatic: true, img: IMG.acido, desc: "+4d6 de ácido." })] }),
			arma("Pancada", { img: IMG.pancada, dano: "3d8+15", tipo: "impacto", desc: P("Duas pancadas por ação agredir, junto com a mordida. Mais 4d6 de ácido (entra sozinho)."), efeitos: [efUso("Ácido", [["dano", "4d6[acido]"]], { automatic: true, img: IMG.acido, desc: "+4d6 de ácido." })] }),
			AGARRAR("mordida", 56),
			habilidade("Corpo Volátil", "Se sofrer 20 ou mais de eletricidade ou fogo mágicos, a água evapora numa nuvem corrosiva de 6 m ao redor. Quem começa o turno nela sofre 10d6 de ácido e fica enjoado (Fort CD 42 reduz à metade e evita). Dentro da nuvem: deslocamento 3 m, –2 em ataque e dano, camuflagem leve até 1,5 m e total além disso.", { img: IMG.acido, area: "6m", resistencia: "Fortitude reduz à metade e evita a condição", rolls: [rolagemDano("Nuvem", "10d6", "acido")], efeitos: [efCondicao("enjoado")] }),
			habilidade("Engolfar", "Se começa o turno agarrando uma criatura Grande ou menor, faz um teste de agarrar; se vencer, a engolfa: continua agarrada, submersa, sufocando e sofrendo 10d6 de ácido no início de cada rodada do elemental. Escapa com Atletismo (natação) CD 42.", { img: IMG.acido, execucao: "free", rolls: [rolagemDano("Ácido", "10d6", "acido")] }),
			habilidade("Reabastecer (cura acelerada 50)", "Em contato com um corpo d'água Médio ou maior, tem cura acelerada 50. Se fosse sofrer dano mágico de frio, cura metade do dano.<br><b>Automação:</b> no rio, o módulo cura 50 PV no início do turno. Apague esta habilidade se ele sair da água.", { img: IMG.reparo, rolls: [rolagemDano("Cura acelerada", "50", "curapv")] }),
			habilidade("Torrente Cáustica", "Uma criatura em alcance médio sofre 10d6 (metade ácido, metade impacto) e fica caída (Ref CD 42 reduz à metade e evita). Falha por 10+: empurrada 6 m e armadura/escudo corroído (–1 na Defesa). Recarga (movimento).", { img: IMG.acido, execucao: "move", alcance: "medium", resistencia: "Reflexos reduz à metade e evita a condição", rolls: [rolagemDano("Ácido", "5d6", "acido", 0), rolagemDano("Impacto", "5d6", "impacto", 1)], efeitos: [efCondicao("caido")] })
		],
		automacoes: { curaAcelerada: { valor: 50 } }
	},
	eridibus("Centopeia-Dragão", {
		img: ICONE("centopeia-dragao"), escavar: 9,
		atr: { for: 18, des: 10, con: 15, int: 5, sab: 7, car: -1 },
		pv: 400, defesa: 64, desl: 18,
		resistencias: "redução de dano 10",
		pericias: { inic: 26, perc: 28, fort: 34, refl: 35, vont: 20, luta: 59 },
		ataquescac: "Mordida +59 (4d8+25 mais 2d12 fogo).",
		bio: "Forma da 1ª rodada: centopeia-dragão de pele rochosa que respinga líquido fervente; a sala vira deserto vermelho.",
		itens: () => [
			arma("Mordida", { img: IMG.mordida, dano: "4d8+25", tipo: "perfuracao", desc: P("Mais 2d12 de fogo (entra sozinho)."), efeitos: [efUso("Fogo", [["dano", "2d12[fogo]"]], { automatic: true, img: IMG.fogo, desc: "+2d12 de fogo." })] }),
			AGARRAR("mordida", 64),
			habilidade("Aura de Calor", "No início de cada turno de Eridibus, todas as criaturas em alcance curto sofrem 8d12 de fogo.", { img: IMG.fogo, alcance: "short", rolls: [rolagemDano("Fogo", "8d12", "fogo")] }),
			habilidade("Engolir", "Se começa o turno agarrando uma criatura Média ou menor, faz um teste de agarrar; se vencer, a engole: agarrada, sofre 4d6+25 de impacto e 5d12 de fogo no início de cada turno dele. Uma por vez. Escapa causando 50 de dano ao estômago (Defesa 20).", { img: IMG.mordida, execucao: "action", rolls: [rolagemDano("Impacto", "4d6+25", "impacto", 0), rolagemDano("Fogo", "5d12", "fogo", 1)] }),
			INSANIDADE("3d12", 49),
			habilidade("Sangue Fervente", "Quem causa dano com ataque corpo a corpo sofre 2d12 de fogo (armas alongadas não).", { img: IMG.fogo, rolls: [rolagemDano("Fogo", "2d12", "fogo")] }),
			habilidade("Sopro de Plasma", "Cone de 18 m: 20d12 de fogo e em chamas (Ref CD 49 reduz à metade e evita). Recarga (movimento).", { img: IMG.fogo, execucao: "action", area: "18m", resistencia: "Reflexos reduz à metade e evita a condição", rolls: [rolagemDano("Fogo", "20d12", "fogo")], efeitos: [efCondicao("emchamas")] })
		]
	}),
	eridibus("Bisão da Montanha", {
		img: ICONE("guerreiro-de-chifres"),
		atr: { for: 15, des: 5, con: 18, int: 5, sab: 7, car: -1 },
		pv: 700, defesa: 64, desl: 18,
		resistencias: "redução de dano 20, resistência a magia +5, metade do dano de corte, impacto e perfuração",
		pericias: { inic: 21, perc: 28, fort: 34, refl: 28, vont: 20, luta: 57 },
		ataquescac: "Chifres x2 +57 (4d10+33, 19/x3).",
		bio: "Forma da 4ª rodada: bisão gigante de pelagem rubra; a areia vira neve vermelha, a sala escurece e o vento impede a voz.",
		itens: () => [
			arma("Chifres", { img: IMG.pancada, dano: "4d10+33", tipo: "perfuracao", critM: 19, critX: 3, desc: P("Dois ataques por ação agredir.") }),
			habilidade("Passar por Cima", "Percorre até o dobro do deslocamento atropelando criaturas Grandes ou menores: 15d10+33 de impacto (Ref CD 49 reduz à metade).", { img: IMG.pancada, execucao: "full", resistencia: "Reflexos reduz à metade", rolls: [rolagemDano("Impacto", "15d10+33", "impacto")] }),
			habilidade("Pelagem Rubra", "Todo dano de corte, impacto e perfuração que Eridibus sofre é reduzido à metade.", { img: IMG.fort }),
			INSANIDADE("3d12", 49),
			habilidade("Sopro Gélido", "Cone de 18 m: 12d12 de frio e lentas (Ref CD 49 reduz à metade e evita). Recarga (movimento).", { img: IMG.frio, execucao: "action", area: "18m", resistencia: "Reflexos reduz à metade e evita a condição", rolls: [rolagemDano("Frio", "12d12", "frio")], efeitos: [efCondicao("lento")] })
		]
	}),
	eridibus("Lula Abissal", {
		img: ICONE("otyugh"), nadar: 24,
		atr: { for: 15, des: 15, con: 10, int: 5, sab: 7, car: -1 },
		pv: 400, defesa: 64, desl: 9,
		resistencias: "redução de dano 10",
		pericias: { inic: 31, perc: 28, fort: 20, refl: 29, vont: 34, luta: 54 },
		ataquescac: "Oito tentáculos +54 (1d10+15 mais veneno carmesim).",
		bio: "Forma da 7ª rodada: lula gigante com um olho no abdômen; a sala se enche de líquido ácido (6d6 de ácido por turno a partir do fim da 7ª rodada).",
		itens: () => [
			arma("Tentáculo", { img: IMG.garra, dano: "1d10+15", tipo: "impacto", desc: P("Oito ataques por ação agredir. Veneno carmesim: paralisado por 1 rodada (Fort CD 49 evita)."), efeitos: [efCondicao("paralisado", { rodadas: 1 })] }),
			AGARRAR("tentáculo", 59),
			habilidade("Constrição", "No início de cada turno, causa 2d10+15 de impacto em cada criatura que estiver agarrando.", { img: IMG.pancada, execucao: "free", rolls: [rolagemDano("Impacto", "2d10+15", "impacto")] }),
			INSANIDADE("3d12", 49)
		]
	}),
	{
		nome: "Esmagador Coletivo", nd: "15", tipo: "con", tamanho: "eno", img: ICONE("turba-de-zumbis"),
		atr: { for: 14, des: -1, con: 15, int: 0, sab: 0, car: 0 },
		pv: 800, defesa: 39, desl: 9, cd: 40, sentidos: ["escuro"], ic: ["paralisado"],
		resistencias: "imunidade a acertos críticos, metabolismo, metamorfose e paralisia; redução de dano 15; não pode ser flanqueado",
		pericias: { inic: 12, perc: 13, fort: 32, refl: 12, vont: 18, luta: 39 },
		ataquescac: "Três pancadas +39 (4d10+28).",
		bio: "Gigante de matéria vermelha feito de humanoides vivos fundidos, com dezenas de cabeças, braços e pernas e um coro de gemidos. Agarra a vítima e a absorve. Parte 1, Cena 3 (dois, na câmara de Reynard) e encontro 2 da tabela.",
		itens: () => [
			arma("Pancada", { img: IMG.pancada, dano: "4d10+28", tipo: "impacto", desc: P("Três pancadas por ação agredir. Pancada Estonteante: atordoado por 1 rodada (Fort CD 40 evita; uma vez por cena por criatura)."), efeitos: [efCondicao("atordoado", { rodadas: 1 })] }),
			habilidade("Absorver", "Absorve uma criatura Média ou menor que esteja agarrando há três turnos seguidos: ela morre e o esmagador recebe 20 PV temporários por nível dela.", { img: IMG.mordida, execucao: "full" }),
			AGARRAR("pancada", 41),
			habilidade("Arranhar", "No início do turno, causa 4d10+28 de corte em quem estiver agarrando.", { img: IMG.dilacerar, rolls: [rolagemDano("Corte", "4d10+28", "corte")] }),
			habilidade("Corpos Arremessados", "Arremessa 1d4+2 corpos num alvo em alcance longo: 4d8+15 de impacto por corpo (Ref CD 40 evita).", { img: IMG.pancada, execucao: "action", alcance: "long", resistencia: "Reflexos evita", rolls: [rolagemFormula("Corpos", "1d4+2", 0), rolagemDano("Por corpo", "4d8+15", "impacto", 1)] }),
			habilidade("Forma Horrenda", "Quem começa o turno em alcance médio fica apavorado por 1d4 rodadas e depois abalado (Von CD 40: só abalado por 1d4 rodadas e imune até o fim da cena).", { img: IMG.trevas, alcance: "medium", resistencia: "Vontade reduz", rolls: [rolagemFormula("Rodadas", "1d4")], efeitos: [efCondicao("apavorado"), efCondicao("abalado")] })
		]
	},
	{
		nome: "Ezequias Heldret (sumo-sacerdote)", nd: "20", tipo: "mon", raca: "Lefeu", tamanho: "gra", img: ICONE("maniaco-lefou"),
		atr: { for: 5, des: 5, con: 5, int: 15, sab: 8, car: 5 },
		pv: 900, defesa: 46, desl: 9, cd: 51,
		resistencias: "redução de dano 20, resistência a magia divina +5",
		pericias: { inic: 29, perc: 29, fort: 20, refl: 36, vont: 34, luta: 50, conh: 33, dipl: 23, intu: 26, mist: 33, ofic: 36, reli: 26 },
		ataquescac: "Coração de Rubi x2 +50 (1d8+35 mais os efeitos de um Coração da Tormenta por 1d4 rodadas).",
		equipamento: "Coração de Rubi.", tesouro: "Dobro.",
		bio: "Epílogo. Em sua nova forma, Ezequias é o elo entre Arton e os lefeu: simetria perfeita e exótica que fascina, corpo em mutação constante. Amável e diplomático, fala com empolgação das maravilhas lefeu e de \"evoluir\" Arton. Sumo-sacerdote de Aharadak e regente de Ahar'kadhan. Só para mestres que queiram continuar a história; Ofício (engenhoqueiro) +36.",
		itens: () => [
			arma("Coração de Rubi", { img: IMG.lanca, dano: "1d8+35", tipo: "perfuracao", proficiencia: "simples", desc: P("Dois ataques por ação agredir. Quem é tocado sofre os efeitos de um Coração da Tormenta por 1d4 rodadas: debilitado, enjoado, esmorecido e perde 10d6 PV por rodada (0 PV: desintegrado; afeta até lefou)."), efeitos: [efCondicao("debilitado"), efCondicao("enjoado"), efCondicao("esmorecido")] }),
			habilidade("Criações Insanas", "Até 10 bioengenhocas no corpo, cada uma simulando uma magia. Ativar: ação de movimento e Ofício (engenhoqueiro) CD 15 + custo em PM. Trocar o efeito: ação completa, fica desprevenido. Favoritas: Controlar o Tempo, Engenho de Mana e Intervenção Divina.", { img: IMG.forja, execucao: "move", rolls: [rolagemFormula("Ofício (engenhoqueiro)", "1d20+36")] }),
			habilidade("Espécime Perfeito", "Vislumbrá-lo faz a criatura perder 3d12 PM e ficar fascinada (Von CD 51 evita e imuniza pela cena; falha por 10+: pasma por 1d4 rodadas).", { img: IMG.tormenta, resistencia: "Vontade evita", rolls: [rolagemFormula("PM perdidos", "3d12")], efeitos: [efCondicao("fascinado"), efCondicao("pasmo")] }),
			DISTORCAO_TEMPORAL("Ezequias", "realiza uma ação padrão e uma de movimento adicionais"),
			habilidade("Momento de Tormenta", "Perfurando a realidade com o Coração de Rubi, invoca uma área de Tormenta com 2 km de raio por um dia.", { img: IMG.tormenta, execucao: "full" }),
			habilidade("Sumo-Sacerdote", "Para um devoto de Aharadak, desobedecer Ezequias conta como violar suas Obrigações e Restrições.", { img: IMG.ordens }),
			habilidade("Coração da Tormenta (dano por rodada)", "Rolagem dos 10d6 de perda de PV por rodada para quem sofre os efeitos do Coração de Rubi.", { img: IMG.tormenta, rolls: [rolagemFormula("Perda de PV", "10d6"), rolagemFormula("Rodadas", "1d4", 1)] })
		]
	},
	{
		nome: "Hashmalan, Cardeal da Assimilação", nd: "20", tipo: "con", raca: "Lefeu", tamanho: "med", img: ICONE("sacerdote-da-tormenta"), voo: 18,
		atr: { for: 4, des: 6, con: 7, int: 12, sab: 10, car: -1 },
		pv: 800, defesa: 45, desl: 9, cd: 51, sentidos: ["cegas"],
		resistencias: "imunidade a encantamento e ilusão",
		pericias: { inic: 33, perc: 33, fort: 33, refl: 33, vont: 33, mist: 33, conh: 33 },
		bio: "Lefeu construído por Aharadak para assimilar todo o conhecimento de Arton, paródia do sumo-sacerdote de Tanna-Toh: corpo de matéria fibrosa vermelha, globo luminoso no lugar da cabeça, quatro livros flutuantes. Parte 3, Cena 4: testa o grupo com enigmas (perigo Enigmas de Hashmalan); só luta se o grupo acertar menos de sete. Atacado antes disso, teletransporta o globo e volta com corpo novo sete segundos depois. A 0 PV, o globo vira a Essência da Assimilação.",
		itens: () => [
			habilidade("Conhecimento Universal", "Faz testes de qualquer perícia como se fosse treinado, com +33.", { img: HAB("magias"), rolls: [rolagemFormula("Perícia", "1d20+33")] }),
			habilidade("Dobra no Tempo", "Lança duas magias com execução de ação padrão ou menor.", { img: IMG.tempo, execucao: "action" }),
			INSANIDADE("3d12", 49),
			habilidade("Potencial Mágico Ilimitado", "Lança e sustenta qualquer magia arcana ou divina sem gastar PM, como conjurador de 20º nível (CD 51, limite de PM 32), mas só sustenta uma magia por rodada.", { img: IMG.arcano })
		]
	},
	{
		nome: "Queklain, Cardeal da Devoção", nd: "19", tipo: "mon", raca: "Lefeu", tamanho: "gra", img: ICONE("capitao-baluarte"),
		atr: { for: 13, des: 0, con: 15, int: 1, sab: 5, car: 7 },
		pv: 916, defesa: 64, desl: 9, cd: 47, sentidos: ["cegas"],
		resistencias: "redução de dano 20",
		pericias: { inic: 15, perc: 19, fort: 32, refl: 25, vont: 26, luta: 54, conh: 16, dipl: 22, intu: 20, reli: 20 },
		ataquescac: "Machado de guerra x2 +54 (3d6+28, 19/x3, mais 1d6 matéria vermelha).",
		equipamento: "Machado de guerra aumentado de matéria vermelha, atroz, preciso e drenante.",
		bio: "Goradar, o anão Paladino Único de Beluhga e líder dos Escolhidos da Dragoa-Rainha. Com a morte da deusa, vagou pelas Uivantes e foi seduzido por Aharadak. Armadura completa de placas vermelhas, elmo fechado, machado enorme; quatro almas acorrentadas flutuam presas à armadura e uma corrente imensa sai das costas até o Grande Templo. Pomposo e arrogante, voz metálica. Parte 2, Cena 4. Derrotado, deixa a Essência da Devoção (cristal vermelho em cruz).",
		itens: () => [
			arma("Machado de guerra", { img: IMG.machadoGuerra, dano: "3d6+28", tipo: "corte", critM: 19, critX: 3, proficiencia: "marcial", desc: P("Dois ataques por ação agredir. Mais 1d6 de matéria vermelha (entra sozinho)."), efeitos: [MATERIA(), efUso("Golpe Profano (+6d8)", [["dano", "6d8"]], { img: IMG.trevas, desc: "Uma vez por rodada, +6d8 no dano." })] }),
			habilidade("Almas Acorrentadas", "Os fantasmas da armadura agarram até quatro criaturas em alcance médio (teste +28). No fim do turno, cada agarrada sofre 3d6 de ácido e 3d6 de trevas e perde 2d8 PM. Cada alma: Defesa 26, 56 PV, mesmas imunidades, só pode ser atacada por quem ela agarra e causa 3d6 (metade ácido, metade trevas) a quem a acerta corpo a corpo.", { img: IMG.trevas, execucao: "free", alcance: "medium", rolls: [rolagemFormula("Agarrar", "1d20+28", 0), rolagemDano("Ácido", "3d6", "acido", 1), rolagemDano("Trevas", "3d6", "trevas", 1), rolagemFormula("PM perdidos", "2d8", 2)], efeitos: [efCondicao("agarrado")] }),
			habilidade("Baluarte da Devoção Absoluta", "Se passar num teste de resistência contra uma magia que o tem como alvo, ela é revertida contra o conjurador.", { img: IMG.fort }),
			habilidade("Expurgar os Impuros", "Onda de energia da Tormenta: 8d6 de trevas em todos os não lefeu em alcance médio (Von CD 47 reduz à metade).", { img: IMG.trevas, execucao: "move", alcance: "medium", resistencia: "Vontade reduz à metade", rolls: [rolagemDano("Trevas", "8d6", "trevas")] }),
			habilidade("Golpe Profano", "Uma vez por rodada, quando faz um ataque corpo a corpo, +6d8 no dano.<br><b>Automação:</b> opção no ataque do machado.", { img: IMG.trevas, execucao: "free" }),
			INSANIDADE("3d10", 47),
			habilidade("Vida Infindável", "Recupera 60 PV.", { img: IMG.cura, execucao: "move", rolls: [rolagemDano("Cura", "60", "curapv")] })
		]
	},
	{
		nome: "Rhond, o Deus das Armas", nd: "20", tipo: "hum", raca: "Deus menor", tamanho: "gra", img: ICONE("golem-de-ferro"),
		atr: { for: 15, des: 1, con: 12, int: 8, sab: 8, car: 5 },
		pv: 1200, defesa: 60, desl: 9, cd: 47, sentidos: ["cegas"], ic: ["desprevenido", "surpreendido"],
		resistencias: "imunidade a desprevenido, surpreendido, efeitos mentais, metabolismo, metamorfose e veneno; redução de dano 20; resistência a magia +10",
		pericias: { inic: 17, perc: 24, fort: 34, refl: 20, vont: 28, luta: 48, ofic: 33, reli: 28 },
		ataquescac: "Armamento de Rhond x6 +48 (veja as armas).",
		bio: "O Deus Menor das Armas (Tormenta20, p. 365): forma metálica enorme de seis braços, rude e de poucas palavras, em sua forja vulcânica. Parte 1, Cena 6: luta um contra um com cada personagem para escolher a arma de aço-rubi certa. Sem força total: dois ataques na 1ª rodada, quatro na 2ª e seis na 3ª; para se alguém ficar inconsciente e recupera todos os PV entre os duelos. Qualquer interferência expulsa todos do templo. Escolhe a arma pelo estilo do oponente (ex.: Rasgacéus contra RD ou armaduras pesadas). Veja o perigo Duelo com Rhond.",
		itens: () => [
			arma("Lança Rasgacéus", { img: IMG.lanca, dano: "1d8+25", tipo: "essencia", critX: 3, desc: P("Mais 1d6 de eletricidade; ignora 20 de RD. O atingido sofre mais 4d8+4 de eletricidade (Fort CD 47 reduz à metade)."), efeitos: [efUso("Eletricidade", [["dano", "1d6[eletricidade]"], ["ignoraRD", 20]], { automatic: true, img: IMG.raio, desc: "+1d6 de eletricidade, ignora 20 de RD." }), efUso("Descarga (+4d8+4)", [["dano", "4d8+4[eletricidade]"]], { img: IMG.raio, desc: "Fort CD 47 reduz à metade." })] }),
			arma("Mangual Punição", { img: EQ("mangual"), dano: "1d12+31", tipo: "impacto", desc: P("O atingido fica sangrando (cumulativo) e fraco, depois debilitado. Ao acertar, Rhond lança Dissipar Magia no alvo."), efeitos: [efCondicao("sangrando"), efCondicao("fraco"), efCondicao("debilitado")] }),
			arma("Martelo de Guerra Implacável", { img: IMG.marreta, dano: "1d10+35", tipo: "impacto", critM: 17, desc: P("Fort CD 47 ou fica caído e é empurrado 1,5 m (+1,5 m a cada 5 pontos de falha); bater em algo causa 1d6 de impacto por 1,5 m."), efeitos: [efCondicao("caido")] }),
			arma("Espada Bastarda Vitória", { img: IMG.bastarda, dano: "1d12+35", tipo: "corte", critM: 19, desc: P("Rola dois dados no ataque e usa o melhor.") }),
			arma("Maça Estilhaçadora", { img: EQ("maca"), dano: "1d12+25", tipo: "impacto", critX: 3, desc: P("+2d8 contra construtos e objetos e ignora a RD deles; objeto destruído explode em estilhaços (3d6 de corte nos adjacentes)."), efeitos: [efUso("Contra construto ou objeto (+2d8)", [["dano", "2d8"]], { img: IMG.pancada, desc: "+2d8 e ignora RD." })] }),
			arma("Espada Longa Devoradora", { img: IMG.espada, dano: "1d10+35", tipo: "corte", critM: 19, desc: P("O atingido perde PM igual à metade do dano sofrido.") }),
			habilidade("Ferreiro Divino", "Fabrica armas com até quatro melhorias e três encantos sem sacrificar PM e pode imbuir outros poderes (veja As Armas de Rhond).", { img: IMG.forja }),
			habilidade("Atacar Braços", "Um braço pode ser atacado (Defesa 62). Com 150 de dano num braço, ele fica desabilitado e Rhond perde um ataque por uma rodada.", { img: IMG.bloqueio })
		]
	},
	{
		nome: "Lefeu, Sarektril", nd: "14", tipo: "mon", raca: "Lefeu", tamanho: "gra", img: ICONE("formiga-aberrante"),
		atr: { for: 10, des: 7, con: 5, int: 3, sab: 4, car: 2 },
		pv: 700, defesa: 50, desl: 12, cd: 38, sentidos: ["escuro"],
		resistencias: "redução de dano 10",
		pericias: { inic: 20, perc: 22, fort: 28, refl: 26, vont: 14, luta: 43, guer: 21, intu: 19 },
		ataquescac: "Espada da Tormenta +43 (3d6+20, 17, mais 1d6 matéria vermelha), duas lâminas +41 (2d10+16, 19) e duas pinças +41 (4d6+16), corte.",
		tesouro: "Espada da Tormenta.",
		bio: "Versão aperfeiçoada dos uktril e geraktril: mais de 3 m, pernas serrilhadas e três pares de braços (mãos, pinças e lâminas), olhos multifacetados e carapaça espinhosa. Oficial e estrategista lefeu. Encontro 3 da tabela e reforços no Ritual da Essência.",
		itens: () => [
			arma("Espada da Tormenta", { img: IMG.bastarda, dano: "3d6+20", tipo: "corte", critM: 17, proficiencia: "exotica", desc: P("Mais 1d6 de matéria vermelha (entra sozinho)."), efeitos: [MATERIA()] }),
			arma("Lâmina", { img: IMG.dilacerar, extra: -2, dano: "2d10+16", tipo: "corte", critM: 19, desc: P("Dois ataques, junto com a espada e as pinças.") }),
			arma("Pinça", { img: IMG.garra, extra: -2, dano: "4d6+16", tipo: "corte", desc: P("Dois ataques. Pinças Estilhaçadoras: se exceder a Defesa por 10+, avaria a armadura (–5 na Defesa; de novo, destrói; aço-rubi é imune) ou causa +2d8 em quem não usa armadura.") }),
			habilidade("Comandante Lefeu", "Até o próximo turno dele, outros lefeu em alcance médio rolam dois dados nos ataques e usam o melhor.", { img: IMG.ordens, execucao: "move", alcance: "medium" }),
			habilidade("Espinhos", "Quem o atinge corpo a corpo sofre 2d10 de perfuração (armas alongadas não).", { img: IMG.dilacerar, rolls: [rolagemDano("Espinhos", "2d10", "perfuracao")] }),
			INSANIDADE("2d10", 38),
			habilidade("Instinto Guerreiro", "Uma vez por rodada, quando uma criatura no alcance corpo a corpo fica desprevenida ou sai voluntariamente do alcance, faz um ataque corpo a corpo contra ela.", { img: IMG.golpe, execucao: "reaction" })
		]
	},
	{
		nome: "Lefeu, Zirradak", nd: "18", tipo: "mon", raca: "Lefeu", tamanho: "med", img: ICONE("assassino-aberrante"),
		atr: { for: 7, des: 8, con: 7, int: 5, sab: 4, car: 5 },
		pv: 1050, defesa: 55, desl: 18, cd: 46,
		resistencias: "redução de dano 15",
		pericias: { inic: 25, perc: 24, fort: 20, refl: 36, vont: 28, luta: 46, enga: 25, furt: 25, intu: 21 },
		ataquescac: "Dois ataques entre lâmina +46 (2d10+25, 17, corte), marreta +46 (2d12+25, x3, impacto) e lança +46 (2d8+25, perfuração, alongada).",
		bio: "O mais furtivo e dissimulado dos lefeu: muda a forma livremente e fala, imitando maneirismos sem entendê-los. Revelado, entra em frenesi assassino. Este é o mais poderoso lefeu já capturado, derrotado ao tentar se infiltrar na Academia Arcana (com a ajuda de Talude). Parte 1, Cena 4 (Conhecimento CD 36 identifica).",
		itens: () => [
			arma("Lâmina", { img: IMG.dilacerar, dano: "2d10+25", tipo: "corte", critM: 17, desc: P("Dois ataques por ação agredir, entre lâmina, marreta e lança.") }),
			arma("Marreta", { img: IMG.marreta, dano: "2d12+25", tipo: "impacto", critX: 3 }),
			arma("Lança", { img: IMG.lanca, dano: "2d8+25", tipo: "perfuracao", desc: P("Alongada.") }),
			habilidade("Alternar Forma", "Transforma-se em outra criatura, como Metamorfose, com qualquer aprimoramento e sem gastar PM.", { img: IMG.arcano, execucao: "free" }),
			habilidade("Ataque Furtivo e Mutação Mortífera", "Ataque furtivo +10d6, sem limite de usos por rodada. Os alvos dos ataques dele são sempre desprevenidos contra ele, mesmo os imunes.<br><b>Automação:</b> +10d6 automático (todo alvo conta como desprevenido).", { img: IMG.golpe, efeitos: [efUso("Ataque furtivo (+10d6)", [["dano", "10d6"]], { automatic: true, types: ["attack"], img: IMG.golpe, desc: "+10d6 (alvos sempre desprevenidos)." })] }),
			INSANIDADE("3d10", 46),
			habilidade("Velocidade Aberrante", "Realiza uma ação padrão ou de movimento adicional por turno.", { img: IMG.tempo })
		]
	},
	ezzayn("Ezzayn com Batalhão Burodron", {
		ajuste: 5,
		bio: `Variação do ${GL("Lefeu, Ezzayn", "AdA", "ezzayn")} (p. 125) reforçada por burodrons, escavadores com jeito de gorila insetoide. Encontro 8 (Patrulha Subterrânea). Ajustes já aplicados: +5 em ataque e dano com garras.`,
		extra: habilidade("Emboscada Subterrânea", "Escava até uma criatura em alcance curto e tenta puxá-la com agarrar (teste +54). Se vencer, ela desce 3 m, sofre 4d8+23 de corte e fica agarrada. Sair do fosso: ação padrão e Atletismo CD 44; falha, sofre o dano de novo.", { img: IMG.garra, execucao: "action", alcance: "short", rolls: [rolagemFormula("Agarrar", "1d20+54", 0), rolagemDano("Corte", "4d8+23", "corte", 1)], efeitos: [efCondicao("agarrado")] })
	}),
	ezzayn("Ezzayn com Cavalaria Hurobakk", {
		pv: 750, fort: 32,
		bio: `Variação do ${GL("Lefeu, Ezzayn", "AdA", "ezzayn")} (p. 125) reforçada por hurobakks, centauros insetoides de quatro braços com garras de lagosta. Encontro 3 (Manada Mortal, com um sarektril). Ajustes já aplicados: +100 PV e +5 em Fortitude.`,
		extra: habilidade("Investida Terrível", "Criaturas num quadrado de 6 m à frente sofrem 4d10+19 de impacto e ficam caídas (Fort CD 44 reduz à metade e evita). Falha por 5+: armadura avariada (–5 na Defesa; de novo, destruída) ou +2d8 se estiver sem armadura.", { img: IMG.pancada, execucao: "action", area: "6m", resistencia: "Fortitude reduz à metade e evita a condição", rolls: [rolagemDano("Impacto", "4d10+19", "impacto")], efeitos: [efCondicao("caido")] })
	}),
	ezzayn("Ezzayn com Esquadrão Veridak", {
		inic: 20, refl: 30, voo: 18,
		bio: `Variação do ${GL("Lefeu, Ezzayn", "AdA", "ezzayn")} (p. 125) com apoio aéreo veridak, louva-a-deus bípedes de 2,5 m. Encontro 6 (Patrulha Aérea). Ajustes já aplicados: +5 em Iniciativa e Reflexos, voo 18 m.`,
		extra: habilidade("Ataque Rasante", "Criaturas num quadrado de 6 m à frente sofrem 4d6+31 de corte (Ref CD 44 reduz à metade). Quem falha faz agarrar contra CD 44; se falhar, é erguido e largado de 12 m.", { img: IMG.dilacerar, execucao: "action", area: "6m", resistencia: "Reflexos reduz à metade", rolls: [rolagemDano("Corte", "4d6+31", "corte")] })
	})
];

// ---------------------------------------------------------------------------
// Perigos e testes (atores do tipo Perigo)
// ---------------------------------------------------------------------------
const R = (f, t) => `[[/r ${f}${t ? `[${t}]` : ""}]]`;
const PERIGOS = [
	{
		nome: "Prova da Câmara Planar", nd: "—", local: "Parte 1, Cenas 2 a 4 (Academia Arcana)",
		goal: P("A prova de três etapas de Reynard numa câmara planar de 30 m de lado que simula a Tormenta. Depois de cada vitória, Reynard pergunta se o grupo quer continuar."),
		effects: P(
			`<b>Etapa 1 — Amostra Grátis:</b> ${GL("Lefeu, Ezzayn", "AdA", "ezzayn")}. Derrota (mais da metade inconsciente): Reynard manda o grupo embora, sem prêmio. Vitória e parada: uma armadura rubra por herói.`,
			"<b>Etapa 2 — Fauna Lefeu:</b> 2 esmagadores coletivos (absorvidos reaparecem inconscientes). Derrota: armaduras, com desapontamento. Vitória e parada: armaduras e o mapa de Reynard.",
			"<b>Etapa 3 — Das Profundezas Carmesim:</b> o zirradak (Conhecimento CD 36). Derrota (alguém em risco de morte): mesmas recompensas da etapa 2. Vitória: noite na Academia, as histórias da Companhia Rubra e Reynard como parceiro a partir da Parte 2."
		),
		actions: P("Reynard assiste por uma janela de campo de força (com quem não quiser participar). Ao fim, vá para a Cena 5.")
	},
	{
		nome: "Duelo com Rhond", nd: "20", local: "Parte 1, Cena 6 (forja de Rhond)",
		goal: P("Cada personagem enfrenta Rhond sozinho. A arma de aço-rubi que recebe depende de quantas rodadas aguenta (as armas não perdem encantos em áreas de Tormenta)."),
		effects: P(
			"Rhond faz <b>2 ataques</b> na 1ª rodada, <b>4</b> na 2ª e <b>6</b> na 3ª. Para quando o personagem fica inconsciente e recupera todos os PV entre duelos. Magias antes do duelo são permitidas; qualquer interferência durante a luta expulsa todos do templo, sem armas.",
			"<b>2 rodadas:</b> arma de aço-rubi formidável, mais uma melhoria e um encanto. <b>3 rodadas:</b> magnífica, mais duas melhorias, um encanto e uma propriedade de classe. <b>4 rodadas:</b> magnífica, mais três melhorias, dois encantos e as duas propriedades de classe."
		),
		actions: P("Propriedades de classe: veja \"As Armas de Rhond\" nos Documentos para os jogadores.")
	},
	{
		nome: "Travessia Cáustica", nd: "16", local: "Parte 2, Cena 2 (Rio Panteão)",
		goal: P("O barco de aço-rubi de Ezequias está a 90 m da outra margem e avança 18 m por rodada (5 rodadas). No meio do caminho, o elemental corrompido ataca."),
		effects: P(
			"Se ninguém engajar o elemental, ele ataca o barco (RD 10, 200 PV).",
			`Barco destruído: terminar a travessia nadando nas águas corrompidas causa ${R("8d6", "acido")} de ácido por rodada.`
		),
		actions: P("Engajar o elemental para proteger o barco; ajudar Ezequias no timão (Pilotagem) fica a critério do mestre.")
	},
	{
		nome: "Rumo à Cidade na Tormenta", nd: "—", local: "Parte 2, Cena 3 (área de Tormenta)",
		goal: P("Encontrar uma alma acorrentada: teste estendido de <b>Sobrevivência CD 35, 7 sucessos</b>. Dois testes por dia (manhã e tarde); abrindo mão de descansar, um terceiro à noite. O mapa de Reynard dá +5."),
		effects: P(
			"Dentro da Tormenta valem os efeitos de área de Tormenta (Tormenta20, p. 319).",
			"Falha no teste estendido: as distorções devolvem o grupo às margens do Rio Panteão e tudo recomeça.",
			"A cada dia, role uma vez na tabela <b>A6 · Encontros na Tormenta</b> (2d6)."
		),
		actions: P("Use a macro <b>CdR · Teste estendido</b> (CD 35, 7 sucessos). Com sucesso, vá para a Cena 4 (Queklain).")
	},
	{
		nome: "A Câmara de Eridibus", nd: "20", local: "Parte 3, Cena 2 (ala da Evolução)",
		goal: P("Sobreviver até a 10ª rodada ou derrotar as três formas de Eridibus. Eridibus aceita o desafio e começa a mudar."),
		effects: P(
			"<b>1ª rodada — Centopeia-Dragão:</b> chão arenoso (terreno difícil) e calor: quem não tem resistência a clima ou fogo fica @STATUS[exausto] e vulnerável a fogo.",
			"<b>4ª rodada — Bisão da Montanha:</b> neve vermelha, escuridão total (camuflagem total) e vento que impede a voz (condição terrível para magias). Sem resistência a clima ou frio: @STATUS[esmorecido], @STATUS[alquebrado] e vulnerável a frio.",
			`<b>7ª rodada — Lula Abissal:</b> a sala se enche de líquido ácido; do fim da 7ª rodada em diante, todos submersos e quem toca o líquido sofre ${R("6d6", "acido")} de ácido no início do turno.`,
			`<b>10ª rodada:</b> o líquido escoa; cada criatura faz Atletismo CD 35 ou é sugada contra a grade (${R("10d6", "impacto")} de impacto). A sala volta ao normal e Eridibus, satisfeito, entrega a Essência da Evolução.`
		),
		actions: P("A forma que chega a 0 PV dá lugar à próxima com PV máximos. Derrotado antes da 10ª rodada, Eridibus se desfaz numa massa amorfa com a essência (octaedro esmeralda) no meio.")
	},
	{
		nome: "Enigmas de Hashmalan", nd: "20", local: "Parte 3, Cena 4 (ala da Assimilação)",
		goal: P("Responder às dez perguntas do Cardeal da Assimilação, <b>60 segundos reais</b> cada (45 depois de errar a 3ª). Com <b>7 acertos</b>, Hashmalan entrega a Essência da Assimilação (esfera branca)."),
		effects: P(
			"Cada resposta errada impõe uma consequência a um personagem, escolhido pelos jogadores antes de saberem qual é (lista no roteiro, página Enigmas de Hashmalan).",
			"Com menos de 7 acertos, Hashmalan os declara indignos e ataca; a 0 PV, o globo vira a essência."
		),
		actions: P("Mostre as perguntas aos jogadores pelo diário <b>A6 · Documentos para os jogadores</b> (página Enigmas de Hashmalan) e cronometre na mesa.")
	},
	{
		nome: "O Ritual da Essência", nd: "20", local: "Parte 3, Cenas 5 e 6 (Câmara Primordial)",
		goal: P("Ativar e energizar os quatro pilares e mantê-los por mais <b>4 rodadas</b>. Ativar: ficar adjacente ao pilar empunhando a essência certa e gastar uma ação padrão. No fim de cada rodada, role 1d4 por pilar ativo: 4 energiza (depois a essência pode ser retirada). Ezequias precisa ficar adjacente à pirâmide <b>com uma essência</b> o ritual inteiro: troque essências entre ele e os pilares."),
		effects: P(
			"Não lefeu na sala sofrem os efeitos de área de Tormenta; em alcance curto da pirâmide, os de um <b>Coração da Tormenta</b>: @STATUS[debilitado], @STATUS[enjoado], @STATUS[esmorecido] e " + R("10d6") + " PV por rodada (0 PV: desintegrado). Quem porta uma essência é imune aos dois.",
			"No fim da 1ª rodada com algum pilar ativo e a cada rodada ímpar, surge um ezzayn junto à pirâmide; no fim da rodada seguinte e a cada rodada par, um sarektril.",
			"<b>Assimilação:</b> ativado, não lefeu ficam @STATUS[alquebrado]; energizado, replica uma habilidade ou magia usada na última rodada. <b>Devoção:</b> +5 no ataque dos lefeu (+10 energizado). <b>Dominação:</b> nuvem rubra de 3 m num ponto aleatório a cada rodada (" + R("6d6", "acido") + " de ácido dentro e um relâmpago de " + R("8d8", "eletricidade") + " num herói em alcance médio, Ref CD 28 metade); energizado, cada nuvem tem 1 em 4 de gerar um ezzayn. <b>Evolução:</b> lefeu com +5 no dano e 50 PV temporários; energizado, um lefeu evolui por rodada (ezzayn ganham tipos de lefeu; com todos, surge um sarektril)."
		),
		actions: P(
			"<b>Ler o tomo</b> (quantas vezes quiser): Conhecimento CD 35 revela um pilar; sempre faça Vontade CD 30 (+5 por leitura anterior) ou perca " + R("3d8") + " PM.",
			"Use a macro <b>A6 · Ritual da Essência</b> no fim de cada rodada. A pirâmide ocupa 6 m no centro; cada pilar fica a 30 m de uma face."
		)
	}
];

// ---------------------------------------------------------------------------
// Itens da aventura e parceiros
// ---------------------------------------------------------------------------
async function itensDaAventura() {
	const lista = [];
	const tesouro = (nome, desc, { qtd = 1, preco = 0, img = "icons/svg/item-bag.svg", role } = {}) => ({ name: nome, type: "tesouro", img, flags: role ? { world: { cdrRole: role } } : {}, system: { description: { value: P(...[].concat(desc)) }, source: FONTE, qtd, preco } });
	const consumivel = (nome, desc, { preco = 0, img, execucao = "action", efeitos = [], rolls = [] }) => ({ name: nome, type: "consumivel", img, effects: efeitos, system: { description: { value: P(...[].concat(desc)) }, source: FONTE, qtd: 1, preco, ativacao: { execucao }, rolls } });
	const parceiro = (nome, desc, efeitos = []) => ({ name: nome, type: "poder", img: "icons/svg/mystery-man.svg", effects: efeitos, system: { description: { value: P(...desc, "Arraste para a ficha de um personagem durante a cena e apague depois.") }, source: FONTE, tipo: "ability", ativacao: { execucao: "passive", custo: 0 } } });

	const lanca = await doCompendio("equipamentos", "Lança");
	if (lanca) {
		lanca.name = "Coração de Rubi";
		lanca.system.source = FONTE;
		lanca.system.description.value = P("O coração da área de Tormenta de Aharadak, a chave-portal entre Arton e a Anticriação. Apesar de \"desativado\", ainda é perigosíssimo: lança magnífica veloz que causa os efeitos de um Coração da Tormenta por 1d4 rodadas em qualquer criatura que toque (debilitada, enjoada, esmorecida e perdendo 10d6 PV por rodada; 0 PV desintegra, até lefou).", "<b>Automação:</b> +3 no ataque e +2 no dano (magnífica) entram sozinhos; botões das condições e rolagem da perda de PV no cartão.") + (lanca.system.description.value ?? "");
		lanca.effects = [...(lanca.effects ?? []), efUso("Magnífica", [["ataque", 3], ["dano", 2]], { automatic: true, desc: "+3 no ataque, +2 no dano." }), efCondicao("debilitado"), efCondicao("enjoado"), efCondicao("esmorecido")];
		lanca.system.rolls = [...(lanca.system.rolls ?? []), rolagemFormula("Coração da Tormenta: PV perdidos", "10d6", 9), rolagemFormula("Rodadas", "1d4", 10)];
		lista.push(lanca);
	} else relatorio.avisos.push("Lança não encontrada no compêndio do sistema.");

	const bastarda = await doCompendio("equipamentos", "Espada Bastarda");
	if (bastarda) {
		bastarda.name = "Espada da Tormenta";
		bastarda.system.source = FONTE;
		bastarda.system.preco = 46600;
		bastarda.system.description.value = P("Lâmina serrilhada com centenas de dentes que crescem e caem sem parar; o cabo lembra uma lacraia e crava garras na mão do usuário. Espada bastarda aumentada atroz de matéria vermelha, ameaçadora e formidável; +5 em testes para evitar ser desarmado. Arma específica maior (T$ 46.600). Tesouro do sarektril.", "<b>Automação:</b> formidável (+2 no dano) e matéria vermelha (+1d6) entram sozinhos; os demais ajustes ficam com o mestre.") + (bastarda.system.description.value ?? "");
		bastarda.effects = [...(bastarda.effects ?? []), efUso("Formidável", [["dano", 2]], { automatic: true, desc: "+2 no dano." }), MATERIA()];
		lista.push(bastarda);
	} else relatorio.avisos.push("Espada Bastarda não encontrada no compêndio do sistema.");

	const ESSENCIAS = [
		["Essência da Devoção", "Cristal vermelho-vivo em forma de cruz, incrustado no peito de Goradar (Queklain). Abre o primeiro quadrante da porta da Câmara Primordial e ativa o Pilar da Devoção.", "devocao"],
		["Essência da Evolução", "Joia esmeralda octaédrica, deixada por Eridibus. Ativa o Pilar da Evolução.", "evolucao"],
		["Essência da Dominação", "Joia alaranjada em forma de pirâmide equilátera, o que resta de Adramalek. Ativa o Pilar da Dominação.", "dominacao"],
		["Essência da Assimilação", "Joia redonda e branca, dada (ou deixada) por Hashmalan. Ativa o Pilar da Assimilação.", "assimilacao"]
	];
	for (const [nome, desc, role] of ESSENCIAS) lista.push(tesouro(nome, [desc, "Pulsa como um coração apesar da forma cristalina. Quem porta uma essência cardeal é imune aos efeitos de área de Tormenta e do Coração da Tormenta na Câmara Primordial."], { img: GER("gemas-preciosas"), role: `essencia-${role}` }));

	lista.push(
		tesouro("Armadura rubra", [
			"Uma das mais de dez armaduras de Reynard, aberrantes, feitas de matéria vermelha e partes de carapaça, escama e pele de demônios da Tormenta, usadas pela Companhia Rubra. Existem de todos os tipos do livro básico; são mágicas (se ajustam ao usuário) e não metálicas (druidas e devotos de Allihanna podem usar).",
			"Cada uma tem <b>três melhorias e três encantos</b> à escolha do jogador e fornece <b>resistência a Tormenta +5</b>. Monte a armadura escolhida a partir do compêndio do sistema e cole este texto nela."
		], { img: EQ("couraca") }),
		tesouro("Arma de Rhond", [
			"Arma ou manopla de aço-rubi à escolha, forjada e batizada por Rhond numa cerimônia religiosa. Não perde seus encantos em áreas de Tormenta.",
			"<b>2 rodadas no duelo:</b> formidável, mais uma melhoria e um encanto. <b>3 rodadas:</b> magnífica, mais duas melhorias, um encanto e uma propriedade de classe. <b>4 rodadas:</b> magnífica, mais três melhorias, dois encantos e as duas propriedades de classe.",
			"Monte a arma a partir do compêndio do sistema e cole este texto e as propriedades escolhidas (Documentos para os jogadores, página As Armas de Rhond)."
		], { img: IMG.bastarda }),
		tesouro("Chave de Wynna", "Delicada chave dourada com a efígie da Deusa da Magia, numa caixinha de madeira: abre um portal para a Academia Arcana. A volta para Yuvalin fica por conta dos heróis. Presente de Ezequias (Parte 1).", { img: GER("anel-sinete") }),
		tesouro("Carta dos clérigos de Rhond", "Garante uma audiência com o próprio Deus Menor das Armas. Ezequias a entrega junto com o pedido de levar o Parvathar.", { img: GER("pergaminho") }),
		tesouro("Mapa de Reynard", "Mapa da área de Tormenta de Zakharov feito por Reynard na incursão da Companhia Rubra: +5 em Sobrevivência dentro da área de Tormenta (vale no teste estendido da Parte 2).", { img: GER("bussola"), role: "mapaReynard" }),
		consumivel("Seiva Rubra", "Frasco de líquido viscoso de gosto metálico, cheio de mana, vendido no mercado de Ahar'kadhan (escambo: Diplomacia ou Enganação CD 30). Beber cura 3d8 PM, mas deixa confuso até o fim do próximo turno.", { img: GER("essencia-mana"), rolls: [rolagemFormula("PM recuperados", "3d8")], efeitos: [efCondicao("confuso", { rodadas: 1 })] }),
		consumivel("Semente Carmesim", "Baga retorcida de odor ocre, um superalimento do mercado de Ahar'kadhan. Consumir cura 10d10+10 PV e remove uma condição entre enjoado, envenenado, exausto, fatigado ou fraco, mas deixa debilitado até o fim do próximo turno.", { img: GER("baga-de-fogo"), rolls: [rolagemDano("Cura", "10d10+10", "curapv")], efeitos: [efCondicao("debilitado", { rodadas: 1 })] }),
		parceiro("Parceiro: Reynard, o Arquimago", [
			"Se o grupo vencer a prova da Câmara Planar, Reynard acompanha a expedição a partir da Parte 2 (antes, oferece um Teletransporte para Yuvalin).",
			`<b>Benefícios:</b> +5 em Misticismo e Vontade; +20 PM e a capacidade de lançar ${G("Globo de Invulnerabilidade")} e ${G("Relâmpago Flamejante")} (de Reynard). Se o grupo for derrotado, ele lança ${G("Desejo")} para levar todos de volta a Yuvalin em segurança e abandona a missão.`,
			"<b>Automação:</b> +5 em Misticismo e Vontade enquanto estiver na ficha; os PM extras ficam com o mestre."
		], [efPassivo("Reynard (+5 Misticismo e Vontade)", [["system.pericias.mist.bonus", 5], ["system.pericias.vont.bonus", 5]], { desc: "+5 em Misticismo e Vontade." })]),
		parceiro("Parceiros: Esquadrão Escarlate", [
			"Depois do conselho de guerra (Parte 2, Cena 1), cada personagem escolhe um dos aventureiros do Esquadrão Escarlate para acompanhá-lo na incursão. Há aliados <b>mestres</b> de todos os tipos (veja os parceiros do sistema)."
		])
	);
	return lista;
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------
const pastaAmeacas = await subpasta("Ameaças", "Actor");
const pastaPerigos = await subpasta("Perigos e Testes", "Actor");

const fichas = {};
for (const a of AMEACAS) {
	const ator = await criarAmeaca(a, pastaAmeacas);
	const mov = {};
	if (a.voo) mov["system.attributes.movement.fly.base"] = a.voo;
	if (a.nadar) mov["system.attributes.movement.swim.base"] = a.nadar;
	if (a.escavar) mov["system.attributes.movement.burrow.base"] = a.escavar;
	if (Object.keys(mov).length) await ator.update(mov);
	fichas[a.nome] = ator;
}
for (const h of PERIGOS) fichas[h.nome] = await criarPerigo(h, pastaPerigos);

const itens = (await itensDaAventura()).map((i) => ({ ...i, folder: pasta.Item.id, flags: { ...(i.flags ?? {}), world: { ...(i.flags?.world ?? {}), cdr: TAG } } }));
const itensCriados = {};
for (const i of await Item.implementation.createDocuments(itens)) {
	itensCriados[i.name] = i;
	relatorio.criados.push(`Item: ${i.name}`);
}

const L = (n, rotulo) => (fichas[n] ? `@UUID[${fichas[n].uuid}]{${rotulo ?? n}}` : rotulo ?? n);
const I = (n, rotulo) => (itensCriados[n] ? `@UUID[${itensCriados[n].uuid}]{${rotulo ?? n}}` : rotulo ?? n);

// Tabela de encontros (2d6)
const EZ = GL("Lefeu, Ezzayn", "AdA", "ezzayn");
const ENCONTROS = [
	[2, "Fábrica de Esmagadores", `Cultistas entoam cânticos em volta de uma fornalha de carne esponjosa. 2d4 ${G("Sacerdote de Aharadak", "sacerdotes de Aharadak")}; na 1ª rodada, um gasta uma ação padrão para ativar a fornalha e gera um ${L("Esmagador Coletivo", "esmagador coletivo")} no fim da rodada. Um sacerdote adjacente pode reativá-la depois de 1d4 rodadas.`],
	[3, "Manada Mortal", `Centauros insetoides e um demônio altivo de lâmina brilhante: um ${L("Lefeu, Sarektril", "sarektril")} e um ${L("Ezzayn com Cavalaria Hurobakk", "ezzayn com hurobakks")}.`],
	[4, "Definhamento", "A Tormenta se alimenta do grupo: todos perdem [[/r 10d8]] PV e ficam @STATUS[debilitado] até o fim do próximo dia (Fort CD 35 evita ambos)."],
	[5, "Tempestade Elétrica", "Dura [[/r 2d4]] rodadas numa área de 90 m. No início de cada rodada, um personagem aleatório na área sofre [[/r 10d8[eletricidade]]] de eletricidade e [[/r 10d8[trevas]]] de trevas."],
	[6, "Patrulha Aérea", `O guincho de um veridak alerta a patrulha: ${L("Ezzayn com Esquadrão Veridak", "ezzayn com veridaks")}.`],
	[7, "Chuva Ácida", "Dura [[/r 2d4]] rodadas numa área de 90 m. No início de cada rodada, quem está na área sofre [[/r 4d8[acido]]] de ácido; o dano persiste uma rodada depois de sair ou de a chuva acabar."],
	[8, "Patrulha Subterrânea", `O chão treme e demônios emergem: ${L("Ezzayn com Batalhão Burodron", "ezzayn com burodrons")}.`],
	[9, "Labaredas Infernais", "Cada jogador rola 1d20; ímpar, uma coluna de chamas causa [[/r 5d6[fogo]]] de fogo e [[/r 5d6[trevas]]] de trevas (Ref CD 35 reduz à metade). Repete por mais [[/r 1d4]] rodadas; não há como fugir, só melhorar o teste ou ganhar resistência."],
	[10, "Pesadelos Reais", "Vontade CD 35: quem falha vê seu maior medo, fica @STATUS[apavorado] e faz Vontade CD 35 por rodada; cada falha causa [[/r 6d8[psiquico]]] psíquico e [[/r 1d8]] PM perdidos. Acaba com dois sucessos seguidos. Quem não está apavorado pode prestar ajuda."],
	[11, "Colosso Corrompido", `Um besouro do tamanho de um pequeno castelo: um ${G("Thuwarokk", "thuwarokk")}.`],
	[12, "Nenhum", "Um dia de paz relativa (na medida do possível dentro da Tormenta)."]
];
const tabela = await RollTable.implementation.create({
	name: "A6 · Encontros na Tormenta", img: "icons/svg/hazard.svg", folder: pasta.RollTable.id, flags: FLAGS("encontrosTormenta"),
	formula: "2d6", replacement: true, displayRoll: true,
	description: "Uma rolagem por dia na área de Tormenta (Parte 2, Cena 3).",
	results: ENCONTROS.map(([n, nome, desc]) => ({ type: "text", range: [n, n], weight: 1, name: nome, description: desc }))
});
relatorio.criados.push(`Tabela: ${tabela.name}`);

// Macro
const RITUAL = String.raw`// A6 · Ritual da Essência (Horizonte de Sangue, Parte 3, Cena 6). Só o mestre.
// Rode no FIM de cada rodada. Marque os pilares ativos que ainda não foram energizados:
// a macro rola 1d4 para cada (4 = energizado) e lembra os lefeu que surgem nesta rodada.
// O estado (rodada, pilares energizados, contagem final) fica guardado no próprio usuário.
if (!game.user.isGM) return ui.notifications.warn("Só o mestre roda esta macro.");
const { DialogV2 } = foundry.applications.api;
const PILARES = ["Assimilação", "Devoção", "Dominação", "Evolução"];
const est = foundry.utils.duplicate(game.user.getFlag("world", "cdrRitual") ?? { rodada: 0, energizados: [], ativos: [], final: 0 });
const linha = (p) => {
	const e = est.energizados.includes(p), a = est.ativos.includes(p);
	return "<label style='display:block'><input type='checkbox' name='" + p + "'" + (a || e ? " checked" : "") + (e ? " disabled" : "") + "> Pilar da " + p + (e ? " <b>(energizado)</b>" : "") + "</label>";
};
const r = await DialogV2.wait({
	window: { title: "Ritual da Essência" }, rejectClose: false,
	content: "<p>Fim da rodada <b>" + (est.rodada + 1) + "</b> do ritual. Pilares ativos:</p>" + PILARES.map(linha).join(""),
	buttons: [
		{ action: "rodar", label: "Fim da rodada", default: true, callback: (e, b) => ({ f: b.form.elements }) },
		{ action: "zerar", label: "Recomeçar ritual", callback: () => "zerar" }
	]
});
if (!r) return;
if (r === "zerar") { await game.user.unsetFlag("world", "cdrRitual"); return ui.notifications.info("Ritual recomeçado."); }
est.rodada += 1;
est.ativos = PILARES.filter((p) => r.f[p]?.checked);
let html = "";
for (const p of est.ativos.filter((x) => !est.energizados.includes(x))) {
	const d = (await new Roll("1d4").evaluate()).total;
	if (d === 4) est.energizados.push(p);
	html += "<p>Pilar da " + p + ": " + d + (d === 4 ? " — <b>energizado!</b> (a essência pode ser retirada)" : "") + "</p>";
}
if (est.ativos.length) {
	if (!est.inicio) est.inicio = est.rodada;
	const n = est.rodada - est.inicio + 1;
	html += "<p>" + (n % 2 ? "Surge um <b>ezzayn</b> adjacente à pirâmide." : "Surge um <b>sarektril</b> adjacente à pirâmide.") + "</p>";
}
if (est.energizados.length === 4) {
	est.final += 1;
	html += est.final >= 4 ? "<h3>O ritual está completo!</h3><p>Vá para o fim da Cena 6.</p>" : "<p>Todos os pilares energizados: rodada <b>" + est.final + " de 4</b>.</p>";
}
await game.user.setFlag("world", "cdrRitual", est);
ChatMessage.create({ whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id), content: "<h3>Ritual da Essência · rodada " + est.rodada + "</h3>" + (html || "<p>Nenhum pilar ativo.</p>") });`;
await Macro.implementation.create({ name: "A6 · Ritual da Essência", type: "script", scope: "global", img: "icons/svg/sun.svg", folder: pasta.Macro.id, flags: FLAGS("ritualEssencia"), command: RITUAL });
relatorio.criados.push("Macro: A6 · Ritual da Essência");

// ---------------------------------------------------------------------------
// Diários
// ---------------------------------------------------------------------------
const linha = (local, txt) => `<li><b>${local}:</b> ${txt}</li>`;
const ul = (arr) => `<ul>${arr.join("")}</ul>`;
const paginas = (lista) => lista.map((pg, i) => ({ name: pg.name, type: "text", sort: (i + 1) * 100, title: { show: true, level: 1 }, text: { content: pg.html, format: 1 } }));
const T = `@UUID[${tabela.uuid}]{Encontros na Tormenta}`;

const ENIGMAS = [
	["O que é meu, mas quem me conhece usa muito mais do que eu?", "Meu nome.", "Sempre que ouvir o próprio nome, perde 5 PM."],
	["Não é vivo, mas cresce. Não respira, mas falta de ar pode matá-lo. O que é?", "O fogo.", "Vulnerabilidade a fogo."],
	["O que está sempre à nossa frente, mas nunca chega?", "O futuro.", "O tempo de resposta das próximas perguntas cai para 45 segundos."],
	["Existe algo que quanto mais se perde, mais se tem. O que é?", "Sono.", "Sempre que descansa, rola um dado: ímpar, não recupera PV nem PM."],
	["Você acordou em uma sala trancada. Para sair, pegou uma chave dentro de uma caixa, dentro de uma gaiola. O que você abriu primeiro?", "Os olhos.", "Fica cego permanentemente."],
	["O que mantém sempre o mesmo tamanho, não importa quanto pese?", "Uma balança.", "Role 1d6 duas vezes para dois atributos; some-os e divida por dois: esse é o novo valor dos dois."],
	["Existe algo em Arton que é totalmente feito de água, mas deixa de existir se for mergulhado nela. O que é?", "Gelo.", "Vulnerabilidade a frio permanente."],
	["Qual a última coisa que se pode tirar de uma criatura?", "A vida.", "Perde 50 PV permanentemente."],
	["O que é que todos têm, sempre aumenta, mas nunca diminui?", "A idade.", "Fica velho (ajustes de atributos de Tormenta20, p. 108)."],
	["Qual a única palavra de seu idioma que sempre se escreve errado?", "Errado.", "Falha automaticamente em qualquer teste com 1 ou 2 no dado."]
];

const roteiro = [
	{ name: "Visão geral", html: P(
		"<b>Horizonte de Sangue</b> (livro, pp. 105–127). A última parte da Jornada Heroica, para heróis de 18º nível: com Yuvalin livre e o Parvathar em mãos, o grupo invade a área de Tormenta de Zakharov.",
		"<b>Parte 1:</b> preparação com Reynard (Academia Arcana) e Rhond (Deus Menor das Armas). <b>Parte 2:</b> a travessia da Tormenta até Ahar'kadhan e o primeiro Cardeal, Queklain. <b>Parte 3:</b> os outros três Cardeais no Santuário da Tormenta e o Ritual da Essência.",
		"Ezequias, recém-nomeado Mestre Fundidor, já processa aço-rubi na Fundição Central. O plano final dele sempre foi destruir a área de Tormenta. A virada do epílogo: ele faz um acordo com Aharadak e vira seu sumo-sacerdote."
	) },
	{ name: "Parte 1 — Mais Perto do Sonho", html: ul([
		linha("Introdução", `Ezequias manda o grupo à Academia Arcana com a ${I("Chave de Wynna")}: procurar Venturella Hoffart, assistente do Arquimago Reynard.`),
		linha("Cena 1 — A Academia Arcana", "Venturella, sulfure de pele rubra e terno cinza, leva o grupo ao Centro de Testes. Reynard, líder da lendária Companhia Rubra, quer ter certeza de que não os manda para a morte e propõe uma prova em três etapas."),
		linha("Cenas 2 a 4 — A Prova", `${L("Prova da Câmara Planar")}: ${EZ}, depois 2 ${L("Esmagador Coletivo", "esmagadores coletivos")}, depois o ${L("Lefeu, Zirradak", "zirradak")}. Recompensas: ${I("Armadura rubra", "armaduras rubras")}, ${I("Mapa de Reynard")} e ${I("Parceiro: Reynard, o Arquimago", "Reynard como parceiro")}.`),
		linha("Cena 5 — A Ferramenta Certa", `Ezequias separou os melhores lingotes de aço-rubi e manda o grupo a Rhond com a ${I("Carta dos clérigos de Rhond")} e o Parvathar.`),
		linha("Cena 6 — A Ferro e Fogo", `${L("Rhond, o Deus das Armas")}: ${L("Duelo com Rhond")}. Cada um recebe uma ${I("Arma de Rhond")} conforme as rodadas que aguentou. Depois, despedidas em Yuvalin.`)
	]) },
	{ name: "Parte 2 — Dia Vermelho", html: ul([
		linha("Cena 1 — Planos & Sonhos", `Cerimônia no Parque Normandia: nasce o Esquadrão Escarlate. Plano: seguir os passos da Companhia Rubra, achar uma alma acorrentada e seguir a corrente até a Cidade na Tormenta. Cada personagem escolhe um ${I("Parceiros: Esquadrão Escarlate", "aliado mestre do Esquadrão")}.`),
		linha("Cena 2 — Travessia Cáustica", `${L("Travessia Cáustica")} contra o ${L("Elemental Corrompido")}.`),
		linha("Cena 3 — Deixai Toda Esperança", `${L("Rumo à Cidade na Tormenta")}, com a tabela ${T} (2d6, uma vez por dia).`),
		linha("Cena 4 — O Arauto Carmesim", `${L("Queklain, Cardeal da Devoção")}, preso a quatro almas acorrentadas e a uma corrente que some no horizonte. Pomposo, exige que se curvem; ataca se insultarem Aharadak ou recusarem duas vezes. Derrotado, revela Goradar e o cristal: ${I("Essência da Devoção")} (se ninguém pegar, Ezequias pega).`),
		linha("Cena 5 — A Divina Anticriação", "O desfiladeiro: voar faz cair (6d6) e teletransporte falha. No pórtico de tentáculos, o Emissário (lefeu sem nome, cortês; destruído com 60 de dano, outro idêntico chega na rodada seguinte). Ahar'kadhan parece normal, mas os sorrisos são congelados. No Grande Templo, o Emissário anuncia o desafio: enfrentar os outros três Cardeais e forjar uma nova essência no Santuário do Coração."),
		linha("Cena 6 — Cidade Rubra", `Um dia livre (efeitos da Tormenta anulados na cidade). <b>Ateliê:</b> Vontade CD 35 ou frustrado por 1d4 dias; Conhecimento ou Religião CD 30 sobre os Cardeais. <b>Mercado:</b> escambo (Diplomacia ou Enganação CD 30, ±5 pela criatividade), ${I("Semente Carmesim", "sementes carmesim")} e ${I("Seiva Rubra", "seiva rubra")}; Diplomacia ou Investigação CD 30. <b>Taverna A Beleza Divina:</b> Mestre Rupert e os serviçais; um teste livre por jogador; dormir lá pede Vontade CD 30 (luxuosa ou ruim). No fim, Ezequias revela que quer usar o título de Cardeal para destruir o Coração da Tormenta.`)
	]) },
	{ name: "Os Quatro Pilares Cardeais (informações)", html: P("Anote cada sucesso dos testes da Cena 6 e revele no fim do dia, conforme o total:") + ul([
		linha("3+ sucessos", "Os quatro Cardeais regem a cidade, manifestação da vontade de Aharadak. Os outros três: Adramalek (Dominação), Eridibus (Evolução no combate; o livro também o chama de Assimilação nesta lista) e Hashmalan (Assimilação)."),
		linha("5+ sucessos", "Cada Cardeal é um pilar da fé em Aharadak: dominar, converter, assimilar e evoluir os artonianos. Forma e poderes ligados ao pilar."),
		linha("7+ sucessos", "O Santuário da Tormenta é o antigo Castelo Aharadak, com quatro alas (uma por Cardeal) e a Câmara Primordial, onde fica o Coração da Tormenta."),
		linha("10+ sucessos", "Adramalek era um humano, um dos maiores guerreiros contra a Tormenta. Hashmalan é uma consciência sem corpo, paródia do Helladarion, que testa conhecimento e raciocínio. Eridibus é uma criatura sem forma que muda a si e o ambiente com um pensamento, em busca da forma artoniana suprema.")
	]) },
	{ name: "Parte 3 — Fora da Realidade", html: ul([
		linha("Cena 1 — O Começo do Fim", "O Emissário guia o grupo ao Santuário (portão em forma de bocarra, tapete de carne). Salão com fonte, mesa de paródias de comida, quatro escadarias infinitas e uma porta quadrada selada. A Essência da Devoção acende um quadrante; Ezequias (e lefou) sente a Lança de Aharadak atrás dela. Entre os Cardeais, descanso luxuoso de 8 horas; comer da mesa cura [[/r 7d8+7]] PV e remove condições, ou beber da fonte recupera [[/r 2d8]] PM (um por descanso)."),
		linha("Cena 2 — Eridibus, o Cardeal da Evolução", `${L("A Câmara de Eridibus")}: ${L("Eridibus, Cardeal da Evolução (Centopeia-Dragão)", "centopeia-dragão")}, ${L("Eridibus, Cardeal da Evolução (Bisão da Montanha)", "bisão da montanha")} e ${L("Eridibus, Cardeal da Evolução (Lula Abissal)", "lula abissal")}. Prêmio: ${I("Essência da Evolução")}.`),
		linha("Cena 3 — Adramalek, o Cardeal da Dominação", `${L("Adramalek, Cardeal da Dominação")} salta de um trono de cadáveres lefeu e ataca sem conversa. Com Reynard presente, ele reconhece Velk, o Galo Louco. Prêmio: ${I("Essência da Dominação")}.`),
		linha("Cena 4 — Hashmalan, o Cardeal da Assimilação", `A biblioteca: ${L("Hashmalan, Cardeal da Assimilação")} e os ${L("Enigmas de Hashmalan")}. Prêmio: ${I("Essência da Assimilação")}.`),
		linha("Cena 5 — O Ritual da Essência", "As quatro essências abrem a porta; uma escadaria sem fim leva à câmara da pirâmide, com a lança fincada no topo mantendo aberto o portal. Um tomo de páginas de carne explica o ritual. O Emissário espera novas essências; Ezequias quer voltar o poder do coração contra ele mesmo."),
		linha("Cena 6 — Sacrifício", `${L("O Ritual da Essência")} com a macro <b>A6 · Ritual da Essência</b>. Uma cena longa: de preferência numa sessão só para ela. No fim, Ezequias arranca a lança, o fluxo da Tormenta se inverte, a fenda explode e ele some. Na saída do castelo, o céu está azul: a área de Zakharov desapareceu.`),
		linha("Epílogo", `Ahar'kadhan está menos aberrante e os habitantes, mais lúcidos. Ezequias, mais lefeu do que nunca e empunhando o ${I("Coração de Rubi")}, explica o acordo com Aharadak: a área recuou, e ele virou sumo-sacerdote e regente, criando a Essência da Unificação para a coexistência. Convida o grupo a segui-lo; se recusarem, lamenta e se despede. O plano de Aharadak: tornar a Tormenta mais \"artoniana\" e ganhar força no Panteão. Ficha: ${L("Ezequias Heldret (sumo-sacerdote)")}.`)
	]) },
	{ name: "Enigmas de Hashmalan (respostas)", html: P("Cada pergunta tem 60 segundos reais (45 depois de errar a 3ª). Os jogadores escolhem quem sofre a consequência <b>antes</b> de saber qual é. Com 7 acertos, recebem a essência; com menos, Hashmalan ataca.") + `<ol>${ENIGMAS.map(([q, a, c]) => `<li><b>${q}</b><br>Resposta: <i>${a}</i><br>Consequência: ${c}</li>`).join("")}</ol>` }
];

const documentos = [
	["Discurso de Ezequias (Esquadrão Escarlate)", "<i>Sejam bem-vindos, amigos! Hoje, escrevemos um novo capítulo da nossa história, não só como cidadãos de Yuvalin, mas como artonianos! Hoje, um grupo de bravos desafia a maior ameaça que assola nosso mundo! (...) Foi graças ao seu trabalho que hoje esse contingente exibe suas lâminas vermelhas, como presas que rosnam para os invasores, prestes a desferir o bote. É graças a vocês que, hoje, nasce o Esquadrão Escarlate!</i>"],
	["O desafio dos Cardeais (o Emissário)", "<i>A essência está novamente em seu lugar. O desafio está lançado. Artonianos, vocês devem confrontar os outros três Cardeais e receber suas bênçãos. Caso sejam aprovados, um de vocês será nomeado Cardeal, e irá forjar uma nova essência no Santuário do Coração. Mas, se forem julgados indignos, serão destruídos.</i>"],
	["Enigmas de Hashmalan", `<ol>${ENIGMAS.map(([q]) => `<li>${q}</li>`).join("")}</ol>`],
	["As Armas de Rhond: propriedades de classe", "Escolha propriedades de uma classe em que você tenha pelo menos um nível; só valem empunhando a arma." + ul([
		linha("Arcanista", "<i>Aniquilação:</i> suas magias ignoram as imunidades dos lefeu. <i>Devastação:</i> magias de dano ganham um benefício de Magia Ampliada de graça."),
		linha("Bárbaro", "<i>Poder Gigante:</i> em fúria, o dano da arma aumenta um passo. <i>Poder Esmagador:</i> em fúria, aplica o dobro da Força no dano corpo a corpo com ela."),
		linha("Bardo", "<i>Compasso:</i> habilidades e magias de bardo não sofrem aumento de custo em área de Tormenta. <i>Fortíssimo:</i> quem está sob sua Inspiração ignora as imunidades dos lefeu."),
		linha("Bucaneiro", "<i>Zombaria:</i> Panache contra lefeu ou criatura da Tormenta recupera 3 PM em vez de 1. <i>Astúcia:</i> dobra a Esquiva Sagaz contra eles."),
		linha("Caçador", "<i>Abater:</i> o dano de Marca da Presa ganha um dado do mesmo tipo. <i>Predador Rubro:</i> bônus de Explorador dentro da área de Tormenta (ou +2 se já tiver)."),
		linha("Cavaleiro", "<i>Honra Artoniana:</i> Duelo contra lefeu ou criatura da Tormenta ganha +2. <i>Indômito:</i> Posturas como ação livre e sem aumento de custo em área de Tormenta."),
		linha("Clérigo", "<i>Ira Divina:</i> suas magias ignoram as imunidades dos lefeu. <i>Arma Eclesiástica:</i> magias divinas custam –1 PM (cumulativo com Símbolo Sagrado Energizado e Símbolo Abençoado)."),
		linha("Druida", "<i>Garras Rubras:</i> modificações e encantos passam para as armas naturais na Forma Selvagem. <i>Elementos Alienígenas:</i> seus ataques e magias ignoram as imunidades dos lefeu."),
		linha("Guerreiro", "<i>Ataque Superior:</i> Ataque Especial contra lefeu ou criatura da Tormenta ganha +4. <i>Ataque Veloz:</i> Ataque Extra até duas vezes por rodada."),
		linha("Inventor", "<i>Ferramenta de Precisão:</i> contra lefeu ou criatura da Tormenta, recebe o benefício de Encontrar Fraqueza. <i>Participação na Construção:</i> a arma conta como feita por você para poderes de inventor e o dano aumenta um passo."),
		linha("Ladino", "<i>Ponto Cego:</i> flanqueia lefeu e criaturas da Tormenta e o Ataque Furtivo os afeta. <i>Chacina:</i> os dados do Ataque Furtivo aumentam uma categoria."),
		linha("Lutador", "<i>Pancada:</i> a arma causa o dano do seu ataque desarmado (Briga) com um dado a mais e aceita habilidades de ataque desarmado. <i>Rajada:</i> Ataque Relâmpago até duas vezes por ação agredir."),
		linha("Nobre", "<i>Arauto:</i> Gritar Ordens dá +2 a mais e não sofre aumento de custo em área de Tormenta. <i>Soberania:</i> Orgulho para atacar lefeu ou criatura da Tormenta também soma no dano."),
		linha("Paladino", "<i>Punição Divina:</i> Golpe Divino contra lefeu e criaturas da Tormenta causa 2 dados a mais. <i>Juízo Final:</i> o bônus da Aura Sagrada dobra; Aura Ardente afeta lefeu e ignora imunidades e RD.")
	])],
	["Coração da Tormenta", "Toda área de Tormenta tem um ponto de origem, uma fenda na realidade por onde a Anticriação invade Arton. O da área de Zakharov é uma lança que perfura nossa realidade. Qualquer não lefeu em alcance curto fica debilitado, enjoado e esmorecido e perde 10d6 PV por rodada; reduzido a 0 PV, é desintegrado. Isso afeta até lefou."]
];

await JournalEntry.implementation.createDocuments([
	{ name: "A6 · Como usar no Foundry", folder: pasta.JournalEntry.id, flags: FLAGS("comoUsar"), pages: paginas([
		{ name: "Visão geral", html: P(
			"Tudo desta aventura fica nas pastas <b>A6 · Horizonte de Sangue</b> (Atores, Itens, Tabelas, Macros e Diários). Ameaças em <i>Ameaças</i>; perigos e testes em <i>Perigos e Testes</i>. Cenas e mapas ficam por sua conta.",
			"O ezzayn comum, o sacerdote de Aharadak, o thuwarokk e as magias de Reynard vêm do <b>Giria T20</b> pelos links. Os três ezzayn com burodrons, hurobakks e veridaks são fichas próprias, com os ajustes do livro já aplicados.",
			"Eridibus tem uma ficha por forma: troque o token quando ele mudar. Fichas conferidas com o livro (pp. 122–127)."
		) },
		{ name: "Automações", html: ul([
			linha("Elemental Corrompido", "Cura acelerada 50 automática (no rio); apague a habilidade Reabastecer se ele sair da água. Ácido extra automático nos ataques."),
			linha("Matéria vermelha", "Adramalek, Queklain, sarektril e a Espada da Tormenta somam +1d6 sozinhos."),
			linha("Opções no ataque", "Fúria Rubra de Adramalek (+10), Golpe Profano de Queklain (+6d8), descarga da Rasgacéus de Rhond e o bônus contra construtos da Maça Estilhaçadora."),
			linha("Zirradak", "Ataque furtivo +10d6 automático (Mutação Mortífera deixa todo alvo desprevenido)."),
			linha("Botões de condição", "Atordoado (esmagador), paralisado (lula), em chamas, lento, caído, agarrado, fascinado e as condições do Coração da Tormenta."),
			linha("Reynard", "Parceiro: +5 em Misticismo e Vontade enquanto estiver na ficha."),
			linha("Testes e tabela", "Rumo à Cidade na Tormenta: macro CdR · Teste estendido e tabela A6 · Encontros na Tormenta (2d6). Ritual: macro A6 · Ritual da Essência (guarda a rodada e os pilares energizados; use Recomeçar para zerar).")
		]) }
	]) },
	{ name: "A6 · Roteiro", folder: pasta.JournalEntry.id, flags: FLAGS("roteiro"), pages: paginas(roteiro) },
	{ name: "A6 · Documentos para os jogadores", folder: pasta.JournalEntry.id, flags: FLAGS("documentos"), pages: documentos.map(([n, t], i) => ({ name: n, type: "text", sort: (i + 1) * 100, title: { show: true, level: 1 }, text: { content: t.startsWith("<") ? t : `<p>${t}</p>`, format: 1 } })) }
]);

const ulr = (arr) => (arr.length ? `<ul>${arr.map((x) => `<li>${x}</li>`).join("")}</ul>` : "<p>—</p>");
ChatMessage.create({
	whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id),
	content: `<h3>${NOME_PASTA}</h3><p><b>Criados (${relatorio.criados.length}):</b></p>${ulr(relatorio.criados)}` + (relatorio.avisos.length ? `<p><b>Avisos:</b></p>${ulr(relatorio.avisos)}` : "")
});
