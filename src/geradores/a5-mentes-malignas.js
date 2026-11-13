/* =====================================================================
 * CORAÇÃO DE RUBI · AVENTURA 5 · "MENTES MALIGNAS QUE PLANEJAM DESTRUIÇÃO"
 * Gerador de conteúdo para Foundry VTT v14 + sistema Tormenta20 (Vizael 1.6.x)
 *
 * Fonte do compêndio do módulo giriarpg-coracao-de-rubi (o build roda este arquivo num Foundry
 * simulado). Também funciona como macro de Script, colado inteiro e executado pelo Mestre.
 * Cria, na pasta "A5 · Mentes Malignas" de cada tipo:
 *  • 11 ameaças novas do livro (pp. 100–103): ARQUEMIS-B, Bateria de Artilharia, Ber'baram, Manada de
 *    Ber'baram, Corvo de Krauser, Diligência Dracocérbera, Golem de Reconhecimento, Grupo de Assalto de
 *    Elite, Hidra Helicoide, Príncipe Conrad Kor Kovith e Reator de Tormenta. Criaturas de outros livros
 *    (golem de ferro, capitão-baluarte, capelão de guerra, cavaleiro do leopardo, lefeu) ficam como links
 *    para o Giria T20.
 *  • 5 perigos e testes: Perseguição Celeste (ND 15), Pólvora Goblin (ND 8), Caminhada pelo Inferno,
 *    O Código Lefeu (ND 16) e Portal do Reator.
 *  • Itens: Hariken, caderno de Ezequias, carta de corso de Lislah, bombas alquímicas de Ezequias,
 *    engrenagens, e os parceiros Mariposa, Mestre Muramune e os reféns da Fundição.
 *  • Macro A5 · Salto sobre Yuvalin (teste de salto e local de pouso).
 *  • Diários: Como usar no Foundry, Roteiro e Documentos para os jogadores.
 * Rodar de novo apaga (depois de confirmar) o que tem a marca flags.world.cdr = "a5" e recria tudo.
 *
 * Os links @GIRIA[nome|livro] viram links para o compêndio do Giria T20 no build do módulo.
 * Fichas conferidas com o livro Coração de Rubi, pp. 85–103.
 * ===================================================================== */
if (!game.user.isGM) return ui.notifications.error("Só o Mestre pode rodar este gerador.");

const TAG = "a5";
const FLAGS = (role) => ({ world: role ? { cdr: TAG, cdrRole: role } : { cdr: TAG } });
const NOME_PASTA = "A5 · Mentes Malignas";
const FONTE = "Coração de Rubi — Mentes Malignas que Planejam Destruição";
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
		window: { title: "Aventura 5: recriar conteúdo" },
		content: `<p>Já existem <b>${antigos.length}</b> documentos gerados para a Aventura 5.</p>
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
		flags: { tormenta20: { coracaoDeRubi: "aventura5" }, world: { cdr: TAG, ...(a?.automacoes ? { cdrAutomacoes: a.automacoes } : {}) } }
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
		flags: { tormenta20: { coracaoDeRubi: "aventura5" }, world: { cdr: TAG } }
	});
	relatorio.criados.push(`Perigo: ${h.nome}`);
	return actor;
}


const GL = (nome, livro, rotulo) => `@GIRIA[${nome}|${livro}]{${rotulo ?? nome}}`;

// ---------------------------------------------------------------------------
// Ameaças (livro, pp. 100–103)
// ---------------------------------------------------------------------------
IMG.acido = GER("acido");
IMG.marca = HAB("visao-ampla");
IMG.mira = "icons/svg/target.svg";
IMG.canhao = "icons/svg/explosion.svg";
IMG.trevas = "icons/svg/skull.svg";
IMG.raio = "icons/svg/lightning.svg";
IMG.invisivel = "icons/svg/invisible.svg";
IMG.tormenta = "icons/svg/eye.svg";
IMG.bando = "icons/svg/combat.svg";
IMG.reparo = "icons/svg/regen.svg";
IMG.bastarda = EQ("espada-bastarda");

const BANDO = (nome) => habilidade("Bando", `${nome} é um grupo de indivíduos. Se um ataque do bando exceder a Defesa do inimigo por 10 ou mais, causa o dobro do dano; se errar, ainda causa metade. Imune a manobras de combate e a efeitos de alvo único que não causam dano; vulnerável a dano de área. Quem tem Trespassar e acerta o bando pode usá-lo contra ele (uma vez por turno).`, { img: IMG.bando });
const INVISIBILIDADE = (nome) => habilidade("Invisibilidade Noturna", `Durante a noite, ${nome} recebe camuflagem total e +20 em Furtividade. Perde esta habilidade quando o grupo acumula os 5 sucessos de Olhos no Céu (Perseguição Celeste).`, { img: IMG.invisivel });
const CURA = (n, quem, desc) => habilidade(`${quem} (cura acelerada ${n})`, `${desc}<br><b>Automação:</b> em combate, o módulo cura ${n} PV no início do turno. Se a equipe for afetada por uma condição (mental, no caso do ARQUEMIS), desligue apagando a marca em <i>flags.world.cdrAutomacoes</i> ou apague esta habilidade.`, { img: IMG.reparo, rolls: [rolagemDano("Cura acelerada", String(n), "curapv")] });
const DISTORCAO = (cd) => habilidade("Campo de Distorção", `Criaturas que terminem o turno em alcance médio ficam esmorecidas e debilitadas por uma rodada e perdem 1d6 PM (Fort CD ${cd} evita). Tormenta.`, {
	img: IMG.tormenta, alcance: "medium", resistencia: "Fortitude evita", rolls: [rolagemFormula("PM perdidos", "1d6")], efeitos: [efCondicao("esmorecido", { rodadas: 1 }), efCondicao("debilitado", { rodadas: 1 })]
});
const ENGRENAGENS = "Padrão, mais 1d6 engrenagens (CD 30 para extrair; cada uma conta como T$ 1.000 em matéria-prima para engenhocas).";

const AMEACAS = [
	{
		nome: "ARQUEMIS-B", nd: "17", tipo: "con", tamanho: "col", img: ICONE("colosso-supremo"), automacoes: { curaAcelerada: { valor: 30 } },
		atr: { for: 15, des: 0, con: 12, int: 0, sab: 2, car: -4 },
		pv: 1020, pm: 180, defesa: 54, desl: 15, cd: 44, ic: ["atordoado"],
		resistencias: "imunidade a atordoamento, ilusão e movimento, imunidade a camuflagem e escuridão (inclusive mágicas), redução de dano 20, resistência a magia +5",
		pericias: { inic: 15, perc: 17, fort: 30, refl: 17, vont: 24, luta: 47 },
		ataquescac: "Quatro espadas titânicas +47 (4d12+23, 19).",
		magias: ["Seta Infalível", "Flecha Ácida", "Lança Ígnea", "Raio Polar"],
		bio: "Colosso de guerra purista: esqueleto de gigante reanimado banhado em adamante líquido, com dois braços biônicos extras e canhões nos ombros; rios de metal líquido escorrem das frestas e colunas de fumaça vermelha saem dos tubos. O ARQUEMIS-A explodiu nos testes. No cerne, o Reator de Tormenta. Parte 3, Cena 4. A 0 PV desaba (10d6 de impacto em alcance curto, Ref CD 25 reduz à metade) e pode se reerguer pela cura acelerada; se a tripulação estiver desabilitada, entra em Fissão do Reator. Com Lislah atacando com o Mariposa, está sempre flanqueado. Veja as vantagens do Código Lefeu no roteiro.",
		itens: () => [
			arma("Espada titânica", { img: IMG.bastarda, dano: "4d12+23", tipo: "corte", critM: 19, desc: P("Quatro ataques por ação agredir. Com <i>É Grande, mas não É Dois</i>, os personagens têm +10 na Defesa contra estes ataques.") }),
			habilidade("Blindagem Adaptativa", "Na primeira vez que sofre dano na rodada, o ARQUEMIS-B evita esse dano e fica imune a esse tipo de dano até o início do seu próximo turno. Com <i>Brecha na Armadura</i>, os personagens ignoram a redução de dano do colosso.", { img: IMG.fort, execucao: "reaction" }),
			DISTORCAO(44),
			habilidade("Fissão do Reator", "Quando é reduzido a 0 PV ou menos numa rodada em que a Tripulação de Elite está inativa, o reator entra em fissão: uma sirene soa por duas rodadas e o colosso explode num raio de 30 m. Criaturas na área sofrem 150 de essência e itens mágicos (exceto artefatos) viram mundanos para sempre (Fort CD 44 reduz o dano à metade e o efeito nos itens para 1 dia). Depois surge o Reator de Tormenta.", { img: IMG.canhao, area: "30m", resistencia: "Fortitude reduz à metade", rolls: [rolagemDano("Dano", "150", "essencia")] }),
			habilidade("Irrefreável", "O ARQUEMIS-B sempre percorre seu deslocamento em direção a Yuvalin, passando por qualquer criatura Grande ou menor no caminho: 6d8 de impacto (Ref CD 44 reduz à metade).", { img: IMG.pancada, execucao: "move", resistencia: "Reflexos reduz à metade", rolls: [rolagemDano("Atropelar", "6d8", "impacto")] }),
			habilidade("Resíduos Tóxicos", "Quem causa dano ao colosso com ataque corpo a corpo sofre 4d6 de fogo e perde 1d6 PM (não vale para armas alongadas).", { img: IMG.fogo, rolls: [rolagemDano("Fogo", "4d6", "fogo", 0), rolagemFormula("PM perdidos", "1d6", 1)] }),
			habilidade("Torres de Artilharia", "Quatro torres magibélicas; cada uma lança uma vez por turno, como ação livre: Seta Infalível de Talude, Flecha Ácida, Lança Ígnea de Aleph e Raio Polar. Tem 180 PM de \"munição\", pode usar até 10 PM em aprimoramentos por magia (sem pagar o custo básico) e todas contam como Magia Ampliada. Com <i>Fogo de Suporte</i> e o Mariposa, perde uma torre (1d4) no fim da 2ª rodada e a cada duas rodadas.", { img: IMG.canhao, execucao: "free", rolls: [rolagemFormula("Torre perdida (1d4)", "1d4")] }),
			CURA(30, "Tripulação de Elite", "Engenhoqueiros e arcanistas consertam o colosso por dentro. A tripulação é imune a dano, mas não a efeitos mentais: Vontade +10 (com a resistência a magia do colosso); qualquer condição mental desliga a cura. Com <i>Explosão de Raiva</i>, magos do Reinado a confundem e o colosso perde a cura acelerada.")
		]
	},
	{
		nome: "Bateria de Artilharia", nd: "9", tipo: "con", tamanho: "gra", img: ICONE("engenho-de-guerra-goblin"),
		atr: { for: 4, des: -2, con: 5, int: 0, sab: 4, car: -4 },
		pv: 252, defesa: 32, desl: 3, cd: 30, sentidos: ["escuro"], vulneravel: ["fogo"],
		resistencias: "redução de dano 10, vulnerabilidade a fogo",
		pericias: { inic: 2, perc: 12, fort: 15, refl: 9, vont: 21, pont: 25 },
		ataquesad: "Dois canhões +25 (4d10+17, 19/x3, alcance longo).",
		bio: "Autômato de grande poder de fogo e pouca mobilidade, usado em quantidade para defender fortificações. Parte 2: quatro nos Jardins-Estufa (Cena 3) e duas nos Portões da Fundição (Cena 11).",
		itens: () => [
			arma("Canhão", { img: IMG.canhao, pericia: "pont", dano: "4d10+17", tipo: "impacto", critM: 19, critX: 3, alcance: "long", proposito: "disparo", proficiencia: "fogo", desc: P("Dois disparos por ação agredir.") }),
			habilidade("Explosivo", "Quando chega a 0 PV ou menos, treme e solta fumaça; no início do próximo turno explode: 12d6 de fogo em alcance curto (Ref CD 30 reduz à metade).", { img: IMG.canhao, alcance: "short", resistencia: "Reflexos reduz à metade", rolls: [rolagemDano("Explosão", "12d6", "fogo")] }),
			habilidade("Sistema de Mira", "Não sofre –5 por atacar à distância alvos em corpo a corpo e, quando mira, ignora chance de falha por camuflagem.", { img: IMG.mira })
		]
	},
	{
		nome: "Ber'baram", nd: "8", tipo: "esp", raca: "Elemental", tamanho: "gra", img: ICONE("cao-do-inferno"),
		atr: { for: 8, des: 5, con: 5, int: -2, sab: 2, car: 2 },
		pv: 320, defesa: 30, desl: 15, cd: 26, sentidos: ["escuro"], imune: ["fogo"], vulneravel: ["frio"], ic: ["atordoado", "fatigado", "exausto", "paralisado"],
		resistencias: "imunidade a acertos críticos e a atordoamento, cansaço, fogo, metabolismo e paralisia; vulnerabilidade a frio",
		pericias: { inic: 9, perc: 10, fort: 20, refl: 17, vont: 7, luta: 26 },
		ataquescac: "Marrada +26 (2d10+12 mais 3d6 fogo).",
		bio: "Elemental do fogo quadrúpede do tamanho de um touro: cascos bipartidos, pelos avermelhados, chifres dourados retorcidos e olhos de rubi. Orgulhosos e impulsivos, desafiam humanoides por brincadeira, soprando fogo e sangrando lava. Cuidavam da estufa do Parque Normandia (Parte 2, Cena 8) e agora estão entediados.",
		itens: () => [
			arma("Marrada", { img: IMG.pancada, dano: "2d10+12", tipo: "impacto", desc: P("Mais 3d6 de fogo (entra sozinho)."), efeitos: [efUso("Fogo", [["dano", "3d6[fogo]"]], { automatic: true, img: IMG.fogo, desc: "+3d6 de fogo." })] }),
			habilidade("Baforada Flamejante", "Cone de 9 m: 7d6 de fogo (Ref CD 26 reduz à metade). Recarga (movimento).", { img: IMG.fogo, execucao: "move", area: "9m", resistencia: "Reflexos reduz à metade", rolls: [rolagemDano("Dano", "7d6", "fogo")] }),
			habilidade("Marrada Explosiva", "Quando acerta a marrada em investida, explosão de chamas num raio de 6 m ao redor do alvo: 6d6 de fogo (Ref CD 26 reduz à metade). Recarga (movimento).", { img: IMG.fogo, execucao: "free", area: "6m", resistencia: "Reflexos reduz à metade", rolls: [rolagemDano("Dano", "6d6", "fogo")] }),
			habilidade("Sangue de Lava", "Quando sofre dano de corte ou perfuração, criaturas adjacentes sofrem 4d6 de fogo e ficam em chamas (Ref CD 26 reduz à metade e evita as chamas).", { img: IMG.fogo, resistencia: "Reflexos reduz à metade e evita a condição", rolls: [rolagemDano("Dano", "4d6", "fogo")], efeitos: [efCondicao("emchamas")] })
		]
	},
	{
		nome: "Manada de Ber'baram", nd: "12", tipo: "esp", raca: "Elemental", tamanho: "eno", img: ICONE("cao-do-inferno"),
		atr: { for: 8, des: 5, con: 5, int: -2, sab: 2, car: 2 },
		pv: 1600, defesa: 30, desl: 15, cd: 28, sentidos: ["escuro"], imune: ["fogo"], vulneravel: ["frio"], ic: ["atordoado", "fatigado", "exausto", "paralisado"],
		resistencias: "imunidade a acertos críticos e a atordoamento, cansaço, fogo, metabolismo e paralisia; vulnerabilidade a frio",
		pericias: { inic: 11, perc: 12, fort: 22, refl: 19, vont: 9, luta: 36 },
		ataquescac: "[bando] Marrada +36 (4d10+24 mais 6d6 fogo).",
		bio: "Uma manada de ber'baram brincando de incendiar o Parque Normandia. Parte 2, Cena 8: quem falha em Furtividade CD 28 é atacado por ela (quem passa enfrenta só um ber'baram na saída).",
		itens: () => [
			arma("Marrada", { img: IMG.pancada, dano: "4d10+24", tipo: "impacto", desc: P("Mais 6d6 de fogo (entra sozinho)."), efeitos: [efUso("Fogo", [["dano", "6d6[fogo]"]], { automatic: true, img: IMG.fogo, desc: "+6d6 de fogo." })] }),
			habilidade("Baforada Flamejante", "Cone de 9 m: 14d6 de fogo e em chamas (Ref CD 28 reduz à metade e evita as chamas). Recarga (movimento).", { img: IMG.fogo, execucao: "move", area: "9m", resistencia: "Reflexos reduz à metade e evita a condição", rolls: [rolagemDano("Dano", "14d6", "fogo")], efeitos: [efCondicao("emchamas")] }),
			habilidade("Marrada Explosiva", "Quando acerta a marrada em investida, explosão num raio de 6 m ao redor do alvo: 12d6 de fogo e em chamas (Ref CD 28 reduz à metade e evita as chamas). Recarga (movimento).", { img: IMG.fogo, execucao: "free", area: "6m", resistencia: "Reflexos reduz à metade e evita a condição", rolls: [rolagemDano("Dano", "12d6", "fogo")], efeitos: [efCondicao("emchamas")] }),
			habilidade("Sangue de Lava", "Quando sofre dano de corte ou perfuração, criaturas adjacentes sofrem 8d6 de fogo e ficam em chamas (Ref CD 28 reduz à metade e evita as chamas).", { img: IMG.fogo, resistencia: "Reflexos reduz à metade e evita a condição", rolls: [rolagemDano("Dano", "8d6", "fogo")], efeitos: [efCondicao("emchamas")] }),
			BANDO("A manada")
		]
	},
	{
		nome: "Corvo de Krauser", nd: "15", tipo: "con", tamanho: "col", img: ICONE("colosso-supremo"), automacoes: { curaAcelerada: { valor: 20 } },
		atr: { for: 10, des: 4, con: 10, int: 0, sab: 0, car: 0 },
		pv: 700, defesa: 50, desl: 0, voo: 18, cd: 40,
		resistencias: "redução de dano 10, resistência a magia +5",
		pericias: { inic: 17, perc: 13, fort: 28, refl: 22, vont: 15, luta: 43, pont: 43, furt: 18 },
		ataquescac: "Pancada +43 (8d6+10).", ataquesad: "Dois canhões +43 (6d8+10 impacto, 19/x3, alcance longo).",
		tesouro: ENGRENAGENS,
		bio: "O primeiro dos Três Espectros Invisíveis: galeão de guerra acoplado a um balão com invólucro mágico, dezenas de canhões e blindagem de adamante, tripulado por soldados de elite; dizem que o templo interno é de Aharadak. O capitão não é Von Krauser, e sim Lorde Resuark, um clone deformado dele numa réplica da armadura Shorder, de intelecto militar brilhante. Parte 1, Cena 5C. Combate abstrato: descreva o dano como abordagens, marujos derrotados e pontos estruturais destruídos.",
		itens: () => [
			arma("Pancada", { img: IMG.pancada, dano: "8d6+10", tipo: "impacto" }),
			arma("Canhão", { img: IMG.canhao, pericia: "pont", dano: "6d8+10", tipo: "impacto", critM: 19, critX: 3, alcance: "long", proposito: "disparo", proficiencia: "fogo", desc: P("Dois disparos por ação agredir.") }),
			habilidade("Brilhantismo Bélico", "Quando faz um ataque, rola dois dados e usa o melhor.<br><b>Automação:</b> role como 2d20kh.", { img: IMG.mira }),
			CURA(20, "Goblins Consertadores", "Goblins engenhoqueiros rastejam por dentro da aeronave consertando tudo. São imunes a dano, mas não a efeitos mentais: Vontade +4 (com a resistência a magia da nave); qualquer condição desliga a cura."),
			INVISIBILIDADE("o Corvo"),
			habilidade("Ordem Inquestionável", "Uma vez por rodada, efeito igual ao da magia Comando (CD 40). Não é mágico: vem da autoridade militar do capitão.", { img: IMG.ordens, execucao: "free" }),
			habilidade("Saraivada", "Dispara todos os canhões: criaturas em alcance médio sofrem 16d12 de impacto (Ref CD 40 reduz à metade). Recarga (padrão).", { img: IMG.canhao, execucao: "full", alcance: "medium", resistencia: "Reflexos reduz à metade", rolls: [rolagemDano("Dano", "16d12", "impacto")] }),
			habilidade("Tiro Livre", "Uma vez por rodada, o Corvo faz dois ataques de canhão como ação livre.", { img: IMG.canhao, execucao: "free" })
		]
	},
	{
		nome: "Diligência Dracocérbera", nd: "14", tipo: "con", tamanho: "col", img: ICONE("dragao-adulto"),
		atr: { for: 10, des: 0, con: 10, int: 0, sab: 0, car: 0 },
		pv: 600, defesa: 44, desl: 0, voo: 18, cd: 38,
		resistencias: "redução de dano 20",
		pericias: { inic: 11, perc: 11, fort: 28, refl: 14, vont: 22, luta: 39, furt: 16 },
		ataquescac: "Três mordidas +39 (4d10+25, 18).",
		tesouro: ENGRENAGENS,
		bio: "Esfera de metal cheia de canhões puxada por cabos por três dragões negros adultos (Tytonothrax, Echidonontallas e Chernyyluga), submissos por encantamentos e drogas alquímicas; templo interno de Arsenal. Capitão: o ex-gladiador Gio Diovanni, corpulento e excêntrico, que acorrenta não humanos vivos no casco e joga do convés quem falha. Tática favorita: os três sopros de uma vez. Parte 1, Cena 5B.",
		itens: () => [
			arma("Mordida", { img: IMG.mordida, dano: "4d10+25", tipo: "perfuracao", critM: 18, desc: P("Três mordidas por ação agredir (os dragões).") }),
			habilidade("Aura Aterradora", "Criatura que comece o turno em alcance longo fica abalada até o fim da cena (Von CD 38 evita e fica imune até o fim da cena).", { img: IMG.trevas, alcance: "long", resistencia: "Vontade evita", efeitos: [efCondicao("abalado")] }),
			habilidade("Canhões", "Uma vez por rodada, dispara numa criatura em alcance longo: 6d6 de impacto (Ref CD 38 reduz à metade); adjacentes sofrem metade (Ref CD 38 evita).", { img: IMG.canhao, execucao: "free", alcance: "long", rolls: [rolagemDano("Dano", "6d6", "impacto")] }),
			habilidade("Escudo Humanoide", "A blindagem ostenta 10d10 não humanos acorrentados (role no início da cena). Sempre que a Diligência sofre mais de 20 de dano letal, 1d10 reféns morrem. Dano não letal não mata reféns.", { img: IMG.bloqueio, rolls: [rolagemFormula("Reféns", "10d10", 0), rolagemFormula("Reféns mortos", "1d10", 1)] }),
			INVISIBILIDADE("a Diligência"),
			habilidade("Sopro Triplo", "Cone de 24 m: 18d12 de trevas e enjoadas por 1d4 rodadas (Ref CD 38 reduz à metade e evita a condição). Recarga (padrão).", { img: IMG.trevas, execucao: "full", area: "24m", resistencia: "Reflexos reduz à metade e evita a condição", rolls: [rolagemDano("Dano", "18d12", "trevas")], efeitos: [efCondicao("enjoado")] })
		]
	},
	{
		nome: "Golem de Reconhecimento", nd: "8", tipo: "con", tamanho: "gra", img: ICONE("golem-de-ferro"),
		atr: { for: 8, des: 5, con: 4, int: 0, sab: 5, car: -4 },
		pv: 64, defesa: 26, desl: 12, sentidos: ["escuro"], imune: ["eletricidade"],
		resistencias: "imunidade a eletricidade, redução de dano 10",
		pericias: { inic: 13, perc: 13, fort: 13, refl: 17, vont: 7, luta: 26, pont: 26, sobr: 13 },
		ataquescac: "Pancada x2 +26 (3d8+18, x3).", ataquesad: "Arco embutido x2 +26 (2d10+18, x3, alcance médio).",
		bio: "Construto de ferro com jeito de caçador de proporções exageradas e um arco forjado no corpo. Parte 2, Cena 9: três consertam a Sede da Guilda e atacam quem invade o perímetro.",
		itens: () => [
			arma("Pancada", { img: IMG.pancada, dano: "3d8+18", tipo: "impacto", critX: 3, desc: P("Dois ataques por ação agredir.") }),
			arma("Arco embutido", { img: EQ("arco-longo"), pericia: "pont", dano: "2d10+18", tipo: "perfuracao", critX: 3, alcance: "medium", proposito: "disparo", desc: P("Dois ataques por ação agredir.") }),
			habilidade("Sensor de Caça", "Analisa um inimigo em alcance curto: até o fim da cena, +5 em Percepção e +2d8 no dano contra ele (dobrados contra humanoide). Recarga (reduzir o alvo a 0 PV).<br><b>Automação:</b> opções no ataque.", {
				img: IMG.marca, execucao: "move", alcance: "short",
				efeitos: [efUso("Sensor de Caça (+2d8)", [["dano", "2d8"]], { types: ["attack"], img: IMG.marca, desc: "+2d8 contra o alvo analisado." }), efUso("Sensor de Caça, humanoide (+4d8)", [["dano", "4d8"]], { types: ["attack"], img: IMG.marca, desc: "+4d8 contra humanoide analisado." })]
			})
		]
	},
	{
		nome: "Grupo de Assalto de Elite", nd: "7", tipo: "hum", raca: "Humano", tamanho: "gra", img: ICONE("soldado-supremacista"),
		atr: { for: 6, des: 2, con: 5, int: 1, sab: 0, car: -1 },
		pv: 525, defesa: 24, desl: 6,
		pericias: { inic: 6, perc: 5, fort: 16, refl: 11, vont: 7, luta: 16, pont: 22 },
		ataquescac: "[bando] Espada bastarda +16 (2d12+30, 19).", ataquesad: "Besta pesada +22 (2d12+20, 19).",
		equipamento: "Besta pesada, escudo pesado, espada bastarda aumentada, meia armadura reforçada, virotes x10.",
		tesouro: "Metade.",
		bio: "A menor unidade tática purista: dez soldados veteranos e embrutecidos liderados por um sargento. Parte 2: Cenas 2, 10 e 11, e emboscada na falha total da Caminhada pelo Inferno.",
		itens: () => [
			arma("Espada bastarda", { img: IMG.bastarda, dano: "2d12+30", tipo: "corte", critM: 19, proficiencia: "exotica" }),
			arma("Besta pesada", { img: IMG.besta, pericia: "pont", dano: "2d12+20", tipo: "perfuracao", critM: 19, alcance: "medium", proposito: "disparo", proficiencia: "simples" }),
			habilidade("Táticas de Elite", "Quando usa a ação agredir, faz um ataque corpo a corpo e um à distância. Recarrega as bestas com ação de movimento.", { img: IMG.ordens }),
			BANDO("O grupo de assalto")
		]
	},
	{
		nome: "Hidra Helicoide", nd: "14", tipo: "con", tamanho: "col", img: ICONE("hidra"),
		atr: { for: 10, des: 0, con: 10, int: 0, sab: 0, car: 0 },
		pv: 600, defesa: 44, desl: 0, voo: 15, cd: 38, imune: ["eletricidade"],
		resistencias: "imunidade a eletricidade, redução de dano 20",
		pericias: { inic: 11, perc: 11, fort: 28, refl: 22, vont: 14, luta: 39, furt: 16 },
		ataquescac: "Hélices +39 (12d6+37 corte, x3).",
		tesouro: ENGRENAGENS,
		bio: "Fortaleza voadora assimétrica de incontáveis braços com hélices de adamante e mitral, encantadas para abafar sons, movida por um reator de elementais de eletricidade aprisionados. Paira, abalroa navios e dilacera. Pilotada pela Capitã Helga Hellmeistër, mercenária ambiciosa de Collen (olho esquerdo dourado, cabelo de cor diferente a cada vez), devota de Valkaria, que acredita que a Supremacia tomará a capital. Parte 1, Cena 5A.",
		itens: () => [
			arma("Hélices", { img: IMG.dilacerar, dano: "12d6+37", tipo: "corte", critX: 3, desc: P("Mil Hélices: uma jogada de ataque comparada com a Defesa de cada criatura adjacente.") }),
			habilidade("Canhões Elétricos", "Uma vez por rodada, dispara dois relâmpagos; cada um causa 12d6 de eletricidade numa linha de alcance longo (Ref CD 38 reduz à metade).", { img: IMG.raio, execucao: "free", alcance: "long", resistencia: "Reflexos reduz à metade", rolls: [rolagemDano("Relâmpago", "12d6", "eletricidade")] }),
			habilidade("Hélices Hipnóticas", "Uma vez por rodada, quando acerta um ataque corpo a corpo, quem pode vê-la fica fascinado (Von CD 38 evita).", { img: IMG.atordoar, resistencia: "Vontade evita", efeitos: [efCondicao("fascinado")] }),
			INVISIBILIDADE("a Hidra"),
			habilidade("Mil Hélices", "O ataque de hélices atinge todas as criaturas ao redor: uma única jogada de ataque comparada com a Defesa de cada criatura adjacente.", { img: IMG.dilacerar })
		]
	},
	{
		nome: "Príncipe Conrad Kor Kovith", nd: "16", tipo: "mor", raca: "Osteon", tamanho: "med", img: ICONE("esqueleto-de-elite"),
		atr: { for: 6, des: 6, con: 6, int: 4, sab: 0, car: 4 },
		pv: 800, defesa: 53, desl: 6, cd: 42, sentidos: ["escuro"], imune: ["fogo", "frio"],
		resistencias: "imunidade a fogo e frio, redução de corte e perfuração 10",
		pericias: { inic: 20, perc: 14, fort: 30, refl: 24, vont: 16, luta: 46, atle: 20, guer: 18, inti: 18 },
		ataquescac: "Espada longa x2 +46 (1d8+35, 17, mais 2d6 fogo e 2d6 trevas).",
		equipamento: "Armadura completa defensora, escudo pesado defensor, espada longa formidável ameaçadora.",
		bio: "Lorde General dos batalhões puristas em Yuvalin: príncipe osteon de um reino varrido pelo Exército Com Uma Nação que, em vez de vingança, abraçou a cultura dos opressores. Campeão do torneio do Deus do Duelo; traidor da bênção de Tenebra, segundo Lislah. Armadura branca impecável, chamas vermelhas nas órbitas, espada flamejante; some e reaparece ao atacar (teletransporte 18 m). Parte 2, Cena 13, na Fornalha Central. Recupera PV com o dano de fogo do calor (2d6 por rodada em todos) até a fornalha ser desativada.",
		itens: () => [
			arma("Espada longa", { img: IMG.espada, dano: "1d8+35", tipo: "corte", critM: 17, proficiencia: "marcial", desc: P("Dois ataques por ação agredir. Mais 2d6 de fogo e 2d6 de trevas (entram sozinhos). No crítico, os dados de fogo também multiplicam."), efeitos: [efUso("Fogo e trevas", [["dano", "2d6[fogo]"], ["dano", "2d6[trevas]"]], { automatic: true, img: IMG.fogo, desc: "+2d6 de fogo e +2d6 de trevas." })] }),
			habilidade("Chamas Tumulares", "No início de cada turno dele, todas as criaturas em alcance curto sofrem 4d6 de dano (metade fogo, metade trevas).", { img: IMG.fogo, alcance: "short", rolls: [rolagemDano("Fogo", "2d6", "fogo", 0), rolagemDano("Trevas", "2d6", "trevas", 1)] }),
			habilidade("Correntes de Ódio", "Labaredas envolvem uma criatura em alcance médio: 12d6 (metade fogo, metade trevas) e agarrada (Ref CD 42 reduz à metade e evita). Agarrada, sofre 4d6 (metade fogo, metade trevas) no início de cada turno; escapa com ação completa e Acrobacia ou Atletismo CD 42, ou causando 20 de dano de frio ou luz nas labaredas.", {
				img: IMG.trevas, execucao: "move", alcance: "medium", resistencia: "Reflexos reduz à metade e evita a condição",
				rolls: [rolagemDano("Fogo", "6d6", "fogo", 0), rolagemDano("Trevas", "6d6", "trevas", 1)], efeitos: [efCondicao("agarrado")]
			}),
			habilidade("Príncipe Infernal", "Quando sofre dano de fogo, recupera PV igual ao dano que sofreria. No acerto crítico com a espada, multiplica também os dados de fogo.", { img: IMG.fogo }),
			habilidade("Teletransporte", "Deslocamento de teletransporte 18 m: ao atacar, some e reaparece em outro ponto quase instantaneamente.", { img: IMG.invisivel })
		]
	},
	{
		nome: "Reator de Tormenta", nd: "17", tipo: "mon", raca: "Lefeu", tamanho: "eno", img: ICONE("devorador-de-medos"),
		atr: { for: 10, des: 5, con: 10, int: -2, sab: 5, car: -2 },
		pv: 714, defesa: 52, desl: 0, voo: 18, cd: 44, sentidos: ["escuro"],
		resistencias: "redução de dano 20, resistência a magia +10",
		pericias: { inic: 19, perc: 24, fort: 30, refl: 22, vont: 24, luta: 50, mist: 24 },
		ataquescac: "Mordida +50 (4d8+45, 19).",
		magias: ["Desintegrar", "Enxame Rubro", "Metamorfose", "Relâmpago"],
		bio: "O motor vivo do ARQUEMIS-B: esfera de carne e adamante retorcido com bocarra de dentes de aço-rubi, língua de tubos e cabos, tentáculos com olhos e um \"olho\" central que é um portal para uma área de Tormenta, jorrando sangue. Parte 3, Cena 5. Na 1ª rodada, Vontade CD 25 (falha: abalado pela cena; por 5+: apavorado 1d4 rodadas e abalado). Na 3ª rodada chega Ezequias, que baixa a CD do Campo de Distorção para 25 e entrega as bombas. Com <i>Fonte de Mana</i>: +5 em Fortitude contra o Campo de Distorção; com <i>Referências Religiosas</i>: +5 em Misticismo e Vontade contra o Campo de Anulação.",
		itens: () => [
			arma("Mordida", { img: IMG.mordida, dano: "4d8+45", tipo: "perfuracao", critM: 19 }),
			habilidade("Arauto da Tempestade", "Lança duas destas magias sem custo em PM: Desintegrar, Enxame Rubro de Ichabod, Metamorfose (só a versão que transforma o alvo em algo inofensivo) ou Relâmpago. Pode usar até 10 PM em aprimoramentos entre as duas, mais os PM absorvidos pelo Campo de Anulação.", { img: IMG.tormenta, execucao: "action" }),
			habilidade("Campo de Anulação", "Contramágica automática contra qualquer magia de outra fonte lançada em alcance médio. Se vencer, anula a magia e recebe PM temporários iguais aos PM gastos, até o fim do próximo turno dele.", { img: IMG.arcano, execucao: "reaction", alcance: "medium" }),
			DISTORCAO(44)
		]
	}
];

// ---------------------------------------------------------------------------
// Perigos e testes (atores do tipo Perigo)
// ---------------------------------------------------------------------------
const R = (f, t) => `[[/r ${f}${t ? `[${t}]` : ""}]]`;
const PERIGOS = [
	{
		nome: "Perseguição Celeste", nd: "15", local: "Parte 1, Cena 4 (a bordo do Mariposa)",
		goal: P("Encontrar um dos Três Espectros Invisíveis: <b>5 sucessos</b> em Olhos no Céu em até <b>5 rodadas</b>. Role 1d6 para o espectro: 1–2 Hidra Helicoide, 3–4 Diligência Dracocérbera, 5–6 Corvo de Krauser (role de novo se já foi destruído). Três noites para destruir os três."),
		effects: P(
			"No fim de cada rodada, cada personagem faz Fortitude CD 20 (+2 por teste anterior); falha: @STATUS[enjoado] e não age na rodada seguinte.",
			`No fim de cada rodada, o espectro atinge o Mariposa (Ref CD 30 reduz à metade): Hidra ${R("12d6", "eletricidade")}, Diligência ${R("6d12", "trevas")}, Corvo ${R("6d8+10", "impacto")}.`,
			"Com os 5 sucessos, o espectro perde a Invisibilidade Noturna e começa o combate (o Mariposa é um aliado destruidor mestre). Sem eles, o espectro encontra o grupo: combate com todos surpreendidos."
		),
		actions: P(
			"<b>Olhos no Céu</b> (Percepção CD 30).",
			"<b>Recompor</b> (Diplomacia ou Intimidação CD 20): tira um colega do enjoo.",
			"<b>Prestar Ajuda</b>: Conhecimento (estrelas faltando), Guerra, Investigação, Misticismo, Sobrevivência etc.",
			"<b>Manobras Defensivas</b> (Pilotagem CD 30): o Mariposa não é atingido nesta rodada.",
			`<b>No combate:</b> abordar com Atletismo CD 30 (sem ataques à distância do navio; Acrobacia CD 20 no início de cada turno ou cai, ${R("40d6", "impacto")}; quem voa não testa).`
		)
	},
	{
		nome: "Pólvora Goblin", nd: "8", local: "Parte 2, Cena 6 (Taverna Fim do Mundo)",
		goal: P("A taverna barricada (portas RD 5, 30 PV) parece um bastião da resistência. Dentro, só a pichação \"ESPERAMOS QUE GOSTE DO PRESENTE, LIXO PURISTA! ASS: OS GOBLINS\" e muita pólvora."),
		effects: P(`Entrar arma o mecanismo: criaturas em alcance médio sofrem ${R("20d6", "fogo")} de fogo (Reflexos CD 30 reduz para ${R("10d6", "fogo")}). Atacar a barricada com fogo explode tudo sem direito a teste.`),
		actions: P("Investigação ou Ladinagem CD 30 percebe e desarma a armadilha.")
	},
	{
		nome: "Caminhada pelo Inferno", nd: "—", local: "Parte 2, Cena 12 (interior da Fundição Central)",
		goal: P("Chegar à Fornalha Central com a fundição trancando as comportas e esquentando: teste estendido aberto (qualquer perícia justificável), CD 25 +2 por teste feito, <b>5 sucessos</b>."),
		effects: P(
			"A voz de Kor Kovith deixa todos @STATUS[abalado] (Von CD 25 anula).",
			`Cada falha: ${R("3d6", "fogo")} de fogo. Falha total: o grupo se perde, é emboscado por um grupo de assalto de elite e recomeça.`,
			"A sirene conta como condição ruim para lançar magias; desativá-la (Ofício [engenhoqueiro] ou Investigação CD 30) vale como um dos testes."
		),
		actions: P("Use a macro <b>CdR · Teste estendido</b> (5 sucessos; ajuste a CD a cada teste).")
	},
	{
		nome: "O Código Lefeu", nd: "16", local: "Parte 3, Cena 2 (caderno de Ezequias)",
		goal: P("Estudar as anotações de Ezequias em <b>3 dias</b> para descobrir as fraquezas do ARQUEMIS-B. No início de cada dia, cada personagem faz uma das ações (ou ajuda um colega)."),
		effects: P(
			"No fim de cada dia, quem fez uma ação faz Vontade CD 30 (+2 por teste já feito): 1 falha @STATUS[frustrado]; 2 falhas @STATUS[alquebrado]; 3 falhas perde para sempre 1 ponto de Int, Sab ou Car (aleatório).",
			"Cada sucesso revela um trecho do caderno e a vantagem dele (veja \"O Código Lefeu\" no roteiro)."
		),
		actions: P(
			"<b>Brecha na Armadura</b> (Ofício [armeiro] CD 35). <b>É Grande, mas não É Dois</b> (Iniciativa CD 35). <b>Explosão de Raiva</b> (Luta CD 35).",
			"<b>Fogo de Suporte</b> (Pontaria CD 35). <b>Fonte de Mana</b> (Misticismo CD 35). <b>Referências Religiosas</b> (Religião CD 35)."
		)
	},
	{
		nome: "Portal do Reator", nd: "—", local: "Parte 3, Cena 5 (o plano de Ezequias)",
		goal: P("Plantar ao menos <b>duas</b> das três bombas alquímicas de Ezequias na base do portal, do lado da Tormenta. Elas explodem duas rodadas depois do último teste."),
		effects: P(
			`Entrar pelo \"olho\": ação completa e Atletismo CD 25 para escalar, depois ação completa e Acrobacia CD 25 para saltar (quem voa só faz a Acrobacia). Falha: cai, ${R("2d6", "impacto")}, e recomeça.`,
			"Do outro lado, quem não é lefou faz Vontade CD 25: passa, @STATUS[frustrado] pelo resto do dia; falha, @STATUS[alquebrado] e @STATUS[esmorecido] pelo resto do dia.",
			`Os lefeu ignoram quem não os ameaça (não distinguem o grupo dos puristas); se perturbados, use ${GL("Lefeu, Ezzayn", "AdA", "ezzayn")}.`
		),
		actions: P(
			`<b>Armar bomba</b>: ação completa e Ladinagem ou Ofício (alquimia ou coerente) CD 25. Falha: tenta de novo. Falha por 5+: explode, ${R("12d6", "impacto")} em alcance curto.`,
			"A estrutura do portal (RD 10, 50 PV) só sofre dano de ataques ou magias feitos dentro da Tormenta: destruí-la assim prende o herói lá.",
			"Sem fechar o portal, ainda dá para derrotar o reator em Arton reduzindo seus PV a zero."
		)
	}
];

// ---------------------------------------------------------------------------
// Itens da aventura e parceiros
// ---------------------------------------------------------------------------
async function itensDaAventura() {
	const lista = [];
	const tesouro = (nome, desc, { qtd = 1, preco = 0, img = "icons/svg/item-bag.svg", role } = {}) => ({ name: nome, type: "tesouro", img, flags: role ? { world: { cdrRole: role } } : {}, system: { description: { value: P(...[].concat(desc)) }, source: FONTE, qtd, preco } });
	const parc = (n, id) => `@UUID[Compendium.tormenta20.parceiros.Item.${id}]{${n}}`;
	const PARC = { destruidor: parc("destruidor", "FIJfKOIU8dzbvSDG"), guardiao: parc("guardião", "Un1h4jcM8qtf4F8L"), medico: parc("médico", "rntcrujiIc63hKOp"), combatente: parc("combatente", "nNpGA5SWMj7rtUQR") };
	const parceiro = (nome, desc) => ({ name: nome, type: "poder", img: "icons/svg/mystery-man.svg", system: { description: { value: P(...desc, "Arraste para a ficha de um personagem durante a cena e apague depois.") }, source: FONTE, tipo: "ability", ativacao: { execucao: "passive", custo: 0 } } });

	const katana = await doCompendio("equipamentos", "Katana");
	if (katana) {
		katana.name = "Hariken";
		katana.system.source = FONTE;
		katana.system.description.value = P("A mítica espada de Mestre Hatori Muramune: katana de mitral, formidável e veloz. Ele a entrega ao personagem que jurar resgatar seu assistente Goro Okazaki (Parte 2, Cena 10).", "<b>Automação:</b> formidável (+2 no dano) entra sozinho; veloz e mitral ficam com o mestre.") + (katana.system.description.value ?? "");
		katana.system.upgrades = { ...(katana.system.upgrades ?? {}), melhoria1: "specialmaterial" };
		katana.effects = [...(katana.effects ?? []), efUso("Formidável", [["dano", 2]], { automatic: true, desc: "+2 no dano." })];
		lista.push(katana);
	} else relatorio.avisos.push("Katana não encontrada no compêndio do sistema.");

	lista.push(
		tesouro("Caderno de anotações de Ezequias", [
			"Planos do ARQUEMIS-B (o ARQUEMIS-A explodiu nos testes): esqueleto de gigante reanimado, banhado em adamante líquido, dois braços biônicos extras e um canhão de rajadas arcanas. O resto está num código que Ezequias criou imitando a linguagem telepática dos lefeu, impermeável a magias de adivinhação e perigoso para a mente de quem lê.",
			"Escondido num compartimento secreto da mesa de trabalho em Minérios Maravilhosos (Investigação CD 20; junto com 1d4 poções). Se ninguém achar, Lislah o entrega. Veja o perigo O Código Lefeu."
		], { img: GER("diario"), role: "cadernoEzequias" }),
		tesouro("Carta de corso de Lislah", "Assinada pela própria Rainha-Imperatriz: dá a Lislah Céu Negro o direito de matar, pilhar e destruir o que bem entender. \"Ouro é coisa do deus-sol, podem ficar com todo aquele que encontrarem. Só quero o sangue dos meus inimigos.\"", { img: GER("pergaminho") }),
		tesouro("Bombas alquímicas de Ezequias", "Saco com três bombas alquímicas com um dispositivo que lembra um relógio. Precisam ser armadas na base do portal, do lado da Tormenta (perigo Portal do Reator).", { qtd: 3, img: GER("bomba") }),
		tesouro("Engrenagens dos Espectros", "Tiradas dos destroços de um dos Três Espectros (CD 30 para extrair). Cada uma conta como T$ 1.000 em matéria-prima para fabricar engenhocas.", { img: GER("engrenagens"), preco: 1000 }),
		parceiro("Parceiro: Mariposa (destruidor mestre)", [
			`O navio-templo de Lislah Céu Negro, de ébano e velas escuras, iluminado por marujos fantasmas, com grumetes zumbis, marujos esqueletos, navegadores goblins, artilheiros anões e clérigos qareens de Tenebra. Invisibilidade parcial depois do anoitecer; equipes de reparo o deixam inteiro a cada combate (cura acelerada). Nos combates contra os Espectros, conta como aliado ${PARC.destruidor} mestre.`,
			"Contra o ARQUEMIS-B, os canhões não o ferem, mas o deixam sempre flanqueado (e desligam torres com Fogo de Suporte)."
		]),
		parceiro("Parceiro: Mestre Muramune (combatente e guardião mestre)", [
			`O renomado ferreiro Hatori Muramune, lutando sozinho contra um destacamento purista diante da Kanpeki em chamas (Parte 2, Cena 10): parceiro ${PARC.combatente} e ${PARC.guardiao} mestre durante a cena. Depois, ferido demais para seguir, entrega a Hariken a quem jurar resgatar Goro.`
		]),
		parceiro("Parceiros: reféns da Fundição", [
			"Na Fornalha Central (Parte 2, Cena 13), acorrentados e desmaiados. Libertar: Ladinagem CD 25 ou destruir a corrente (RD 10, 50 PV). Cada um libertado que receba ao menos 20 PV de cura vira parceiro na cena. Cada um morre se sofrer 20 de dano.",
			`<b>Penellope Pendragon</b>, a anã \"ferreira a frio\": ${PARC.guardiao} veterana. <b>Goro Okazaki</b>, aprendiz de Muramune: ${PARC.combatente} veterano. <b>Artemis</b>, moreau da raposa joalheira: ${PARC.medico} veterana. <b>Galix</b>, \"o príncipe da pólvora\": ${PARC.destruidor} veterano.`
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
	if (a.voo) await ator.update({ "system.attributes.movement.fly.base": a.voo });
	fichas[a.nome] = ator;
}
for (const h of PERIGOS) fichas[h.nome] = await criarPerigo(h, pastaPerigos);

const itens = (await itensDaAventura()).map((i) => ({ ...i, folder: pasta.Item.id, flags: { ...(i.flags ?? {}), world: { ...(i.flags?.world ?? {}), cdr: TAG } } }));
const itensCriados = {};
for (const i of await Item.implementation.createDocuments(itens)) {
	itensCriados[i.name] = i;
	relatorio.criados.push(`Item: ${i.name}`);
}

// Macro
const SALTO = String.raw`// A5 · Salto sobre Yuvalin (Mentes Malignas, Parte 2, Cena 1). Só o mestre.
// Selecione os tokens que vão saltar, escolha a perícia do método de salto e rode.
// O resultado diz em que cena cada um pousa. Ajuste com +2/-2 (habilidade ou ideia criativa) e combine com o grupo.
if (!game.user.isGM) return ui.notifications.warn("Só o mestre roda esta macro.");
const { DialogV2 } = foundry.applications.api;
const atores = canvas.tokens.controlled.map((t) => t.actor).filter(Boolean);
if (!atores.length) return ui.notifications.warn("Selecione os tokens que vão saltar.");
const POUSO = [
	[19, "Cena 2 · Distrito do Carvão: Muros Externos (e sofre 10d6 de impacto)", "10d6"],
	[24, "Cena 2 · Distrito do Carvão: Muros Externos"],
	[26, "Cena 3 · Distrito do Carvão: Jardins-Estufa (e começa surpreendido pelas baterias)"],
	[27, "Cena 3 · Distrito do Carvão: Jardins-Estufa"],
	[29, "Cena 4 · Distrito do Carvão: Bairro Boêmio"],
	[31, "Cena 5 · Distrito da Bigorna: Oficina Beluhga"],
	[33, "Cena 6 · Distrito da Bigorna: Taverna Fim do Mundo"],
	[35, "Cena 7 · Distrito da Bigorna: Minérios Maravilhosos"],
	[37, "Cena 8 · Distrito da Forja: Parque Normandia"],
	[39, "Cena 9 · Distrito da Forja: Sede da Guilda"],
	[44, "Cena 10 · Distrito da Forja: Kanpeki"],
	[999, "Cena 11 · Portões da Fundição"]
];
const P = CONFIG.T20?.pericias ?? {};
const nome = (id) => { const v = P[id]; return game.i18n.localize(typeof v === "string" ? v : v?.label ?? id); };
const opcoes = [["acro", "paraquedas"], ["atle", "paraquedas"], ["cava", "montaria"], ["pilo", "veículo"], ["mist", "Voo ou similar"], ["refl", "voo natural"]]
	.map(([id, m]) => '<option value="' + id + '">' + nome(id) + " (" + m + ")</option>").join("");
const r = await DialogV2.wait({
	window: { title: "Salto sobre Yuvalin" }, rejectClose: false,
	content: "<p>" + atores.map((a) => a.name).join(", ") + '</p><label>Perícia <select name="pericia">' + opcoes + '</select></label><label><input type="checkbox" name="voo"> Tem deslocamento de voo (+5)</label><label>Ajuste (habilidade ou ideia: +2 ou -2) <input type="number" name="ajuste" value="0"></label>',
	buttons: [{ action: "saltar", label: "Saltar!", default: true, callback: (e, b) => ({ f: b.form.elements }) }]
});
if (!r) return;
const per = r.f.pericia.value;
const bonus = (r.f.voo.checked ? 5 : 0) + (Number(r.f.ajuste.value) || 0);
let html = "";
for (const a of atores) {
	const t = (await new Roll("1d20 + " + (a.system.pericias?.[per]?.value ?? 0) + " + " + bonus).evaluate()).total;
	const [, local, dano] = POUSO.find(([max]) => t <= max);
	let extra = "";
	if (dano) extra = " Dano da queda: <b>" + (await new Roll(dano).evaluate()).total + "</b> de impacto.";
	html += "<p><b>" + a.name + "</b> (" + nome(per) + " " + t + "): " + local + "." + extra + "</p>";
}
ChatMessage.create({ whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id), content: "<h3>Salto sobre Yuvalin</h3>" + html + "<p><i>Ao entrar num distrito novo: Percepção ou Sobrevivência CD 30 para escolher a cena; sem descanso entre cenas.</i></p>" });`;
await Macro.implementation.create({ name: "A5 · Salto sobre Yuvalin", type: "script", scope: "global", img: "icons/svg/falling.svg", folder: pasta.Macro.id, flags: FLAGS("saltoYuvalin"), command: SALTO });
relatorio.criados.push("Macro: A5 · Salto sobre Yuvalin");

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
		"<b>Mentes Malignas que Planejam Destruição</b> (livro, pp. 85–103). Personagens do 15º ao 18º nível. Com a queda da Guilda (que tinha acordo oculto com a Supremacia), os puristas tomaram Yuvalin da noite para o dia, trazendo tropas pelo ar nos Três Espectros Invisíveis, navios voadores feitos por anões, elfos e goblins escravizados, blindados contra adivinhação. O cerco de Zakharov fracassa.",
		"<b>Parte 1:</b> Lislah Céu Negro e o Mariposa caçam os Três Espectros. <b>Parte 2:</b> salto sobre Yuvalin até a Fundição Central e o Príncipe Conrad Kor Kovith. <b>Parte 3:</b> o caderno de Ezequias, o colosso ARQUEMIS-B e o Reator de Tormenta.",
		"<b>Lislah Céu Negro:</b> clériga de Tenebra de robes negros e máscara branca, corsária celeste veterana da resistência contra Tauron; inquieta, dramática e cheia de títulos (\"a casamenteira profana!\"). Não é maligna, mas parte da tripulação é morta-viva: deixe os jogadores interpretarem o atrito. Está furiosa porque os puristas \"copiaram o navio dela\"."
	) },
	{ name: "Parte 1 — Os Céus de Yuvalin", html: ul([
		linha("Cena 1 — Volta ao Lar", "Trilhos das minas destruídos, casas em escombros, trincheiras e túneis com runas de proteção arcana. Soldados de Zakharov reconhecem os heróis e os levam a uma câmara subterrânea."),
		linha("Cena 2 — Sala de Guerra", `Velas negras, mapas, plantas de navios e um altar a Tenebra. Lislah explica a situação e oferece a ${I("Carta de corso de Lislah", "carta de corso")}: tripulantes do Mariposa, caçando os Espectros. Os aventureiros podem descansar e comprar no quartel.`),
		linha("Cena 3 — O Mariposa", `Ao anoitecer, uma âncora-elevador sobe até o navio-templo (${I("Parceiro: Mariposa (destruidor mestre)", "Mariposa")}). Guerra ou Intuição CD 20: hora de se preparar para combate aéreo.`),
		linha("Cena 4 — Caçada aos Espectros", L("Perseguição Celeste")),
		linha("Cena 5 — Os Espectros", `<b>5A</b> ${L("Hidra Helicoide")} (Capitã Helga Hellmeistër); <b>5B</b> ${L("Diligência Dracocérbera")} (Gio Diovanni e os três dragões negros); <b>5C</b> ${L("Corvo de Krauser")} (Lorde Resuark). Combate abstrato e épico. Depois de cada um, descansar ou caçar o próximo; três noites no total, ou os puristas destroem o Mariposa (veja Missões Adicionais).`)
	]) },
	{ name: "Parte 2 — Salto sobre Yuvalin", html: P(
		"Sem os Espectros, é um cerco comum, mas uma esfera de contenção arcana impede teletransporte para dentro. Plano de Lislah: tropas saltam do Mariposa à noite, com levitação, para tomar a Fundição Central (sem o calor dela, o resto da cidade se rende). Lislah avisa sobre o Príncipe Conrad Kor Kovith.",
		"<b>Teste de salto</b> (macro <b>A5 · Salto sobre Yuvalin</b>): Acrobacia ou Atletismo (paraquedas), Cavalgar ou Pilotagem (montaria ou veículo), Misticismo (Voo), Acrobacia ou Reflexos (voo natural). Voo: +5. Habilidade ou ideia: +2 ou –2 à escolha. <b>≤19</b> Cena 2 e 10d6 de impacto; <b>20–24</b> Cena 2; <b>25–26</b> Cena 3 surpreendido; <b>27</b> Cena 3; <b>28–29</b> Cena 4; <b>30–31</b> Cena 5; <b>32–33</b> Cena 6; <b>34–35</b> Cena 7; <b>36–37</b> Cena 8; <b>38–39</b> Cena 9; <b>40–44</b> Cena 10; <b>45+</b> Cena 11.",
		"<b>Avançando:</b> depois de cada cena, explorar outra do mesmo distrito ou avançar. Ao entrar num distrito novo, Percepção ou Sobrevivência CD 30 para escolher a cena (falha: o mestre escolhe). Quem chega numa cena em andamento entra rolando Iniciativa. <b>Sem descanso</b>: quanto mais exploram, mais gastos chegam à Fundição."
	) + ul([
		linha("Cena 2 — Carvão: Muros Externos", `Pátio de soldados descansando. ${L("Grupo de Assalto de Elite")}. Depois, os mecanismos abrem os portões para o exército de Zakharov.`),
		linha("Cena 3 — Carvão: Jardins-Estufa", `4 ${L("Bateria de Artilharia", "baterias de artilharia")} atacam quem invade o perímetro (não atiram nas estufas). Dentro: Fortitude CD 25 contra o calor ou fatigado por um dia (redução de fogo imuniza) e um ${G("Golem de Ferro", "golem de ferro")}.`),
		linha("Cena 4 — Carvão: Bairro Boêmio", `Um ${G("Capitão-Baluarte", "capitão-baluarte")} e 2 ${G("Capelão de Guerra", "capelães de guerra")} interrogam pessoas na praça. Nenhum não humano no bairro: foram levados para a Fundição.`),
		linha("Cena 5 — Bigorna: Oficina Beluhga", "Destruída por explosão, sem sinal de Penellope. Investigação CD 25: cofre (RD 10, 50 PV, Ladinagem CD 25) com quatro armas de gelo eterno com dois encantos cada (role)."),
		linha("Cena 6 — Bigorna: Taverna Fim do Mundo", L("Pólvora Goblin")),
		linha("Cena 7 — Bigorna: Minérios Maravilhosos", `Percepção CD 20: 2 ${G("Cavaleiro do Leopardo", "cavaleiros do Leopardo Negro")} revirando a oficina de Ezequias. Investigação CD 20: compartimento secreto com 1d4 poções e o ${I("Caderno de anotações de Ezequias")}.`),
		linha("Cena 8 — Forja: Parque Normandia", `Redoma estilhaçada, neve e fogo. Furtividade CD 28: falha, ${L("Manada de Ber'baram")}; passa, um ${L("Ber'baram")} na saída.`),
		linha("Cena 9 — Forja: Sede da Guilda", `Quartel purista meio destruído pela resistência. 3 ${L("Golem de Reconhecimento", "golens de reconhecimento")}.`),
		linha("Cena 10 — Forja: Kanpeki", `A oficina em chamas; um espadachim solitário contra um ${L("Grupo de Assalto de Elite", "grupo de assalto de elite")}: ${I("Parceiro: Mestre Muramune (combatente e guardião mestre)", "Mestre Muramune")}. Goro foi levado para a Fundição; quem jurar resgatá-lo recebe a ${I("Hariken")}.`),
		linha("Cena 11 — Portões da Fundição", `2 ${L("Bateria de Artilharia", "baterias de artilharia")} e um ${L("Grupo de Assalto de Elite", "grupo de assalto de elite")}. Quem chega direto do céu surpreende as tropas.`),
		linha("Cena 12 — Caminhada pelo Inferno", L("Caminhada pelo Inferno")),
		linha("Cena 13 — O Príncipe do Submundo", `Prisioneiros acorrentados em volta da fornalha: ${I("Parceiros: reféns da Fundição", "Penellope, Goro, Artemis e Galix")}. ${L("Príncipe Conrad Kor Kovith")}. No início de cada rodada, todos sofrem ${R("2d6", "fogo")} de fogo pelo calor (role também para os quatro prisioneiros; 20 de dano mata) e o príncipe se cura com isso. Desativar a fornalha (ação completa, Ofício [engenhoqueiro] ou Ladinagem CD 30; ou destruir o mecanismo, RD 10, 100 PV) acaba com o calor e a cura, e derruba o campo de interferência mágica.`),
		linha("Cena 14 — Balde de Água Fria", "Sem a Fundição, a cidade congela e os puristas ficam presos, mas não se rendem. Ezequias sumiu: foi levado prisioneiro. Escaramuças ou descanso por alguns dias.")
	]) },
	{ name: "Parte 3 — A.R.Q.U.E.M.I.S.", html: ul([
		linha("Cena 1 — O Caderno de Ezequias", "Um marujo morto-vivo chama o grupo ao Mariposa. Lislah viu um colosso de guerra purista vindo por terra, quase do tamanho do antigo gigante de Arsenal. Ezequias foi levado até ele num dos Espectros. Se ninguém achou o caderno, Lislah o entrega (\"A gente costumava sair junto em noites de lua nova...\")."),
		linha("Cena 2 — O Código Lefeu", L("O Código Lefeu")),
		linha("Cena 3 — Odeio o Cheiro de Tormenta pela Manhã", "No 4º dia, fumaça rubra no horizonte. Lislah quer lutar em campo aberto enquanto o exército evacua. Não ponha trilhos: deixe os jogadores planejarem, e avise pelos NPCs que o colosso causa muito dano por rodada."),
		linha("Cena 4 — A Batalha contra o ARQUEMIS-B", `${L("ARQUEMIS-B")}. Com Lislah, sempre flanqueado. A 0 PV desaba (10d6 de impacto em alcance curto, Ref CD 25 reduz à metade) e pode se reerguer; com a tripulação desabilitada, Fissão do Reator.`),
		linha("Cena 5 — O Reator da Tormenta", `${L("Reator de Tormenta")}. Na 3ª rodada, um orbe de metal cai: Ezequias, numa armadura rubra quitinosa que se desmonta (\"Vocês estão com uma expressão horrível.\"). A lamparina verde dele baixa a CD do Campo de Distorção para 25, e ele entrega as ${I("Bombas alquímicas de Ezequias", "bombas")}: ${L("Portal do Reator")}.`),
		linha("Epílogo", "Fugir do reator transforma Yuvalin numa pequena área de Tormenta (provável fim da Jornada). Vencendo: desfile triunfal, medalhas diante da antiga Sede da Guilda, títulos de nobreza, terras e assentos no novo conselho. Lislah recusa, doa as propriedades, desiste (a contragosto) de zumbificar os mortos da guerra e parte: \"Despeçam-se de Ezequias por mim. E tomem cuidado. Ele é um bom homem, mas só tem Tormenta dentro da cabeça.\" Personagens no 18º nível.")
	]) },
	{ name: "O Código Lefeu: trechos e vantagens", html: ul([
		linha("Brecha na Armadura", "\"Foi feito a partir do esqueleto de um gigante e revestido em minério líquido... a blindagem, portanto, não cobre a estrutura uniformemente...\" Ignoram a RD do ARQUEMIS-B (não a do reator)."),
		linha("É Grande, mas não É Dois", "\"A máquina é limitada por seu tamanho... Possui dificuldade para atingir alvos pequenos e móveis.\" +10 na Defesa contra os ataques corpo a corpo do colosso."),
		linha("Explosão de Raiva", "\"...escutam vozes em suas mentes... Talvez suas mentes estejam sendo controladas remotamente ou... por algo dentro do próprio ARQUEMIS-B?\" Magos do Reinado confundem a tripulação: o colosso perde a cura acelerada."),
		linha("Fogo de Suporte", "\"...alguns pontos poderiam ser visados, como suas torres de artilharia...\" Com Lislah e o Mariposa: no fim da 2ª rodada e a cada duas rodadas, o colosso perde uma torre (1d4), até a 8ª."),
		linha("Fonte de Mana", "\"Há um reator interno... e ele é muito potente... tenho uma hipótese de qual seria...\" +5 em Fortitude contra o Campo de Distorção do reator."),
		linha("Referências Religiosas", "\"...reconheci o símbolo em seu braço. Era um símbolo sagrado, mas de nenhum deus artoniano.\" +5 em Misticismo e Vontade contra o Campo de Anulação do reator.")
	]) },
	{ name: "Missões Adicionais", html: ul([
		linha("Resgate", "Entrar na cidade ocupada para resgatar alguém (um nobre, um general, a própria Lislah): furtividade, ação e fuga protegendo o resgatado."),
		linha("Espionagem", "Infiltrar uma base purista para roubar planos de defesa (sentinelas, turnos, suprimentos) e sair vivo."),
		linha("Diplomacia", "Conseguir aliados em outros reinos, entre nobres hesitantes ou simpatizantes puristas; intriga, veneno e assassinato nos bailes."),
		linha("Sabotagem", "Desabilitar algo importante, como um canhão antiaéreo que impede o Mariposa de sobrevoar a cidade.")
	]) + P("Cercos reais duravam anos: se quiser, deixe a situação entrar em impasse enquanto o grupo vive outras aventuras.") }
];

const documentos = [
	["Pichação na Taverna Fim do Mundo", "<b>ESPERAMOS QUE GOSTE DO PRESENTE, LIXO PURISTA! ASS: OS GOBLINS</b>"],
	["Discurso de Kor Kovith (Fundição Central)", "<i>Minha mente não consegue compreender porque pequenos passarinhos saltitantes entraram de tão bom grado nesta gaiola. Por que desceram do céu ao inferno? Teriam se apaixonado por mim, o Príncipe? Sou tão puro, o mais puro de todos! Purguei minha própria carne nas chamas. Agora cantem, passarinhos. Cantem pela débil Kor Kovith e pela esplendorosa Supremacia. Cantem seus gritos de dor! O príncipe irá dançar a música de vocês.</i>"],
	["Caderno de Ezequias (o que dá para ler)", "Planos de uma máquina apelidada <b>ARQUEMIS-B</b>: esqueleto de gigante reanimado, banhado em adamante líquido, com dois braços biônicos adicionais e um canhão de rajadas arcanas. O ARQUEMIS-A explodiu em fase de testes. O resto está num código estranho que, quanto mais se estuda, mais parece fazer sentido..."]
];

await JournalEntry.implementation.createDocuments([
	{ name: "A5 · Como usar no Foundry", folder: pasta.JournalEntry.id, flags: FLAGS("comoUsar"), pages: paginas([
		{ name: "Visão geral", html: P(
			"Tudo desta aventura fica nas pastas <b>A5 · Mentes Malignas</b> (Atores, Itens, Macros e Diários). Ameaças em <i>Ameaças</i>; perigos e testes em <i>Perigos e Testes</i>. Cenas e mapas ficam por sua conta.",
			"Golem de ferro, capitão-baluarte, capelão de guerra, cavaleiro do Leopardo Negro e o lefeu ezzayn vêm do <b>Giria T20</b> pelos links do roteiro.",
			"Os Espectros e o ARQUEMIS-B são construtos colossais: o combate com eles é abstrato (o dano representa abordagens, tripulantes derrotados e pontos estruturais). Fichas conferidas com o livro (pp. 100–103)."
		) },
		{ name: "Automações", html: ul([
			linha("ARQUEMIS-B e Corvo de Krauser", "Cura acelerada automática no início do turno (30 e 20). Quando a tripulação ou os goblins forem afetados por uma condição, apague a habilidade de cura da ficha para desligar."),
			linha("Ber'baram, Manada, Kor Kovith", "Fogo e trevas extras automáticos nos ataques; botões de Em Chamas e Agarrado."),
			linha("Campo de Distorção (ARQUEMIS-B e Reator)", "Botões de Esmorecido e Debilitado por 1 rodada e rolagem dos PM perdidos."),
			linha("Golem de Reconhecimento", "Sensor de Caça como opção no ataque (+2d8 ou +4d8 contra humanoide)."),
			linha("Hariken", "Formidável (+2 no dano) automático."),
			linha("Testes estendidos", "Perseguição Celeste, Caminhada pelo Inferno e O Código Lefeu: macro CdR · Teste estendido. Salto: macro A5 · Salto sobre Yuvalin.")
		]) }
	]) },
	{ name: "A5 · Roteiro", folder: pasta.JournalEntry.id, flags: FLAGS("roteiro"), pages: paginas(roteiro) },
	{ name: "A5 · Documentos para os jogadores", folder: pasta.JournalEntry.id, flags: FLAGS("documentos"), pages: documentos.map(([n, t], i) => ({ name: n, type: "text", sort: (i + 1) * 100, title: { show: true, level: 1 }, text: { content: `<p>${t}</p>`, format: 1 } })) }
]);

const ulr = (arr) => (arr.length ? `<ul>${arr.map((x) => `<li>${x}</li>`).join("")}</ul>` : "<p>—</p>");
ChatMessage.create({
	whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id),
	content: `<h3>${NOME_PASTA}</h3><p><b>Criados (${relatorio.criados.length}):</b></p>${ulr(relatorio.criados)}` + (relatorio.avisos.length ? `<p><b>Avisos:</b></p>${ulr(relatorio.avisos)}` : "")
});
