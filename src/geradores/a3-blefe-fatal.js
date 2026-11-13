/* =====================================================================
 * CORAÇÃO DE RUBI · AVENTURA 3 · "BLEFE FATAL"
 * Gerador de conteúdo para Foundry VTT v14 + sistema Tormenta20 (Vizael 1.6.x)
 *
 * Fonte do compêndio do módulo giriarpg-coracao-de-rubi (o build roda este arquivo num Foundry
 * simulado). Também funciona como macro de Script, colado inteiro e executado pelo Mestre.
 * Cria, na pasta "A3 · Blefe Fatal" de cada tipo:
 *  • 6 ameaças novas do livro (pp. 59–61): Assassino Putrefato, Enxame de Papa-dim, Rà, Sihnion, Sillion
 *    e Siora; e as variantes Dazan, o Vampiro Falido (vampiro faminto) e Guarda de Aslavi (besteiro).
 *    As criaturas do livro básico (esqueleto de elite, aparição, hidra, cultista de Sszzaas, ogro) não são
 *    copiadas: o roteiro aponta para as fichas do Giria T20.
 *  • 4 perigos e testes: Partida de Wyrt, Fuga dos Papa-Dim (ND 14), Fim de Festa e Cassino Dimensional.
 *  • Itens: os cinco itens do leilão (Pingente da Sereia Adormecida, Cálices Encantados de Mulk, Adaga do
 *    Último Suspiro, Manoplas do Mestre Moldador, Pulmão da Montanha), carta de crédito da Guilda, moedas-
 *    convite de Bac Arat e o bastão de teletransporte de Rà.
 *  • Tabela: Licor de Tinta de Kraken (1d6).
 *  • Macros A3 · Partida de Wyrt e A3 · Cassino Dimensional.
 *  • Diários: Como usar no Foundry, Roteiro e Documentos para os jogadores.
 * Rodar de novo apaga (depois de confirmar) o que tem a marca flags.world.cdr = "a3" e recria tudo.
 *
 * Os links @GIRIA[nome|livro] viram links para o compêndio do Giria T20 no build do módulo.
 * Fichas conferidas com o livro Coração de Rubi, pp. 47–61.
 * ===================================================================== */
if (!game.user.isGM) return ui.notifications.error("Só o Mestre pode rodar este gerador.");

const TAG = "a3";
const FLAGS = (role) => ({ world: role ? { cdr: TAG, cdrRole: role } : { cdr: TAG } });
const NOME_PASTA = "A3 · Blefe Fatal";
const FONTE = "Coração de Rubi — Blefe Fatal";
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
		window: { title: "Aventura 3: recriar conteúdo" },
		content: `<p>Já existem <b>${antigos.length}</b> documentos gerados para a Aventura 3.</p>
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
		flags: { tormenta20: { coracaoDeRubi: "aventura3" }, world: { cdr: TAG, ...(a?.automacoes ? { cdrAutomacoes: a.automacoes } : {}) } }
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
		flags: { tormenta20: { coracaoDeRubi: "aventura3" }, world: { cdr: TAG } }
	});
	relatorio.criados.push(`Perigo: ${h.nome}`);
	return actor;
}


/** Variante de uma ameaça do compêndio do sistema (ex.: Dazan = vampiro faminto). */
async function variante(base, v, folder) {
	const obj = await doCompendio("ameacas", base);
	if (!obj) {
		relatorio.avisos.push(`${v.nome}: "${base}" não encontrado no compêndio de ameaças do sistema.`);
		return null;
	}
	obj.name = v.nome;
	obj.folder = folder.id;
	obj.prototypeToken = { ...(obj.prototypeToken ?? {}), name: v.nome, actorLink: false, disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE };
	if (v.nd) obj.system.attributes.nd = v.nd;
	obj.items = (obj.items ?? []).filter((i) => !(v.remover ?? []).includes(i.name)).map((i) => (v.renomear?.[i.name] ? { ...i, name: v.renomear[i.name] } : i));
	obj.system.detalhes = { ...(obj.system.detalhes ?? {}), biography: { value: P(v.bio) + (obj.system.detalhes?.biography?.value ?? ""), public: "" } };
	obj.flags = { ...(obj.flags ?? {}), tormenta20: { ...(obj.flags?.tormenta20 ?? {}), coracaoDeRubi: "aventura3" }, world: { cdr: TAG } };
	const actor = await Actor.implementation.create(obj);
	if (v.defesa) {
		const d = actor.system.attributes.defesa;
		if (typeof d?.value === "number" && d.value !== v.defesa) await actor.update({ "system.attributes.defesa.base": (d.base ?? 0) + (v.defesa - d.value) });
	}
	if (v.extras) await actor.createEmbeddedDocuments("Item", v.extras(actor));
	relatorio.criados.push(`${v.nome} (ND ${obj.system.attributes.nd}, variante de ${base})`);
	return actor;
}

// ---------------------------------------------------------------------------
// Ameaças (livro, pp. 59–61)
// ---------------------------------------------------------------------------
IMG.florete = EQ("florete");
IMG.trevas = "icons/svg/skull.svg";
IMG.vulto = "icons/svg/invisible.svg";
IMG.moeda = "icons/svg/coins.svg";
IMG.esquiva = "icons/svg/wingfoot.svg";
IMG.dobro = "icons/svg/combat.svg";
IMG.palco = "icons/svg/card-hand.svg";

const AMEACAS = [
	{
		nome: "Assassino Putrefato", nd: "9", tipo: "mor", tamanho: "med", img: ICONE("assassino-aberrante"),
		atr: { for: 2, des: 7, con: 2, int: 1, sab: 1, car: -2 },
		pv: 50, defesa: 24, desl: 9, cd: 24, sentidos: ["escuro"],
		resistencias: "evasão aprimorada, redução de dano 10/mágico, resistência a magia +5",
		pericias: { inic: 15, perc: 7, fort: 14, refl: 19, vont: 7, luta: 25, acro: 15, furt: 20 },
		ataquescac: "Espada púrpura +25 (1d8+16, 19, mais 4d8 trevas e sangramento). Ataque Furtivo +7d6.",
		equipamento: "Couro batido ajustado e reforçado, gazua, manto camuflado (urbano).",
		tesouro: "Metade.",
		bio: "Agentes de elite da coroa de Aslothia: ladrões e bandoleiros executados e reanimados por necromancia, leais ao regente Ferren Asloth. Corpo e rosto cobertos por bandana, chapéu e luvas; por baixo, carne semidecomposta e tatuagens arcanas de brilho roxo. Vrat e Porac, os \"colegas\" de Prinkster, são dois deles. Parte 3, Cena 3: quatro bloqueiam o caminho atrás de Rà.",
		itens: () => [
			arma("Espada púrpura", {
				img: IMG.espada, dano: "1d8+16", tipo: "corte", critM: 19, proficiencia: "marcial",
				desc: P("Mais 4d8 de trevas (entra sozinho no dano) e sangramento cumulativo. Só funciona com o assassino para o qual foi feita; se ele morrer, a espada vira pó."),
				efeitos: [efUso("Trevas", [["dano", "4d8[trevas]"]], { automatic: true, img: IMG.trevas, desc: "+4d8 de trevas." }), efCondicao("sangrando")]
			}),
			habilidade("Ataque Furtivo", "+7d6 de dano contra alvo desprevenido ou flanqueado.<br><b>Automação:</b> Shift+clique na espada e marque a opção.", {
				img: IMG.golpe, efeitos: [efUso("Ataque Furtivo (+7d6)", [["dano", "7d6"]], { names: ["Espada púrpura"], img: IMG.golpe, desc: "+7d6 de dano furtivo." })]
			}),
			habilidade("Emanação de Trevas", "Tentáculos de energia negativa envolvem uma criatura viva em alcance médio: 6d8+6 pontos de dano de trevas e fica fatigada (Fort CD 24 reduz o dano à metade e evita a condição).", {
				img: IMG.trevas, execucao: "action", alcance: "medium", resistencia: "Fortitude reduz à metade e evita a condição",
				rolls: [rolagemDano("Dano", "6d8+6", "trevas")], efeitos: [efCondicao("fatigado")]
			}),
			habilidade("Vulto Mortal", "O assassino se cobre em sombras até o fim da cena: camuflagem leve, +10 em Furtividade e pode fintar como ação de movimento.", {
				img: IMG.vulto, execucao: "move", duracao: { value: 0, units: "scene", special: "" },
				efeitos: [efCartao("Vulto Mortal", [["system.pericias.furt.bonus", 10]], { img: IMG.vulto, cena: true, desc: "+10 em Furtividade e camuflagem leve até o fim da cena." })]
			}),
			habilidade("Evasão Aprimorada", "Quando sofre um efeito que permite Reflexos para reduzir o dano à metade, não sofre dano se passar e sofre metade se falhar.", { img: IMG.esquiva })
		]
	},
	{
		nome: "Enxame de Papa-dim", nd: "8", tipo: "mon", tamanho: "gra", img: GER("bolsa-de-po"),
		atr: { for: 5, des: 1, con: 5, int: -2, sab: 0, car: 0 },
		pv: 69, defesa: 19, desl: 6, cd: 24, sentidos: ["escuro"],
		resistencias: "enxame (imune a manobras e a efeitos de alvo único que não causam dano; vulnerável a dano de área; metade do dano de armas)",
		pericias: { inic: 12, perc: 8, fort: 19, refl: 14, vont: 8 },
		tesouro: "Moedas e gemas no valor de T$ 6d6 × 100.",
		bio: "Bolsas de moedas douradas, gelatinosas e translúcidas de um metro de altura, que pulam tilintando e trituram tudo em busca de ouro. A lenda diz que são algibeiras perdidas que absorveram a ganância dos donos. Parte 2, Cena 2 (Floresta dos Papa-Dim): matar um enxame não resolve, outro aparece; use o perigo Fuga dos Papa-Dim. Conhecimento, Misticismo ou Sobrevivência CD 20 para conhecê-los.",
		itens: () => [
			habilidade("Enxame", "Pode entrar no espaço de um personagem e, no fim do turno, causa 8d8+20 pontos de dano de perfuração automaticamente a quem estiver no seu espaço. Imune a manobras e a efeitos de alvo único que não causam dano; vulnerável a dano de área; sofre metade do dano de ataques com armas. Estar dentro do enxame é condição ruim para lançar magias.", {
				img: IMG.mordida, rolls: [rolagemDano("Dano do enxame", "8d8+20", "perfuracao")]
			}),
			habilidade("Ganância", "Quem sofre dano do enxame perde T$ 1 por ponto de dano. Se alguém jogar moedas ou objetos de T$ 100 ou mais no enxame, os papa-dim se concentram em devorá-los e ficam atordoados por uma rodada.", { img: IMG.moeda }),
			habilidade("Mordida Trituradora", "Uma criatura que sofra dano do enxame fica atordoada por uma rodada e sangrando (Fort CD 24 evita). Só pode ser atordoada por esta habilidade uma vez por cena.", {
				img: IMG.atordoar, resistencia: "Fortitude evita", efeitos: [efCondicao("atordoado", { rodadas: 1 }), efCondicao("sangrando")]
			})
		]
	},
	{
		nome: "Rà", nd: "11", tipo: "hum", raca: "Humana", tamanho: "med", img: ICONE("cultista-da-traicao"),
		atr: { for: 1, des: 6, con: 3, int: 4, sab: 1, car: 6 },
		pv: 280, pm: 70, defesa: 22, desl: 9, cd: 30, ic: ["atordoado", "enfeiticado"],
		resistencias: "evasão aprimorada, imunidade a atordoamento e encantamento",
		pericias: { inic: 19, perc: 13, fort: 10, refl: 22, vont: 16, luta: 27, acro: 19, atua: 21, enga: 21, joga: 21 },
		ataquescac: "Florete magnífico x2 +27 (1d6+18, 16).",
		magias: ["Amedrontar", "Criar Ilusão", "Disfarce Ilusório", "Imagem Espelhada", "Leque Cromático", "Bola de Fogo", "Toque Vampírico", "Velocidade"],
		equipamento: "Armadura de couro ajustada, reforçada e defensora, cosmético x2, estojo de disfarces aprimorado, florete magnífico.",
		bio: "Assassina famosa no submundo, alta e esguia, roupas exóticas e chamativas; voz estridente e autoconfiança infantil, péssima perdedora. Mimetiza qualquer criatura que já viu: passou a aventura disfarçada de Prinkster (as duas piscadelas com o olho esquerdo são dela). Contratada pelo Conde Ferren Asloth para tirar o Pulmão da Montanha de \"mãos erradas\". Lança magias como uma barda de 12º nível (CD 30). Em combate: Velocidade primeiro; depois duas ações agredir, ou agredir e magia; Imagem Espelhada para se defender, Bola de Fogo para atacar, Toque Vampírico ao sofrer dano. Parte 3, Cena 4 (Cassino Dimensional).",
		itens: () => [
			arma("Florete magnífico", { img: IMG.florete, dano: "1d6+18", tipo: "perfuracao", critM: 16, proficiencia: "marcial", desc: P("Dois ataques por ação agredir.") }),
			habilidade("Distração", "Uma vez por rodada, quando é atingida por um ataque, Rà pode fazer um teste de Atuação. Se o resultado for maior que o ataque do oponente, evita o ataque.", { img: IMG.palco, execucao: "reaction" }),
			habilidade("Espetáculo Mortal", "Quando usa a ação agredir ou lança uma magia com execução de uma ação padrão, Rà pode gastar 1 PM para fazer um ataque adicional com seu florete.", { img: IMG.dobro, execucao: "free", custo: 1 }),
			habilidade("Evasão Aprimorada", "Quando sofre um efeito que permite Reflexos para reduzir o dano à metade, não sofre dano se passar e sofre metade se falhar.", { img: IMG.esquiva })
		]
	},
	...["Sihnion", "Sillion"].map((nome) => ({
		nome, nd: "5", tipo: "hum", raca: "Elfo", tamanho: "med", img: ICONE("chefe-bandido"),
		atr: { for: 0, des: 6, con: 2, int: 3, sab: -1, car: 0 },
		pv: 52, defesa: 25, desl: 12, sentidos: ["penumbra"],
		pericias: { inic: 13, perc: 8, fort: 13, refl: 18, vont: 6, luta: 22, pont: 16, acro: 15, inti: 7 },
		ataquescac: "Florete x2 +22 (1d6+14, 17).", ataquesad: "Adaga +16 (1d4+10, 19).",
		equipamento: "Adaga x2, florete pungente de mitral, couro batido reforçado sob medida.",
		tesouro: "Padrão.",
		bio: `Um dos gêmeos espadachins do Trio de Elfos (com ${nome === "Sihnion" ? "Sillion" : "Sihnion"} e a irmã Siora): cabelos longos e brancos, armadura de couro negro, arrogantes e dispostos a matar por uma vida de luxo. Parte 1, Cena 5: atacam pelas moedas-convite de Bac Arat.`,
		itens: () => [
			arma("Florete", { img: IMG.florete, dano: "1d6+14", tipo: "perfuracao", critM: 17, proficiencia: "marcial", desc: P("Dois ataques por ação agredir. Pungente de mitral (já na margem).") }),
			arma("Adaga", { img: IMG.adaga, pericia: "pont", dano: "1d4+10", tipo: "perfuracao", critM: 19, alcance: "short", proposito: "arremesso", proficiencia: "simples" }),
			habilidade("Prepare-se para a encrenca…", "Uma vez por rodada, quando é atingido por um ataque, pode fazer um teste de ataque (+27). Se o resultado for maior que o do oponente, evita o ataque.", { img: IMG.bloqueio, execucao: "reaction", rolls: [rolagemFormula("Aparar (+27)", "1d20+27")] }),
			habilidade("… em dobro", "Uma vez por rodada, quando o irmão acerta um ataque corpo a corpo, este gêmeo pode fazer um ataque corpo a corpo contra o mesmo alvo.", { img: IMG.dobro, execucao: "reaction" })
		]
	})),
	{
		nome: "Siora", nd: "6", tipo: "hum", raca: "Elfa", tamanho: "med", img: ICONE("necromante"),
		atr: { for: -1, des: 5, con: 2, int: 7, sab: 0, car: 2 },
		pv: 134, pm: 61, defesa: 18, desl: 12, cd: 25, sentidos: ["penumbra"],
		pericias: { inic: 11, perc: 8, fort: 6, refl: 12, vont: 19, luta: 13, pont: 16, conh: 18, mist: 21 },
		ataquescac: "Adaga +13 (1d4–1, 19).", ataquesad: "Adaga +16 (1d4+10, 19).",
		magias: ["Amedrontar", "Crânio Voador", "Manto de Sombras", "Tentáculos de Trevas"],
		equipamento: "Adaga de mitral, orbe cristalina.",
		tesouro: "Padrão.",
		bio: "Irmã mais velha do Trio de Elfos, bruxa de vestido negro de seda. Fica atrás sussurrando magias enquanto os gêmeos avançam. Lança magias como uma maga de 9º nível (CD 25, limite de PM 10). Parte 1, Cena 5.",
		itens: () => [
			arma("Adaga", { img: IMG.adaga, dano: "1d4-1", tipo: "perfuracao", critM: 19, proficiencia: "simples" }),
			arma("Adaga (arremesso)", { img: IMG.adaga, pericia: "pont", dano: "1d4+10", tipo: "perfuracao", critM: 19, alcance: "short", proposito: "arremesso", proficiencia: "simples" })
		]
	}
];

const VARIANTES = [
	{
		base: "Vampiro", nome: "Dazan, o Vampiro Falido", nd: "11", defesa: 36,
		remover: ["Presença Majestosa"], renomear: { "Espada longa x2": "Espada longa" },
		bio: "<b>Variante do Coração de Rubi (p. 59):</b> vampiro que já viu dias melhores. Faminto, está fatigado (a Defesa 36 já conta a penalidade), faz só um ataque com espada por rodada e não usa Presença Majestosa. Rouba as moedas-convite do grupo e deixa um rastro de sangue (Parte 2, Cena 1). Com menos da metade dos PV grita \"Vocês me pagam!\" e foge em forma de morcego. Volta no leilão para acusar o grupo pela \"morte\" de Prinkster."
	},
	{
		base: "Esqueleto de Elite", nome: "Guarda de Aslavi (besteiro)",
		bio: "<b>Variante do Coração de Rubi (p. 60):</b> os dois esqueletos de elite no topo da torre do portão usam bestas pesadas (ataque +17, dano 1d12+5, crítico 19), mas também atacam com espadas. Os outros dois guardas e os reforços são @GIRIA[Esqueleto de Elite|T20]{esqueletos de elite} comuns; o oficial é uma @GIRIA[Aparição|T20]{aparição}.",
		extras: (actor) => [arma("Besta pesada", { img: IMG.besta, pericia: "pont", extra: 17 - (actor.system.pericias?.pont?.value ?? 0), dano: "1d12+5", tipo: "perfuracao", critM: 19, alcance: "medium", proposito: "disparo", proficiencia: "simples" })]
	}
];

// ---------------------------------------------------------------------------
// Perigos e testes (atores do tipo Perigo)
// ---------------------------------------------------------------------------
const R = (f, t) => `[[/r ${f}${t ? `[${t}]` : ""}]]`;
const PERIGOS = [
	{
		nome: "Partida de Wyrt", nd: "—", local: "Parte 1, Cena 4 (porão da Lixo Trancado)",
		goal: P("Manter Prinkster falando sobre o leilão (não precisa ganhar). Até dois personagens jogam; Prinkster e os capangas Vrat e Porac jogam como um só, com T$ 300. Use a macro <b>A3 · Partida de Wyrt</b>."),
		effects: P(
			"<b>Aposta inicial:</b> T$ 100 por personagem. <b>Aposta da rodada:</b> no seu turno, T$ 20 ou T$ 50; os outros cobrem (Prinkster paga o triplo: T$ 60 ou T$ 150).",
			"<b>Mão Inicial:</b> Carisma CD 15 (passa: +5 na Jogatina; falha por 5+: –5) ou Ladinagem CD 20 (passa: +5; falha por 5+: pego trapaceando e expulso pelos ogros).",
			"<b>Ajudar/Atrapalhar:</b> quem está fora ajuda com qualquer perícia justificável (CD 10/15), ou atrapalha Prinkster (CD 15: –1, e –1 a cada 10 acima). Cada perícia uma vez; falha por 5+ é expulso por \"atrapalhar a mesa\".",
			"<b>Blefar:</b> Enganação CD 20 (+2; falha por 5+: –5).",
			"<b>Hora da Verdade:</b> Jogatina oposto (pode sem treino); Prinkster +14. Quem vence leva o pote.",
			`<b>Bebida Amarga:</b> fim de cada rodada, Fortitude CD 15 +1 por teste já feito. 1ª falha @STATUS[frustrado], 2ª @STATUS[esmorecido], 3ª @STATUS[inconsciente] (sai do jogo). Quem não bebe ofende Prinkster: sem comentário na rodada.`
		),
		actions: P("Fim de jogo quando os dois personagens ou Prinkster ficam sem dinheiro. Prinkster se despede com duas piscadelas do olho esquerdo e deixa na mesa duas moedas-convite de Bac Arat.")
	},
	{
		nome: "Fuga dos Papa-Dim", nd: "14", local: "Parte 2, Cena 2 (Floresta dos Papa-Dim)",
		goal: P("Cruzar a floresta sem ser devorado: <b>5 sucessos</b> na ação Conduzir (a pé: 7, e Atletismo no lugar de Reflexos). Defina quem leva os convites: se chegar a 0 PV por mordida dos papa-dim, o enxame devora as moedas (derrotar o enxame para recuperar)."),
		effects: P(
			`Carruagem: RD 5, 70 PV. No início de cada rodada, cada personagem na carruagem faz Reflexos CD 20: falha ${R("2d6", "impacto")}; falha por 10+ ${R("4d6", "impacto")} e cai. Quem voa não testa, mas não conduz.`,
			`Papa-dim que alcançam a carruagem causam ${R("6d6+5", "perfuracao")} a ela; 20 de dano quebra uma roda.`
		),
		actions: P(
			"<b>Conduzir</b> (Destreza, Adestramento ou Pilotagem CD 25): passa, avança; falha, avança e é alcançada; falha por 5+, não avança e é alcançada.",
			"<b>Ajudar o Condutor</b>: Atletismo nos arreios, Percepção para achar a rota etc.",
			"<b>Atacar as Criaturas</b>: 50 de dano no enxame na rodada impede o ataque à carruagem.",
			"<b>Quem Quer Dinheiro</b>: jogar T$ 100 em moedas ou objetos como isca impede o ataque na rodada.",
			"<b>Lançar uma magia</b>: Vontade CD 15 + custo em PM (condição ruim).",
			"<b>Embarcar</b> (Atletismo CD 20, ação completa): para quem caiu; falha, é atacado pelo enxame.",
			"<b>Consertar Roda</b>: carroça parada, dois testes de Ladinagem ou Ofício CD 20; enquanto isso um enxame ataca (o grupo ou a carroça).",
			"Use a macro <b>CdR · Teste estendido</b> para o placar (5 sucessos)."
		)
	},
	{
		nome: "Fim de Festa", nd: "—", local: "Parte 3, Cena 1 (sala de exposição de Bac Arat)",
		goal: P("Chegar ao palco, 12 m adiante, fugindo da multidão enfurecida de malfeitores e seguranças. Enfrentar todos não é opção. A escada para o térreo está obstruída."),
		effects: P(
			"Rolem Iniciativa. Cada ação de movimento exige Acrobacia ou Atletismo CD 20: passa, avança metade do deslocamento (terreno difícil); falha, não avança.",
			`No fim de cada rodada, quem não está no palco sofre ${R("4d8+4", "corte")} de corte da turba.`
		),
		actions: P("Outras saídas: voar, Intimidação CD 25 etc. Causar 50 de dano na multidão (ou habilidades a critério do mestre) impede o dano da turba na rodada.")
	},
	{
		nome: "Cassino Dimensional", nd: "11", local: "Parte 3, Cena 4 (porão da Lixo Trancado)",
		goal: P("Vencer Rà em combate, agindo com cartas, numa redoma de cartas flutuantes de 15 m de raio. Fortitude CD 20 ao chegar: quem falha começa @STATUS[enjoado] na primeira rodada. Use a macro <b>A3 · Cassino Dimensional</b> (simula o baralho com d20 e d4)."),
		effects: P(
			"No início de cada rodada, cada personagem compra até ter 3 cartas; Rà, até 5. Age primeiro quem tem a maior carta numérica, em ordem decrescente.",
			"Cada ação gasta uma carta; o naipe define a ação: <b>paus</b> movimento, <b>copas</b> padrão (exceto atacar), <b>espadas</b> agredir, <b>ouros</b> completa. Os personagens continuam limitados a uma padrão e uma de movimento por turno; Rà não.",
			"No fim da rodada, pode descartar as cartas não usadas."
		),
		actions: P(
			"<b>Ás:</b> ação (do naipe) que não conta no limite do turno. <b>Valete:</b> outra criatura em alcance curto rola de novo um teste recém-feito. <b>Rainha:</b> habilidade sem pagar o custo básico em PM (ainda gasta a carta da ação). <b>Rei:</b> +5 em um teste. <b>Curinga:</b> emula qualquer carta.",
			"Vencida, Rà cai inerte; o grupo volta à mesa da taverna, com Rà desacordada sob a mesa."
		)
	}
];

// ---------------------------------------------------------------------------
// Itens da aventura
// ---------------------------------------------------------------------------
async function itensDaAventura() {
	const lista = [];
	const tesouro = (nome, desc, { qtd = 1, preco = 0, img = "icons/svg/item-bag.svg" } = {}) => ({ name: nome, type: "tesouro", img, system: { description: { value: P(desc) }, source: FONTE, qtd, preco } });
	const acessorio = (nome, desc, { preco, img, efeitos = [], custo = 0 }) => ({
		name: nome, type: "equipamento", img, effects: efeitos,
		system: { description: { value: P(...desc) }, source: FONTE, tipo: "acessorio", preco, peso: 0, espacos: 1, ativacao: { custo } }
	});

	lista.push(acessorio("Pingente da Sereia Adormecida", [
		"Uma pérola enorme e brilhante, envolta em uma rede de fios de prata. Seu usuário se torna imune a sono e sua recuperação de PV e PM é sempre confortável.",
		"O usuário pode gastar uma ação de movimento e 1 PM para remover uma condição de fadiga que esteja afetando qualquer criatura em alcance curto.",
		"Acessório menor. Item do leilão de Bac Arat (Parte 2, Cena 3)."
	], { preco: 3000, img: GER("joia-familia"), custo: 1 }));

	lista.push(acessorio("Cálices Encantados de Mulk", [
		"Um par de cálices de vidro elegantes, idênticos para qualquer um, exceto seu usuário. Quando a palavra de comando é pronunciada, o usuário enxerga um dos cálices ficar escuro.",
		"O cálice escuro torna venenoso qualquer líquido dentro dele: quem beber um gole deve passar em um teste de Fortitude (CD Int) ou fica @STATUS[enjoado] e perde [[/r 4d12[veneno]]] PV por rodada, por 10 rodadas. O outro cálice transforma líquido em antídoto — ideal para chantagens…",
		"Acessório médio. Item do leilão de Bac Arat."
	], { preco: 7500, img: "icons/svg/tankard.svg" }));

	const adaga = await doCompendio("equipamentos", "Adaga");
	if (adaga) {
		adaga.name = "Adaga do Último Suspiro";
		adaga.img = adaga.img ?? IMG.adaga;
		adaga.system.preco = 70000;
		adaga.system.source = FONTE;
		adaga.system.ativacao = { ...(adaga.system.ativacao ?? {}), custo: 2 };
		adaga.system.description.value = P(
			"Uma adaga prateada com uma lágrima vermelha em rubi na base da lâmina e empunhadura totalmente preta. A Último Suspiro é uma adaga formidável, assassina e sanguinária.",
			"Você pode gastar 2 PM para tocar em um cadáver e ver a última cena vista por esta criatura antes de morrer.",
			"Arma específica. Item do leilão de Bac Arat. O livro não detalha os encantos: os efeitos de assassina e sanguinária ficam com o mestre."
		);
		lista.push(adaga);
	} else relatorio.avisos.push("Adaga não encontrada no compêndio do sistema.");

	lista.push(acessorio("Manoplas do Mestre Moldador", [
		"Par de manoplas grossas de couro avermelhado, reforçadas com aço, que permitem moldar rocha e minérios comuns (mas não material especial) com as mãos.",
		`Você pode lançar ${G("Transmutar Objetos")}, com um aprimoramento adicional: <b>+3 PM:</b> muda a execução para ação completa e a duração para permanente. Se já conhece a magia, o custo para lançá-la diminui em –1 PM.`,
		"Acessório médio. Item do leilão de Bac Arat."
	], { preco: 21000, img: EQ("manopla") }));

	lista.push({
		name: "Pulmão da Montanha", type: "tesouro", img: GER("ferramenta-pesada"),
		flags: { world: { cdrRole: "pulmaoDaMontanha" } },
		system: {
			description: { value: P(
				"Fole de ferreiro de madeira escura adornado com runas. O couro lembra escamas e o bocal de saída tem a forma de uma cabeça de dragão, que parece \"soprar\" quando o objeto é manipulado. Dizem que é capaz de aspirar e expirar energias elementais.",
				"É a ferramenta necessária para forjar aço-rubi, mas suas capacidades mágicas estão latentes e só serão reveladas na Aventura 4. Quando o grupo o encontra, o couro está desgastado e as cores das escamas, opacas e desbotadas.",
				"<b>Artefato.</b>"
			) },
			source: FONTE, qtd: 1, preco: 0
		}
	});

	lista.push(tesouro("Carta de crédito da Guilda dos Mineradores", "Carta com o selo da Guilda dos Mineradores que Ezequias Heldret confia ao grupo para arrematar o artefato no leilão de Aslavi (Introdução).", { img: "icons/svg/book.svg" }));
	lista.push(tesouro("Moeda-convite de Bac Arat", "Moeda de brilho esverdeado, borda levemente espetada, mais grossa e pesada que um tibar comum. Numa face, o brasão de Aslothia; na outra, uma lua minguante e a inscrição BAC ARAT. Cada moeda permite o ingresso de um convidado mais um acompanhante no Leilão das Sombras.", { qtd: 2, img: IMG.moeda }));
	lista.push(tesouro("Bastão de teletransporte de Rà", "Pequeno bastão com um único botão, achado com Rà. Ao ser pressionado, desfaz-se em cinzas e forma no chão um círculo de linhas brilhantes que leva quem pisar nele ao Mercado das Nuvens, em Vectora. Uso único (fim da Parte 3).", { img: GER("varinha-arcana") }));
	return lista;
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------
const pastaAmeacas = await subpasta("Ameaças", "Actor");
const pastaPerigos = await subpasta("Perigos e Testes", "Actor");

const fichas = {};
for (const a of AMEACAS) fichas[a.nome] = await criarAmeaca(a, pastaAmeacas);
for (const v of VARIANTES) {
	const ator = await variante(v.base, v, pastaAmeacas);
	if (ator) fichas[v.nome] = ator;
}
for (const h of PERIGOS) fichas[h.nome] = await criarPerigo(h, pastaPerigos);

const itens = (await itensDaAventura()).map((i) => ({ ...i, folder: pasta.Item.id, flags: { ...(i.flags ?? {}), world: { ...(i.flags?.world ?? {}), cdr: TAG } } }));
const itensCriados = {};
for (const i of await Item.implementation.createDocuments(itens)) {
	itensCriados[i.name] = i;
	relatorio.criados.push(`Item: ${i.name}`);
}

// Tabela
const LICOR = [
	[[1, 2], "Inebriado", "O personagem fica inebriado (–2 em testes de Destreza e Sabedoria e em perícias baseadas nesses atributos) até o fim do dia."],
	[[3, 3], "Nenhum efeito", "Só o gosto de tinta e alga."],
	[[4, 5], "Sorte", "+2 em um atributo à escolha do personagem até o fim do dia."],
	[[6, 6], "Muita sorte", "+2 em um atributo à escolha até o fim do dia, mais [[/r 2d10]] PV temporários e [[/r 1d10]] PM temporários."]
];
const tabela = await RollTable.implementation.create({
	name: "A3 · Licor de Tinta de Kraken", img: "icons/consumables/potions/potion-flask-corked-pink.webp", folder: pasta.RollTable.id, flags: FLAGS("licorKraken"),
	formula: "1d6", replacement: true, displayRoll: true,
	description: "Servido na entrada do leilão (Parte 2, Cena 5): \"É para dar sorte... se você estiver com sorte.\" Misticismo ou Ofício (alquimia) CD 20 percebe que é mágico, mas não o efeito.",
	results: LICOR.map(([range, nome, desc]) => ({ type: "text", range, weight: range[1] - range[0] + 1, name: nome, description: desc }))
});
relatorio.criados.push(`Tabela: ${tabela.name}`);

// ---------------------------------------------------------------------------
// Macros
// ---------------------------------------------------------------------------
const WYRT = String.raw`// A3 · Partida de Wyrt (Blefe Fatal, Parte 1, Cena 4). Só o mestre.
// Selecione os tokens dos (até dois) personagens na mesa. "Jogar o turno" resolve o turno de um deles
// (aposta, mão inicial, blefe, ajuda e Hora da Verdade contra Prinkster +14). "Fim da rodada" rola a
// Bebida Amarga de quem bebeu e solta o próximo comentário de Prinkster. Bolsas e placar ficam salvos.
if (!game.user.isGM) return ui.notifications.warn("Só o mestre roda esta macro.");
const { DialogV2 } = foundry.applications.api;
const FLAG = "cdrWyrt";
const COMENTARIOS = [
	"Aslavi é um antro de ladrões e oportunistas. A cidade recebe muitos mercadores das Repúblicas Livres e até de Vectora. Alguns desses, ingênuos ou embriagados, confundem a languidez dos mortos-vivos de Aslothia com inocência, sendo alvos fáceis para golpistas.",
	"Mas alguns comerciantes de outros reinos vêm para ficar, foragidos ou simplesmente atraídos por uma vida menos regrada. Esses comerciantes trazem seus conhecimentos e estoques a um mercado menos... 'exigente' em relação à procedência de sua mercadoria.",
	"Esses comerciantes operam principalmente ao longo da rua principal de Aslavi. Lá há diversas lojas e tendas onde se encontram todo o tipo de objetos e quinquilharias estranhas. É um lugar muito procurado na busca de itens raros... ou ilegais.",
	"Porém, as melhores mercadorias não estão nas lojas! Os objetos mais valiosos e procurados são vendidos apenas nos leilões da cidade, promovidos periodicamente. Conhecidos como 'leilões das sombras', esses eventos são secretos e os convites são entregues de forma personalizada, restritos a convidados que provem a sua indignidade.",
	"Itens mágicos são proibidos no Reino dos Mortos e, quando são encontrados pelas autoridades, são confiscados. Estranhamente, muitos desses itens acabam aparecendo nos leilões de Aslavi. (sussurrando) Rumores dizem que essa é uma das fontes da riqueza do regente Ferren Asloth.",
	"Dizem que o convite é feito através de um estranho que aborda a pessoa em algum lugar da cidade e dá a ela uma moeda especial. Daqui a algumas noites, teremos um deles e eu serei o apresentador do evento!",
	"O próximo leilão será o maior de todos, e será realizado na chiquérrima mansão Bac Arat daqui três dias. Haverá um grande baile e, então, o leilão. A joia do evento será um objeto valiosíssimo para aqueles que desejam criar as armas mais poderosas de Arton.",
	"Esse item é chamado 'Pulmão da Montanha'. É um tipo de fole de ferreiro mágico, mas isso é tudo que sei. Chega de conversa, vamos jogar em silêncio agora!"
];
const novo = () => ({ prinkster: 300, comentario: 0, jogadores: {} });
let st = foundry.utils.deepClone(game.user.getFlag("world", FLAG) ?? novo());
const selecionados = canvas.tokens.controlled.map((t) => t.actor).filter(Boolean).slice(0, 2);
for (const a of selecionados) st.jogadores[a.id] ??= { nome: a.name, bolsa: 100, bebidas: 0, falhas: 0, fora: false };
const ativos = Object.entries(st.jogadores).filter(([, j]) => !j.fora && j.bolsa > 0);
const placar = () => "Prinkster: <b>T$ " + st.prinkster + "</b> · " + Object.values(st.jogadores).map((j) => j.nome + ": <b>T$ " + j.bolsa + "</b>" + (j.fora ? " (fora)" : "") + (j.falhas ? ", " + j.falhas + " falha(s) na bebida" : "")).join(" · ");
const sussurro = (html) => ChatMessage.create({ whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id), content: "<h3>Partida de Wyrt</h3>" + html + "<p>" + placar() + "</p>" });
const val = (a, id) => a?.system?.pericias?.[id]?.value ?? 0;
const rolar = async (f) => (await new Roll(f).evaluate()).total;

const content = "<p>" + placar() + "</p>" +
	'<label>Turno de <select name="quem">' + ativos.map(([id, j]) => '<option value="' + id + '">' + j.nome + "</option>").join("") + "</select></label>" +
	'<label>Aposta <select name="aposta"><option value="20">T$ 20</option><option value="50">T$ 50</option></select></label>' +
	'<label>Mão inicial <select name="mao"><option value="car">Carisma CD 15</option><option value="ladi">Ladinagem CD 20</option></select></label>' +
	'<label><input type="checkbox" name="blefe"> Blefar (Enganação CD 20)</label>' +
	'<label>Ajuda dos colegas (bônus total) <input type="number" name="ajuda" value="0"></label>' +
	'<label>Atrapalhar Prinkster (penalidade total) <input type="number" name="atrapalha" value="0" min="0"></label>' +
	'<label>Quem não bebeu nesta rodada <input type="text" name="naoBebeu" placeholder="nomes, separados por vírgula"></label>';
const r = await DialogV2.wait({
	window: { title: "Partida de Wyrt" }, content, rejectClose: false,
	buttons: [
		{ action: "turno", label: "Jogar o turno", default: true, callback: (e, b) => ({ a: "turno", f: b.form.elements }) },
		{ action: "rodada", label: "Fim da rodada", callback: (e, b) => ({ a: "rodada", f: b.form.elements }) },
		{ action: "zerar", label: "Nova partida", callback: () => ({ a: "zerar" }) }
	]
});
if (!r) return;
if (r.a === "zerar") {
	await game.user.setFlag("world", FLAG, novo());
	return ui.notifications.info("Nova partida de Wyrt: selecione os jogadores e rode de novo.");
}
if (r.a === "rodada") {
	const naoBebeu = (r.f.naoBebeu.value ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
	let html = "";
	let beberam = 0;
	for (const [id, j] of ativos) {
		if (naoBebeu.includes(j.nome.toLowerCase())) { html += "<p>" + j.nome + " não bebeu.</p>"; continue; }
		beberam++;
		const ator = game.actors.get(id);
		const cd = 15 + j.bebidas;
		const t = await rolar("1d20 + " + val(ator, "fort"));
		j.bebidas++;
		if (t >= cd) { html += "<p>" + j.nome + ": Fortitude " + t + " vs CD " + cd + " → resiste.</p>"; continue; }
		j.falhas++;
		const cond = ["frustrado", "esmorecido", "inconsciente"][Math.min(j.falhas, 3) - 1];
		if (j.falhas >= 3) j.fora = true;
		html += "<p>" + j.nome + ": Fortitude " + t + " vs CD " + cd + " → <b>" + cond + "</b>" + (j.fora ? " (sai do jogo)" : "") + ".</p>";
		try { await ator?.toggleStatusEffect?.(cond, { active: true }); } catch (e) { console.warn(e); }
	}
	if (beberam && !naoBebeu.length && st.comentario < COMENTARIOS.length) {
		html += "<p><b>Prinkster (" + (st.comentario + 1) + "/8):</b> <i>“" + COMENTARIOS[st.comentario] + "”</i></p>";
		st.comentario++;
	} else if (naoBebeu.length) html += "<p>Prinkster se ofende e não comenta nada nesta rodada.</p>";
	await game.user.setFlag("world", FLAG, st);
	return sussurro(html);
}
const id = r.f.quem.value;
const j = st.jogadores[id];
const ator = game.actors.get(id);
if (!j || !ator) return ui.notifications.warn("Selecione os tokens dos personagens na mesa.");
const aposta = Number(r.f.aposta.value);
let html = "<p><b>Turno de " + j.nome + "</b>, aposta T$ " + aposta + ".</p>";
// Pote: cada jogador ativo cobre (ou paga tudo o que tem); Prinkster paga o triplo.
let pote = 0;
for (const [, x] of ativos) { const v = Math.min(aposta, x.bolsa); x.bolsa -= v; pote += v; }
const vp = Math.min(aposta * 3, st.prinkster);
st.prinkster -= vp;
pote += vp;
// Mão inicial
let mod = 0;
if (r.f.mao.value === "car") {
	const t = await rolar("1d20 + " + (ator.system.atributos?.car?.value ?? 0));
	if (t >= 15) mod += 5; else if (t <= 10) mod -= 5;
	html += "<p>Mão inicial (Carisma " + t + " vs 15): " + (t >= 15 ? "mão boa, +5" : t <= 10 ? "mão ruim, –5" : "nada") + ".</p>";
} else {
	const t = await rolar("1d20 + " + val(ator, "ladi"));
	if (t >= 20) mod += 5;
	if (t <= 15) {
		j.fora = true;
		st.prinkster += pote; // a mesa fica com o pote
		html += "<p>Ladinagem " + t + " vs 20: <b>pego trapaceando!</b> Os ogros expulsam " + j.nome + " da taverna. Prinkster fica com o pote.</p>";
		await game.user.setFlag("world", FLAG, st);
		return sussurro(html);
	}
	html += "<p>Ladinagem " + t + " vs 20: " + (t >= 20 ? "mão boa, +5" : "nada") + ".</p>";
}
if (r.f.blefe.checked) {
	const t = await rolar("1d20 + " + val(ator, "enga"));
	if (t >= 20) mod += 2; else if (t <= 15) mod -= 5;
	html += "<p>Blefe (Enganação " + t + " vs 20): " + (t >= 20 ? "+2" : t <= 15 ? "blefe evidente, –5" : "nada") + ".</p>";
}
mod += Number(r.f.ajuda.value) || 0;
// Hora da Verdade: todos os jogadores ativos rolam Jogatina; só o do turno tem os modificadores.
const resultados = [];
for (const [xid, x] of ativos) {
	const a = game.actors.get(xid);
	const t = await rolar("1d20 + " + val(a, "joga") + (xid === id ? " + " + mod : ""));
	resultados.push({ nome: x.nome, id: xid, t });
}
const tp = await rolar("1d20 + 14 - " + (Number(r.f.atrapalha.value) || 0));
resultados.push({ nome: "Prinkster", id: null, t: tp });
resultados.sort((a, b) => b.t - a.t);
const venc = resultados[0];
html += "<p>Hora da Verdade (Jogatina): " + resultados.map((x) => x.nome + " " + x.t).join(", ") + " → <b>" + venc.nome + "</b> leva T$ " + pote + ".</p>";
if (venc.id) st.jogadores[venc.id].bolsa += pote; else st.prinkster += pote;
for (const x of Object.values(st.jogadores)) if (x.bolsa <= 0 && !x.fora) { x.fora = true; html += "<p>" + x.nome + " ficou sem dinheiro e sai do jogo.</p>"; }
if (st.prinkster <= 0 || Object.values(st.jogadores).every((x) => x.fora)) html += "<p><b>Fim de jogo.</b> Prinkster se levanta: “Foi uma noite extremamente agradável. Se não fosse pelo desastre do omelete, teria sido impecável. Parto agora, mas algo me diz que nos encontraremos novamente…” (duas piscadelas com o olho esquerdo). Na mesa, duas moedas-convite de Bac Arat.</p>";
await game.user.setFlag("world", FLAG, st);
sussurro(html);`;

const CASSINO = String.raw`// A3 · Cassino Dimensional (Blefe Fatal, Parte 3, Cena 4). Só o mestre.
// Baralho simulado com d20 + d4 (como no livro). Selecione os tokens (personagens e Rà).
// "Comprar" completa a mão de cada um (3 cartas; 5 para Rà) e mostra a ordem de ação.
// "Usar cartas" retira da mão as cartas marcadas. As mãos ficam salvas entre as rodadas.
if (!game.user.isGM) return ui.notifications.warn("Só o mestre roda esta macro.");
const { DialogV2 } = foundry.applications.api;
const FLAG = "cdrCassino";
const NAIPES = { 1: ["paus", "♣", "ação de movimento"], 2: ["copas", "♥", "ação padrão (exceto atacar)"], 3: ["espadas", "♠", "ação agredir"], 4: ["ouros", "♦", "ação completa"] };
const VALORES = { 1: "Ás", 11: "Valete", 12: "Rainha", 13: "Rei", 14: "Curinga" };
const ESPECIAL = { 1: "ação extra que não conta no limite do turno", 11: "outra criatura em alcance curto rola de novo um teste", 12: "habilidade sem pagar o custo básico em PM", 13: "+5 em um teste", 14: "emula qualquer carta" };
const nomeCarta = (c) => c.v === 14 ? "Curinga" : (VALORES[c.v] ?? c.v) + " de " + NAIPES[c.n][0] + " " + NAIPES[c.n][1];
const descCarta = (c) => nomeCarta(c) + (c.v === 14 ? "" : " (" + NAIPES[c.n][2] + ")") + (ESPECIAL[c.v] ? " — " + ESPECIAL[c.v] : "");
async function carta() {
	let v;
	do v = (await new Roll("1d20").evaluate()).total; while (v > 14);
	const n = (await new Roll("1d4").evaluate()).total;
	return { v, n };
}
const st = foundry.utils.deepClone(game.user.getFlag("world", FLAG) ?? {});
const atores = canvas.tokens.controlled.map((t) => t.actor).filter(Boolean);
if (!atores.length) return ui.notifications.warn("Selecione os tokens dos personagens e de Rà.");
const ehRa = (a) => /^r[aà]$/i.test(a.name.trim());
const corpo = atores.map((a) => "<p><b>" + a.name + "</b>: " + ((st[a.id] ?? []).map((c, i) => '<label><input type="checkbox" name="u_' + a.id + "_" + i + '"> ' + descCarta(c) + "</label>").join("<br>") || "sem cartas") + "</p>").join("");
const r = await DialogV2.wait({
	window: { title: "Cassino Dimensional" }, content: corpo, rejectClose: false,
	buttons: [
		{ action: "comprar", label: "Comprar (nova rodada)", default: true, callback: () => ({ a: "comprar" }) },
		{ action: "usar", label: "Usar/descartar marcadas", callback: (e, b) => ({ a: "usar", f: b.form.elements }) },
		{ action: "zerar", label: "Encerrar o jogo", callback: () => ({ a: "zerar" }) }
	]
});
if (!r) return;
if (r.a === "zerar") { await game.user.unsetFlag("world", FLAG); return ui.notifications.info("Cassino Dimensional encerrado."); }
let html = "";
if (r.a === "usar") {
	for (const a of atores) {
		const mao = st[a.id] ?? [];
		const usadas = mao.filter((c, i) => r.f["u_" + a.id + "_" + i]?.checked);
		if (!usadas.length) continue;
		st[a.id] = mao.filter((c, i) => !r.f["u_" + a.id + "_" + i]?.checked);
		html += "<p><b>" + a.name + "</b> usa/descarta: " + usadas.map(nomeCarta).join(", ") + ".</p>";
	}
} else {
	const ordem = [];
	for (const a of atores) {
		const mao = st[a.id] ?? [];
		const alvo = ehRa(a) ? 5 : 3;
		while (mao.length < alvo) mao.push(await carta());
		st[a.id] = mao;
		const maior = Math.max(...mao.filter((c) => c.v >= 2 && c.v <= 10).map((c) => c.v), 0);
		ordem.push({ a, maior });
		html += "<p><b>" + a.name + "</b>: " + mao.map(descCarta).join("; ") + ".</p>";
	}
	ordem.sort((x, y) => y.maior - x.maior);
	html = "<p><b>Ordem (maior carta numérica):</b> " + ordem.map((o) => o.a.name + " (" + (o.maior || "—") + ")").join(" → ") + "</p>" + html;
}
await game.user.setFlag("world", FLAG, st);
if (html) ChatMessage.create({ whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id), content: "<h3>Cassino Dimensional</h3>" + html });`;

for (const [nome, cmd, img, role] of [
	["A3 · Partida de Wyrt", WYRT, "icons/svg/card-hand.svg", "wyrt"],
	["A3 · Cassino Dimensional", CASSINO, "icons/svg/card-joker.svg", "cassino"]
]) {
	await Macro.implementation.create({ name: nome, type: "script", scope: "global", img, folder: pasta.Macro.id, flags: FLAGS(role), command: cmd });
	relatorio.criados.push(`Macro: ${nome}`);
}

// ---------------------------------------------------------------------------
// Diários
// ---------------------------------------------------------------------------
const L = (n, rotulo) => (fichas[n] ? `@UUID[${fichas[n].uuid}]{${rotulo ?? n}}` : rotulo ?? n);
const I = (n, rotulo) => (itensCriados[n] ? `@UUID[${itensCriados[n].uuid}]{${rotulo ?? n}}` : rotulo ?? n);
const linha = (local, txt) => `<li><b>${local}:</b> ${txt}</li>`;
const ul = (arr) => `<ul>${arr.join("")}</ul>`;
const paginas = (lista) => lista.map((pg, i) => ({ name: pg.name, type: "text", sort: (i + 1) * 100, title: { show: true, level: 1 }, text: { content: pg.html, format: 1 } }));

const roteiro = [
	{ name: "Visão geral", html: P(
		"<b>Blefe Fatal</b> (livro, pp. 47–61). Personagens do 8º ao 11º nível. Aventura de intriga em Aslavi, cidade de jogatina e leilões de Aslothia, o Reino dos Mortos: esperteza vale mais que força bruta. Aqui nada é proibido, desde que você não seja pego.",
		"<b>Parte 1:</b> entrar em Aslavi e descobrir o leilão e o artefato. <b>Parte 2:</b> chegar ao Leilão das Sombras em Bac Arat; os itens são roubados e o grupo é acusado. <b>Parte 3:</b> atrás da verdadeira ladra, Rà, até o Cassino Dimensional.",
		`<b>Introdução:</b> em Yuvalin, o anão Thrûn ouviu boatos de um item capaz de forjar aço-rubi que será leiloado em Aslothia. Ezequias conta de Aslavi e entrega a missão e a ${I("Carta de crédito da Guilda dos Mineradores")}.`,
		"<b>Viagem</b> (cerca de 2.000 km, semanas): pelo leste, cruzando a Supremacia Purista, ou pelo sul (Deheon, Wynlla e o Mar do Dragão-Rei). Resolva com descrição (Jornadas, T20 p. 267), com o perigo complexo Jornada pelos Ermos (longa, T20 p. 320) ou com uma aventura sua."
	) },
	{ name: "Aslavi", html: P(
		"Cerca de 100 km ao sul de Milothiann, sobre uma colina íngreme: construções amontoadas, vielas estreitas que terminam em barrancos, névoa densa e lampiões. Muro de pedra de 6 m; portão vigiado por quatro esqueletos (dois no portão, dois na torre) e uma aparição.",
		"<b>Barganha:</b> vencer muda o preço em 15% a seu favor; vencer por 10 ou mais, 30%. Perder por 5 ou mais: compra algo sem valor real.",
		"<b>Leilões secretos:</b> cimitarra dançarina, adaga sanguinária, clava profana, punhal sszzazita, carapaça demoníaca, manto da noite, anel da invisibilidade, brincos da sagacidade, caveira maldita e todo tipo de veneno.",
		"Forasteiros são tolerados porque a cidade enche os cofres reais. Devotos de deuses do Bem, cavaleiros da Luz e arcanistas não recebem essa hospitalidade."
	) },
	{ name: "Parte 1 — Mão de Kobold", html: ul([
		linha("Cena 1 — Portões da Morte", `A aparição cobra pedágio de T$ 200 por pessoa. Se não pagarem, ou se virem devoto de Azgher, Khalmyr, Lena ou Thyatis, cavaleiro da Luz ou arcanista, os guardas atacam: ${G("Aparição", "aparição")}, ${G("Esqueleto de Elite", "2 esqueletos de elite")} no portão e ${L("Guarda de Aslavi (besteiro)", "2 besteiros")} na torre. Mesmo de dia a aparição não fica debilitada (o céu é sempre encoberto). Se o combate passar de 5 rodadas, no início da 6ª surgem ${R("1d4+1")} ${G("Esqueleto", "esqueletos")}.`),
		linha("Cena 2 — Em Aslavi", "Praça central de comerciantes que sussurram ofertas. Passeios, compras, e logo a Lixo Trancado."),
		linha("Cena 3 — Lixo Trancado", `Maior taverna de Aslavi: bar no térreo, hospedaria em cima e casa de apostas no porão (o dobro do tamanho). Agatha, a taverneira da colher de pau; Opritnik, hynne recepcionista, garçom e batedor de carteiras; as raparigas Tayla e Aiana; três ${G("Ogro", "ogros")} seguranças com maças. Opritnik deixa escapar que o osteon da mesa do fundo vai conduzir o leilão amanhã (e reclamou do omelete de naja). Prinkster, de casaca e cartola, com os "colegas" Vrat e Porac (${L("Assassino Putrefato", "assassinos putrefatos")} disfarçados), convida para o jogo: "Se quiserem conversar, precisam jogar."`),
		linha("Cena 4 — Partida de Wyrt", `${L("Partida de Wyrt")}. Macro <b>A3 · Partida de Wyrt</b> (página "Comentários de Prinkster"). No fim, duas ${I("Moeda-convite de Bac Arat", "moedas-convite de Bac Arat")} ficam na mesa.`),
		linha("Cena 5 — Ambição Élfica", `Uma adaga crava na mesa onde estavam as moedas. Trio de Elfos: ${L("Sihnion")}, ${L("Sillion")} e ${L("Siora")}. Os seguranças estão escoltando Prinkster: ninguém intervém.`),
		linha("Cena 6 — Hospedagem Grátis", "Agatha agradece, repreende Opritnik e oferece os aposentos pelo tempo que quiserem. Três dias para descansar, comprar e se preparar.")
	]) },
	{ name: "Parte 2 — Castelo de Barro", html: ul([
		linha("Cena 1 — Sangue & Ouro", `As moedas-convite sumiram. Investigação CD 15: pedaço de capa preta ensanguentado na janela. A rua dos fundos está sob <i>Escuridão</i>; Sobrevivência CD 15 (–5 sem dissipar) segue o sangue até um casebre. ${L("Dazan, o Vampiro Falido")} dorme no divã com uma taça vazia; o próximo movimento o acorda. Com menos da metade dos PV foge como morcego. Os convites estão no casebre.`),
		linha("Cena 2 — Floresta dos Papa-Dim", `Agatha empresta uma carruagem. Placa: "Você está adentrando a Floresta dos Papa-Dim. Cuidado". Conhecimento, Misticismo ou Sobrevivência CD 20 para saber o que são. Percepção CD 15: a carruagem da frente joga moedas e os papa-dim param para recolher. ${L("Enxame de Papa-dim")}; matar não resolve: ${L("Fuga dos Papa-Dim")}.`),
		linha("Cena 3 — Chegando em Bac Arat", `Mansão de pedra de três andares, salão circular sob abóbada de vitral, luzes vermelhas e roxas. Banquete e aposentos; de manhã, o pergaminho do leilão (veja "Documentos para os jogadores") e a exposição no 2º andar: ilusões dos cinco itens numa sala pentagonal (os verdadeiros estão nos "cofres malditos"). Itens: ${I("Pingente da Sereia Adormecida")}, ${I("Cálices Encantados de Mulk")}, ${I("Adaga do Último Suspiro")}, ${I("Manoplas do Mestre Moldador")} e ${I("Pulmão da Montanha")}.`),
		linha("Cena 4 — Medusas Barraqueiras", `Três medusas brigam por uma bolsa; a terceira organiza apostas. A bolsa voa no grupo: todos fazem Reflexos e o menor resultado leva ${R("1d4+2", "impacto")} e cai. Irmãs Medusas: 3 ${G("Cultista de Sszzaas", "cultistas de Sszzaas")} (raça medusa). A segurança chega em ${R("1d4+1")} rodadas e expulsa todos, mas Prinkster intervém: "Esses não. São meus convidados." À noite, festa.`),
		linha("Cena 5 — O Dia do Leilão", `Na entrada, um esqueleto garçom serve ${"@UUID[" + tabela.uuid + "]{Licor de Tinta de Kraken}"} (Misticismo ou Ofício (alquimia) CD 20: é mágico). Prinkster abre o leilão com o Pingente... que não chega. O palco explode: Prinkster morto, "desta vez, em definitivo". Dazan acusa o grupo e a multidão avança. Termine a cena aqui.`)
	]) },
	{ name: "Parte 3 — Valha-me Nimb", html: ul([
		linha("Cena 1 — Fim de Festa", L("Fim de Festa")),
		linha("Cena 2 — Detrás das Cortinas", `Porta trancada com trava de madeira. Salão com urna num pedestal no meio de uma piscina sem fundo; porta de pedra trancada por magia; teletransporte não funciona. A urna guarda uma chave de ferro; ao pegá-la, um elfo anuncia a recompensa de T$ 100.000 pelo grupo e surge a Guardiã do Cofre: uma ${G("Hidra", "hidra")} (cinco cabeças). Lembre que podem fugir pela porta de pedra com a chave.`),
		linha("Cena 3 — Desvendando o Mistério", `O cofre pentagonal com os itens verdadeiros. "Prinkster" guarda o Pulmão da Montanha numa caixa e se revela: é ${L("Rà")}. Bola de Fogo na parede e fuga; 4 ${L("Assassino Putrefato", "assassinos putrefatos")} bloqueiam o caminho. Depois, perseguição de carroça (Rà joga prata aos papa-dim) até a Lixo Trancado.`),
		linha("Cena 4 — De volta à Taverna", `Rastro de sangue até o porão. Rà segura Agatha com uma adaga; Opritnik e as raparigas desmaiados; os ogros enfeitiçados. Rà quer a recompensa e propõe um Wyrt: "Se me atacarem agora... todos aqui morrem." Teletransporte para o ${L("Cassino Dimensional")} (macro <b>A3 · Cassino Dimensional</b>).`),
		linha("Epílogo", `De volta à mesa, Rà desacordada. Agatha está com o Pulmão da Montanha e o ${I("Bastão de teletransporte de Rà")}: "Ele serve para ir até Vectora. Agora vão, antes que os guardas cheguem!" O grupo surge no Mercado das Nuvens. Perguntas: como o artefato funciona? Para quem Rà ia entregá-lo em Vectora? Personagens no 11º nível.`)
	]) },
	{ name: "Comentários de Prinkster", html: P("Um por rodada da Partida de Wyrt, nesta ordem, se os personagens beberem com ele (a macro solta sozinha).") + `<ol>${[
		"Aslavi é um antro de ladrões e oportunistas: mercadores das Repúblicas Livres e de Vectora viram alvos fáceis de golpistas.",
		"Comerciantes foragidos de outros reinos trazem estoques de procedência duvidosa.",
		"Eles ficam na rua principal: itens raros... ou ilegais.",
		"As melhores mercadorias estão nos 'leilões das sombras', secretos, com convite personalizado.",
		"Itens mágicos confiscados pelas autoridades aparecem nos leilões; rumores de que enriquecem o regente Ferren Asloth (sussurrado).",
		"O convite é uma moeda especial entregue por um estranho; Prinkster será o apresentador do próximo.",
		"O maior leilão será na mansão Bac Arat em três dias, com baile; a joia é um objeto para criar as armas mais poderosas de Arton.",
		"O item é o 'Pulmão da Montanha', um fole de ferreiro mágico. \"Chega de conversa!\""
	].map((x) => `<li>${x}</li>`).join("")}</ol>` }
];

const documentos = [
	["Pergaminho sobre os Itens (Bac Arat)", "<i>Os produtos mais maravilhosos, por valores um tanto quanto presunçosos.</i></p><ul><li><b>Pingente da Sereia Adormecida.</b> “Quando o sono eterno dominar sua alma, segure o Pingente da Sereia Adormecida forte em sua palma.”</li><li><b>Cálice Encantado de Mulk.</b> “Se os lábios de um amigo o elixir toca, sua saúde será recuperada. Se um inimigo o líquido prova, sua vida poderá ser fulminada.”</li><li><b>Adaga do Último Suspiro.</b> “Em face da morte do amor irrefutável, a vingança será, então, inevitável.”</li><li><b>Manoplas do Mestre Moldador.</b> “Ao toque dessas luvas, pedras e metal serão tão moldáveis quanto barro primordial.”</li><li><b>Pulmão da Montanha.</b> “O sangue da terra toma forma, quando o sopro poderoso atinge a bigorna.”</li></ul><p>"],
	["Moeda-convite de Bac Arat", "Moeda de brilho esverdeado e borda espetada. Numa face, o brasão de Aslothia; na outra, uma lua minguante e a inscrição <b>BAC ARAT</b>. Vale um convidado e um acompanhante."],
	["Placa na estrada", "<i>Você está adentrando a Floresta dos Papa-Dim. Cuidado.</i>"],
	["Recompensa (anunciada em Bac Arat)", "<i>Notícias frescas da capital! O reino está oferecendo uma recompensa de cem mil Tibares pela cabeça de foragidos cuja descrição se parece muito com esse grupo aí!</i>"]
];

await JournalEntry.implementation.createDocuments([
	{ name: "A3 · Como usar no Foundry", folder: pasta.JournalEntry.id, flags: FLAGS("comoUsar"), pages: paginas([
		{ name: "Visão geral", html: P(
			"Tudo desta aventura fica nas pastas <b>A3 · Blefe Fatal</b> (Atores, Itens, Tabelas, Macros e Diários). As ameaças novas e as variantes estão em <i>Ameaças</i>; os perigos e testes em <i>Perigos e Testes</i>. Cenas e mapas ficam por sua conta.",
			"As criaturas do livro básico (esqueleto, esqueleto de elite, aparição, hidra, cultista de Sszzaas, ogro) vêm do compêndio de ameaças do <b>Giria T20</b>: os links do roteiro abrem as fichas de lá.",
			"Dazan e o Guarda de Aslavi (besteiro) são cópias das fichas do sistema (vampiro e esqueleto de elite) com as mudanças do livro.",
			"Fichas conferidas com o livro (pp. 59–61)."
		) },
		{ name: "Automações", html: ul([
			linha("Assassino Putrefato", "Espada púrpura com +4d8 de trevas automático e botão \"Sangrando\"; Ataque Furtivo (+7d6) como opção; Emanação de Trevas com rolagem e botão \"Fatigado\"; Vulto Mortal (+10 Furtividade) como botão."),
			linha("Enxame de Papa-dim", "Rolagem do enxame (8d8+20) e botões \"Atordoado (1 rodada)\" e \"Sangrando\" na Mordida Trituradora."),
			linha("Rà", "Florete com margem 16, magias de barda (CD 30) na ficha; Distração e Espetáculo Mortal descritos."),
			linha("Sihnion e Sillion", "Rolagem do aparar (+27) na reação."),
			linha("Partida de Wyrt", "Macro A3 · Partida de Wyrt: aposta, mão inicial, blefe, ajuda, Hora da Verdade contra Prinkster (+14), pote, Bebida Amarga (CD crescente, aplica frustrado/esmorecido/inconsciente) e os 8 comentários em ordem."),
			linha("Fuga dos Papa-Dim", "Macro CdR · Teste estendido (5 sucessos de Conduzir)."),
			linha("Cassino Dimensional", "Macro A3 · Cassino Dimensional: compra 3 cartas por personagem e 5 para Rà (d20 + d4), mostra a ordem de ação e o que cada carta permite."),
			linha("Licor de Tinta de Kraken", "Tabela 1d6.")
		]) }
	]) },
	{ name: "A3 · Roteiro", folder: pasta.JournalEntry.id, flags: FLAGS("roteiro"), pages: paginas(roteiro) },
	{ name: "A3 · Documentos para os jogadores", folder: pasta.JournalEntry.id, flags: FLAGS("documentos"), pages: documentos.map(([n, t], i) => ({ name: n, type: "text", sort: (i + 1) * 100, title: { show: true, level: 1 }, text: { content: `<p>${t}</p>`, format: 1 } })) }
]);

const ulr = (arr) => (arr.length ? `<ul>${arr.map((x) => `<li>${x}</li>`).join("")}</ul>` : "<p>—</p>");
ChatMessage.create({
	whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id),
	content: `<h3>${NOME_PASTA}</h3><p><b>Criados (${relatorio.criados.length}):</b></p>${ulr(relatorio.criados)}` + (relatorio.avisos.length ? `<p><b>Avisos:</b></p>${ulr(relatorio.avisos)}` : "")
});
