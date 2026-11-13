/* =====================================================================
 * CORAÇÃO DE RUBI · AVENTURA 4 · "CARAVANA CARTESIANA"
 * Gerador de conteúdo para Foundry VTT v14 + sistema Tormenta20 (Vizael 1.6.x)
 *
 * Fonte do compêndio do módulo giriarpg-coracao-de-rubi (o build roda este arquivo num Foundry
 * simulado). Também funciona como macro de Script, colado inteiro e executado pelo Mestre.
 * Cria, na pasta "A4 · Caravana Cartesiana" de cada tipo:
 *  • 12 ameaças novas do livro (pp. 79–83): Aaron Sauer, Bando Pirata, Bhalorg, Capitã Alurra, Ginete de
 *    Serpe, Goblin, Kaminari, Raijin, Revoada de Serpes, Pudim Alvinegro, Thalliathos, Turba de Zumbis
 *    do Pântano, Verme do Gelo Larva e Verme do Pântano. Criaturas do livro básico (serpe, dragão adulto)
 *    e outros livros ficam como links para o Giria T20.
 *  • 6 perigos e testes: Burocracia Arcana, Travessia do Pântano dos Vermes, Jogo de Influências,
 *    Escalada nas Uivantes, Desmoronamento e Ases nas Alturas.
 *  • Itens: Parvathar (forma enfraquecida, com Aspirar e Assoprar), apito de Raisenzan, tiara de Beluhga,
 *    carta de recomendação de Vectorius, roupas de frio de Kirima, Presa da Tempestade, itens de Salistick
 *    e os parceiros Masaru Yuudai e Schaven.
 *  • Tabela: Eventos do Pântano dos Vermes (1d12).
 *  • Macro A4 · Ases nas Alturas (canhões do Vento Vasto e testes de borda da nuvem).
 *  • Diários: Como usar no Foundry, Roteiro e Documentos para os jogadores.
 * Rodar de novo apaga (depois de confirmar) o que tem a marca flags.world.cdr = "a4" e recria tudo.
 *
 * Os links @GIRIA[nome|livro] viram links para o compêndio do Giria T20 no build do módulo.
 * Fichas conferidas com o livro Coração de Rubi, pp. 63–83.
 * ===================================================================== */
if (!game.user.isGM) return ui.notifications.error("Só o Mestre pode rodar este gerador.");

const TAG = "a4";
const FLAGS = (role) => ({ world: role ? { cdr: TAG, cdrRole: role } : { cdr: TAG } });
const NOME_PASTA = "A4 · Caravana Cartesiana";
const FONTE = "Coração de Rubi — Caravana Cartesiana";
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
		window: { title: "Aventura 4: recriar conteúdo" },
		content: `<p>Já existem <b>${antigos.length}</b> documentos gerados para a Aventura 4.</p>
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
			// Padrão do Cauê: nome ao passar o mouse (qualquer um), visão ligada, barras sempre para o dono (PV e PM, que o sistema pinta de azul).
			displayName: CONST.TOKEN_DISPLAY_MODES.HOVER,
			displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER,
			sight: { enabled: true },
			bar1: { attribute: "attributes.pv" },
			bar2: { attribute: "attributes.pm" }
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
		flags: { tormenta20: { coracaoDeRubi: "aventura4" }, world: { cdr: TAG, ...(a?.automacoes ? { cdrAutomacoes: a.automacoes } : {}) } }
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
		flags: { tormenta20: { coracaoDeRubi: "aventura4" }, world: { cdr: TAG } }
	});
	relatorio.criados.push(`Perigo: ${h.nome}`);
	return actor;
}


const GL = (nome, livro, rotulo) => `@GIRIA[${nome}|${livro}]{${rotulo ?? nome}}`;

// ---------------------------------------------------------------------------
// Ameaças (livro, pp. 79–83)
// ---------------------------------------------------------------------------
IMG.florete = EQ("florete");
IMG.acido = GER("acido");
IMG.marca = HAB("visao-ampla");
IMG.mira = "icons/svg/target.svg";
IMG.pistola = EQ("pistola");
IMG.cimitarra = EQ("cimitarra");
IMG.katana = EQ("katana");
IMG.mangual = EQ("mangual");
IMG.arcoLongo = EQ("arco-longo");
IMG.bando = "icons/svg/combat.svg";
IMG.esquiva = "icons/svg/wingfoot.svg";
IMG.trevas = "icons/svg/skull.svg";
IMG.agarrar = "icons/svg/net.svg";
IMG.engolir = "icons/svg/acid.svg";
IMG.frio = "icons/svg/frozen.svg";
IMG.veneno = "icons/svg/poison.svg";

const BANDO = (nome) => habilidade("Bando", `${nome} é um grupo de indivíduos. Se um ataque do bando exceder a Defesa do inimigo por 10 ou mais, causa o dobro do dano; se errar, ainda causa metade. Imune a manobras de combate e a efeitos de alvo único que não causam dano; vulnerável a dano de área. Quem tem Trespassar e acerta o bando pode usá-lo contra ele (uma vez por turno).`, { img: IMG.bando });
const PERNAS = (nome) => habilidade("Pernas do Mar", `Quando está se equilibrando ou escalando, ${nome} não fica desprevenido e seu deslocamento não é reduzido à metade.`, { img: IMG.esquiva });
const EVASAO = () => habilidade("Evasão", "Quando sofre um efeito que permite Reflexos para reduzir o dano à metade, não sofre dano se passar.", { img: IMG.esquiva });
const AGARRAR = (ataque, teste) => habilidade("Agarrar Aprimorado", `Quando acerta ${ataque}, pode fazer a manobra agarrar como ação livre (teste +${teste}).`, { img: IMG.agarrar, execucao: "free", rolls: [rolagemFormula("Agarrar", `1d20+${teste}`)] });

const AMEACAS = [
	{
		nome: "Aaron Sauer", nd: "11", tipo: "hum", raca: "Humano", tamanho: "med", img: ICONE("cavaleiro-supremacista"),
		atr: { for: 0, des: 6, con: 2, int: 4, sab: 1, car: 3 },
		pv: 295, defesa: 39, desl: 9, ic: [],
		resistencias: "evasão, imunidade a adivinhação",
		pericias: { inic: 17, perc: 12, fort: 11, refl: 24, vont: 18, luta: 32, pont: 32, cava: 15, dipl: 14, enga: 14, furt: 17, inti: 14, intu: 10, inve: 14, joga: 14, ladi: 17, mist: 15, nobr: 13, pilo: 15 },
		ataquescac: "Florete x2 +32 (3d6+20, 16/x3, mais sangramento).", ataquesad: "Pistola +32 (3d6+25, 18/x3). Ataque Furtivo +8d6.",
		equipamento: "Anel do escudo mental, armadura de couro ajustada, florete maciço pungente sanguinário, estojo de disfarces, granada de Dissipar Magia, granada de Sopro das Uivantes (8d8 de dano), pistola de adamante precisa de mira telescópica, poção de campo de força (50 PV temporários), poção de Concentração de Combate (duração cena).",
		tesouro: "Padrão.",
		bio: "Espião purista, comandante da rede de inteligência da Supremacia em Vectora; quer chegar à Cúpula Purista e vê no Parvathar o caminho. Alto, loiro, queixo quadrado, olhos verdes cheios de maldade. Disfarçado de mercador de Valkaria (\"Sauer\"), fala calmo e pausado, mas não resiste às vestes de um branco imaculado mantido com magia. Raptou Raijin (para chantagear Kaminari) e Sieja, a filha de Alurra. Aparece na Parte 1 (Assistência Arcana), na Parte 4, Cena 2, e lidera o ataque final (Ases nas Alturas).",
		itens: () => [
			arma("Florete", { img: IMG.florete, dano: "3d6+20", tipo: "perfuracao", critM: 16, critX: 3, proficiencia: "marcial", desc: P("Dois ataques por ação agredir. Maciço, pungente e sanguinário (sangramento)."), efeitos: [efCondicao("sangrando")] }),
			arma("Pistola", { img: IMG.pistola, pericia: "pont", dano: "3d6+25", tipo: "perfuracao", critM: 18, critX: 3, alcance: "medium", proposito: "disparo", proficiencia: "fogo", desc: P("Adamante, precisa, mira telescópica.") }),
			habilidade("Ataque Furtivo", "+8d6 de dano contra alvo desprevenido ou flanqueado.<br><b>Automação:</b> Shift+clique na arma e marque a opção.", {
				img: IMG.golpe, efeitos: [efUso("Ataque Furtivo (+8d6)", [["dano", "8d6"]], { names: ["Florete", "Pistola"], img: IMG.golpe, desc: "+8d6 de dano furtivo." })]
			}),
			habilidade("Espião de Elite", "Aaron pode fazer uma ação de movimento extra por turno e, uma vez por rodada quando sofre dano, pode reduzir esse dano à metade.", { img: IMG.esquiva }),
			habilidade("Ódio Puro", "+5 em testes de Vontade quando segue ordens de um superior (purista de ND maior) e +2 nas rolagens de dano contra humanoides não humanos.<br><b>Automação:</b> opção no ataque.", {
				img: IMG.marca, efeitos: [efUso("Ódio Puro (humanoide não humano)", [["dano", 2]], { types: ["attack"], img: IMG.marca, desc: "+2 no dano contra humanoide não humano." })]
			}),
			habilidade("Saque Rápido", "Saca itens como ação livre e recarrega a pistola como ação de movimento.", { img: IMG.pistola }),
			EVASAO()
		]
	},
	{
		nome: "Bando Pirata", nd: "6", tipo: "hum", raca: "Humano", tamanho: "med", img: ICONE("bandido"),
		atr: { for: 2, des: 3, con: 1, int: 0, sab: 0, car: -1 },
		pv: 56, defesa: 25, desl: 9,
		pericias: { inic: 5, perc: 3, fort: 12, refl: 17, vont: 7, luta: 24, acro: 10, atle: 9 },
		ataquescac: "[bando] Cimitarra x2 +24 (2d6+16, 18).",
		equipamento: "Armadura de couro, cimitarra (1d6 cada).",
		bio: "Tripulação do dirigível Vento Vasto, leal à Capitã Alurra (não sabe da chantagem de Aaron). Um bando por aventureiro na Parte 2, Cena 4; quatro no Vento Vasto (Cena 5, com as armas dos personagens); dois com Goblin (Parte 4, Cena 2,5); quatro no ataque final. Não lutam até a morte: com os líderes derrotados, fogem.",
		itens: () => [arma("Cimitarra", { img: IMG.cimitarra, dano: "2d6+16", tipo: "corte", critM: 18, proficiencia: "marcial", desc: P("Dois ataques por ação agredir (bando).") }), BANDO("O bando pirata"), PERNAS("o bando pirata")]
	},
	{
		nome: "Bhalorg", nd: "14", tipo: "mon", tamanho: "eno", img: ICONE("urso-coruja"),
		atr: { for: 10, des: 0, con: 10, int: 0, sab: 7, car: -1 },
		pv: 700, pm: 77, defesa: 46, desl: 12, cd: 38, sentidos: ["faro", "escuro"], imune: ["frio"],
		resistencias: "imunidade a frio, redução de dano 10, resistência a magia +4",
		pericias: { inic: 11, perc: 20, fort: 28, refl: 14, vont: 22, luta: 39, atle: 21, reli: 18, sobr: 18 },
		ataquescac: "Mordida +39 (4d6+36, 17) e duas garras +39 (3d6+32, 17).",
		magias: ["Curar Ferimentos", "Despedaçar", "Dissipar Magia", "Tempestade Divina", "Erupção Glacial", "Conjurar Elemental", "Raio Polar"],
		bio: "O último dos Escolhidos de Beluhga no santuário. Enfurecido com os saqueadores, tomou a joia central da coroa da rainha e se entregou à bestialidade: um enorme urso branco cheio de cicatrizes, com cristais de gelo brotando da pele. Lança magias como um druida de Megalokk de 14º nível (CD 38, limite de PM 21; Conjurar Elemental só de água). Parte 4, Cena 7: a 0 PV volta à forma humana e pode ser ouvido (ajuda o grupo e cura 10d8+10 PV e 2d8 PM de cada um) ou morto (vira cristais, e a joia fica).",
		itens: () => [
			arma("Mordida", { img: IMG.mordida, dano: "4d6+36", tipo: "perfuracao", critM: 17 }),
			arma("Garra", { img: IMG.garra, dano: "3d6+32", tipo: "corte", critM: 17, desc: P("Duas garras na mesma ação.") }),
			habilidade("Magia Acelerada", "Uma vez por rodada, quando lança uma magia com execução de ação completa ou menor, Bhalorg pode gastar 4 PM para mudar a execução para livre.", { img: IMG.arcano, execucao: "free", custo: 4 }),
			habilidade("Trespassar", "Uma vez por rodada, quando faz um ataque corpo a corpo e reduz os PV do alvo a 0 ou menos, pode fazer um ataque adicional contra outra criatura ao alcance.", { img: IMG.dilacerar, execucao: "free" })
		]
	},
	{
		nome: "Capitã Alurra", nd: "9", tipo: "hum", raca: "Humana", tamanho: "med", img: ICONE("chefe-bandido"),
		atr: { for: 1, des: 5, con: 2, int: 3, sab: -1, car: 4 },
		pv: 280, defesa: 30, desl: 9,
		resistencias: "evasão",
		pericias: { inic: 15, perc: 7, fort: 16, refl: 22, vont: 10, luta: 23, pont: 26, acro: 17, atle: 13, furt: 15, inti: 14, pilo: 18 },
		ataquescac: "Florete +23 (1d6+15, 18).", ataquesad: "Duas pistolas +26 (3d6+12, 16/x3).",
		equipamento: "Couro batido reforçado, florete pungente, pistolas de adamante precisas x2.",
		bio: "Anna Alurra, \"o terror do céu\", capitã do dirigível Vento Vasto: humana na casa dos trinta, cabelos negros cacheados soltos. Desde que teve Sieja (filha meia-elfa de um artista élfico que sumiu), aceita serviços menos perigosos. Aaron Sauer raptou Sieja e a força a tomar o Parvathar; entre uma cidade de desconhecidos e a filha, escolhe Sieja. Parte 2, Cena 4; jantar de Sckhar (Parte 3, Cena 4); ataque final.",
		itens: () => [
			arma("Florete", { img: IMG.florete, dano: "1d6+15", tipo: "perfuracao", critM: 18, proficiencia: "marcial" }),
			arma("Pistolas", { img: IMG.pistola, pericia: "pont", dano: "3d6+12", tipo: "perfuracao", critM: 16, critX: 3, alcance: "medium", proposito: "disparo", proficiencia: "fogo", desc: P("Dois disparos por ação agredir.") }),
			habilidade("Andar na Prancha", "Quando faz um acerto crítico com uma pistola, Alurra empurra o alvo 6 m na direção oposta.", { img: IMG.pistola }),
			habilidade("Movam-se, Sacripantas!", "Alurra grita ordens: aliados em alcance médio recebem +4 em testes de perícia e rolagens de dano até o fim da cena.<br><b>Automação:</b> botão no cartão para aplicar nos aliados.", {
				img: IMG.ordens, execucao: "move", alcance: "medium",
				efeitos: [efCartao("Movam-se, Sacripantas!", [["system.pericias.*.bonus", 4], ["dano", 4]], { img: IMG.ordens, cena: true, desc: "+4 em testes de perícia e no dano até o fim da cena." })]
			}),
			habilidade("Pistoleira dos Céus", "As pistolas de Alurra têm alcance médio e não sofrem penalidade contra oponentes em corpo a corpo. Ela recarrega as duas com uma única ação de movimento.", { img: IMG.pistola }),
			PERNAS("Alurra"), EVASAO()
		]
	},
	{
		nome: "Ginete de Serpe", nd: "9", tipo: "hum", raca: "Humano", tamanho: "med", img: ICONE("serpe"),
		atr: { for: 6, des: 2, con: 6, int: 0, sab: 0, car: 1 },
		pv: 72, defesa: 33, desl: 6,
		pericias: { inic: 13, perc: 9, fort: 20, refl: 15, vont: 10, luta: 29, cava: 13, inti: 13 },
		ataquescac: "Mangual x2 +29 (2d10+20, 19, mais 1d12 perfurante).",
		equipamento: "Armadura de couro, escudo pesado, mangual certeiro.",
		tesouro: "Padrão.",
		bio: "Bandido de elite de Sckharshantallas, endurecido pela vida ao lado das serpes. Montado numa serpe com armadura (voo 18 m). Parte 3, Cena 2: dois ginetes guiam uma revoada de serpes.",
		itens: () => [
			arma("Mangual", { img: IMG.mangual, dano: "2d10+20", tipo: "impacto", critM: 19, proficiencia: "marcial", desc: P("Dois ataques por ação agredir. Montado: +1d12 de perfuração da serpe (entra sozinho)."), efeitos: [efUso("Montaria Feroz", [["dano", "1d12[perfuracao]"]], { automatic: true, img: ICONE("serpe"), desc: "+1d12 de perfuração enquanto montado." })] }),
			habilidade("Escudo de Escamas", "Uma vez por rodada, o ginete pode fazer com que uma revoada de serpes em alcance curto sofra o dano de um ataque ou habilidade em seu lugar.", { img: IMG.bloqueio, execucao: "reaction" }),
			habilidade("Montaria Feroz", `O ginete cavalga uma ${G("Serpe", "serpe")}. Montado, tem voo 18 m e +1d12 nas rolagens de dano corpo a corpo (já no mangual).`, { img: ICONE("serpe") })
		],
		voo: 18
	},
	{
		nome: "Goblin", nd: "10", tipo: "hum", raca: "Elfo", tamanho: "med", img: ICONE("goblin-salteador"),
		atr: { for: 2, des: 7, con: 1, int: 2, sab: 1, car: -2 },
		pv: 105, defesa: 35, desl: 12, sentidos: ["penumbra"],
		pericias: { inic: 16, perc: 12, fort: 15, refl: 18, vont: 9, luta: 34, pont: 34, acro: 18, atle: 11, furt: 20 },
		ataquescac: "Espada longa x3 +34 (2d8+25, 18).", ataquesad: "Arco longo x2 +34 (3d8+25, x3).",
		equipamento: "Arco longo pungente, couraça delicada, espada longa precisa.",
		bio: "Elfo de máscara de goblin que abandonou nome e identidade (dizem que tem traços belíssimos destroçados por cicatrizes: a queda de Lenórienn?). Fala pouco; foi contratado por Aaron, sem chantagem. Capturado, abre o bico com Intimidação ou uma oferta polpuda (\"Só não me bate no rosto!\"); Intimidação CD 25 revela que Aaron é purista. Parte 2, Cena 4; Parte 4, Cena 2,5; ataque final.",
		itens: () => [
			arma("Espada longa", { img: IMG.espada, dano: "2d8+25", tipo: "corte", critM: 18, proficiencia: "marcial", desc: P("Três ataques por ação agredir.") }),
			arma("Arco longo", { img: IMG.arcoLongo, pericia: "pont", dano: "3d8+25", tipo: "perfuracao", critX: 3, alcance: "long", proposito: "disparo", proficiencia: "marcial", desc: P("Dois ataques por ação agredir.") }),
			habilidade("Soldado de Lenórienn", "Quando faz um ataque, Goblin rola dois dados e usa o melhor resultado.<br><b>Automação:</b> role o ataque como 2d20kh.", { img: IMG.mira })
		]
	},
	...["Kaminari", "Raijin"].map((nome) => ({
		nome, nd: "10", tipo: "esp", raca: "Aggelus", tamanho: "med", img: ICONE("capitao-baluarte"),
		atr: { for: 1, des: 6, con: 2, int: 1, sab: 2, car: 0 },
		pv: 80, defesa: 36, desl: 9, voo: 18, sentidos: ["escuro"],
		pericias: { inic: 15, perc: 7, fort: 16, refl: 21, vont: 11, luta: 36, acro: 18 },
		ataquescac: "Presa da Tempestade +36 (4d8+26, 19).",
		equipamento: "Presa da Tempestade (katana pungente de mitral e formidável).",
		tesouro: "Padrão.",
		bio: `Gêmeo aggelus, espadachim alado de Nitamu-ra (Valkaria), discípulo de Masaru; feições andróginas, maquiagem pesada, cabelo púrpura em coque samurai. Os gêmeos flanqueiam quem parece mais vulnerável. Parte 1, Cena 3: atacam no treino (Masaru interrompe se metade do grupo cair, ou se um gêmeo cair ou os dois tiverem menos de 10 PV).${nome === "Kaminari" ? " Cena 7: com Raijin raptado por Aaron, Kaminari ataca um herói sozinho, chorando e pedindo desculpas; foge com metade dos PV. Depois luta ao lado dos piratas." : " Raptado por Aaron depois da Parte 1, para chantagear Kaminari."}`,
		itens: () => [
			arma("Presa da Tempestade", { img: IMG.katana, dano: "4d8+26", tipo: "corte", critM: 19, proficiencia: "exotica", desc: P("Katana pungente de mitral e formidável.") }),
			habilidade("Espadachim da Tempestade", "Percorre até o dobro do deslocamento voando e faz até três ataques contra criaturas diferentes no caminho.", { img: IMG.dobro ?? IMG.katana, execucao: "full" })
		]
	})),
	{
		nome: "Revoada de Serpes", nd: "9", tipo: "mon", tamanho: "eno", img: ICONE("serpe"),
		atr: { for: 7, des: 1, con: 6, int: -2, sab: 1, car: -1 },
		pv: 1000, defesa: 24, desl: 9, voo: 18, cd: 20, sentidos: ["faro", "escuro"], ic: ["paralisado"],
		resistencias: "imunidade a paralisia",
		pericias: { inic: 7, perc: 9, fort: 12, refl: 18, vont: 7, luta: 27 },
		ataquescac: "[bando] Mordida +27 (4d6+24) e ferrão +27 (2d8+24 mais veneno).",
		tesouro: "8d4 doses de peçonha concentrada (CD 24 para extrair).",
		bio: "Serpes criadas em cativeiro e usadas como armas por bandidos, couro marcado por chicotes e queimaduras. Parte 3, Cena 2, com dois ginetes de serpe.",
		itens: () => [
			arma("Mordida", { img: IMG.mordida, dano: "4d6+24", tipo: "perfuracao" }),
			arma("Ferrão", { img: IMG.veneno, dano: "2d8+24", tipo: "perfuracao", desc: P(`Mais veneno: ${G("Peçonha Concentrada", "peçonha concentrada")} (perde 1d12 PV por rodada por 3 rodadas; Fort CD 20 reduz para uma rodada).`), efeitos: [efCondicao("envenenado")] }),
			AGARRAR("a mordida", 32), BANDO("A revoada de serpes")
		]
	},
	{
		nome: "Pudim Alvinegro", nd: "13", tipo: "mon", tamanho: "col", img: ICONE("glop"),
		atr: { for: 10, des: 0, con: 6, int: -2, sab: 0, car: -4 },
		pv: 650, defesa: 30, desl: 9, escalar: 9, nadar: 9, cd: 30, sentidos: ["cegas"], ic: ["atordoado", "paralisado"],
		resistencias: "imunidade a atordoamento, metamorfose, paralisia e sono, resistência a magia +4",
		pericias: { inic: 10, perc: 10, fort: 30, refl: 24, vont: 19, luta: 37 },
		ataquescac: "Pancada +37 (4d8+10 mais 4d8 ácido) e protuberâncias ósseas +37 (4d12+26 perfuração mais 4d8 ácido).",
		bio: "Pudim negro único do Pântano dos Vermes: englobou o esqueleto de um dragão que os experimentos necromânticos de Mzzylein tornaram indigerível, ganhou certa consciência e acredita ser um dragão (vive tentando voar de pontos altos). Perdeu a divisão; as protuberâncias ósseas o tornaram mais perigoso. Parte 2, Cena 3. Alurra depois presenteia Sckhar com o crânio do \"dragão que ela matou\".",
		itens: () => [
			arma("Pancada", { img: IMG.pancada, dano: "4d8+10", tipo: "impacto", desc: P("Mais 4d8 de ácido (entra sozinho)."), efeitos: [efUso("Ácido", [["dano", "4d8[acido]"]], { automatic: true, img: IMG.acido, desc: "+4d8 de ácido." })] }),
			arma("Protuberâncias ósseas", { img: IMG.dilacerar, dano: "4d12+26", tipo: "perfuracao", desc: P("Mais 4d8 de ácido (entra sozinho)."), efeitos: [efUso("Ácido", [["dano", "4d8[acido]"]], { automatic: true, img: IMG.acido, desc: "+4d8 de ácido." })] }),
			AGARRAR("a pancada", 39),
			habilidade("Corpo Ácido", "Quem acerta o pudim com ataque desarmado ou arma natural, ou começa o turno agarrado a ele, sofre 6d6 de ácido. Arma de metal ou madeira não mágica que o acerte é destruída (Ref CD 30 evita).", { img: IMG.acido, rolls: [rolagemDano("Dano", "6d6", "acido")] }),
			habilidade("Cuspe Ácido", "Bola de muco numa criatura em alcance médio: 10d12 de ácido e fica vulnerável (Ref CD 30 reduz à metade e evita a condição). Recarga (movimento).", {
				img: IMG.acido, execucao: "move", alcance: "medium", resistencia: "Reflexos reduz à metade e evita a condição", rolls: [rolagemDano("Dano", "10d12", "acido")], efeitos: [efCondicao("vulneravel")]
			})
		]
	},
	{
		nome: "Thalliathos", nd: "14", tipo: "hum", raca: "Meio-dragão", tamanho: "med", img: ICONE("necromante-veterano"),
		atr: { for: -1, des: 0, con: 2, int: 7, sab: -1, car: 4 },
		pv: 480, pm: 96, defesa: 30, desl: 9, cd: 40, sentidos: ["escuro"],
		resistencias: "redução de fogo 10",
		pericias: { inic: 11, perc: 10, fort: 14, refl: 22, vont: 28, conh: 18, inti: 15, mist: 20, nobr: 20 },
		magias: ["Amedrontar", "Armadura Arcana", "Enfeitiçar", "Bola de Fogo", "Campo de Força", "Vidência", "Mão Poderosa", "Talho Invisível"],
		tesouro: "Padrão (ou tesouro de ND 14 dobrado, se o grupo saquear Tyros).",
		bio: "Filho de Sckhar e barão-fantoche de Tyros, estudioso de magia arcana. Parou de repassar os tributos e gastou fortunas para virar um dragão verdadeiro; conseguiu prender a essência de um dragão num rubi da coroa. Lança magias como um conjurador arcano de 15º nível (CD 40). Parte 3, Cena 6. Ao ser derrotado, a coroa se despedaça e o rubi solta a névoa vermelha que energiza o Parvathar com fogo.",
		itens: () => [
			habilidade("Herdeiro de Sckhar", "Pode lançar duas magias com uma ação padrão, desde que cada uma tenha execução de ação padrão ou menos. Cada dado de dano das suas magias aumenta em dois passos.", { img: IMG.arcano }),
			habilidade("Transformação em Dragão", `Quando é reduzido a 0 PV, a joia da coroa faísca, uma coluna de chamas irrompe e Thalliathos se transforma num ${G("Dragão Adulto", "dragão adulto")}, com PV e PM restaurados. A coroa continua presa às escamas.<br><b>Automação:</b> troque o token pelo Dragão Adulto do Giria T20.`, { img: IMG.fogo, execucao: "reaction" })
		]
	},
	{
		nome: "Turba de Zumbis do Pântano", nd: "7", tipo: "mor", tamanho: "gra", img: ICONE("turba-de-zumbis"),
		atr: { for: 6, des: -1, con: 0, int: 0, sab: -1, car: -3 },
		pv: 280, defesa: 20, desl: 9, cd: 19, sentidos: ["escuro"],
		pericias: { inic: 2, perc: 5, fort: 16, refl: 11, vont: 6, luta: 26 },
		ataquescac: "[bando] Pancada +26 (4d6+36).",
		bio: "Mortos-vivos lentos, inchados e malcheirosos do Pântano dos Vermes, cheios de vermes e insetos (Int —). Evento 1 da travessia: duas turbas.",
		itens: () => [
			arma("Pancada", { img: IMG.pancada, dano: "4d6+36", tipo: "impacto" }),
			habilidade("Inchaço da Turba", "Quando sofre 20 ou mais de dano de um só ataque, um zumbi explode: criaturas vivas adjacentes sofrem 10d6 de trevas e ficam enjoadas até o fim do próximo turno (Fort CD 19 reduz à metade e evita).", {
				img: IMG.trevas, resistencia: "Fortitude reduz à metade e evita", rolls: [rolagemDano("Dano", "10d6", "trevas")], efeitos: [efCondicao("enjoado", { rodadas: 1 })]
			}),
			habilidade("Vômito Corrosivo", "Criaturas vivas em alcance curto sofrem 8d6+20 de ácido (Ref CD 19 reduz à metade).", { img: IMG.acido, execucao: "move", alcance: "short", resistencia: "Reflexos reduz à metade", rolls: [rolagemDano("Dano", "8d6+20", "acido")] }),
			BANDO("A turba")
		]
	},
	{
		nome: "Verme do Gelo Larva", nd: "10", tipo: "mon", tamanho: "eno", img: ICONE("centopeia-dragao"),
		atr: { for: 6, des: 1, con: 4, int: -5, sab: 2, car: -3 },
		pv: 400, defesa: 36, desl: 12, escavar: 15, cd: 30, sentidos: ["faro", "cegas", "escuro"], imune: ["frio"], vulneravel: ["fogo"],
		resistencias: "imunidade a frio, vulnerabilidade a fogo",
		pericias: { inic: 10, perc: 13, fort: 22, refl: 16, vont: 10, luta: 29, furt: 5 },
		ataquescac: "Mordida +29 (4d8+52 mais 4d6 frio).",
		tesouro: "2d4 doses de gelo extremo (CD 25 para extrair).",
		bio: `Verme branco-azulado de mais de dez metros das Uivantes; com o território encolhendo pela Tormenta, passou a caçar em grupo. Furtividade +20 no gelo. Parte 4, Cena 3: quatro emboscam no platô congelado. Tesouro: ${GL("Gelo Extremo", "AdA", "gelo extremo")}.`,
		itens: () => [
			arma("Mordida", { img: IMG.mordida, dano: "4d8+52", tipo: "perfuracao", desc: P("Mais 4d6 de frio (entra sozinho)."), efeitos: [efUso("Frio", [["dano", "4d6[frio]"]], { automatic: true, img: IMG.frio, desc: "+4d6 de frio." })] }),
			AGARRAR("a mordida", 34),
			habilidade("Engolir", "Se começa o turno agarrando uma criatura Média ou menor, pode fazer um teste de agarrar; se vencer, engole. A engolida continua agarrada e sofre 2d6+20 de impacto mais 4d6+10 de frio no início de cada turno do verme. Escapa causando 30 de dano ao estômago (Defesa 15): é regurgitada e fica caída.", {
				img: IMG.engolir, execucao: "action", rolls: [rolagemDano("Impacto", "2d6+20", "impacto", 0), rolagemDano("Frio", "4d6+10", "frio", 1)]
			}),
			habilidade("Espasmo Mortal", "Ao morrer, o corpo explode em estacas de gelo num raio de 6 m: 4d6 de corte mais 4d6 de frio e caídas (Ref CD 30 evita). A área vira terreno difícil com cobertura leve; fogo mágico destrói as estacas.", {
				img: IMG.frio, area: "6m", resistencia: "Reflexos evita", rolls: [rolagemDano("Corte", "4d6", "corte", 0), rolagemDano("Frio", "4d6", "frio", 1)]
			}),
			habilidade("Sopro Glacial", "Cone de 12 m: 8d10 de frio e lentas (Ref CD 30 reduz à metade e evita). Recarga (movimento).", {
				img: IMG.frio, execucao: "action", area: "12m", resistencia: "Reflexos reduz à metade e evita a condição", rolls: [rolagemDano("Dano", "8d10", "frio")], efeitos: [efCondicao("lento")]
			})
		]
	},
	{
		nome: "Verme do Pântano", nd: "8", tipo: "mon", tamanho: "eno", img: ICONE("jiboia"),
		atr: { for: 7, des: 1, con: 8, int: -4, sab: 1, car: -2 },
		pv: 64, defesa: 28, desl: 9, nadar: 15, sentidos: ["escuro"],
		pericias: { inic: 9, perc: 10, fort: 21, refl: 15, vont: 10, luta: 26 },
		ataquescac: "Mordida +26 (4d8+18).",
		bio: "Verme gigante nativo do pântano, de pele escura, lisa e pegajosa, que vê aventureiros como um hynne vê um assado. Evento 11 da travessia: dois engolem os zumbis e se viram contra o grupo.",
		itens: () => [
			arma("Mordida", { img: IMG.mordida, dano: "4d8+18", tipo: "perfuracao" }),
			AGARRAR("a mordida", 28),
			habilidade("Fome Tremedálica", "Se começa o turno agarrando uma criatura Média ou menor, pode fazer um teste de agarrar; se vencer, engole e recupera 8d8+8 PV. A engolida sofre 2d10+12 de impacto e 4d6+8 de ácido no início de cada turno do verme (só uma por vez). Escapa causando 20 de dano ao estômago (Defesa 10).", {
				img: IMG.engolir, execucao: "action", rolls: [rolagemFormula("Cura", "8d8+8", 0), rolagemDano("Impacto", "2d10+12", "impacto", 1), rolagemDano("Ácido", "4d6+8", "acido", 2)]
			})
		]
	}
];

// ---------------------------------------------------------------------------
// Perigos e testes (atores do tipo Perigo)
// ---------------------------------------------------------------------------
const R = (f, t) => `[[/r ${f}${t ? `[${t}]` : ""}]]`;
const PERIGOS = [
	{
		nome: "Burocracia Arcana", nd: "12", local: "Parte 1, Cena 6 (Castelo Vectorius)",
		goal: P("Conseguir o visto de permanência em Vectora e a permissão para usar a magia de Raisenzan na cidade: <b>7 sucessos</b> entre Preencher Formulário e Responder Entrevista."),
		effects: P(
			"No fim de cada rodada, cada personagem faz Vontade CD 20 (+2 por teste já feito). Falha: @STATUS[frustrado]; falha por 10+: também @STATUS[atordoado] por uma rodada. Já frustrado: @STATUS[esmorecido]. Já esmorecido: surta e sai da cena.",
			"Todos surtaram antes dos 7 sucessos: sem visto (tentar de novo em uma semana, sem a proteção da lei). Todos os testes com sucesso: carta de recomendação de Vectorius (20% de desconto por conta dos cofres da cidade)."
		),
		actions: P(
			"<b>Preencher Formulário</b> (Conhecimento ou Nobreza CD 25).",
			"<b>Responder Entrevista</b> (Diplomacia ou Enganação CD 25): convencer uma cópia de Vectorius.",
			"<b>Debater Planos</b> (qualquer perícia justificável, CD 10): ajudar um colega.",
			"Use a macro <b>CdR · Teste estendido</b> (7 sucessos)."
		)
	},
	{
		nome: "Travessia do Pântano dos Vermes", nd: "—", local: "Parte 2, Cena 2",
		goal: P("Chegar ao ponto indicado por Masaru: teste estendido de Sobrevivência CD 25, <b>5 sucessos</b>; cada teste é uma hora. Falha total: o grupo se perde e recomeça."),
		effects: P("A cada hora, um jogador rola na tabela <b>A4 · Eventos do Pântano dos Vermes</b> (1d12). Resultado repetido vira o evento 1."),
		actions: P("Use a macro <b>CdR · Teste estendido</b> (5 sucessos). Em Salistick a magia divina enfraquece: rolagens de efeito no mínimo e CD –5, a não ser que o conjurador gaste +2 PM.")
	},
	{
		nome: "Jogo de Influências", nd: "14", local: "Parte 3, Cena 4 (jantar de gala de Sckhar)",
		goal: P("Cair nas graças de Schaven: <b>7 sucessos</b> em Estabelecer Presença, Performance e Politicagem durante as <b>3 rodadas</b> do jantar (uma hora cada)."),
		effects: P(
			"No início de cada rodada, Alurra faz Intimidação (+14) oposta pela Vontade de um personagem à escolha; se vencer, ele não age na rodada.",
			"Trajes luxuosos: +2 em todos os testes da cena. Presente comprado (T$ 300): gaste para rolar de novo um teste recém-feito.",
			"Cada sucesso acima de 7: presente de [[/r 1d6*1000]] T$ de nobres satisfeitos. Sem os 7: um nobre pede T$ 10.000 de suborno para interceder."
		),
		actions: P(
			"<b>Atrapalhar Alurra</b> (Intuição CD 20): próximo Intimidação dela com –5.",
			"<b>Conduzir a Conversa</b> (Enganação CD 25): +5 no próximo teste de um colega.",
			"<b>Estabelecer Presença</b> (Intimidação CD 30). <b>Performance</b> (Atuação CD 32). <b>Politicagem</b> (Diplomacia CD 30).",
			"<b>Seguir Protocolos</b> (Nobreza CD 20): +5 no próprio próximo teste ou no de um colega."
		)
	},
	{
		nome: "Escalada nas Uivantes", nd: "—", local: "Parte 4, Cenas 3 e 5",
		goal: P("Chegar a Korm e depois ao santuário de Beluhga. Roupas de frio de Kirima: +5 em Fortitude contra frio."),
		effects: P(
			"<b>Trilha até Korm:</b> Fortitude CD 20 ou @STATUS[fatigado] até o fim da cena. Depois, emboscada de 4 vermes do gelo larva no platô congelado.",
			`<b>Subida:</b> ${R("4d8", "frio")} de frio e @STATUS[fatigado] (Fort CD 25 evita).`,
			`<b>Tempestade:</b> cada um faz Atletismo CD 25 (+5 pelo equipamento de segurança); quem falha escorrega e sofre ${R("10d6", "impacto")}. Reflexos CD 25 segura o companheiro da frente, com –2 no próprio Atletismo.`
		),
		actions: P("Kirima cobra T$ 100 por dia (comida e equipamento) e vende as roupas de frio por T$ 30. Defina a ordem de marcha: há passagens estreitas.")
	},
	{
		nome: "Desmoronamento", nd: "14", local: "Parte 4, Cena 6 (caverna congelada)",
		goal: P("Avançar pelos túneis até o centro do santuário com toneladas de neve e rocha nos calcanhares: <b>7 sucessos</b> em Avançar."),
		effects: P(`No fim de cada rodada, cada personagem faz Reflexos CD 25 (+1 por teste já feito). Falha: ${R("4d6", "impacto")} de impacto e ${R("4d6", "frio")} de frio, e só pode Escapar.`),
		actions: P(
			"<b>Avançar</b> (CD 30): qualquer perícia justificável, cada uma no máximo duas vezes.",
			"<b>Escapar/Soltar Colega</b> (Força CD 20): quem falhou nos Reflexos se solta (ou outro o solta) e pode agir na rodada seguinte.",
			"Use a macro <b>CdR · Teste estendido</b> (7 sucessos)."
		)
	},
	{
		nome: "Ases nas Alturas", nd: "—", local: "Parte 4, Cena 8 (batalha aérea sobre a nuvem)",
		goal: P("Sobreviver ao ataque final de Aaron Sauer sobre a nuvem mágica (quadrado de 4,5 m) presa ao Vento Vasto por arpões. Com Aaron morto, a luta acaba."),
		effects: P(
			`No começo de cada rodada, o Vento Vasto dispara os canhões: todos na nuvem sofrem ${R("6d6", "impacto")} (Ref CD 20 reduz à metade).`,
			"Personagem na borda que sofre dano faz Acrobacia CD 10 + metade do dano; se falhar, cai a 9 m por rodada (campo de levitação de Vectora). Passou de 30 m, sai do campo e despenca. Os vilões lutam no campo sem cair.",
			"Use a macro <b>A4 · Ases nas Alturas</b>."
		),
		actions: P(
			"Com Masaru como parceiro, o herói gasta uma ação de movimento para Masaru voar até quem cai e trazê-lo de volta.",
			"Quem sabe dos motivos dos piratas pode virar qualquer um deles com Diplomacia CD 30."
		)
	}
];

// ---------------------------------------------------------------------------
// Itens da aventura e parceiros
// ---------------------------------------------------------------------------
function itensDaAventura() {
	const tesouro = (nome, desc, { qtd = 1, preco = 0, img = "icons/svg/item-bag.svg", role } = {}) => ({ name: nome, type: "tesouro", img, flags: role ? { world: { cdrRole: role } } : {}, system: { description: { value: P(...[].concat(desc)) }, source: FONTE, qtd, preco } });
	const consumivel = (nome, desc, { preco, img, execucao = "action", efeitos = [], rolls = [] }) => ({ name: nome, type: "consumivel", img, effects: efeitos, system: { description: { value: P(...[].concat(desc)) }, source: FONTE, qtd: 1, preco, ativacao: { execucao }, rolls } });
	const poder = (nome, desc, { img = "icons/svg/mystery-man.svg" } = {}) => ({ name: nome, type: "poder", img, system: { description: { value: P(...desc) }, source: FONTE, tipo: "ability", ativacao: { execucao: "passive", custo: 0 } } });
	const parc = (n, id) => `@UUID[Compendium.tormenta20.parceiros.Item.${id}]{${n}}`;
	return [
		{
			name: "Parvathar, o Pulmão da Montanha", type: "equipamento", img: GER("ferramenta-pesada"),
			flags: { world: { cdrRole: "parvathar" } },
			system: {
				description: { value: P(
					"Criado pelos anões de Doherimm para forjar aço-rubi, usa energias elementais como combustível: transforma chamas comuns em chamas rubras, fortes o bastante para moldar aço-rubi. Preso ao corpo do usuário, é um item vestido de 1 espaço. Não pode ser teletransportado enquanto se regenera (a energia se dissipa ou ele explode).",
					"<b>Aspirar.</b> Quando sofre um efeito que causa dano de ácido, eletricidade, fogo ou frio, o usuário pode gastar 3 PM para reduzir esse dano à metade.",
					"<b>Assoprar.</b> Se já usou Aspirar na cena, o usuário gasta uma ação padrão para disparar um cone de 6 m: criaturas na área sofrem 1d6 de dano para cada 5 pontos de dano absorvidos com Aspirar, do mesmo tipo de energia (Reflexos CD Car reduz à metade). Depois, precisa Aspirar de novo antes de Assoprar outra vez.",
					"<b>Energias restauradas:</b> eletricidade (Raisenzan, Parte 1) · ácido (pudim alvinegro, Parte 2) · fogo (rubi de Thalliathos, Parte 3) · frio (Beluhga, Parte 4). Com as quatro, Dhormûg e Masaru o restauram por completo (Epílogo): o couro brilha em furta-cor.",
					"<b>Automação:</b> Aspirar com custo de 3 PM no uso; para Assoprar, role [[/r 1d6]] por 5 pontos absorvidos."
				) },
				source: FONTE, tipo: "acessorio", preco: 0, peso: 0, espacos: 1, ativacao: { execucao: "reaction", custo: 3 }
			}
		},
		tesouro("Apito de Raisenzan", "Apito metálico de formato exótico, usado por monges em missões diplomáticas. Soprado ao ar livre, invoca uma nuvem quadrada de 4,5 m de lado que leva todos sobre ela a um local pedido; Raisenzan fala pela nuvem com voz de trovão. No destino, a nuvem some. Invocada de novo, só volta para Ozora.", { img: GER("apito"), role: "apito" }),
		tesouro("Tiara de Beluhga", "Tiara branca e fria ao toque que pertenceu a Beluhga, dada por Raisenzan. Mostrada às aias de Sckhar no Dia do Tributo, abre as portas do palácio (Parte 3, Cena 3).", { img: GER("joia-familia") }),
		tesouro("Carta de recomendação de Vectorius", "Assinada pelo próprio arquimago: 20% de desconto em qualquer compra em Vectora, por conta dos cofres da cidade (limites a critério do mestre). Só se todos os testes da Burocracia Arcana forem sucesso.", { img: GER("pergaminho") }),
		tesouro("Roupas de frio de Kirima", "Trajes de peles de cheiro forte: +5 em testes de Fortitude contra baixas temperaturas.", { preco: 30, img: GER("capa-pesada") }),
		tesouro("Mensagem na garrafa", "Escrita em anão (Conhecimento CD 15 para ler): \"Morreram todos. Logo morrerei. Não faça como nós. Proteja-se do ácido.\" Evento 4 do Pântano dos Vermes.", { img: GER("odre") }),
		consumivel("Antídoto Universal", "Líquido espesso, verde-escuro e de cheiro forte. Ingeri-lo remove uma condição de veneno. Preparado alquímico de Salistick.", { preco: 15, img: GER("kit-medicamentos") }),
		consumivel("Elixir de Vida", "Tônico analgésico de Salistick. Ingerir é uma ação padrão e recupera 4d6 PV. Preparado alquímico; a CD para fabricar aumenta em +5.", { preco: 210, img: GER("balsamo-restaurador"), rolls: [rolagemFormula("Cura", "4d6")] }),
		consumivel("Pomada Protetora", "Pasta espessa e cinzenta que deixa a pele dura como pedra. Espalhar é uma ação completa e fornece resistência a dano 5 por uma cena. Preparado alquímico; a CD para fabricar aumenta em +10.<br><b>Automação:</b> botão do efeito no cartão.", {
			preco: 750, img: GER("oleo"), execucao: "full", efeitos: [efCartao("Pomada Protetora (RD 5)", [["system.tracos.resistencias.dano.bonus", 5]], { img: GER("oleo"), cena: true, desc: "Resistência a dano 5 até o fim da cena." })]
		}),
		consumivel("Tônico Revigorante", "Bebida amarga de Salistick que remove uma condição de fadiga. Preparado alquímico.", { preco: 60, img: GER("bebida-comum") }),
		{
			name: "Lançador Alquímico", type: "equipamento", img: EQ("mosquete"),
			system: { description: { value: P("Cano grosso com empunhadura e gatilho de Salistick. Carregar um preparado ou poção é uma ação padrão. Exige as duas mãos e arremessa o item carregado em alcance médio, com +2 na CD para resistir ao efeito. Equipamento de aventura.", `O ${GL("Bacamarte", "AdA", "bacamarte")} também é vendido livremente em Yuton.`) }, source: FONTE, tipo: "acessorio", preco: 600, peso: 0, espacos: 2 }
		},
		poder("Parceiro: Masaru Yuudai", [
			"Mestre de mahou-jutsu lefou do templo Ozora. Não quer ficar longe de Vectora por muito tempo (convencer pode exigir perícias sociais CD 20). Começa como parceiro <b>iniciante</b>: +2 em ataques corpo a corpo.",
			"<b>Veterano</b> (cumpra: ( ) conversar longamente sobre destruir a Tormenta; ( ) contar sobre as pessoas que o herói perdeu; ( ) treinar com Masaru em Ozora): uma vez por rodada causa 3d6 de eletricidade, fogo ou frio num alvo atingido por um ataque corpo a corpo do herói.",
			"<b>Mestre</b> (cumpra: ( ) aprender mahou-jutsu; ( ) presentear Masaru com uma relíquia de Tamu-ra): uma vez por cena, como ação livre, um jutsu: <b>Forma Espiritual</b> (invisível e incorpóreo, desloca em qualquer direção por 1d6 rodadas); <b>Integridade Corporal</b> (recupera 6d8 PV); <b>Mente Ausente</b> (imune a confusão, +2 em ataques e Vontade por uma cena); <b>Toque Paralisante</b> (criatura adjacente faz Fort CD Sab ou fica paralisada por 1d4 rodadas).",
			`Masaru ensina ${GL("Mahou-Jutsu", "HdA", "Mahou-Jutsu")} a quem se mostrar honrado (um poder geral ao subir de nível, ou por treinamento).`,
			"<b>Automação:</b> use o efeito do nível atual no ataque (opções abaixo)."
		], { img: "icons/svg/mystery-man.svg" }),
		{
			...poder("Parceiro: Schaven (destruidor mestre)", [
				`Filho de Sckhar e da concubina Brienna, meio-dragão de cabelos cor de fogo e porte élfico, ambicioso. Na missão contra Thalliathos (Parte 3, Cenas 5 e 6) acompanha o grupo como parceiro ${parc("Destruidor", "FIJfKOIU8dzbvSDG")} mestre.`,
				"Arraste para a ficha de um personagem durante a missão e apague depois."
			]),
			img: "icons/svg/fire.svg"
		}
	].map((i) => i);
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

const MASARU_EF = [
	efUso("Masaru iniciante (+2 corpo a corpo)", [["ataque", 2]], { types: ["attack"], img: IMG.ordens, desc: "+2 em ataques corpo a corpo." }),
	efUso("Masaru veterano (+3d6 elemental)", [["dano", "3d6"]], { types: ["attack"], img: IMG.fogo, desc: "Uma vez por rodada: +3d6 de eletricidade, fogo ou frio." })
];
const itens = itensDaAventura().map((i) => ({
	...i,
	effects: i.name === "Parceiro: Masaru Yuudai" ? MASARU_EF : i.effects ?? [],
	folder: pasta.Item.id,
	flags: { ...(i.flags ?? {}), world: { ...(i.flags?.world ?? {}), cdr: TAG } }
}));
const itensCriados = {};
for (const i of await Item.implementation.createDocuments(itens)) {
	itensCriados[i.name] = i;
	relatorio.criados.push(`Item: ${i.name}`);
}

// Tabela
const L = (n, rotulo) => (fichas[n] ? `@UUID[${fichas[n].uuid}]{${rotulo ?? n}}` : rotulo ?? n);
const EVENTOS = [
	["Pântano dos Mortos", `Corpos humanoides inchados se erguem das águas, com fome. Duas ${L("Turba de Zumbis do Pântano", "turbas de zumbis do pântano")}.`],
	["Macaquinhos Travessos", "Micos com pelo de folhagem na barriga jogam uma pedra que faz faísca no gás: todos sofrem [[/r 8d6[fogo]]] de fogo (Ref CD 20 reduz à metade)."],
	["Lamaçal", "Lodo como piche: Fortitude CD 20 ou @STATUS[fatigado] até o fim do dia. Ideias e habilidades podem dar bônus."],
	["Mensagem Numa Garrafa", "Garrafa esverdeada com um papel em anão (Conhecimento CD 15): \"Morreram todos. Logo morrerei. Não faça como nós. Proteja-se do ácido.\""],
	["Gases Tóxicos", "Cheiro adocicado, lábios em espasmos, cabeça leve: Fortitude CD 20 ou @STATUS[alquebrado] até o fim do dia."],
	["Esqueleto Blindado", `Esqueleto limpo preso nas raízes de uma árvore, ainda com uma ${G("Couraça", "couraça")} de aço intacta: é uma couraça polida cáustica.`],
	["Águas Profundas", "O pântano fica fundo: Atletismo CD 20 para nadar (penalidade de armadura conta). Quem falha fica @STATUS[fatigado]."],
	["Poção Surpresa", `Uma garrafa amarrada num cipó esbarra no ombro: ${G("Poção de Resistência a Energia", "poção de resistência a energia")}.`],
	["Gases Venenosos", "Nuvem esverdeada que queima os pulmões: todos ficam @STATUS[envenenado], perdem [[/r 2d12]] PV por 3 rodadas e ficam @STATUS[fraco] (Fort CD 20 reduz para 1 rodada e evita a condição)."],
	["Um Tronco no Caminho", "Árvore gigantesca tombada: contornar leva duas horas, menos 15 minutos por personagem que passe em Atletismo ou Sobrevivência CD 20 (Controlar Plantas, Desintegrar etc. contam como sucesso)."],
	["Pântano dos Mortos 2: o Inimigo Agora é Outro!", `Zumbis bloqueiam a passagem, mas dois ${L("Verme do Pântano", "vermes do pântano")} explodem do lodo, engolem os zumbis e se viram contra o grupo.`],
	["Macaquinhos Solícitos", "Micos com pelo de caveira deixam cair uma pedra colorida. Percepção CD 15 para devolver: os micos guiam o grupo (conta como um sucesso no teste estendido, uma hora a menos). Se forem grossos, jogam fezes e fogem."]
];
const tabela = await RollTable.implementation.create({
	name: "A4 · Eventos do Pântano dos Vermes", img: "icons/svg/hazard.svg", folder: pasta.RollTable.id, flags: FLAGS("eventosPantano"),
	formula: "1d12", replacement: true, displayRoll: true,
	description: "Uma rolagem por hora de travessia (teste estendido de Sobrevivência CD 25, 5 sucessos). Resultado repetido vira o evento 1.",
	results: EVENTOS.map(([nome, desc], i) => ({ type: "text", range: [i + 1, i + 1], weight: 1, name: nome, description: desc }))
});
relatorio.criados.push(`Tabela: ${tabela.name}`);

// Macro
const ASES = String.raw`// A4 · Ases nas Alturas (Caravana Cartesiana, Parte 4, Cena 8). Só o mestre.
// Selecione os tokens na nuvem. "Canhões" rola o dano do Vento Vasto e os Reflexos de cada um (CD 20, metade).
// "Teste de borda" rola Acrobacia (CD 10 + metade do dano) de quem está na borda e sofreu dano.
if (!game.user.isGM) return ui.notifications.warn("Só o mestre roda esta macro.");
const { DialogV2 } = foundry.applications.api;
const atores = canvas.tokens.controlled.map((t) => t.actor).filter(Boolean);
if (!atores.length) return ui.notifications.warn("Selecione os tokens na nuvem.");
const val = (a, id) => a?.system?.pericias?.[id]?.value ?? 0;
const r = await DialogV2.wait({
	window: { title: "Ases nas Alturas" }, rejectClose: false,
	content: '<p>' + atores.map((a) => a.name).join(", ") + '</p><label>Dano sofrido (para o teste de borda) <input type="number" name="dano" value="10" min="0"></label>',
	buttons: [
		{ action: "canhoes", label: "Canhões do Vento Vasto", default: true, callback: () => ({ a: "canhoes" }) },
		{ action: "borda", label: "Teste de borda", callback: (e, b) => ({ a: "borda", dano: Number(b.form.elements.dano.value) || 0 }) }
	]
});
if (!r) return;
let html = "";
if (r.a === "canhoes") {
	const dano = (await new Roll("6d6").evaluate()).total;
	html = "<p>Canhões: <b>" + dano + "</b> de impacto (Ref CD 20 reduz à metade).</p>";
	for (const a of atores) {
		const t = (await new Roll("1d20 + " + val(a, "refl")).evaluate()).total;
		html += "<p>" + a.name + ": Reflexos " + t + " → <b>" + (t >= 20 ? Math.floor(dano / 2) : dano) + "</b> de dano.</p>";
	}
} else {
	const cd = 10 + Math.floor(r.dano / 2);
	for (const a of atores) {
		const t = (await new Roll("1d20 + " + val(a, "acro")).evaluate()).total;
		html += "<p>" + a.name + ": Acrobacia " + t + " vs CD " + cd + " → " + (t >= cd ? "se segura" : "<b>cai</b> (9 m por rodada; passou de 30 m, despenca)") + ".</p>";
	}
}
ChatMessage.create({ whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id), content: "<h3>Ases nas Alturas</h3>" + html });`;
await Macro.implementation.create({ name: "A4 · Ases nas Alturas", type: "script", scope: "global", img: "icons/svg/wing.svg", folder: pasta.Macro.id, flags: FLAGS("asesNasAlturas"), command: ASES });
relatorio.criados.push("Macro: A4 · Ases nas Alturas");

// ---------------------------------------------------------------------------
// Diários
// ---------------------------------------------------------------------------
const I = (n, rotulo) => (itensCriados[n] ? `@UUID[${itensCriados[n].uuid}]{${rotulo ?? n}}` : rotulo ?? n);
const linha = (local, txt) => `<li><b>${local}:</b> ${txt}</li>`;
const ul = (arr) => `<ul>${arr.join("")}</ul>`;
const paginas = (lista) => lista.map((pg, i) => ({ name: pg.name, type: "text", sort: (i + 1) * 100, title: { show: true, level: 1 }, text: { content: pg.html, format: 1 } }));
const T = `@UUID[${tabela.uuid}]{Eventos do Pântano dos Vermes}`;

const roteiro = [
	{ name: "Visão geral", html: P(
		"<b>Caravana Cartesiana</b> (livro, pp. 63–83). Personagens do 11º ao 15º nível. Uma volta ao mundo a bordo de Vectora para restaurar o Parvathar com as quatro energias elementais puras.",
		"<b>Parte 1:</b> Vectora, Dhormûg, Masaru e o dragão Raisenzan (eletricidade). <b>Parte 2:</b> Salistick e o Pântano dos Vermes (ácido), com os piratas do Vento Vasto. <b>Parte 3:</b> Sckharshantallas, o jantar de Sckhar e Thalliathos (fogo). <b>Parte 4:</b> as Uivantes e o santuário de Beluhga (frio), e a batalha aérea contra Aaron Sauer.",
		`Por trás de tudo, o espião purista ${L("Aaron Sauer")}: raptou Raijin para chantagear Kaminari e a filha de Alurra para usar os piratas. Leve o ${I("Parvathar, o Pulmão da Montanha")} (ele não pode ser teletransportado nesta fase).`
	) },
	{ name: "Parte 1 — Amigos de Alta Estirpe", html: ul([
		linha("Cena 1 — O Mercado nas Nuvens", "Praça da estátua de Vectorius. Um guarda anão inspeciona o fole (\"Que Khalmyr arranque a minha barba se isso não é artesanato anão!\") e explica a lei: proibida magia que cause prejuízo ou permita trapaça (encantamentos, ilusões, transmutações). Estalagens dez vezes mais caras; tudo do livro básico à venda (itens mágicos com Investigação). Investigação CD 20 sobre o fole: procurem Dhormûg (Intuição CD 20: as intenções são legítimas)."),
		linha("Cena 2 — Oficina Assistência Arcana", `Bairro de Mucro. Dhormûg, jovem anã inventora de tranças cor de cobre, alegre e tagarela: \"Seja qual for a peça com defeito, eu dou um jeito!\" Reconhece o Parvathar (feito pela família dela), explica que precisa absorver as quatro energias puras e indica Masaru Yuudai, no templo Ozora. <b>O Espião:</b> um rapaz loiro de vestes brancas imaculadas, \"Sauer, mercador de Valkaria\".`),
		linha("Cena 3 — O Templo Ozora", `Torre de turmalina azul, antigo altar de Hydora, alunos treinando no ar. Masaru (lefou, cicatrizes vermelhas) medita no chão; o que voa no teto é uma projeção. Para falar com ele, é preciso voar até o teto (poções e pergaminhos de voo à venda). ${L("Kaminari")} e ${L("Raijin")} atacam como parte do treino. Metade do grupo caído: \"Basta!\" e voltem depois. Um gêmeo caído ou os dois com menos de 10 PV: Masaru recebe o grupo.`),
		linha("Cena 4 — Raisenzan e as Energias Elementais", `A estátua do pilar é o dragão celestial Raisenzan (preguiçoso e debochado; ${GL("Dragão Celestial Adulto", "AdA", "ficha de dragão celestial")}). O sopro dele energiza o Parvathar com eletricidade. O mapa de raios aponta: um pântano perto de Yuton, a capital de Sckharshantallas e um cume nas Uivantes. Dhormûg explica as habilidades do artefato. Masaru pode acompanhar como ${I("Parceiro: Masaru Yuudai", "parceiro")}.`),
		linha("Cena 5 — Carona de dragão", `Raisenzan entrega o ${I("Apito de Raisenzan")}. Hospedagem em Ozora, mas é preciso pedir documentos no palácio.`),
		linha("Cena 6 — Audiência em Vectora", `Castelo Vectorius, cópias do arquimago carimbando papéis. ${L("Burocracia Arcana")}. Prêmio máximo: ${I("Carta de recomendação de Vectorius")}.`),
		linha("Cena 7 — Traição Celeste", `Separe um aventureiro: ${L("Kaminari")} ataca chorando e pedindo desculpas, e foge com metade dos PV. (Aaron raptou Raijin.)`)
	]) },
	{ name: "Parte 2 — Pântano, Pudim e Piratas", html: ul([
		linha("Cena 1 — O Lugar Esquecido pelos Deuses", `Yuton, capital de Salistick. Magia divina enfraquecida (rolagens de efeito no mínimo, CD –5; +2 PM cancela). Medicina, alquimia e pólvora livres: ${I("Antídoto Universal")}, ${GL("Bacamarte", "AdA", "bacamarte")} (T$ 450), ${I("Elixir de Vida")}, ${I("Lançador Alquímico")}, ${I("Pomada Protetora")}, ${I("Tônico Revigorante")}. Investigação: <b>10</b> o nome vem dos vermes nos mortos-vivos; <b>15</b> um dragão ronda o pântano / dizem que é o lar de Mzzylein; <b>20</b> o pântano é o laboratório necromântico de Mzzylein.`),
		linha("Cena 2 — Pântano dos Vermes", `${L("Travessia do Pântano dos Vermes")} com a tabela ${T}.`),
		linha("Cena 3 — Pudim Alvinegro", `Um esqueleto de dragão envolto em gosma negra se ergue do lamaçal: ${L("Pudim Alvinegro")}. Derrotado, o Parvathar absorve o ácido.`),
		linha("Cena 4 — Piratas!", `O dirigível Vento Vasto (proa de raposa, peças de navios diferentes). ${L("Capitã Alurra")}, ${L("Goblin")}, ${L("Kaminari")} e um ${L("Bando Pirata", "bando pirata")} por aventureiro. Líderes derrotados: fogem (vá para a Parte 3). Piratas vencem: Cena 5.`),
		linha("Cena 5 — Prisioneiros num Navio", `Vento Vasto: 90 × 15 m, dois andares. Desarmados, amarrados, conjuradores amordaçados; acordam com metade do nível em PV e PM. Soltar-se: Força ou Acrobacia CD 25 (falha: 1d3 de dano). Porta: fechadura CD 20 (–5 sem ferramentas) ou Força CD 15 (barulho). Os piratas dividem o butim numa sala de estoque: 4 ${L("Bando Pirata", "bandos piratas")} com as armas dos heróis; tesouro de [[/r 2d4*10000]] T$. Subir é suicídio (6 bandos e os líderes; Alurra joga os heróis para fora). O navio já está nas docas de Vectora.`)
	]) },
	{ name: "Parte 3 — A Chama do Rei", html: ul([
		linha("Cena 1 — Presente de Dragão", `Raisenzan não entra em Sckharshantallas (\"Tenho apenas 600 anos, sou jovem demais para morrer!\"), mas entrega a ${I("Tiara de Beluhga")}.`),
		linha("Cena 2 — Sob a Sombra do Dragão", `Tyros, feudo de Trebuck. Só se entra por terra. Fortitude CD 15 (20 de armadura pesada) ou fatigado até o fim da jornada. Emboscada: 2 ${L("Ginete de Serpe", "ginetes de serpe")} e uma ${L("Revoada de Serpes", "revoada de serpes")}.`),
		linha("Cena 3 — Dia do Tributo", "Ghallistryx. Fila de oferendas ao castelo; com a tiara de Beluhga, as aias levam o grupo a Schaven, filho de Sckhar, que convida para o jantar. Trajes: T$ 100 (aceitáveis) ou T$ 1.000 (luxuosos, +2 na cena); presentes T$ 300 cada. Alurra também foi convidada (deu a Sckhar o crânio do \"dragão que ela matou\")."),
		linha("Cena 4 — Que Convença o Melhor", `Sckhar entra em forma élfica com o crânio, elogia Alurra e sai. Schaven escolhe Alurra como agente. ${L("Jogo de Influências")}.`),
		linha("Cena 5 — A Ordem do Rei", `Schaven quer remover o irmão Thalliathos, barão de Tyros, que parou de repassar tributos. ${I("Parceiro: Schaven (destruidor mestre)", "Schaven acompanha como parceiro destruidor mestre")}.`),
		linha("Cena 6 — Jantar à Luz de Chamas", `${L("Thalliathos")} põe a coroa de rubi e cresce. A 0 PV vira um ${G("Dragão Adulto", "dragão adulto")} com PV e PM restaurados. Derrotado, a coroa se despedaça e o rubi solta a névoa de fogo para o Parvathar. Saquear Tyros (tesouro de ND 14 dobrado) é escolha moral do grupo. O apito chama a nuvem de volta.`)
	]) },
	{ name: "Parte 4 — Enterrem Meu Coração nas Uivantes", html: ul([
		linha("Cena 1 — Entrando Numa Fria", "Masaru indica o santuário de Beluhga; a nuvem só leva até a base. Dhormûg quer inspecionar o Parvathar."),
		linha("Cena 2 — O Cliente sem Razão", "Aaron negocia uma harpa com Dhormûg (\"Oh, seus clientes preferidos chegaram\"). Quando as Uivantes forem mencionadas: Percepção oposta à Furtividade de Aaron (+17); quem passar o vê ouvindo pela janela."),
		linha("Cena 2,5 — Tá Chovendo Goblin", `Quem seguir Aaron é interceptado por ${L("Goblin")} e 2 ${L("Bando Pirata", "bandos piratas")}. Goblin capturado fala (Intimidação ou oferta); Intimidação CD 25: Aaron é purista e contratou o Vento Vasto.`),
		linha("Cena 3 — A Montanha dos Ventos", `${L("Escalada nas Uivantes")}. Platô congelado: 4 ${L("Verme do Gelo Larva", "vermes do gelo larva")}.`),
		linha("Cena 4 — A Vila no Gelo", `Korm (humanos e anões). Kirima, o guia de bigode espesso com dois lobos: T$ 100 por dia; ${I("Roupas de frio de Kirima")} por T$ 30.`),
		linha("Cena 5 — Para o Alto e ao Vento", `Subida e tempestade (${L("Escalada nas Uivantes", "veja o perigo")}).`),
		linha("Cena 6 — Caverna Congelada", `Kirima espera do lado de fora. Caverna de gelo eterno. ${L("Desmoronamento")}.`),
		linha("Cena 7 — O Guardião do Inverno", `Câmara de pilastras de gelo e o corpo de Beluhga em forma humana. Quem não tem imunidade a frio ou resistência a frio 10+ fica @STATUS[lento]. ${L("Bhalorg")}; a 0 PV volta a ser humano: conversar (ele devolve a joia, energiza o Parvathar com frio e cura 10d8+10 PV e 2d8 PM de cada um) ou matar (vira cristais; a joia fica).`),
		linha("Cena 8 — Ases nas Alturas", `O Vento Vasto arpoa a nuvem. ${L("Aaron Sauer")} com Alurra, Kaminari, Goblin (se vivos) e 4 bandos piratas. ${L("Ases nas Alturas")} e a macro <b>A4 · Ases nas Alturas</b>.`),
		linha("Epílogo", "Dhormûg refaz costuras, entalhes e verniz entoando cantigas; Masaru estabiliza com energia neutra. Uma pequena explosão quebra as janelas do quarteirão, e o Pulmão brilha furta-cor. Hora de voltar a Yuvalin... onde uma surpresa desagradável espera. Personagens no 15º nível.")
	]) },
	{ name: "Masaru e Mahou-Jutsu", html: P(
		"Masaru Yuudai, lefou tamuraniano, perdeu a infância e o mestre para a Tormenta e dominou o mahou-jutsu quase sozinho. Detecta \"pulsos\" de energia elemental conforme Vectora se aproxima deles. Quer lutar contra a Tormenta, mas não quer abandonar o templo; seguir a rota de Vectora resolve as duas coisas.",
		`Um personagem pode aprender ${GL("Mahou-Jutsu", "HdA", "Mahou-Jutsu")} (poder de combate) gastando um poder geral ao subir de nível ou com treinamento. Com o livro Império de Jade, o mestre pode permitir jutsus com \"toque\" ou \"golpe\" no nome no lugar de magias.`,
		`Progresso do parceiro: veja ${I("Parceiro: Masaru Yuudai")}.`
	) }
];

const documentos = [
	["Mensagem na garrafa (em anão)", "<i>Morreram todos. Logo morrerei. Não faça como nós. Proteja-se do ácido.</i>"],
	["Convite para o jantar de Sckhar", "Pergaminho com o brasão de Sckhar em cera vermelha. Num canto, o tipo de traje exigido e o alfaiate a consultar."],
	["Lei de Vectora", "<i>É proibida a conjuração de qualquer magia capaz de causar prejuízo ou possibilitar trapaça, como encantamentos, ilusões e transmutações.</i>"]
];

await JournalEntry.implementation.createDocuments([
	{ name: "A4 · Como usar no Foundry", folder: pasta.JournalEntry.id, flags: FLAGS("comoUsar"), pages: paginas([
		{ name: "Visão geral", html: P(
			"Tudo desta aventura fica nas pastas <b>A4 · Caravana Cartesiana</b> (Atores, Itens, Tabelas, Macros e Diários). Ameaças em <i>Ameaças</i>; perigos e testes em <i>Perigos e Testes</i>. Cenas e mapas ficam por sua conta.",
			"Serpe, dragão adulto, dragão celestial, peçonha concentrada, gelo extremo, bacamarte e Mahou-Jutsu vêm do <b>Giria T20</b> pelos links do roteiro.",
			"Kaminari e Raijin têm a mesma ficha (o livro dá um bloco para os dois). Fichas conferidas com o livro (pp. 79–83)."
		) },
		{ name: "Automações", html: ul([
			linha("Aaron Sauer", "Florete com botão \"Sangrando\"; Ataque Furtivo (+8d6) e Ódio Puro (+2) como opções no ataque."),
			linha("Capitã Alurra", "Movam-se, Sacripantas! como botão (+4 em perícias e dano dos aliados até o fim da cena)."),
			linha("Ginete de Serpe", "+1d12 de perfuração da montaria automático no mangual."),
			linha("Pudim Alvinegro, Verme do Gelo, Turba do Pântano", "Dano de energia extra automático nos ataques; habilidades com rolagens e botões de condição (vulnerável, lento, enjoado)."),
			linha("Revoada de Serpes", "Ferrão com botão \"Envenenado\"."),
			linha("Parvathar", "Aspirar gasta 3 PM ao usar; Assoprar com rolagem manual."),
			linha("Parceiro Masaru", "Opções no ataque: iniciante (+2) e veterano (+3d6)."),
			linha("Pomada Protetora", "Botão de RD 5 até o fim da cena."),
			linha("Testes estendidos", "Burocracia Arcana, Travessia do Pântano, Jogo de Influências e Desmoronamento: macro CdR · Teste estendido. Pântano: tabela de eventos 1d12. Batalha aérea: macro A4 · Ases nas Alturas.")
		]) }
	]) },
	{ name: "A4 · Roteiro", folder: pasta.JournalEntry.id, flags: FLAGS("roteiro"), pages: paginas(roteiro) },
	{ name: "A4 · Documentos para os jogadores", folder: pasta.JournalEntry.id, flags: FLAGS("documentos"), pages: documentos.map(([n, t], i) => ({ name: n, type: "text", sort: (i + 1) * 100, title: { show: true, level: 1 }, text: { content: `<p>${t}</p>`, format: 1 } })) }
]);

const ulr = (arr) => (arr.length ? `<ul>${arr.map((x) => `<li>${x}</li>`).join("")}</ul>` : "<p>—</p>");
ChatMessage.create({
	whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id),
	content: `<h3>${NOME_PASTA}</h3><p><b>Criados (${relatorio.criados.length}):</b></p>${ulr(relatorio.criados)}` + (relatorio.avisos.length ? `<p><b>Avisos:</b></p>${ulr(relatorio.avisos)}` : "")
});
