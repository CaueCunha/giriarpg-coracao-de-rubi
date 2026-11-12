/* =====================================================================
 * CORAÇÃO DE RUBI · AVENTURA 1 · "FORJA DE HERÓIS"
 * Gerador de conteúdo para Foundry VTT v14 + sistema Tormenta20 (Vizael 1.6.x)
 *
 * Fonte do compêndio do módulo giriarpg-coracao-de-rubi (o build roda este arquivo num Foundry
 * simulado). Também funciona como macro de Script, colado inteiro e executado pelo Mestre.
 * Cria, na pasta "A1 · Forja de Heróis" de cada tipo:
 *  • 7 ameaças novas do livro (pp. 26–27): Estátua Animada, Mamãe Glop, Zelin Alexevich, Milla Hofforva,
 *    Ruschel Vodorov, Igor Raitter e Stagh. As criaturas do livro básico (glop, bandido, chefe bandido,
 *    gorlogg, aranha gigante, turba zumbi) não são copiadas: o roteiro aponta para as fichas do Giria T20.
 *  • 6 perigos e testes (Caixotes Perigosos, Forja da Oficina Kanpeki, Investigação na Fim do Mundo,
 *    Propina no Portão Sul, Interrogatório dos Mercenários e O Julgamento) como atores do tipo Perigo.
 *  • Itens: insígnias da Guilda, éter elemental (frio), a gema e a carta de Peter, a amostra de aço-rubi
 *    de Ezequias e o parceiro Ezequias (Emboscada Reversa).
 *  • Tabela: Pistas na Taverna Fim do Mundo (1d6).
 *  • Macro A1 · O Julgamento (5 sucessos antes de 3 falhas, grupos de apelo alternados, testemunhas +1d6).
 *  • Diários: Como usar no Foundry, Roteiro, Quadro de Serviços (para os jogadores), Ezequias Heldret e
 *    Documentos para os jogadores.
 * Rodar de novo apaga (depois de confirmar) o que tem a marca flags.world.cdr = "a1" e recria tudo.
 *
 * Os links @GIRIA[nome|livro] viram links para o compêndio do Giria T20 no build do módulo.
 * Fichas conferidas com o livro Coração de Rubi, pp. 13–27.
 * ===================================================================== */
if (!game.user.isGM) return ui.notifications.error("Só o Mestre pode rodar este gerador.");

const TAG = "a1";
const FLAGS = (role) => ({ world: role ? { cdr: TAG, cdrRole: role } : { cdr: TAG } });
const NOME_PASTA = "A1 · Forja de Heróis";
const FONTE = "Coração de Rubi — Forja de Heróis";
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
		window: { title: "Aventura 1: recriar conteúdo" },
		content: `<p>Já existem <b>${antigos.length}</b> documentos gerados para a Aventura 1.</p>
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
		flags: { tormenta20: { coracaoDeRubi: "aventura1" }, world: { cdr: TAG, ...(a?.automacoes ? { cdrAutomacoes: a.automacoes } : {}) } }
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
		flags: { tormenta20: { coracaoDeRubi: "aventura1" }, world: { cdr: TAG } }
	});
	relatorio.criados.push(`Perigo: ${h.nome}`);
	return actor;
}

// ---------------------------------------------------------------------------
// Ameaças (livro, pp. 26–27)
// ---------------------------------------------------------------------------
IMG.bastarda = EQ("espada-bastarda");
IMG.gelo = "icons/magic/symbols/elements-air-earth-fire-water.webp";
IMG.acido = GER("acido");
IMG.marca = HAB("visao-ampla");
IMG.impeto = "icons/svg/wingfoot.svg";
IMG.mira = "icons/svg/target.svg";
IMG.raio = HAB("magias");

const AMEACAS = [
	{
		nome: "Estátua Animada", nd: "2", tipo: "con", tamanho: "med", img: ICONE("gargula"),
		atr: { for: 4, des: -1, con: 4, int: 0, sab: 0, car: -4 },
		pv: 70, defesa: 19, desl: 6, cd: 16, sentidos: ["escuro"],
		pericias: { inic: 2, perc: 4, fort: 13, refl: 2, vont: 7, luta: 12 },
		ataquescac: "Pancada +12 (2d6+11).",
		bio: "Construto sem consciência (Int —), criado para guardar a câmara anã das Minas Heldret. Tarefa \"Investigação nas Minas Heldret\" (x2): atacam quando um personagem chega ao centro da sala de 18 × 18 m, não saem dela e voltam ao lugar se todos saírem. Se metade do grupo cair, Haldor e os ajudantes arrastam os caídos para fora.",
		itens: () => [
			arma("Pancada", {
				img: IMG.pancada, dano: "2d6+11", tipo: "impacto",
				desc: P("Quem sofre dano fica atordoado (Fort CD 16 evita), uma vez por cena por criatura."),
				efeitos: [efCondicao("atordoado", { rodadas: 1 })]
			}),
			habilidade("Golpe Atordoante", "Uma criatura que sofra dano da pancada da estátua animada fica atordoada (Fort CD 16 evita). Uma criatura só pode ser atordoada por essa habilidade uma vez por cena.<br><b>Automação:</b> no cartão da Pancada, aplique \"Atordoado (1 rodada)\" em quem falhar; ele some sozinho.", { img: IMG.atordoar, resistencia: "Fortitude evita" })
		]
	},
	{
		nome: "Mamãe Glop", nd: "2", tipo: "mon", tamanho: "gra", img: ICONE("glop"), automacoes: { meiose: { ator: "Glop", giria: "@GIRIA_UUID[Glop|T20]" } },
		atr: { for: 2, des: -1, con: 2, int: 0, sab: -3, car: -3 },
		pv: 70, defesa: 17, desl: 9, sentidos: ["cegas"], imune: ["acido"], resistencias: "imunidade a ácido",
		pericias: { inic: 2, perc: -1, fort: 13, refl: 7, vont: 2, luta: 12 },
		ataquescac: "Pancada +12 (2d6+2 mais 2d6 ácido).",
		tesouro: "Padrão.",
		bio: "Glop do tamanho de uma carroça, prestes a se dividir (Int —). Parte 1, Cena 5: surge com o barulho dos caixotes. Sobrevivência CD 16 revela que é uma \"mamãe glop\". Está sempre com 1d4 glops filhinhos; nem eles nem os da Meiose Glópica rendem XP.",
		itens: () => [
			arma("Pancada", {
				img: IMG.pancada, dano: "2d6+2", tipo: "impacto", desc: P("Mais 2d6 de ácido (entra sozinho no dano)."),
				efeitos: [efUso("Ácido", [["dano", "2d6[acido]"]], { automatic: true, img: IMG.acido, desc: "+2d6 de ácido." })]
			}),
			habilidade("Glops Filhinhos", "A mamãe glop está sempre acompanhada por 1d4 glops, que a protegem instintivamente. Esses glops, assim como os gerados pela Meiose Glópica, não rendem pontos de experiência.", { img: ICONE("glop"), rolls: [rolagemFormula("Glops filhinhos", "1d4")] }),
			habilidade("Meiose Glópica", "Quando ameaçada, a mamãe pode gerar outros glops filhinhos para protegê-la. No início de cada turno da mamãe, role um dado. Em um resultado par, um glop surge num espaço adjacente a ela. Ele age normalmente, no turno da mamãe, a partir da próxima rodada.<br><b>Automação:</b> em combate, o módulo rola o dado no início do turno dela e, no par, põe um glop ao lado e no combate (usa o ator \"Glop\" do mundo ou o do Giria T20).", { img: ICONE("glop"), execucao: "free", rolls: [rolagemFormula("Meiose (par = novo glop)", "1d6")] })
		]
	},
	{
		nome: "Zelin Alexevich", nd: "2", tipo: "hum", raca: "Humano", tamanho: "med", img: ICONE("cavaleiro-supremacista"),
		atr: { for: 4, des: 3, con: 3, int: 1, sab: 2, car: 1 },
		pv: 70, defesa: 19, desl: 9,
		pericias: { inic: 10, perc: 8, fort: 11, refl: 8, vont: 5, luta: 13, atle: 7 },
		ataquescac: "Espada bastarda +13 (1d10+6, 19) e espada curta +12 (1d6+4, 19).",
		equipamento: "Couro batido reforçado, espada bastarda certeira, espada curta.",
		tesouro: "Dobro.",
		bio: "O \"Lobo de Ferro\", braço direito de Rodford. Humano alto e musculoso, cabelo curto militar, cicatriz em X no queixo; fala baixo e nunca sorri. Desertor purista. Parte 3, Cena 3 (Emboscada Reversa), com Milla, Ruschel e Igor. Leal a Rodford e difícil de intimidar. Se ele ou mais da metade do bando cair, o resto se rende.",
		itens: () => [
			arma("Espada bastarda", { img: IMG.bastarda, extra: 0, dano: "1d10+6", tipo: "corte", critM: 19, proficiencia: "exotica", desc: P("Certeira (já no ataque).") }),
			arma("Espada curta", { img: IMG.espadaCurta, extra: -1, dano: "1d6+4", tipo: "perfuracao", critM: 19, proficiencia: "simples" }),
			habilidade("Ímpeto", "Uma vez por rodada, Zelin aumenta seu deslocamento em +6m até o fim do turno. Recarga (reduzir uma criatura a 0 PV).", { img: IMG.impeto, execucao: "free" }),
			habilidade("Marca da Presa", "Zelin analisa uma criatura em alcance curto. Até o fim da cena, ele recebe +1d8 nas rolagens de dano contra essa criatura. Se a criatura for um humanoide não humano, esse bônus aumenta para +2d8.<br><b>Automação:</b> no ataque (Shift+clique), marque a opção da presa.", {
				img: IMG.marca, execucao: "move", alcance: "short", duracao: { value: 0, units: "scene", special: "" },
				efeitos: [
					efUso("Marca da Presa (+1d8)", [["dano", "1d8"]], { types: ["attack"], img: IMG.marca, desc: "Alvo marcado: +1d8 no dano." }),
					efUso("Marca da Presa, humanoide não humano (+2d8)", [["dano", "2d8"]], { types: ["attack"], img: IMG.marca, desc: "Alvo marcado e humanoide não humano: +2d8 no dano." })
				]
			})
		]
	},
	{
		nome: "Milla Hofforva", nd: "1", tipo: "hum", raca: "Humana", tamanho: "med", img: ICONE("necromante-veterano"),
		atr: { for: 0, des: 2, con: 2, int: 4, sab: 0, car: 1 },
		pv: 30, pm: 19, defesa: 14, desl: 9, cd: 16,
		pericias: { inic: 4, perc: 2, fort: 0, refl: 5, vont: 11, conh: 6, mist: 8 },
		magias: ["Armadura Arcana", "Seta Infalível", "Bola de Fogo", "Dissipar Magia"],
		tesouro: "Dobro.",
		bio: "Maga militar do bando de Zelin, ex-aluna da Academia Magibélica: coque impecável, olhar frio, casaco militar com o broche da academia. Lança magias como uma maga de 5º nível (CD 16). Parte 3, Cena 3.",
		itens: () => [
			habilidade("Arcano de Batalha", "Milla soma sua Inteligência nas rolagens de dano com magias e com seu raio arcano (já contabilizado no raio).<br><b>Automação:</b> +4 entra sozinho no dano de Seta Infalível e Bola de Fogo.", {
				img: IMG.arcano, efeitos: [efUso("Arcano de Batalha", [["dano", 4]], { automatic: true, types: [], names: ["Seta Infalível", "Bola de Fogo"], img: IMG.arcano, desc: "+4 no dano de magias." })]
			}),
			habilidade("Raio Arcano", "Uma criatura em alcance curto sofre 2d6+4 pontos de dano de essência (Ref CD 16 reduz à metade).", {
				img: IMG.raio, execucao: "action", alcance: "short", resistencia: "Reflexos reduz à metade", rolls: [rolagemDano("Dano", "2d6+4", "essencia")]
			})
		]
	},
	{
		nome: "Ruschel Vodorov", nd: "1", tipo: "hum", raca: "Humano", tamanho: "med", img: ICONE("soldado-supremacista"),
		atr: { for: 2, des: 4, con: 2, int: 0, sab: 2, car: -1 },
		pv: 35, defesa: 19, desl: 9,
		pericias: { inic: 11, perc: 7, fort: 5, refl: 9, vont: 2, luta: 7, pont: 9 },
		ataquescac: "Espada longa +7 (1d8+4, 19).", ataquesad: "Besta pesada +9 (1d12+6, 18).",
		equipamento: "Besta pesada precisa, couraça, espada longa, virotes x20.",
		tesouro: "Dobro.",
		bio: "Atirador de elite do bando de Zelin. Armadura de aço escuro e elmo que parece um chapéu de metal; se comunica por gestos e assovios. Parte 3, Cena 3.",
		itens: () => [
			arma("Espada longa", { img: IMG.espada, dano: "1d8+4", tipo: "corte", critM: 19, proficiencia: "marcial" }),
			arma("Besta pesada", { img: IMG.besta, pericia: "pont", dano: "1d12+6", tipo: "perfuracao", critM: 18, alcance: "medium", proposito: "disparo", proficiencia: "simples", desc: P("Precisa (já na margem de ameaça).") }),
			habilidade("Mira Apurada", "Quando usa a ação mirar, Ruschel recebe +2 em testes de ataque e na margem de ameaça com ataques à distância até o fim do turno.<br><b>Automação:</b> depois de mirar, Shift+clique na besta e marque \"Mira Apurada\".", {
				img: IMG.mira, efeitos: [efUso("Mira Apurada", [["ataque", 2], ["criticoM", -2]], { names: ["Besta pesada"], img: IMG.mira, desc: "Mirou: +2 no ataque e na margem de ameaça." })]
			}),
			habilidade("Recarga Rápida", "Ruschel recarrega sua besta pesada com uma ação de movimento.", { img: IMG.besta, execucao: "move" })
		]
	},
	{
		nome: "Igor Raitter", nd: "1", tipo: "hum", raca: "Humano", tamanho: "med", img: ICONE("capelao-de-guerra"),
		atr: { for: 2, des: 0, con: 3, int: 1, sab: 4, car: 2 },
		pv: 40, pm: 19, defesa: 21, desl: 6, cd: 18,
		pericias: { inic: 3, perc: 7, fort: 7, refl: 2, vont: 13, luta: 10 },
		ataquescac: "Martelo de guerra +10 (1d8+6, x3).",
		equipamento: "Escudo leve reforçado, martelo de guerra, meia armadura reforçada, símbolo sagrado.",
		magias: ["Arma Espiritual", "Curar Ferimentos", "Escudo da Fé", "Oração", "Soco de Arsenal"],
		tesouro: "Dobro.",
		bio: "Capelão do bando de Zelin, devoto do Templo da Pureza Divina (emblema no escudo). Alto, queixo quadrado, cabelo negro penteado para trás; fanático mesmo depois de desertar. Lança magias como um clérigo de 5º nível (CD 18). Parte 3, Cena 3.",
		itens: () => [arma("Martelo de guerra", { img: IMG.martelo, dano: "1d8+6", tipo: "impacto", critX: 3, proficiencia: "marcial" })]
	},
	{
		nome: "Stagh", nd: "3", tipo: "esp", raca: "Elemental", tamanho: "peq", img: IMG.gelo,
		atr: { for: 2, des: 3, con: 3, int: -4, sab: 1, car: -1 },
		pv: 35, defesa: 22, desl: 9, escalar: 9, sentidos: ["escuro"], imune: ["frio"], vulneravel: ["fogo"], ic: ["atordoado", "paralisado", "fatigado"],
		resistencias: "imunidade a acertos críticos e a atordoamento, cansaço, frio, metabolismo e paralisia; vulnerabilidade a fogo",
		pericias: { inic: 6, perc: 4, fort: 7, refl: 12, vont: 4, luta: 16 },
		ataquescac: "Duas garras +16 (1d6+4 mais 1d6 frio).",
		tesouro: "1 dose de éter elemental (frio) (CD 18 para extrair).",
		bio: "Pequeno elemental de gelo que lembra uma aranha de cristal, comum perto das Uivantes. Tarefa \"Amansar Espírito do Gelo\" (Oficina Beluhga): derrotado em até 4 rodadas, volta ao cristal. A partir da 5ª rodada destrói a oficina (recompensa pela metade). Se dois personagens caírem, Pen-Pen interrompe e o cristal se perde. Como familiar, um stagh concede +1 na CD de magias de frio.",
		itens: () => [
			arma("Garra", { img: IMG.garra, dano: "1d6+4", tipo: "corte", desc: P("Duas garras por ação. Mais 1d6 de frio (entra sozinho no dano)."), efeitos: [efUso("Frio", [["dano", "1d6[frio]"]], { automatic: true, img: IMG.gelo, desc: "+1d6 de frio." })] }),
			habilidade("Aura de Frio", "No início de cada turno do stagh, todas as criaturas em alcance curto sofrem 1d6+3 pontos de dano de frio (Fort CD 17 reduz à metade).<br><b>Automação:</b> role o dano no início do turno dele e aplique metade em quem passar.", {
				img: IMG.gelo, alcance: "short", resistencia: "Fortitude reduz à metade", rolls: [rolagemDano("Dano", "1d6+3", "frio")]
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
		nome: "Caixotes Perigosos", nd: "1", local: "Parte 1, Cena 4 (armazém da Fundição Central)",
		goal: P("Atravessar o corredor bagunçado pelos glops sem que os caixotes enormes desabem. Percepção CD 15 nota as caixas deslizando para a beirada."),
		effects: P(
			`<b>Caixotes em Queda</b> (ninguém percebeu): desabam sobre o grupo desprevenido. Reflexos CD 20; quem falhar sofre ${R("2d6", "impacto")} de impacto.`,
			`<b>Caixotes Instáveis</b> (alguém percebeu): cada personagem tem uma rodada para agir: correr dali (Atletismo CD 20), passar devagar sem esbarrar (Acrobacia CD 20) ou uma solução criativa (Eclético, Especialista, <i>Teia</i> segurando os caixotes). Quem falhar sofre metade: ${R("1d6", "impacto")}.`
		),
		actions: P("O barulho atrai a Mamãe Glop (Cena 5).")
	},
	{
		nome: "Forja da Oficina Kanpeki", nd: "1", local: "Parte 2, tarefa \"Auxílio em Manufatura\" (Goro Okazaki)",
		goal: P("Ajudar Goro a terminar a espada: operar o fole, segurar a lâmina na têmpera, preparar os óleos. Teste estendido com perícias diferentes (Atletismo, Ofício, Fortitude...), CD 15, 3 sucessos. Falha total estraga a espada."),
		effects: P(`<b>Arruaceiros:</b> depois da primeira parte, ${G("Bandido", "6 bandidos")} invadem. Dois personagens continuam ajudando Goro (ação completa e um teste por rodada; mais 3 sucessos terminam a espada) enquanto o resto luta. Trocar de função custa uma ação completa. Com metade dos bandidos derrotada, a gangue foge.`),
		actions: P("Espada pronta e oficina protegida: Goro dobra a recompensa (T$ 60 por pessoa) e fica em dívida de honra. Espada estragada: metade da recompensa. Anote o resultado (testemunha no julgamento).", "<b>Automação:</b> use a macro CdR · Teste estendido (CD 15, 3 sucessos).")
	},
	{
		nome: "Investigação na Fim do Mundo", nd: "1", local: "Parte 2, tarefa \"Investigação de Contrabando\" (Distrito da Bigorna)",
		goal: P("Investigar a taverna dos goblins do Príncipe da Pólvora Galix. Cada jogador descreve como investiga; teste estendido com perícias relacionadas, cada perícia só uma vez pelo grupo, CD 15. Cada sucesso revela uma pista (tabela \"A1 · Pistas na Taverna Fim do Mundo\", 1d6). Três falhas: o grupo é expulso por ser enxerido."),
		effects: P("Violência é crime dentro da cidade e pouco louvável."),
		actions: P("Levar as provas à Sede da Guarda: T$ 200. Fingir que não achou nada: Galix fica devendo um favor (testemunha no julgamento). Anote a escolha.")
	},
	{
		nome: "Propina no Portão Sul", nd: "2", local: "Parte 2, tarefa \"Reforço nas Muralhas\" (Sargento Elias Fletcher)",
		goal: P("Fletcher trouxe o grupo como guarda-costas para cobrar propina de contrabandistas. O grupo escolhe entre ajudar ou prender os bandidos."),
		effects: P(
			"<b>Ajudar na negociação:</b> teste estendido de Intimidação CD 16, 3 sucessos (Fletcher pode fazer um dos testes, com Intimidação +6). Sucesso: Fletcher paga T$ 100 a mais por personagem. Falha: os bandidos atacam.",
			`<b>Prender os bandidos:</b> ${G("Bandido", "6 bandidos")} e ${G("Chefe Bandido", "chefe bandido")}. Fletcher e dois guardas lutam como aliados iniciantes do tipo @UUID[Compendium.tormenta20.parceiros.Item.Un1h4jcM8qtf4F8L]{Guardião}. Derrotados, os bandidos se entregam.`
		),
		actions: P("Anote a escolha (os guardas do Portão Sul testemunham no julgamento se o grupo prendeu os contrabandistas).")
	},
	{
		nome: "Interrogatório dos Mercenários", nd: "2", local: "Parte 3, Cena 4 (manhã depois da emboscada)",
		goal: P("Arrancar dos capangas a ordem de Rodford. Zelin é leal e difícil de intimidar; os outros podem abrir o bico."),
		effects: P("Cada personagem faz um teste de perícia diferente, CD 20, explicando como usa a perícia (Diplomacia, Intimidação, Investigação para achar ordens ou pagamentos...)."),
		actions: P("Anote cada resultado positivo. Depois, Ezequias volta a Yuvalin e acusa Rodford Varhim em público: o caso vai a julgamento.")
	},
	{
		nome: "O Julgamento", nd: "3", local: "Parte 3, Cena 6 (Conselho da Guilda dos Mineradores)",
		goal: P("Convencer o Conselho dos crimes de Rodford: 5 sucessos antes de 3 falhas."),
		effects: P(
			"<b>Rodada:</b> um personagem faz uma arguição, escolhe o apelo e a perícia e justifica. Não pode usar uma perícia do mesmo grupo do jogador anterior.",
			"<b>Apelo Racional:</b> Conhecimento, Diplomacia, Investigação, Nobreza. <b>Apelo Emocional:</b> Atuação, Enganação, Intimidação, Intuição.",
			"<b>CD pela justificativa:</b> fraca 22, honesta 17, espetacular 12.",
			`<b>Testemunhas</b> (Cena 5): cada uma vale ${R("1d6")} somado a um teste, decidido depois de rolar e antes do resultado.`
		),
		actions: P("Culpado: Rodford pega prisão perpétua e Ezequias vira presidente (Epílogo). Absolvido: o grupo e Ezequias são banidos para o \"Estábulo\" e precisam limpar o nome (quadro \"Derrota no Tribunal\").", "<b>Automação:</b> macro A1 · O Julgamento.")
	}
];

// ---------------------------------------------------------------------------
// Itens da aventura
// ---------------------------------------------------------------------------
function itensDaAventura() {
	const tesouro = (nome, desc, { qtd = 1, preco = 0, img = "icons/svg/item-bag.svg" } = {}) => ({ name: nome, type: "tesouro", img, system: { description: { value: P(desc) }, source: FONTE, qtd, preco } });
	const parc = (n, id) => `@UUID[Compendium.tormenta20.parceiros.Item.${id}]{${n}}`;
	return [
		tesouro("Insígnia da Guilda: Quartzo", "Broche prateado com o brasão da Guilda dos Mineradores e um pequeno cristal opaco com a palavra \"quartzo\". Licença temporária de aventureiro em treinamento (Parte 1).", { img: GER("insignia-milicia") }),
		tesouro("Insígnia da Guilda: Topázio", "Aventureiro oficial, profissional. Permite aceitar as tarefas do Quadro de Serviços (Parte 2).", { img: GER("insignia-milicia") }),
		tesouro("Insígnia da Guilda: Coríndon", "Aventureiro de elite. Recebida ao somar ND 10 em tarefas do quadro (Parte 3).", { img: GER("insignia-do-exercito") }),
		{
			name: "Éter Elemental (frio)", type: "consumivel", img: GER("gelo-eterno"),
			effects: [efUso("Éter elemental (frio)", [["dano", "1d4[frio]"]], { types: ["attack"], img: GER("gelo-eterno"), desc: "+1d4 de frio até o fim da cena." })],
			system: {
				description: { value: P("Tirado de um stagh (CD 18 para extrair). Você pode gastar uma ação padrão para aplicar este éter em uma arma ou munição, que causará +1d4 pontos de dano de frio até o fim da cena.", "<b>Automação:</b> com o éter na ficha, Shift+clique no ataque e marque a opção durante a cena. Gaste a dose (quantidade) ao aplicar.") },
				source: FONTE, qtd: 1, preco: 60, ativacao: { execucao: "action" }
			}
		},
		tesouro("Gema do Sr. P", "Gema preciosa embrulhada no pacote do porto (tarefa \"Coleta e Entrega de Encomenda\"). Um Ofício relevante diz que vale T$ 500. Junto dela, a carta de amor de Peter Varhim (veja \"Documentos para os jogadores\").", { img: GER("gemas-preciosas"), preco: 500 }),
		tesouro("Amostra de aço-rubi de Ezequias", "Pepita metálica carmesim que Ezequias tira do bolso no discurso de posse: veio das minas do sul, onde também acharam indícios de uma oficina anã com os segredos para trabalhar o metal. Gancho para a Aventura 2.", { img: GER("aco-rubi") }),
		{
			name: "Parceiro: Ezequias (Emboscada Reversa)", type: "poder", img: "icons/svg/mystery-man.svg",
			system: {
				description: { value: P(
					"Só na Parte 3, Cena 3. No início do combate, Ezequias usa uma engenhoca que deixa os inimigos @STATUS[ofuscado] na primeira rodada.",
					`Depois disso, até o fim da cena, ele serve como parceiro ${parc("Destruidor", "FIJfKOIU8dzbvSDG")}, ${parc("Magivocador", "EBDU8TfXg0iVLvCT")} e ${parc("Médico", "rntcrujiIc63hKOp")} iniciante.`,
					"Arraste para a ficha de um personagem durante a luta e apague depois."
				) },
				source: FONTE, tipo: "ability", ativacao: { execucao: "passive", custo: 0 }
			}
		}
	];
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------
const pastaAmeacas = await subpasta("Ameaças", "Actor");
const pastaPerigos = await subpasta("Perigos e Testes", "Actor");

const fichas = {};
for (const a of AMEACAS) fichas[a.nome] = await criarAmeaca(a, pastaAmeacas);
for (const h of PERIGOS) fichas[h.nome] = await criarPerigo(h, pastaPerigos);

const itens = itensDaAventura().map((i) => ({ ...i, folder: pasta.Item.id, flags: { ...(i.flags ?? {}), world: { ...(i.flags?.world ?? {}), cdr: TAG } } }));
for (const i of await Item.implementation.createDocuments(itens)) relatorio.criados.push(`Item: ${i.name}`);

// Tabela
const PISTAS = [
	["Cozinha de fachada", "Apesar de ter uma \"Cozinha\" nos fundos, a taverna serve apenas bebidas. Sempre que algum prato é pedido, os funcionários dizem que o suprimento acabou."],
	["Visitantes suspeitos", "A taverna recebe vários visitantes suspeitos, que não raramente são levados para os fundos e saem com pacotes estranhos."],
	["Fuligem preta", "Uma fuligem preta pelo chão da taverna. Um personagem treinado em Ofício (alquimia) percebe que é pólvora."],
	["Príncipe da Pólvora", "O dono da taverna é chamado pelos frequentadores de \"Príncipe da Pólvora Galix\"."],
	["Monopólio, não crime", "Nenhum dos produtos vendidos pela gangue de Galix é realmente ilegal, apenas controlado como monopólio pela Guilda."],
	["Proteção paga", "Galix diz com todas as letras que não entende por que a Guilda poria aventureiros em seu encalço, já que ele paga muito bem pela \"proteção\" dos agentes da Guilda."]
];
const tabela = await RollTable.implementation.create({
	name: "A1 · Pistas na Taverna Fim do Mundo", img: "icons/svg/tankard.svg", folder: pasta.RollTable.id, flags: FLAGS("pistasGalix"),
	formula: "1d6", replacement: true, displayRoll: true,
	description: "Um sucesso no teste estendido (CD 15, cada perícia uma vez pelo grupo) revela uma pista. Role de novo se repetir.",
	results: PISTAS.map(([nome, desc], i) => ({ type: "text", range: [i + 1, i + 1], weight: 1, name: nome, description: desc }))
});
relatorio.criados.push(`Tabela: ${tabela.name}`);

// Macro do julgamento
const JULGAMENTO = String.raw`// A1 · O Julgamento: 5 sucessos antes de 3 falhas (Forja de Heróis, Parte 3, Cena 6).
// Selecione o token de quem faz a arguição e rode. O placar e as testemunhas ficam salvos no mundo.
if (!game.user.isGM) return ui.notifications.warn("Só o mestre roda esta macro.");
const { DialogV2 } = foundry.applications.api;
const FLAG = "cdrJulgamento";
const GRUPOS = { racional: ["conh", "dipl", "inve", "nobr"], emocional: ["atua", "enga", "inti", "intu"] };
const CDS = { fraca: 22, honesta: 17, espetacular: 12 };
const nome = (id) => { const v = CONFIG.T20?.pericias?.[id]; return game.i18n.localize(typeof v === "string" ? v : v?.label ?? id); };
let st = foundry.utils.deepClone(game.user.getFlag("world", FLAG) ?? { s: 0, f: 0, ultimo: null, testemunhas: 0, fim: false });
const placar = () => "<b>" + st.s + "/5</b> sucessos, <b>" + st.f + "/3</b> falhas, " + st.testemunhas + " testemunha(s) restante(s)";
actor = canvas.tokens.controlled[0]?.actor ?? null;
const opcoes = Object.entries(GRUPOS).map(([g, ps]) => '<optgroup label="Apelo ' + (g === "racional" ? "Racional" : "Emocional") + '">' + ps.map((p) => '<option value="' + g + ":" + p + '"' + (st.ultimo === g ? " disabled" : "") + ">" + nome(p) + "</option>").join("") + "</optgroup>").join("");
const content = "<p>" + placar() + (st.ultimo ? " · o último apelo foi <b>" + st.ultimo + "</b>: agora use o outro grupo." : "") + "</p>" +
	'<label>Perícia <select name="pericia">' + opcoes + "</select></label>" +
	'<label>Justificativa <select name="just"><option value="fraca">Fraca (CD 22)</option><option value="honesta" selected>Honesta (CD 17)</option><option value="espetacular">Espetacular (CD 12)</option></select></label>' +
	'<label>Testemunhas recrutadas (Cena 5) <input type="number" name="test" value="' + st.testemunhas + '" min="0"></label>';
const r = await DialogV2.wait({
	window: { title: "O Julgamento" }, content, rejectClose: false,
	buttons: [
		{ action: "rolar", label: actor ? "Rolar (" + actor.name + ")" : "Selecione um token", default: true, callback: (e, b) => ({ a: "rolar", f: b.form.elements }) },
		{ action: "zerar", label: "Recomeçar", callback: (e, b) => ({ a: "zerar", f: b.form.elements }) }
	]
});
if (!r) return;
if (r.a === "zerar") {
	await game.user.setFlag("world", FLAG, { s: 0, f: 0, ultimo: null, testemunhas: Number(r.f.test.value) || 0, fim: false });
	return ui.notifications.info("Julgamento recomeçado.");
}
if (!actor) return ui.notifications.warn("Selecione o token de quem faz a arguição.");
if (st.fim) return ui.notifications.warn("O julgamento já terminou. Use Recomeçar.");
st.testemunhas = Number(r.f.test.value) || 0;
const [grupo, pericia] = r.f.pericia.value.split(":");
const cd = CDS[r.f.just.value];
const roll = await new Roll("1d20 + " + (actor.system.pericias?.[pericia]?.value ?? 0)).evaluate();
let total = roll.total;
let extra = "";
if (total < cd && st.testemunhas > 0) {
	const usar = await DialogV2.confirm({ window: { title: "Testemunha" }, content: "<p>" + actor.name + " tirou <b>" + total + "</b> contra CD " + cd + ". Gastar uma testemunha (+1d6)?</p>" });
	if (usar) {
		const d6 = await new Roll("1d6").evaluate();
		total += d6.total;
		st.testemunhas -= 1;
		extra = " + testemunha " + d6.total;
	}
}
const ok = total >= cd;
if (ok) st.s += 1; else st.f += 1;
st.ultimo = grupo;
let veredito = "";
if (st.s >= 5) { st.fim = true; veredito = "<p><b>Culpado!</b> Rodford é sentenciado à prisão perpétua. Vá para o Epílogo.</p>"; }
else if (st.f >= 3) { st.fim = true; veredito = "<p><b>Absolvido.</b> Rodford bane o grupo e Ezequias da cidade (Derrota no Tribunal).</p>"; }
await game.user.setFlag("world", FLAG, st);
ChatMessage.create({
	speaker: ChatMessage.getSpeaker({ actor }),
	whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id),
	content: "<h3>O Julgamento</h3><p>Apelo " + grupo + ", " + nome(pericia) + ", CD " + cd + ": <b>" + roll.total + extra + " = " + total + "</b> → " + (ok ? "sucesso" : "falha") + ".</p><p>" + placar() + "</p>" + veredito
});`;
await Macro.implementation.create({ name: "A1 · O Julgamento", type: "script", scope: "global", img: "icons/svg/statue.svg", folder: pasta.Macro.id, flags: FLAGS("julgamento"), command: JULGAMENTO });
relatorio.criados.push("Macro: A1 · O Julgamento");

// ---------------------------------------------------------------------------
// Diários
// ---------------------------------------------------------------------------
const L = (n, rotulo) => (fichas[n] ? `@UUID[${fichas[n].uuid}]{${rotulo ?? n}}` : rotulo ?? n);
const linha = (local, txt) => `<li><b>${local}:</b> ${txt}</li>`;
const ul = (arr) => `<ul>${arr.join("")}</ul>`;
const paginas = (lista) => lista.map((pg, i) => ({ name: pg.name, type: "text", sort: (i + 1) * 100, title: { show: true, level: 1 }, text: { content: pg.html, format: 1 } }));

const roteiro = [
	{ name: "Visão geral", html: P(
		"<b>Forja de Heróis</b> (livro, pp. 13–27). Personagens de 1º nível, terminam no 4º. Apresenta Ezequias Heldret e o plano de destruir a área de Tormenta ao norte de Zakharov.",
		"<b>Parte 1:</b> exame de admissão da Guilda dos Mineradores (Quartzo → Topázio). <b>Parte 2:</b> tarefas do Quadro de Serviços até somar ND 10 (Topázio → Coríndon). <b>Parte 3:</b> Ezequias, a emboscada de Zelin e o julgamento de Rodford Varhim.",
		"Com a variante de marcos, os personagens sobem de nível ao fim de cada parte.",
		"<b>Anote o resultado de cada tarefa:</b> ele decide as testemunhas do julgamento."
	) },
	{ name: "Parte 1 — Vida de Aventureiro", html: ul([
		linha("Cena 1 — Recrutamento", "Sede da Guilda, Distrito da Forja. Os jogadores contam por que querem a licença. A oficial Helena leva o grupo; cada um recebe o pergaminho e a Insígnia da Guilda: Quartzo. Tarefa: infestação na Fundição Central, em dois dias (mostre o mapa da p. 7)."),
		linha("Cena 2 — O Teste", "Mestre da Forja Himmerzan (careca, seco, não responde perguntas). Cada personagem faz Conhecimento, Diplomacia, Intimidação ou Investigação; sorteie uma informação com CD ≤ resultado: <b>CD 10</b> ratos e criaturas vêm nos carros de transporte; <b>CD 15</b> três operários feridos com queimaduras estranhas; <b>CD 15</b> um sobrevivente sentiu dor de ácido na perna; <b>CD 20</b> Himmerzan substituiu um mestre na Guerra Purista, rumores de que é oficial purista."),
		linha("Cena 3 — Entranhas da Fundição", `Portas trancadas atrás do grupo. Percepção CD 10 ou surpreendido. ${G("Glop", "4 glops")}. Rastro de gosma verde até o fundo.`),
		linha("Cena 4 — Caixotes Perigosos", L("Caixotes Perigosos")),
		linha("Cena 5 — Mamãe Glop", `${L("Mamãe Glop")} + ${G("Glop", "1d4 glops filhinhos")} (sem XP). Sobrevivência CD 16 explica a mamãe. Vitória: promoção a Topázio.`)
	]) },
	{ name: "Parte 2 — Trabalho Duro", html: P(
		"O grupo escolhe um nome de esquadrão e pega tarefas do mural (o diário \"A1 · Quadro de Serviços\" tem os cartazes para mostrar aos jogadores). Nível de perigo = ND. Ao somar ND 10, o grupo é chamado para virar Coríndon (Parte 3). Descanso entre tarefas à vontade, mas esperar demais pode custar missões."
	) + ul([
		linha("Amansar Espírito do Gelo (ND 3, T$ 200)", `Pen-Pen (Penellope Pendragon), anã de barba azul, Oficina Beluhga. ${L("Stagh")}: em até 4 rodadas volta ao cristal; da 5ª em diante, recompensa pela metade; dois caídos e Pen-Pen interrompe (sem recompensa). Tesouro: ${L("Stagh", "éter elemental (frio)")}.`),
		linha("Auxílio em Manufatura (ND 1, T$ 30/pessoa)", `Goro Okazaki, Oficina Kanpeki. ${L("Forja da Oficina Kanpeki")}. Gangue paga pela Guilda (a oficina não é afiliada).`),
		linha("Caçada Exótica (ND 2, T$ 120/cauda)", `Chef Rizzelena, Taverna Pombo de Ouro. Margem do Rio Panteão (Porto Vharim): Sobrevivência CD 15 para achar; falha = emboscada (Percepção CD 15 ou surpreendido). ${G("Gorlogg", "2 gorloggs")}; a cada 2 rodadas, 1d4: no 1 surge outro (até 2 vezes). Tirar a cauda: ação completa, Ofício ou Sobrevivência CD 15.`),
		linha("Coleta de Ingredientes (ND 2, T$ 100+)", `Boticário Rafu, qareen, Poções Promissoras. ${G("Aranha Gigante", "Aranha gigante")} na floresta a leste. Três dias depois, mais 2d4+2 doses de bálsamo restaurador.`),
		linha("Coleta e Entrega de Encomenda (ND 1, T$ 150 + 150)", `"Sr. P" (Peter Varhim, boina azul, Normandia). Pacote no porto à noite; emboscada de ${G("Bandido", "6 bandidos")} na volta. Se abrirem: a Gema do Sr. P e a carta de amor. Artemis Joias Especiais recusa o presente (recado em \"Documentos\"). Guardar o segredo faz de Peter testemunha; extorqui-lo o deixa inimigo.`),
		linha("Escolta até Tarrafet (ND 3, T$ 400)", `Adina Astor, hynne cartógrafa. Um dia de viagem pelo Rio Panteão, acampamento. A máquina atrai ${G("Turba Zumbi", "turbas zumbis")}: mais uma a cada 3 rodadas, por ${R("1d3+6")} rodadas. Metade do grupo caído: fogem, metade da recompensa e Adina frustrada.`),
		linha("Investigação de Contrabando (ND 1, T$ 200)", `${L("Investigação na Fim do Mundo")}; tabela @UUID[${tabela.uuid}]{Pistas na Taverna Fim do Mundo}.`),
		linha("Investigação nas Minas Heldret (ND 3, T$ 500)", `Contramestre Haldor, trilhos aéreos até a câmara anã soterrada (18 × 18 m, runas, porta dupla de metal). ${L("Estátua Animada", "2 estátuas animadas")}.`),
		linha("Reforço nas Muralhas (ND 2, T$ 50/pessoa)", L("Propina no Portão Sul"))
	]) },
	{ name: "Parte 3 — Grandes Poderes, Grandes Problemas", html: ul([
		linha("Cena 1 — O Chamado de Ezequias", "Um hynne afobado entrega a carta assinada \"E.H.\" (Investigação CD 15: a loja é de um conselheiro da Guilda, herdeiro fundador). Minérios Maravilhosos, Distrito da Bigorna. Ezequias propõe ajudar com \"o MEU assassinato\": viagem falsa para atrair Zelin, o capanga de Rodford. Dois dias para se preparar."),
		linha("Cena 2 — Viagem Falsa", "Discurso em Normandia. Portão sul: carroça de metal puxada pelo autômato Ford. Cada jogador escolhe do arsenal de Ezequias uma arma, escudo ou item esotérico de adamante ou mitral, com mais uma melhoria à escolha. Aproveite a viagem para os personagens conhecerem Ezequias (diário \"A1 · Ezequias Heldret\")."),
		linha("Cena 3 — Emboscada Reversa", `À noite, o alarme dispara. ${L("Zelin Alexevich")}, ${L("Milla Hofforva")}, ${L("Ruschel Vodorov")} e ${L("Igor Raitter")}. O combate mais difícil da aventura. Ezequias ofusca os inimigos na 1ª rodada e depois ajuda como parceiro (item \"Parceiro: Ezequias (Emboscada Reversa)\"). Zelin ou mais da metade caídos: o resto se rende.`),
		linha("Cena 4 — De volta a Yuvalin", `${L("Interrogatório dos Mercenários")}. Ezequias despeja os capangas na Sede e acusa Rodford Varhim: julgamento pelo Conselho.`),
		linha("Cena 5 — A Preparação", "Ezequias, preso na Sede, pede testemunhas. Os jogadores lembram sozinhos de quem pode depor (página \"Testemunhas\"). Cada uma vale +1d6 em um teste do julgamento."),
		linha("Cena 6 — O Julgamento", `${L("O Julgamento")}. Use a macro <b>A1 · O Julgamento</b>.`),
		linha("Epílogo", "Culpado: Ezequias é eleito presidente e anuncia o plano de destruir a Tormenta e fazer de Yuvalin a maior produtora de aço-rubi de Arton (Amostra de aço-rubi de Ezequias). Personagens no 4º nível.")
	]) },
	{ name: "Testemunhas", html: ul([
		linha("Príncipe da Pólvora Galix", "Se ficou devendo um favor: conta que pagava propina à Guilda."),
		linha("Peter Varhim", "Se o grupo guardou o segredo: depõe contra o pai abusivo."),
		linha("Goro Okazaki e Hatori Muramune", "Atestam a honra do grupo e os ataques à Oficina Kanpeki; Muramune ouviu Rodford dizer que ele \"um dia se arrependeria de ter negado a Guilda\"."),
		linha("Chef Rizzelena", "Atesta a bravura do grupo."),
		linha("Guardas do Portão Sul", "Se o grupo prendeu os contrabandistas: relatam o esquema de corrupção."),
		linha("Boticário Rafu", "Se o grupo abateu a aranha."),
		linha("Penellope Pendragon", "Se o grupo domou o espírito do gelo."),
		linha("Adina Astor", "Se a pesquisa terminou: longa e entediante explicação de como o grupo ajudou a mineração."),
		linha("Contramestre Haldor", "Se o grupo derrotou as estátuas: Rodford negou proteção da Guilda aos trabalhadores da Heldret.")
	]) + P("<b>Derrota no Tribunal:</b> Rodford bane o grupo e Ezequias. Eles recuam para o \"Estábulo\" e precisam limpar o nome: figuras que não depuseram, invadir a Sede atrás de documentos, ou pequenas missões no estilo da Parte 2.") }
];

const QUADRO = [
	["Amansar Espírito do Gelo", "Penellope Pendragon", "Oficina Beluhga, Distrito da Bigorna", "Adquiri um cristal elemental das Uivantes, mas parece que o espírito dentro dele ainda está ativo. Preciso de aventureiros bons de briga para cuidar do elemental quando eu abrir o cristal.", 3, "T$ 200"],
	["Auxílio em Manufatura", "Goro Okazaki", "Oficina Kanpeki, Distrito da Forja", "Contrato ajudantes para ajudar na forja de espada. Pago bem.", 1, "T$ 30/pessoa"],
	["Caçada Exótica", "Chef Rizzelena", "Taverna Pombo de Ouro, Distrito da Forja", "Procuro aventureiros capazes para perseguir e abater uma iguaria que habita o leito do rio.", 2, "T$ 120/peça"],
	["Coleta de Ingredientes", "Boticário Rafu", "Poções Promissoras, Distrito da Bigorna", "Procuro caçadores de monstros para ajudar na coleta de ingredientes... Perigosos.", 2, "T$ 100+"],
	["Coleta e Entrega de Encomenda", "\"Sr. P\"", "Normandia", "Procuro um grupo de aventureiros destemidos e discretos que possam coletar uma encomenda no porto e levá-la para um ponto específico na cidade. Pago muito bem pelo serviço. Interessados me encontrem em Normandia, estarei todos os dias, ao meio-dia, sentado num dos bancos da praça central vestindo uma boina azul.", 1, "a definir"],
	["Escolta até Tarrafet", "Astor Cartografia & Geologia", "Distrito da Bigorna", "Preciso colher amostras de solo na região de Tarrafet, mas o local é infestado de mortos-vivos errantes. Por esse motivo busco contratar uma escolta de aventureiros.", 3, "T$ 400"],
	["Investigação de Contrabando e Venda de Material Ilegal", "Guilda dos Mineradores", "Taverna Fim do Mundo, Distrito da Bigorna", "A Guilda recebeu denúncias de que goblins estão vendendo explosivos ilegais na taverna Fim do Mundo. Investiguem o local por pistas que possam levar aos produtos ou aos contrabandistas, e tragam as informações e provas para a Sede da Guarda.", 1, "T$ 200"],
	["Investigação nas Minas Heldret", "Mineradora Heldret", "Minas Heldret", "A Mineradora Heldret contrata aventureiros experientes para averiguar uma câmara suspeita encontrada durante as escavações.", 3, "T$ 500"],
	["Reforço nas Muralhas", "Sargento Elias Fletcher", "Distrito do Carvão, Portão Sul", "Estamos com problemas para fiscalizar o portão e poucos homens disponíveis. Aceitamos reforço de aventureiros registrados.", 2, "T$ 50/pessoa"]
];

const documentos = [
	["Pergaminho da Guilda (Parte 1)", "<i>Os aventureiros com licença temporária nível Quartzo devem se apresentar a um dos Mestres da Forja na Fundição Central para resolver um problema de infestação. Os recrutas têm dois dias para concluir a tarefa.</i></p><p>Os aventureiros registrados são divididos em categorias: <b>Quartzo</b>, aventureiros em treinamento; <b>Topázio</b>, os profissionais; e <b>Coríndon</b>, os aventureiros de elite. A categoria define o tipo de missão que se pode aceitar no quadro da Guilda."],
	["Carta de E.H. (Parte 3)", "<i>Convidamos o esquadrão a comparecer à loja Minérios Maravilhosos, no Distrito da Bigorna. — E.H.</i>"],
	["Recado de Artemis", "<i>Digam ao seu contratante que eu agradeço a gentileza, mas peço que ele não envie mais coisas assim. Obrigado e tenham um bom dia.</i>"],
	["Carta de Peter Varhim (dentro do pacote)", "Uma declaração de amor a Artemis, assinada por <b>Peter Varhim</b>, herdeiro de uma das casas fundadoras de Yuvalin, junto com a gema."]
];

const ezequias = [
	{ name: "Quem é", html: P(
		"Principal NPC da campanha: guia os heróis até a Cidade na Tormenta. Patriarca da família Heldret, descendente de um dos exploradores que fundaram Zakharov. Dono de algumas das minas mais lucrativas de Yuvalin e conselheiro da Guilda dos Mineradores, onde é só tolerado. Apelidado de \"Professor\"."
	) },
	{ name: "Aparência", html: P(
		"Estatura mediana, postura retraída e fala enérgica. Pele alva de quem pouco vê o sol, cabelos acobreados desgrenhados, dedos longos e finos com uma articulação a mais. Sobretudo de couro cheio de bolsos com cacarecos \"científicos\" e óculos de solda de lentes grossas que nunca tira.",
		"<b>Segredo:</b> os óculos escondem a esclerótica laranja brilhante: Ezequias é lefou e se passa por humano para evitar problemas. Se descobrirem, ele não nega: busca entender a \"maldição\" para um dia revertê-la."
	) },
	{ name: "Personalidade", html: P(
		"Pesquisador de minérios e materiais exóticos, extremamente inteligente e culto, sobretudo sobre a Tormenta, de quem fala com pavor e empolgação (\"conheça seu inimigo\"). Agitado, positivo, tagarela e sem muito trato social; explica tudo de forma didática e pensa em voz alta. Curioso sobre o passado dos personagens.",
		"Autômato <b>Ford</b>: pirâmide com rodas que puxa sua carroça de metal e solta gases vermelhos de cheiro ácido."
	) }
];

await JournalEntry.implementation.createDocuments([
	{ name: "A1 · Como usar no Foundry", folder: pasta.JournalEntry.id, flags: FLAGS("comoUsar"), pages: paginas([
		{ name: "Visão geral", html: P(
			"Tudo desta aventura fica nas pastas <b>A1 · Forja de Heróis</b> (Atores, Itens, Tabelas, Macros e Diários). As ameaças novas estão em <i>Ameaças</i> e os perigos e testes estendidos em <i>Perigos e Testes</i>. Cenas e mapas ficam por sua conta.",
			"As criaturas do livro básico (glop, bandido, chefe bandido, gorlogg, aranha gigante, turba zumbi) vêm do compêndio de ameaças do <b>Giria T20</b>: os links do roteiro abrem as fichas de lá, e você arrasta para a cena.",
			"Fichas conferidas com o livro (pp. 26–27): Defesa, PV, CD, iniciativa, percepção, resistências e ataques."
		) },
		{ name: "Automações", html: ul([
			linha("Mamãe Glop", "Meiose Glópica automática: no início do turno dela em combate, o módulo rola 1d6 e, no par, põe um glop ao lado e no combate."),
			linha("Estátua Animada", "Pancada com botão \"Atordoado (1 rodada)\" no cartão (uma vez por cena por criatura fica com você)."),
			linha("Zelin", "Marca da Presa como opção no ataque (+1d8, ou +2d8 contra humanoide não humano)."),
			linha("Milla", "Arcano de Batalha (+4) entra sozinho em Seta Infalível e Bola de Fogo; Raio Arcano com rolagem."),
			linha("Ruschel", "Mira Apurada como opção na besta (+2 no ataque e na margem)."),
			linha("Stagh", "Garras com +1d6 de frio automático; Aura de Frio com rolagem."),
			linha("Éter Elemental (frio)", "+1d4 de frio como opção nos ataques enquanto estiver na ficha."),
			linha("Testes estendidos", "Forja da Kanpeki, Fim do Mundo e Portão Sul: macro CdR · Teste estendido. Julgamento: macro A1 · O Julgamento (placar, alternância de apelos e testemunhas).")
		]) }
	]) },
	{ name: "A1 · Roteiro", folder: pasta.JournalEntry.id, flags: FLAGS("roteiro"), pages: paginas(roteiro) },
	{ name: "A1 · Quadro de Serviços", folder: pasta.JournalEntry.id, flags: FLAGS("quadro"), ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER },
		pages: paginas(QUADRO.map(([t, s, l, d, n, r]) => ({ name: t, html: `<p><b>Solicitante:</b> ${s}<br><b>Local:</b> ${l}</p><p><i>${d}</i></p><p><b>Nível de Perigo:</b> ${n}<br><b>Recompensa:</b> ${r}</p>` }))) },
	{ name: "A1 · Ezequias Heldret", folder: pasta.JournalEntry.id, flags: FLAGS("ezequias"), pages: paginas(ezequias) },
	{ name: "A1 · Documentos para os jogadores", folder: pasta.JournalEntry.id, flags: FLAGS("documentos"), pages: documentos.map(([n, t], i) => ({ name: n, type: "text", sort: (i + 1) * 100, title: { show: true, level: 1 }, text: { content: `<p>${t}</p>`, format: 1 } })) }
]);

const ulr = (arr) => (arr.length ? `<ul>${arr.map((x) => `<li>${x}</li>`).join("")}</ul>` : "<p>—</p>");
ChatMessage.create({
	whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id),
	content: `<h3>${NOME_PASTA}</h3><p><b>Criados (${relatorio.criados.length}):</b></p>${ulr(relatorio.criados)}` + (relatorio.avisos.length ? `<p><b>Avisos:</b></p>${ulr(relatorio.avisos)}` : "")
});
