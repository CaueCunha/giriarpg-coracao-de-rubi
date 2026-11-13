/* =====================================================================
 * CORAÇÃO DE RUBI · AVENTURA 2 · "O SEGREDO DAS MINAS"
 * Gerador de conteúdo para Foundry VTT v14 + sistema Tormenta20 (Vizael 1.6.x)
 *
 * Fonte do compêndio do módulo giriarpg-coracao-de-rubi (o build roda este arquivo num Foundry
 * simulado). Também funciona como macro de Script, colado inteiro e executado pelo Mestre.
 * Cria, na pasta "A2 · O Segredo das Minas" de cada tipo:
 *  • 13 ameaças (Stroka, Zhura, Jaren, capangas, construtos, trolls rubi, Abominação Rubi e K hostil)
 *    + Lobo do compêndio do sistema; gorloggs ficam de fora (decisão do mestre). Subpasta Ameaças.
 *  • 8 perigos (armadilhas e enigmas) como atores do tipo Perigo. Subpasta Armadilhas e Enigmas.
 *  • Itens da aventura (Manopla dos Anões, armas de aço-rubi, espada de Jaren, chaves, tesouros) e os
 *    parceiros K e Lonien (subpasta Parceiros).
 *  • Macros A2 · K — Rolar novamente e A2 · Lonien — Cura de Emergência.
 *  • Diários: Como usar no Foundry, Roteiro de encontros, Documentos para os jogadores e Roteiro dos
 *    andares 3, 4 e epílogo.
 * Rodar de novo apaga (depois de confirmar) o que tem a marca flags.world.cdr = "a2" e recria tudo.
 *
 * Fichas conferidas com o livro Coração de Rubi, pp. 29–45 (Defesa, PV, CD, iniciativa, percepção,
 * resistências e ataques). Convenções de automação:
 *  • Bônus que valem sempre → efeito "ao usar" com Sempre aplicar.
 *  • Bônus situacionais (Golpe Covarde, Ferreira Elemental, injeção alquímica) → efeito "ao usar"
 *    opcional: Shift+clique no ataque e marque a opção.
 *  • Condições (Atordoado, Sangrando, Vulnerável) → botão no cartão do chat.
 *  • Cura acelerada (troll rubi, Abominação) e cura de emergência da Lonien → automações do módulo
 *    (flags.world.cdrAutomacoes e flags.world.cdrParceiro).
 * ===================================================================== */
if (!game.user.isGM) return ui.notifications.error("Só o Mestre pode rodar este gerador.");

const TAG = "a2";
const FLAGS = (role) => ({ world: role ? { cdr: TAG, cdrRole: role } : { cdr: TAG } });
const ARTE = "modules/giriarpg-coracao-de-rubi/assets/aventura2";
const NOME_PASTA = "A2 · O Segredo das Minas";
const FONTE = "Coração de Rubi — O Segredo das Minas";
const ICONE = (n) => `systems/tormenta20/icons/ameacas/${n}.png`;
const P = (...t) => t.map((x) => `<p style="text-align:justify">${x}</p>`).join("");
const relatorio = { criados: [], avisos: [] };

// ---------------------------------------------------------------------------
// 0. Limpeza do que foi gerado antes
// ---------------------------------------------------------------------------
const isOurs = (d) => d.getFlag?.("world", "cdr") === TAG;
const colecoes = [game.actors, game.items, game.journal, game.tables, game.macros];
const antigos = colecoes.flatMap((c) => c.filter(isOurs));
if (antigos.length) {
	const ok = await foundry.applications.api.DialogV2.confirm({
		window: { title: "Aventura 2: recriar conteúdo" },
		content: `<p>Já existem <b>${antigos.length}</b> documentos gerados para a Aventura 2.</p>
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
for (const type of ["Actor", "Item", "JournalEntry", "Macro"]) {
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

// ---------------------------------------------------------------------------
// Habilidades reaproveitadas
// ---------------------------------------------------------------------------
const golpeCovarde = (dados, armaCaC) =>
	habilidade(
		"Golpe Covarde",
		`Contra alvos flanqueados, recebe +2 em testes de ataque corpo a corpo (para um total de +4) e causa +${dados} de dano com esses ataques.<br><b>Automação:</b> Shift+clique no ataque de ${armaCaC} e marque "Golpe Covarde" (+2 no ataque e +${dados} no dano).`,
		{ img: IMG.golpe, efeitos: [efUso("Golpe Covarde", [["ataque", 2], ["dano", dados]], { types: ["attack"], names: [armaCaC], img: IMG.golpe, desc: `Alvo flanqueado: +2 no ataque e +${dados} no dano.` })] }
	);

const ignoraRD = (n) => efUso(`Ignora RD ${n}`, [["ignoraRD", n]], { automatic: true, img: IMG.rd, desc: `Ignora ${n} pontos de redução de dano.` });

const sensores = (quem) =>
	habilidade(
		"Sensores",
		`${quem} lança <i>Visão da Verdade</i> com alcance de 9m e duração de uma rodada.`,
		{ img: IMG.olho, execucao: "move", alcance: "9m", duracao: { value: 1, units: "round", special: "" } }
	);

const fortificacao = (pct) =>
	habilidade(
		`Fortificação ${pct}%`,
		`Quando sofre um acerto crítico ou ataque furtivo, role 1d100: com ${pct} ou menos, o dano extra é ignorado.`,
		{ img: IMG.fort, rolls: [rolagemFormula("Fortificação (1d100)", "1d100")] }
	);

const curaAcelerada = (n, excecao) =>
	habilidade(
		`Cura Acelerada ${n}${excecao ? "/" + excecao : ""}`,
		`No início de cada turno, recupera ${n} PV${excecao ? `. Dano de ${excecao} não pode ser curado assim` : ""}.<br><b>Automação:</b> em combate, o módulo cura sozinho no início do turno${excecao ? ` e lembra de descontar o dano de ${excecao}` : ""}. A rolagem fica aqui para usar fora de combate.`,
		{ img: IMG.cura, rolls: [rolagemDano("Cura acelerada", String(n), "curapv")] }
	);

const dilacerar = (dano, quem) =>
	habilidade(
		"Dilacerar",
		`Se ${quem} acerta os dois ataques de garra em uma mesma criatura na mesma rodada, causa mais ${dano} pontos de dano.<br><b>Automação:</b> clique quando as duas garras acertarem o mesmo alvo.`,
		{ img: IMG.dilacerar, rolls: [rolagemDano("Dilacerar", dano, "corte")] }
	);

// ---------------------------------------------------------------------------
// Ameaças
// ---------------------------------------------------------------------------
/**
 * Cada ameaça: valores do livro. A macro calcula o "outros" de cada perícia para o total bater
 * com o livro (o sistema soma metade do ND + atributo). Defesa base = Defesa − Des (sem itens de armadura).
 */
const AMEACAS = [
	{
		nome: "Anão Capanga", nd: "1/2", tipo: "hum", raca: "Anão", tamanho: "med", img: ICONE("bandido"),
		atr: { for: 2, des: -1, con: 3, int: 0, sab: 1, car: -1 },
		pv: 13, defesa: 17, desl: 6, sentidos: ["escuro"],
		pericias: { inic: 1, perc: 5, fort: 7, refl: 3, vont: 0, luta: 10 },
		ataquescac: "Machado de batalha +10 (1d8+6, x3).",
		equipamento: "Cota de malha, escudo leve, machado de batalha.",
		bio: "Mercenário de Stroka. Emboscada na estrada (Cena 3, x4). Se Stroka ficar com menos de 15 PV, ela pede clemência.",
		itens: () => [arma("Machado de batalha", { img: IMG.machadoBatalha, dano: "1d8+6", tipo: "corte", critX: 3, proficiencia: "marcial" })]
	},
	{
		nome: "Anão Veterano", nd: "2", tipo: "hum", raca: "Anão", tamanho: "med", img: ICONE("chefe-bandido"),
		atr: { for: 3, des: -1, con: 4, int: 0, sab: 2, car: -1 },
		pv: 33, defesa: 20, desl: 6, sentidos: ["escuro"],
		pericias: { inic: 2, perc: 8, fort: 13, refl: 2, vont: 7, luta: 12, pont: 12 },
		ataquescac: "Machado anão +12 (1d10+10, x3).", ataquesad: "Besta pesada +12 (1d12, 19).",
		equipamento: "Besta pesada, escudo pesado, machado anão, meia armadura, virotes x10.",
		bio: "Andar 1: área 2 (x2, pedem ajuda na 2ª rodada; os humanos da área 3 chegam na 3ª) e área 7 (x3, com Zhura; cada um mata um refém se o grupo atacar). Andar 2: área 3 (x3, emboscada atrás dos caixotes de bombas).",
		itens: () => [
			arma("Machado anão", { img: IMG.machadoAnao, dano: "1d10+10", tipo: "corte", critX: 3, proficiencia: "exotica" }),
			arma("Besta pesada", { img: IMG.besta, pericia: "pont", dano: "1d12", tipo: "perfuracao", critM: 19, alcance: "medium", proposito: "disparo", proficiencia: "simples" })
		]
	},
	{
		nome: "Humano Mercenário", nd: "1", tipo: "hum", raca: "Humano", tamanho: "med", img: ICONE("bandido"),
		atr: { for: 2, des: 1, con: 2, int: 0, sab: -1, car: 0 },
		pv: 12, defesa: 16, desl: 9,
		pericias: { inic: 5, perc: 3, fort: 6, refl: 10, vont: 1, luta: 11, pont: 11 },
		ataquescac: "Espada longa +11 (1d8+6, 19).", ataquesad: "Adaga +11 (1d4+4, 19).",
		equipamento: "Adaga x4, couro batido, escudo leve, espada longa.",
		bio: "Andar 1: área 3 (x2, acampamento), área 4 (vigia dorminhoco: Furtividade CD 5 para passar; Intimidação CD 15 o expulsa) e área 5 (com o lobo de estimação).",
		itens: () => [
			arma("Espada longa", { img: IMG.espada, dano: "1d8+6", tipo: "corte", critM: 19, proficiencia: "marcial" }),
			arma("Adaga", { img: IMG.adaga, pericia: "pont", dano: "1d4+4", tipo: "perfuracao", critM: 19, alcance: "short", proposito: "arremesso", proficiencia: "simples" }),
			golpeCovarde("2d6", "Espada longa")
		]
	},
	{
		nome: "Stroka", nd: "3", tipo: "hum", raca: "Anã", tamanho: "med", img: ICONE("capitao-baluarte"),
		atr: { for: 3, des: 0, con: 4, int: 1, sab: 2, car: 0 },
		pv: 105, defesa: 21, desl: 6, sentidos: ["escuro"],
		pericias: { inic: 9, perc: 4, fort: 16, refl: 10, vont: 4, luta: 14 },
		ataquescac: "Martelo de guerra +14 (1d8+6, x3) e escudo pesado +14 (1d6+4).",
		equipamento: "Escudo pesado reforçado, martelo de guerra cruel, meia armadura.",
		bio: "Líder da emboscada na estrada (Cena 3). <b>Com menos de 15 PV, pede clemência.</b> Se sobreviver, pode aparecer na área 7 do andar 1 e baixar a CD do teste estendido contra Zhura para 20; se o teste falhar, sai da luta sem atacar a companheira.",
		itens: () => [
			arma("Martelo de guerra", { img: IMG.martelo, dano: "1d8+6", tipo: "impacto", critX: 3, proficiencia: "marcial" }),
			arma("Escudo pesado", { img: IMG.escudo, dano: "1d6+4", tipo: "impacto", proficiencia: "marcial", desc: P("Ataque com o escudo. Também é o ataque do Contra-golpe.") }),
			habilidade("Bloqueio com Escudo", "Uma vez por rodada, quando sofre dano, Stroka recebe redução de dano 5 contra este dano.<br><b>Automação:</b> use a habilidade e aplique o efeito do cartão em Stroka antes de aplicar o dano; ele some sozinho no início do próximo turno.", {
				img: IMG.bloqueio, execucao: "reaction",
				efeitos: [efCartao("Bloqueio com Escudo (RD 5)", [["system.tracos.resistencias.dano.bonus", 5]], { img: IMG.bloqueio, rodadas: 1 })]
			}),
			habilidade("Contra-golpe", "Uma vez por rodada, Stroka pode fazer um ataque de escudo contra um inimigo que errou um ataque corpo a corpo contra ela.<br><b>Automação:</b> role o ataque \"Escudo pesado\".", { img: IMG.escudo, execucao: "reaction" })
		]
	},
	{
		nome: "Zhura", nd: "4", tipo: "hum", raca: "Anã", tamanho: "med", img: ICONE("sargento-mor"),
		atr: { for: 3, des: 0, con: 4, int: 1, sab: 2, car: 0 },
		pv: 145, defesa: 24, desl: 6, sentidos: ["escuro"],
		pericias: { inic: 6, perc: 8, fort: 16, refl: 10, vont: 4, luta: 16 },
		ataquescac: "Machado de guerra +16 (2d6+14, x3).",
		equipamento: "Escudo pesado reforçado, machado de guerra cruel, meia armadura.",
		bio: "Comandante dos mercenários do andar 1 (área 7, com 3 anões veteranos e 1d6+4 reféns). Convencer a desistir: teste estendido de Diplomacia ou Intimidação CD 25 (CD 20 com Stroka presente), 3 sucessos. Se o grupo matou Stroka e usar isso para intimidá-la, ataca na hora. Tem a chave da área 6.",
		itens: () => [
			arma("Machado de guerra", { img: IMG.machadoGuerra, dano: "2d6+14", tipo: "corte", critX: 3, proficiencia: "marcial" }),
			habilidade("Ferreira Elemental", "Os ataques de Zhura causam +1d6 de dano de ácido, eletricidade, fogo ou frio, à sua escolha.<br><b>Automação:</b> no ataque (Shift+clique), marque o elemento escolhido na janela.", {
				img: IMG.forja, execucao: "move",
				efeitos: [["Ácido", "acido"], ["Eletricidade", "eletricidade"], ["Fogo", "fogo"], ["Frio", "frio"]].map(([n, t]) =>
					efUso(`Ferreira Elemental: ${n}`, [["dano", `1d6[${t}]`]], { types: ["attack"], img: IMG.forja, desc: `+1d6 de dano de ${n.toLowerCase()}.` }))
			}),
			habilidade("Ordens", "Zhura grita ordens para seus aliados em alcance médio. Eles recebem +2 em testes de perícia até o fim da cena.<br><b>Automação:</b> use a habilidade, selecione os tokens dos aliados e clique no efeito do cartão.", {
				img: IMG.ordens, execucao: "move", alcance: "medium", duracao: { value: 0, units: "scene", special: "" },
				efeitos: [efCartao("Ordens de Zhura", [["system.modificadores.pericias.geral", 2]], { img: IMG.ordens, cena: true })]
			})
		]
	},
	{
		nome: "Humano Matador", nd: "2", tipo: "hum", raca: "Humano", tamanho: "med", img: ICONE("bandido"),
		atr: { for: 3, des: 3, con: 1, int: 0, sab: -1, car: 0 },
		pv: 20, defesa: 18, desl: 9,
		pericias: { inic: 8, perc: 2, fort: 7, refl: 12, vont: 3, luta: 13, pont: 13 },
		ataquescac: "Espada longa +13 (1d8+8, 19).", ataquesad: "Arco longo +13 (1d8+8, x3).",
		equipamento: "Arco longo, couro batido reforçado, espada longa, flechas x10.",
		bio: "Capanga de Jaren. Andar 2: área 6 (x3, com um mago; se o grupo levou mais de 3 rodadas contra os gorloggs, estão com ações preparadas) e área 8 (x2, com Jaren).",
		itens: () => [
			arma("Espada longa", { img: IMG.espada, dano: "1d8+8", tipo: "corte", critM: 19, proficiencia: "marcial" }),
			arma("Arco longo", { img: IMG.arco, pericia: "pont", dano: "1d8+8", tipo: "perfuracao", critX: 3, alcance: "medium", proposito: "disparo", proficiencia: "marcial" }),
			golpeCovarde("3d6", "Espada longa")
		]
	},
	{
		nome: "Mago Matador", nd: "3", tipo: "hum", raca: "Humano", tamanho: "med", img: ICONE("necromante"),
		atr: { for: -1, des: 2, con: 1, int: 4, sab: -1, car: -1 },
		pv: 49, pm: 28, defesa: 19, desl: 9, cd: 19,
		pericias: { inic: 6, perc: 4, fort: 3, refl: 15, vont: 8, luta: 12, conh: 10, mist: 10 },
		ataquescac: "Adaga +12 (1d4+2, 19).",
		equipamento: "Varinha arcana.",
		magias: ["Armadura Arcana", "Imagem Espelhada", "Luz", "Seta Infalível", "Teia", "Bola de Fogo", "Campo de Força", "Velocidade"],
		bio: "Lança magias como um mago de 5º nível (CD 19). Andar 2: área 6 (com 3 matadores) e área 8 (com Jaren).",
		itens: () => [
			arma("Adaga", { img: IMG.adaga, dano: "1d4+2", tipo: "perfuracao", critM: 19, proficiencia: "simples" }),
			habilidade("Arcano de Batalha", "O mago matador soma sua Inteligência nas rolagens de dano com magias.<br><b>Automação:</b> +4 entra sozinho no dano de Seta Infalível e Bola de Fogo (as magias de dano dele).", {
				img: IMG.arcano, efeitos: [efUso("Arcano de Batalha", [["dano", 4]], { automatic: true, types: [], names: ["Seta Infalível", "Bola de Fogo"], img: IMG.arcano, desc: "+4 no dano de magias." })]
			})
		]
	},
	{
		nome: "Jaren", nd: "5", tipo: "hum", raca: "Humano", tamanho: "med", img: ICONE("chefe-bandido"),
		atr: { for: 1, des: 5, con: 3, int: 2, sab: -1, car: 1 },
		pv: 140, defesa: 24, desl: 9, cd: 23,
		pericias: { inic: 12, perc: 6, fort: 17, refl: 11, vont: 5, luta: 14 },
		ataquescac: "Espada longa +14 (1d8+10, 19, mais 2d4 ácido) e espada curta +14 (1d6+10, 19).",
		equipamento: "Couraça reforçada, espada curta, espada longa de injeção alquímica, frascos de ácido x10.",
		bio: "Andar 2, área 8 (com 1 mago matador e 2 humanos matadores). Não pode ser convencido nem intimidado. <b>Se o grupo mencionar Lonien, fica pasmo por uma rodada.</b> <b>Com menos de 10 PV, implora pela vida</b> e oferece T$ 2.000, a espada modificada e o 2º terço da chave.",
		itens: () => [
			arma("Espada longa de injeção alquímica", {
				img: IMG.espada, dano: "1d8+10", tipo: "corte", critM: 19, proficiencia: "marcial",
				desc: P("Mais 2d4 de ácido a cada acerto (entra sozinho no dano)."),
				efeitos: [efUso("Injeção alquímica (ácido)", [["dano", "2d4[acido]"]], { automatic: true, img: GER("acido"), desc: "+2d4 de ácido." })]
			}),
			arma("Espada curta", { img: IMG.espadaCurta, dano: "1d6+10", tipo: "perfuracao", critM: 19, proficiencia: "simples" }),
			habilidade("Bomba de Ácido", "Jaren dispara um frasco de ácido em um ponto em alcance curto. Criaturas num raio de 3m sofrem 6d4+6 pontos de dano de ácido e ficam vulneráveis (Ref CD 23 reduz o dano à metade e evita a condição). <i>Recarga (movimento).</i><br><b>Automação:</b> role o dano, aplique metade em quem passar e o efeito Vulnerável em quem falhar.", {
				img: IMG.bomba, execucao: "action", alcance: "short", area: "esfera com 3m de raio",
				resistencia: "Reflexos reduz à metade e evita a condição",
				rolls: [rolagemDano("Dano", "6d4+6", "acido")],
				efeitos: [efCondicao("vulneravel")]
			}),
			habilidade("Pasmo por Lonien", "Se o grupo mencionar Lonien, Jaren hesita e fica pasmo por uma rodada.", { img: IMG.atordoar, efeitos: [efCondicao("pasmo", { rodadas: 1 })] })
		]
	},
	{
		nome: "Guardião de Aço", nd: "4", tipo: "con", tamanho: "med", img: ICONE("golem-de-ferro"),
		atr: { for: 4, des: 0, con: 3, int: 0, sab: 1, car: -4 },
		pv: 40, defesa: 20, desl: 6, cd: 17, sentidos: ["escuro"],
		pericias: { inic: 4, perc: 4, fort: 14, refl: 4, vont: 9, luta: 16 },
		ataquescac: "Duas pancadas +16 (1d10+7).",
		bio: "Construto de Tallaka (Int —). Andar 3: área 6 (x4). Andar 4: área 2 (x2, com um guardião de rubi) e área 6 (x2).",
		itens: () => [
			arma("Pancada", {
				img: IMG.pancada, dano: "1d10+7", tipo: "impacto",
				desc: P("Duas pancadas por ação. Quem é atingido fica atordoado por uma rodada (Fort CD 17 evita), uma vez por cena por criatura."),
				efeitos: [efCondicao("atordoado", { rodadas: 1 })]
			}),
			habilidade("Pancada Atordoante", "Uma criatura atingida pela pancada do guardião de aço fica atordoada por uma rodada (Fort CD 17 evita). Uma criatura só pode ser atordoada por esta habilidade uma vez por cena.<br><b>Automação:</b> no cartão da Pancada, aplique \"Atordoado (1 rodada)\" em quem falhar; ele some sozinho.", { img: IMG.atordoar, resistencia: "Fortitude evita" })
		]
	},
	{
		nome: "Guardião de Rubi", nd: "5", tipo: "con", tamanho: "gra", img: `${ARTE}/guardiao-de-rubi.webp`,
		atr: { for: 7, des: 0, con: 5, int: 0, sab: 3, car: -4 },
		pv: 190, defesa: 24, desl: 9, cd: 20, sentidos: ["escuro"], resistencias: "fortificação 75%",
		pericias: { inic: 5, perc: 14, fort: 17, refl: 5, vont: 11, luta: 17 },
		ataquescac: "Duas pancadas +17 (2d6+10).",
		bio: "Construto de Tallaka com aço-rubi (Int —). Andar 3: área 7 (com um troll rubi, ao resolver o enigma). Andar 4: área 2 (com 2 guardiões de aço).",
		itens: () => [
			arma("Pancada", {
				img: IMG.pancada, dano: "2d6+10", tipo: "impacto",
				desc: P("Duas pancadas por ação. Ignora 10 de RD (automático). Quem é atingido fica sangrando (Fort CD 20 evita)."),
				efeitos: [ignoraRD(10), efCondicao("sangrando")]
			}),
			habilidade("Pancada Rubi", "As pancadas do guardião ignoram 10 pontos de redução de dano. Além disso, uma criatura atingida pela pancada do guardião de rubi fica sangrando (Fort CD 20 evita).<br><b>Automação:</b> a RD é ignorada sozinha; aplique \"Sangrando\" pelo cartão em quem falhar.", { img: IMG.dilacerar, resistencia: "Fortitude evita" }),
			sensores("O guardião"),
			fortificacao(75)
		]
	},
	{
		nome: "Troll Rubi", nd: "5", tipo: "mon", tamanho: "gra", img: ICONE("troll"), automacoes: { curaAcelerada: { valor: 15, excecao: "ácido" } },
		atr: { for: 7, des: 2, con: 4, int: -3, sab: -2, car: -2 },
		pv: 200, defesa: 23, desl: 9, sentidos: ["escuro"],
		resistencias: "cura acelerada 15/ácido, fortificação 50%, imunidade a fogo", imune: ["fogo"],
		pericias: { inic: 5, perc: 14, fort: 17, refl: 5, vont: 11, luta: 17 },
		ataquescac: "Duas garras +17 (1d6+10).",
		bio: "Experimento de Tallaka. Andar 3: área 5 (x2; um deles carrega a peça triangular da porta do laboratório) e área 7 (com o guardião de rubi). Os documentos sobre trolls do andar 1 dão +1d6 em um ataque contra eles.",
		itens: () => [
			arma("Garra", { img: IMG.garra, dano: "1d6+10", tipo: "corte", desc: P("Duas garras por ação. Ignora 10 de RD (automático)."), efeitos: [ignoraRD(10)] }),
			dilacerar("2d6+10", "o troll rubi"),
			habilidade("Garras Rubi", "As garras do troll ignoram 10 pontos de redução de dano.<br><b>Automação:</b> já entra em todo ataque de garra.", { img: IMG.garra }),
			habilidade("Organismo Metálico", "Uma vez por rodada, quando sofre dano de fogo, o troll recebe uma ação de movimento adicional em seu próximo turno. (É imune a fogo, então o dano não o fere.)", { img: IMG.fogo }),
			curaAcelerada(15, "ácido"),
			fortificacao(50)
		]
	},
	{
		nome: "Abominação Rubi", nd: "8", tipo: "con", tamanho: "gra", img: `${ARTE}/abominacao-rubi.webp`, automacoes: { curaAcelerada: { valor: 10 } },
		atr: { for: 8, des: 0, con: 5, int: 0, sab: 1, car: -5 },
		pv: 322, defesa: 33, desl: 12, cd: 26, sentidos: ["escuro"], ic: ["atordoado", "paralisado"],
		resistencias: "cura acelerada 10, fortificação 75%, imunidade a atordoamento e paralisia",
		pericias: { inic: 8, perc: 12, fort: 21, refl: 8, vont: 15, luta: 26 },
		ataquescac: "Duas garras +26 (1d6+12), pancada +26 (2d6+12 mais sangramento) e mordida +26 (1d8+12, x3, mais atordoamento).",
		bio: "O último experimento de Tallaka: troll e construto fundidos com aço-rubi (Int —). Andar 4, área 7 (o cofre). Depois da luta: corpo de Tallaka, 2 pedaços de aço-rubi, 10 flechas de aço-rubi, machado anão certeiro e preciso de aço-rubi e tesouro de ND 8.",
		itens: () => [
			arma("Garra", { img: IMG.garra, dano: "1d6+12", tipo: "corte", desc: P("Duas garras por ação.") }),
			arma("Pancada", { img: IMG.pancada, dano: "2d6+12", tipo: "impacto", desc: P("Ignora 15 de RD (automático). Sangrando (Fort CD 26 evita)."), efeitos: [ignoraRD(15), efCondicao("sangrando")] }),
			arma("Mordida", { img: IMG.mordida, dano: "1d8+12", tipo: "perfuracao", critX: 3, desc: P("Atordoado por uma rodada (Fort CD 26 evita), uma vez por cena por criatura."), efeitos: [efCondicao("atordoado", { rodadas: 1 })] }),
			dilacerar("2d6+12", "a abominação rubi"),
			habilidade("Mordida Esmagadora", "Uma criatura atingida pela mordida da abominação fica atordoada por uma rodada (Fort CD 26 evita). Uma mesma criatura só pode ser atordoada por esta habilidade uma vez por cena.<br><b>Automação:</b> aplique \"Atordoado (1 rodada)\" pelo cartão da mordida.", { img: IMG.mordida, resistencia: "Fortitude evita" }),
			habilidade("Pancada Rubi", "As pancadas da abominação ignoram 15 pontos de redução de dano. Além disso, uma criatura atingida pela pancada fica sangrando (Fort CD 26 evita).<br><b>Automação:</b> a RD é ignorada sozinha; aplique \"Sangrando\" pelo cartão.", { img: IMG.dilacerar, resistencia: "Fortitude evita" }),
			sensores("A abominação"),
			curaAcelerada(10),
			fortificacao(75)
		]
	}
];

// K hostil = guardião de rubi com Inteligência (epílogo, se o grupo destruir a câmara; ou se for atacado no andar 3).
{
	const base = AMEACAS.find((a) => a.nome === "Guardião de Rubi");
	AMEACAS.push({
		...base,
		nome: "K (hostil)",
		img: `${ARTE}/k.webp`,
		atr: { ...base.atr, int: 2 },
		bio: "Golem de Tallaka. Use esta ficha se o grupo atacar K ou desrespeitar a memória de Tallaka (andar 3, área 3) ou se decidir destruir a câmara no epílogo (K luta até a morte). O livro manda usar o guardião de rubi com Inteligência; a ficha usa Int 2.",
		hostil: true
	});
}

// ---------------------------------------------------------------------------
// Perigos (atores do tipo Perigo; o sistema guarda só texto, então as rolagens ficam no texto)
// ---------------------------------------------------------------------------
const R = (f, t) => `[[/r ${f}${t ? `[${t}]` : ""}]]`;
const PERIGOS = [
	{
		nome: "Caixotes de Bombas", nd: "6", local: "Andar 2, área 3",
		goal: P("Evitar que as bombas explodam (ou explodi-las de propósito contra os anões veteranos)."),
		effects: P(
			`Dentro dos caixotes há ${R("2d4")} bombas. Se mais de 6 pontos de dano de fogo forem causados perto deles, todas explodem: 6d6 de dano, +2d6 por bomba extra, em todas as criaturas a até 6m (Ref CD 20 reduz à metade).`,
			`Dano por quantidade de bombas: 2 → ${R("8d6")} · 3 → ${R("10d6")} · 4 → ${R("12d6")} · 5 → ${R("14d6")} · 6 → ${R("16d6")} · 7 → ${R("18d6")} · 8 → ${R("20d6")}.`
		),
		actions: P("Três anões veteranos emboscam o grupo escondidos atrás dos caixotes. Um deles leva o lembrete: <i>Afiar machado. Aparar a barba. Cobrar de Jaren o pagamento.</i>")
	},
	{
		nome: "Armadilha de Gás Inflamável", nd: "6", local: "Andar 2, área 4 (depósito)",
		goal: P("Entrar no depósito de Jaren (porta trancada: Ladinagem CD 20). Investigação CD 20 descobre a armadilha e que ela não pode ser desativada; a alavanca da área 6 a desativa."),
		effects: P(
			`Gás venenoso, ativado por quem pisar no chão. Afeta todos em alcance curto: perda de ${R("1d12", "perda")} PV por rodada durante 3 rodadas (Fortitude CD 20 reduz para 1 rodada).`,
			`<b>O gás é inflamável.</b> Explodir a porta com uma bomba causa ${R("12d6", "impacto")} de impacto em alcance curto (Reflexos CD 20 reduz à metade).`
		),
		actions: P(`Dentro: ${R("1d4")} poções de curar ferimentos (4d8+4 PV) e ${R("4d6*1000")} T$ (as últimas economias de Jaren).`)
	},
	{
		nome: "Corredor Explosivo", nd: "6", local: "Andar 2, área 7",
		goal: P("Atravessar o corredor estreito (uma pessoa por vez) sem pisar nas bombas enterradas a cada 3m."),
		effects: P(`Investigação CD 20 revela cada bomba. Quem pisar numa sofre ${R("6d6", "impacto")} de impacto (Reflexos CD 17 reduz à metade).`),
		actions: P("Se os jogadores notarem o padrão (uma bomba a cada 3m), podem pular os espaços perigosos, como fazem Jaren e seus capangas.")
	},
	{
		nome: "Desafio de Heredrimm", nd: "7", local: "Andar 3, área 4",
		goal: P("Igualar o peso dos dois lados da balança do mosaico (personagens e equipamento). A porta se fecha e se tranca assim que o primeiro personagem passa: o grupo decide quem fica dentro."),
		effects: P(
			"Pistas: Heredrimm é o nome anão de Khalmyr, Deus da Justiça (Conhecimento ou Religião CD 15).",
			"Na doutrina anã, o equilíbrio de Khalmyr é literal; mercadores o evocam para garantir transações (Conhecimento ou Religião CD 20).",
			"O piso é formado por duas plataformas que cedem levemente sob o peso (Investigação ou Percepção CD 20)."
		),
		actions: P("Com a balança equilibrada, ouve-se um clique e as duas portas se abrem.")
	},
	{
		nome: "Enigma do Sol e da Lua", nd: "7", local: "Andar 3, área 7",
		goal: P("<b>Solução:</b> apagar todas as lamparinas no sentido horário em relação à porta (o sol se põe, a lua sobe)."),
		effects: P(
			"Pistas: o mosaico mostra Azgher, Deus do Sol, e Tenebra, Deusa das Trevas (Int ou Religião CD 10).",
			"Para os anões, Tenebra é a heroína e Azgher o vilão (Religião CD 15).",
			"Todas as noites Tenebra derrota Azgher e traz a escuridão confortável (Religião CD 20)."
		),
		actions: P("A porta se fecha quando o último entra e as 6 lamparinas se acendem. Na sala, um troll rubi desperta e um guardião de rubi se ativa. Resolvido o enigma, um pedestal sobe com um baú: duas rolagens de tesouro de ND 6.")
	},
	{
		nome: "Abismo", nd: "8", local: "Andar 4, área 3",
		goal: P("Atravessar a fenda de 6m, aparentemente sem fundo. Os ossos perto dela são de anões (Cura CD 15)."),
		effects: P("Saltar: Atletismo CD 20. Esgueirar-se pela beirada: Acrobacia CD 15. Outras soluções criativas a critério do mestre."),
		actions: P("Do outro lado, uma porta marcada com X (área 4) e o corredor para a área 6.")
	},
	{
		nome: "Caminho Diagonal (Teias Corrosivas)", nd: "8", local: "Andar 4, área 4",
		goal: P("Cruzar 4 fileiras de plataformas. A partir da porta, a única direção segura é a <b>diagonal (frente e esquerda)</b>; pergunte a direção três vezes."),
		effects: P(
			"As plataformas com armadilha podem ser reveladas com Investigação CD 25 ou <i>Visão Mística</i>.",
			`Quem pisar numa armadilha faz Reflexos CD 25. Se falhar, é preso por teias corrosivas: fica @STATUS[imovel] e sofre ${R("4d8", "acido")} de ácido no início de cada turno.`,
			"Para se soltar: Força CD 25 ou causar 20 pontos de dano de corte nas teias."
		),
		actions: P("Selecione o token preso e clique no ícone ao lado de Imóvel para aplicar a condição.")
	},
	{
		nome: "Porta do Último Experimento", nd: "8", local: "Andar 4, área 5",
		goal: P("Abrir a porta trancada (Ladinagem CD 20) sem disparar o gás. Resultado 25 na Ladinagem ou Investigação CD 25 evita a armadilha."),
		effects: P(`Gás venenoso em alcance curto: perda de ${R("2d12", "perda")} PV por rodada durante 3 rodadas (Fortitude CD 20 reduz para 1 rodada).`),
		actions: P("Dentro: os últimos documentos de Tallaka (veja \"Documentos para os jogadores\").")
	}
];

// ---------------------------------------------------------------------------
// Itens da aventura e parceiros
// ---------------------------------------------------------------------------
async function itensDaAventura() {
	const lista = [];
	const tesouro = (nome, desc, { qtd = 1, preco = 0, img = "icons/svg/item-bag.svg" } = {}) => ({ name: nome, type: "tesouro", img, system: { description: { value: P(desc) }, source: FONTE, qtd, preco } });
	const certeira = () => ({ ...efUso("Certeira", [["ataque", 1]], { automatic: true, desc: "+1 nos testes de ataque." }), flags: { tormenta20: { upgrade: "accurate" } } });
	const precisa = () => ({ ...efUso("Precisa", [["criticoM", -1]], { automatic: true, desc: "+1 na margem de ameaça." }), flags: { tormenta20: { upgrade: "precise" } } });

	// Manopla dos Anões
	lista.push({
		name: "Manopla dos Anões", type: "equipamento", img: EQ("manopla"),
		effects: [efCartao("Manopla dos Anões (+2 For)", [["system.modificadores.atributos.for", 2]], { img: EQ("manopla"), rodadas: 1 })],
		system: {
			description: { value: P("Esta manopla de aço-rubi foi originalmente criada por mestres anões. Uma vez por rodada, você pode gastar 1 PM para receber +2 em Força por 1 rodada.", "<b>Automação:</b> use o item (gasta 1 PM) e aplique o efeito do cartão no próprio token; ele some sozinho no início do próximo turno.", "Andar 4, área 2.") },
			source: FONTE, tipo: "acessorio", preco: 9000, peso: 0, espacos: 1, ativacao: { custo: 1 }
		}
	});

	// Machado anão de aço-rubi
	const machado = await doCompendio("equipamentos", "Machado anão");
	if (machado) {
		machado.name = "Machado anão de aço-rubi";
		machado.system.description.value = P("Machado anão certeiro e preciso de aço-rubi, guardado no cofre de Tallaka (andar 4, área 7).", "<b>Automação:</b> certeira (+1 no ataque), precisa (+1 na margem de ameaça) e aço-rubi (ignora 10 de RD) entram sozinhos em todo ataque. Ignorar a imunidade a crítico de lefeu fica com o mestre.") + machado.system.description.value;
		// Material especial conta como melhoria (o campo antigo "material" o sistema descarta na migração).
		machado.system.upgrades = { ...(machado.system.upgrades ?? {}), melhoria1: "accurate", melhoria2: "precise", melhoria3: "specialmaterial" };
		machado.effects = [certeira(), precisa(), { ...ignoraRD(10), name: "Aço-rubi (ignora RD 10)" }];
		lista.push(machado);
	} else relatorio.avisos.push("Machado anão não encontrado no compêndio do sistema.");

	// Flechas de aço-rubi
	const flechas = await doCompendio("equipamentos", "Flechas");
	if (flechas) {
		flechas.name = "Flechas de aço-rubi";
		flechas.system.qtd = 10;
		flechas.system.description.value = P("Dez flechas de aço-rubi do cofre de Tallaka (andar 4, área 7). Ignoram 10 pontos de redução de dano.", "<b>Automação:</b> ao disparar uma delas, Shift+clique no arco e marque \"Flecha de aço-rubi\".");
		flechas.effects = [efUso("Flecha de aço-rubi", [["ignoraRD", 10]], { types: ["attack"], desc: "Ignora 10 de RD." })];
		lista.push(flechas);
	} else relatorio.avisos.push("Flechas não encontradas no compêndio do sistema.");

	// Pistola certeira (cofre de Zhura)
	const pistola = await doCompendio("equipamentos", "Pistola");
	if (pistola) {
		pistola.name = "Pistola certeira";
		pistola.system.description.value = P("Encontrada no cofre de Zhura (andar 1, área 6), com 10 balas.", "<b>Automação:</b> certeira (+1 no ataque) entra sozinha.") + pistola.system.description.value;
		pistola.system.upgrades = { ...(pistola.system.upgrades ?? {}), melhoria1: "accurate" };
		pistola.effects = [certeira()];
		lista.push(pistola);
	}
	const balas = await doCompendio("equipamentos", "Balas");
	if (balas) {
		balas.name = "Balas (cofre de Zhura)";
		balas.system.qtd = 10;
		lista.push(balas);
	}

	// Espada de injeção alquímica de Jaren
	const espada = await doCompendio("equipamentos", "Espada longa");
	if (espada) {
		espada.name = "Espada de injeção alquímica de Jaren";
		espada.system.description.value = P("A espada modificada de Jaren: um reservatório no cabo injeta preparados alquímicos na lâmina. Jaren a usa com ácido (+2d4).", "<b>Automação:</b> Shift+clique no ataque e marque o preparado carregado (ácido +2d4 ou fogo alquímico +1d6). Recarregar o reservatório fica com o mestre.") + espada.system.description.value;
		espada.system.upgrades = { ...(espada.system.upgrades ?? {}), melhoria1: "injection" };
		espada.effects = [
			efUso("Injeção: ácido", [["dano", "2d4[acido]"]], { desc: "+2d4 de ácido." }),
			efUso("Injeção: fogo alquímico", [["dano", "1d6[fogo]"]], { desc: "+1d6 de fogo." })
		];
		lista.push(espada);
	}

	// Tesouros e chaves
	lista.push(tesouro("Pedaço de aço-rubi", "Pedaço de aço-rubi do cofre de Tallaka. Cada um pode ser usado para uma melhoria de aço-rubi sem custo.", { qtd: 2, img: GER("aco-rubi") }));
	for (const [n, onde] of [["1º andar", "Nicho atrás de onde estavam os reféns (andar 1, área 7). Misticismo CD 15: é parte de uma chave mágica anã."], ["2º andar", "Com Jaren (andar 2, área 8), que o achou escavando para plantar explosivos."], ["3º andar", "Acoplado no construto da área 8 do andar 3."]]) {
		lista.push(tesouro(`Terço da chave de Tallaka (${n})`, `${onde} As três partes juntas abrem o cofre do andar 4.`, { img: "icons/magic/symbols/runes-triangle-orange.webp" }));
	}
	lista.push(tesouro("Peça triangular do laboratório", "Presa no corpo de um dos trolls rubi (andar 3, área 5). Encaixa no nicho da porta do laboratório de Tallaka.", { img: "icons/magic/symbols/runes-star-pentagon-orange.webp" }));
	lista.push(tesouro("Chave do cofre de Zhura", "Abre a porta da área 6 do andar 1 (sem ela: Ladinagem CD 25). Zhura a entrega se for convencida a desistir.", { img: GER("gazua") }));
	lista.push(tesouro("Tabuletas de Tallaka", "Tabuletas de pedra com runas anãs e desenhos de armaduras de aço-rubi (andar 2, área 8). Um anão ou Conhecimento CD 15 lê. Um inventor recebe +10 em testes para fabricar itens de aço-rubi. Entregues a Ezequias, ele dá uma melhoria em um item à escolha de cada jogador.", { img: GER("livro") }));

	// Anotações sobre trolls (andar 1, corredor da área 4)
	lista.push({
		name: "Anotações sobre Trolls", type: "poder", img: GER("diario"),
		effects: [efUso("Anotações sobre Trolls (+1d6)", [["ataque", "1d6"]], { types: ["attack"], desc: "+1d6 em um ataque contra um troll." })],
		system: {
			description: { value: P("Desenhos de trolls com setas apontando partes do corpo (andar 1, corredor após a área 4). Com Conhecimento CD 15, cada herói recebe 1d6 de bônus para usar uma vez em um teste de ataque contra um troll ou para aumentar a CD de uma magia lançada contra um troll.", "<b>Automação:</b> arraste para a ficha de cada herói. No ataque contra o troll, Shift+clique e marque a opção; depois apague o item. Para a CD da magia, role 1d6 e some à mão.") },
			source: FONTE, tipo: "geral", subtipo: "Coração de Rubi"
		}
	});
	return lista;
}

function parceiros() {
	const semUso = { description: "", automatic: false, aumenta: false, custo: 0, names: [], types: [] };
	const efeito = (name, img, key, desc) => ({
		name, img, type: "base", transfer: true, disabled: false,
		duration: { value: null, units: "seconds", expiry: null },
		description: desc,
		system: { changes: [{ key, value: "2", type: "add", priority: null, phase: "initial" }], targets: [], status: null, onuse: false, abilityUse: semUso, aura: { isAura: false, range: 0 } }
	});
	const imgK = "icons/creatures/magical/construct-iron-stomping-yellow.webp";
	const imgL = "icons/consumables/potions/potion-flask-corked-pink.webp";
	return [
		{
			name: "Parceiro: K (Veterano)", type: "poder", img: imgK,
			effects: [efeito("K — Parceiro Veterano (+2 Defesa)", imgK, "system.attributes.defesa.bonus", "<p>K protege este personagem.</p>")],
			system: {
				description: { value: `<p><strong>Parceiro Veterano.</strong> K pode proteger e aconselhar os aventureiros. O personagem que K estiver ajudando recebe <strong>+2 na Defesa</strong> e, <strong>uma vez por cena</strong>, pode rolar novamente um teste de perícia recém realizado.</p>
<p><em>Automação:</em> o +2 na Defesa vale enquanto este poder estiver na ficha. Para rolar novamente, use a macro <strong>A2 · K — Rolar novamente</strong> logo após o teste.</p>`, unidentified: "" },
				source: "Coração de Rubi, Aventura 2, p. 43", tipo: "geral", subtipo: "Parceiros",
				ativacao: { execucao: "passive", custo: 0, qtd: "", condicao: "", special: "" },
				duracao: { value: 0, units: "inst", special: "" }, alcance: "none", rolls: []
			}
		},
		{
			name: "Parceira: Lonien (Veterana)", type: "poder", img: imgL,
			flags: { world: { cdr: TAG, cdrParceiro: "lonien" } },
			effects: [efeito("Lonien — Parceira Veterana (+2 resistência)", imgL, "system.modificadores.pericias.resistencia", "<p>Lonien protege este personagem.</p>")],
			system: {
				description: { value: `<p><strong>Parceira Veterana.</strong> Lonien pode curar e proteger os aventureiros. O personagem que Lonien estiver ajudando recebe <strong>+2 em testes de resistência</strong> e, <strong>uma vez por cena</strong>, se for reduzido a 0 PV ou menos, cura <strong>4d8+4 PV</strong>.</p>
<p><em>Automação:</em> o +2 vale enquanto este poder estiver na ficha. Com o módulo ativo, a cura acontece sozinha quando o herói cai a 0 PV ou menos (1x por cena). A macro <strong>A2 · Lonien — Cura de Emergência</strong> cura na hora.</p>`, unidentified: "" },
				source: "Coração de Rubi, Aventura 2, p. 44", tipo: "geral", subtipo: "Parceiros",
				ativacao: { execucao: "passive", custo: 0, qtd: "", condicao: "", special: "" },
				duracao: { value: 0, units: "inst", special: "" }, alcance: "none",
				rolls: [{ name: "Cura de Emergência", key: "dano0", type: "dano", parts: [["4d8+4", "curapv", ""]], versatil: "", adaptavel: "" }]
			}
		}
	];
}

// ---------------------------------------------------------------------------
// Criação
// ---------------------------------------------------------------------------
function nivelDoND(nd) {
	if (["S", "S+"].includes(nd)) return 20;
	return Number(nd) || 1;
}

async function criarAmeaca(a, folder) {
	const tam = { min: 0.5, peq: 1, med: 1, gra: 2, eno: 3, col: 4 }[a.tamanho] ?? 1;
	const resist = {};
	for (const t of a.imune ?? []) resist[t] = { imunidade: true };

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
				movement: { walk: { base: a.desl } },
				sentidos: { value: a.sentidos ?? [] }
			},
			detalhes: {
				tipo: a.tipo,
				raca: a.raca ?? "",
				resistencias: a.resistencias ?? "",
				ataquescac: a.ataquescac ?? "",
				ataquesad: a.ataquesad ?? "",
				equipamento: a.equipamento ?? "",
				tesouro: "Nenhum.",
				biography: { value: P(a.bio ?? ""), public: "" }
			},
			tracos: { tamanho: a.tamanho, resistencias: resist, ic: { value: a.ic ?? [], custom: "" } }
		},
		flags: { tormenta20: { coracaoDeRubi: "aventura2" }, world: { cdr: TAG, ...(a?.automacoes ? { cdrAutomacoes: a.automacoes } : {}) } }
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
		const m = await doCompendio("magias", nomeMagia);
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
		flags: { tormenta20: { coracaoDeRubi: "aventura2" }, world: { cdr: TAG } }
	});
	relatorio.criados.push(`Perigo: ${h.nome}`);
	return actor;
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------
const pastaAmeacas = await subpasta("Ameaças", "Actor");
const pastaPerigos = await subpasta("Armadilhas e Enigmas", "Actor");
const pastaParceiros = await subpasta("Parceiros", "Item");

const fichas = {};
for (const a of AMEACAS) fichas[a.nome] = await criarAmeaca(a, pastaAmeacas);
for (const h of PERIGOS) fichas[h.nome] = await criarPerigo(h, pastaPerigos);

const lobo = await doCompendio("ameacas", "Lobo");
if (lobo) {
	lobo.folder = pastaAmeacas.id;
	lobo.flags = { ...(lobo.flags ?? {}), ...FLAGS() };
	fichas.Lobo = await Actor.implementation.create(lobo);
	relatorio.criados.push("Lobo (compêndio)");
}

// Itens e parceiros
const itens = (await itensDaAventura()).map((i) => ({ ...i, folder: pasta.Item.id, flags: { ...(i.flags ?? {}), world: { ...(i.flags?.world ?? {}), cdr: TAG } } }));
const pars = parceiros().map((i) => ({ ...i, folder: pastaParceiros.id, flags: { ...(i.flags ?? {}), world: { ...(i.flags?.world ?? {}), cdr: TAG } } }));
for (const i of await Item.implementation.createDocuments([...itens, ...pars])) relatorio.criados.push(`Item: ${i.name}`);

// Macros dos parceiros
await Macro.implementation.createDocuments([
	{ name: "A2 · K — Rolar novamente", type: "script", scope: "global", img: "icons/creatures/magical/construct-iron-stomping-yellow.webp", folder: pasta.Macro.id, flags: FLAGS("kRolar"), ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER }, command: "// K — Rolar novamente — 1x por cena, para quem tiver o poder \"Parceiro: K (Veterano)\"\nactor = canvas.tokens.controlled[0]?.actor ?? game.user.character;\nif (!actor) return ui.notifications.warn(\"Selecione o token do herói que K está ajudando.\");\nif (!actor.items.some((i) => i.name === \"Parceiro: K (Veterano)\")) return ui.notifications.warn(actor.name + \" não tem o poder do K na ficha.\");\nconst MARCA = \"K — rolagem novamente usada\";\nif (actor.effects.some((e) => e.name === MARCA)) return ui.notifications.warn(\"K já ajudou \" + actor.name + \" a rolar novamente nesta cena.\");\n\n// último teste deste ator no chat (ignora rolagens de dano)\nconst msg = game.messages.contents.slice().reverse().find((m) =>\n\tm.speaker?.actor === actor.id && m.rolls?.some((r) => r.dice?.some((d) => d.faces === 20)));\nif (!msg) return ui.notifications.warn(\"Nenhum teste recente de \" + actor.name + \" encontrado no chat.\");\nconst original = msg.rolls.find((r) => r.dice?.some((d) => d.faces === 20));\nconst titulo = (msg.flavor || msg.content.replace(/<[^>]+>/g, \" \").replace(/\\s+/g, \" \").trim().slice(0, 60)) || \"teste\";\n\nconst confirma = await foundry.applications.api.DialogV2.confirm({\n\twindow: { title: \"K — Rolar novamente\" },\n\tcontent: \"<p>Rolar novamente <strong>\" + titulo + \"</strong> (resultado anterior: <strong>\" + original.total + \"</strong>)?</p>\"\n});\nif (!confirma) return;\n\nconst nova = await original.reroll();\nawait nova.toMessage({\n\tspeaker: ChatMessage.getSpeaker({ actor }),\n\tflavor: \"<strong>K aconselha:</strong> rolando novamente \" + titulo + \" (antes: \" + original.total + \")\"\n});\nawait actor.createEmbeddedDocuments(\"ActiveEffect\", [{\n\tname: MARCA, img: \"icons/creatures/magical/construct-iron-stomping-yellow.webp\", type: \"base\",\n\tduration: { value: null, units: \"seconds\", expiry: \"sceneEnd\" },\n\tdescription: \"<p>Rolagem novamente do K já usada nesta cena.</p>\",\n\tsystem: { changes: [], targets: [], status: null, onuse: false,\n\t\tabilityUse: { description: \"\", automatic: false, aumenta: false, custo: 0, names: [], types: [] },\n\t\taura: { isAura: false, range: 0 } }\n}]);" },
	{ name: "A2 · Lonien — Cura de Emergência", type: "script", scope: "global", img: "icons/consumables/potions/potion-flask-corked-pink.webp", folder: pasta.Macro.id, flags: FLAGS("lonienCura"), ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER }, command: "// Lonien — Cura de Emergência: cura 4d8+4 PV agora no herói selecionado (1x por cena).\n// A cura automática ao cair a 0 PV já vem do módulo Coração de Rubi; esta macro é para usar na hora.\nactor = canvas.tokens.controlled[0]?.actor ?? game.user.character;\nif (!actor) return ui.notifications.warn(\"Selecione o token do herói que Lonien está ajudando.\");\nconst api = game.modules.get(\"giriarpg-coracao-de-rubi\")?.api;\nif (!api) return ui.notifications.warn(\"Ative o módulo Coração de Rubi.\");\nawait api.curaLonien(actor);" }
]);

// Diários
	const L = (n, rotulo) => (fichas[n] ? `@UUID[${fichas[n].uuid}]{${rotulo ?? n}}` : rotulo ?? n);
const linha = (local, txt) => `<li><b>${local}:</b> ${txt}</li>`;
const roteiro = [
	{ name: "Abertura e estrada", html: `<ul>${[
		linha("Cena 1 — Ezequias", "T$ 1.000 por aventureiro (dobra se pedirem), pagos ao entregar a ferramenta-artefato."),
		linha("Cena 2 — Lonien", "Pede para achar o irmão Jaren, expulso da Guilda por desvio de dinheiro."),
		linha("Cena 3 — Emboscada anã", `Percepção CD 15 ou surpreendidos. ${L("Stroka")} + 4 ${L("Anão Capanga", "anões capangas")}. Stroka pede clemência com menos de 15 PV.`),
		linha("Cena 4 — Entrada", "Elevador velho; Sabedoria CD 10 lembra que masmorras são mais perigosas no fundo.")
	].join("")}</ul>` },
	{ name: "Andar 1 — Os Mineradores Perdidos", html: `<ul>${[
		linha("Área 1", "Investigação CD 15: sinais de uso recente."),
		linha("Área 2", `2 ${L("Anão Veterano", "anões veteranos")} (Furtividade × Percepção +8). Pedem ajuda na 2ª rodada; os humanos da área 3 chegam na 3ª. Bilhete de Zhura.`),
		linha("Área 3", `2 ${L("Humano Mercenário", "humanos mercenários")} (Furtividade × Percepção +3). 2 rolagens de tesouro ND 3. Desenhos de construtos (Misticismo CD 20).`),
		linha("Área 4", `${L("Humano Mercenário", "Vigia dorminhoco")} (Furtividade CD 5; Intimidação CD 15 o expulsa). Documentos sobre trolls (Conhecimento CD 15 → item Anotações sobre Trolls).`),
		linha("Área 5", `${L("Humano Mercenário", "humano mercenário")} + ${L("Lobo", "lobo")}.`),
		linha("Área 6", "Cofre de Zhura (Ladinagem CD 25 ou a chave): corda e arpéu, pistola certeira com 10 balas, 2 rolagens de tesouro ND 4."),
		linha("Área 7", `${L("Zhura")} + 3 ${L("Anão Veterano", "anões veteranos")} e 1d6+4 reféns (cada anão mata um se o grupo atacar). Teste estendido Diplomacia/Intimidação CD 25 (20 com Stroka), 3 sucessos. Thrûn sobrevive. 1º terço da chave no nicho.`)
	].join("")}</ul>` },
	{ name: "Andar 2 — Sede de Vingança", html: `<ul>${[
		linha("Geral", "Áreas escuras: o grupo precisa de luz ou visão no escuro."),
		linha("Área 2", "Explosão e cadáveres fumegantes dos capangas de Jaren."),
		linha("Área 3", `3 ${L("Anão Veterano", "anões veteranos")} + ${L("Caixotes de Bombas")}.`),
		linha("Área 4", `${L("Armadilha de Gás Inflamável")} (depósito de Jaren).`),
		linha("Área 5", "2 gorloggs (Tormenta20, p. 291; não criados por esta macro)."),
		linha("Área 6", `3 ${L("Humano Matador", "humanos matadores")} + ${L("Mago Matador", "mago matador")}. Alavanca que desativa a armadilha da área 4.`),
		linha("Área 7", L("Corredor Explosivo")),
		linha("Área 8", `${L("Jaren")} + ${L("Mago Matador", "mago matador")} + 2 ${L("Humano Matador", "humanos matadores")}. 2º terço da chave e Tabuletas de Tallaka. Poupado, Jaren leva a Lonien como parceira.`)
	].join("")}</ul>` },
	{ name: "Andar 3 — As Sobras da Guerra", html: `<ul>${[
		linha("Área 2", "Laboratório de Tallaka: minério de aço-rubi e pergaminhos (anão ou Conhecimento CD 15; tradução T$ 30). Porta com nicho triangular."),
		linha("Área 3", `K desperta. Amigável: parceiro veterano (item Parceiro: K). Atacado ou desrespeitado: ${L("K (hostil)")}.`),
		linha("Área 4", L("Desafio de Heredrimm")),
		linha("Área 5", `2 ${L("Troll Rubi", "trolls rubi")}; peça triangular no corpo de um deles.`),
		linha("Área 6", `4 ${L("Guardião de Aço", "guardiões de aço")}.`),
		linha("Área 7", `${L("Enigma do Sol e da Lua")} → ${L("Guardião de Rubi", "guardião de rubi")} + ${L("Troll Rubi", "troll rubi")}. Baú: 2 rolagens de tesouro ND 6.`),
		linha("Área 8", "3º terço da chave, acoplado no construto.")
	].join("")}</ul>` },
	{ name: "Andar 4 — Os Segredos de Tallaka", html: `<ul>${[
		linha("Área 2", `Porta: Ladinagem CD 20. 2 ${L("Guardião de Aço", "guardiões de aço")} + ${L("Guardião de Rubi", "guardião de rubi")}. Manopla dos Anões e 1 rolagem de tesouro ND 7.`),
		linha("Área 3", L("Abismo")),
		linha("Área 4", L("Caminho Diagonal (Teias Corrosivas)")),
		linha("Área 5", `${L("Porta do Último Experimento")}. Últimos documentos de Tallaka.`),
		linha("Área 6", `2 ${L("Guardião de Aço", "guardiões de aço")}.`),
		linha("Área 7", `Cofre (três terços da chave). ${L("Abominação Rubi")}. Corpo de Tallaka, 2 pedaços de aço-rubi, 10 flechas de aço-rubi, machado anão de aço-rubi, tesouro ND 8. O pedestal do artefato está vazio.`)
	].join("")}</ul>` },
	{ name: "Epílogo", html: `<ul>${[
		linha("Lonien", "Quer selar a mina com um desabamento. Aliada permanente se a câmara for destruída: 30% de desconto em alquímicos e poções."),
		linha("K", `Quer preservar a câmara. Aliado permanente se ela for mantida: 30% de desconto em melhorias. Se o grupo destruir a câmara, ${L("K (hostil)", "K ataca")} e luta até a morte.`),
		linha("Meio-termo", "Boa interpretação + Diplomacia estendida CD 25, 3 sucessos: os dois ficam aliados."),
		linha("Registrar", "Destino de Stroka, Zhura e Jaren; aliança com K e/ou Lonien.")
	].join("")}</ul>` }
];
const documentos = [
	["Bilhete de Zhura (andar 1, área 2)", "<i>Não se esqueçam: a Guilda dos Mineradores paga bem, mas exige muito! Não falhem, ou eles chamarão outros mercenários. Precisamos agir a qualquer sinal de pessoas mandadas pelo tal Ezequias. Não me decepcionem. — Zhura</i>"],
	["Lembrete do anão (andar 2, área 3)", "<i>Afiar machado. Aparar a barba. Cobrar de Jaren o pagamento.</i>"],
	["Diário de Tallaka (andar 3)", [
		"Já faz semanas que me estabeleci neste laboratório, com uma boa quantidade de aço-rubi. Minha primeira medida foi defensiva: a criação de construtos que ataquem qualquer intruso. Agora, poderei estudar o aço-rubi.",
		"Há séculos lutamos contra os malditos finntroll. Nossos soldados são bravos, mas os trolls nobres são ardilosos. Fazem experimentos bioarcanos, que transformam criaturas do subterrâneo em armas de guerra. A vitória é improvável. A menos que façamos nossos próprios experimentos...",
		"O aço-rubi é o material mais fantástico de Arton. Mais duro que diamante, mais resistente que adamante, armas forjadas por ele cortam qualquer coisa. Muitas outras raças querem entender como conseguimos o aço-rubi, mas continuaremos em silêncio sobre isso. O aço-rubi é uma das grandes vantagens dos anões e continuará sendo. Ainda há aspectos do material que nós mesmos não entendemos, mas há cada vez mais anões empenhados em estudá-lo.",
		"Descobri aspectos incríveis do aço-rubi, que aumentam a eficácia de armas e armaduras. Será uma boa ajuda contra os trolls e os outros monstros usados pelos finntroll.",
		"Por que me preocupar com armas e armaduras? Se usar o aço-rubi em meus construtos, posso deixá-los ainda mais poderosos e, assim, poupar a vida de incontáveis anões!",
		"Acho que vou conseguir convencer os militares a me escutarem. Alguns ainda viram o nariz para meus construtos, acham que não são tão confiáveis quanto um soldado... Mas estamos em guerra e temos que fazer o que for preciso para vencer. K confirmou que os construtos estão melhorando nos testes de lógica, o que é bom, pois me ajudará convencer os outros de que eles não se virarão contra os nossos.",
		"Meus novos espécimes de estudo chegaram! São trolls da superfície, mas ainda assim estou empolgada, sinto que estou prestes a descobrir algo fantástico! K está preocupado com a minha saúde, mas ele é um golem, não entende que anões são resistentes. Vou usar o espaço do andar de baixo para fazer esses novos experimentos. Nunca fui tão longe, mas tenho esperanças de que conseguirei bons resultados.",
		"Hoje, K foi ferido por um dos espécimes. Ele insiste que não precisa de descanso, mas não vou forçar sua energia. Vou deixá-lo na salinha de descanso, se recuperando, enquanto sigo com os experimentos. Não sei qual foi a última vez que dormi, mas Doherimm cobra resultados e não quero dar chance para os finntroll causarem mais destruição."
	].map((t) => `<i>${t}</i>`).join("</p><p>")],
	["Últimos documentos de Tallaka (andar 4, área 5)", [
		"Sei que, se Doherimm ficar sabendo disso, todas as minhas pesquisas serão canceladas, mas não me importo mais. O que quero agora é derrotar os malditos finntroll e salvar meu povo. Ainda há tanto que não sabemos sobre o aço-rubi que seria um desperdício abandonar os estudos agora. Que Heredrimm tenha misericórdia de mim…",
		"O artefato é fantástico! Consegui usá-lo em armas, armaduras e construtos… Moldar aço-rubi é difícil, mas com as temperaturas que ele permite atingir na forja, torna-se brincadeira de elfo. Ele precisa ficar trancado em meu cofre. Se cair nas mãos dos trolls nobres, estamos perdidos.",
		"Meus novos espécimes chegaram. Me sinto mal por estar enganando esses anões, mas preciso saber até onde podemos usar aço-rubi em um organismo vivo. Em Doherimm, eles foram avisados que me ajudariam com o transporte, mas não é verdade. Talvez morram, mas será por uma boa causa.",
		"Todos os experimentos de aço-rubi em organismos vivos foram um fracasso. A maioria não passa da cirurgia, mas os que sobrevivem se queixam de dores horríveis... e logo morrem. Achei que aplicando aço-rubi diretamente nas pessoas poderia conseguir um resultado melhor, mas agora me vejo em um beco sem saída...",
		"K acha que os anões partiram depois de terem me auxiliado, mas a verdade é que queimei os corpos. Estou pensando em que desculpa dar para Doherimm para pedir mais ajuda. As famílias dessas pessoas vão ficar preocupadas, preciso pensar no que vou falar... Imaginei que uma ou outra poderia morrer, mas não assim. O que vou fazer? O que eu já fiz?"
	].map((t) => `<i>${t}</i>`).join("</p><p>")]
];
const paginas = (lista) => lista.map((pg, i) => ({ name: pg.name, type: "text", sort: (i + 1) * 100, title: { show: true, level: 1 }, text: { content: pg.html, format: 1 } }));
await JournalEntry.implementation.createDocuments([
	{ name: "A2 · Como usar no Foundry", folder: pasta.JournalEntry.id, flags: FLAGS("comoUsar"), pages: paginas([{"name": "Visão geral", "html": "<p>Tudo desta aventura fica nas pastas <strong>Coração de Rubi / Aventura 2 · O Segredo das Minas</strong> (Atores, Itens, Macros e Diários). As ameaças estão em <em>Ameaças</em>, os perigos em <em>Armadilhas e Enigmas</em> e os parceiros em <em>Parceiros</em>. Cenas e mapas ficam por sua conta.</p>\n<p>Fonte: livro <em>Coração de Rubi</em>, pp. 29–45. Os valores das fichas foram conferidos contra o livro: Defesa, PV, CD, iniciativa, percepção, resistências e ataques batem em todas.</p>"}, {"name": "Ameaças", "html": "<table>\n<thead>\n<tr>\n<th>Ameaça</th>\n<th>ND</th>\n<th>Onde</th>\n<th>Automação</th>\n</tr>\n</thead>\n<tbody>\n<tr>\n<td>Anão Capanga</td>\n<td>½</td>\n<td>Cena 3 (x4)</td>\n<td>Ataque e dano prontos</td>\n</tr>\n<tr>\n<td>Stroka</td>\n<td>3</td>\n<td>Cena 3</td>\n<td>Bloqueio com Escudo (RD 5 por 1 rodada, pelo cartão); Contra-golpe usa o ataque de escudo</td>\n</tr>\n<tr>\n<td>Anão Veterano</td>\n<td>2</td>\n<td>A1 áreas 2 e 7; A2 área 3</td>\n<td>Machado anão e besta pesada</td>\n</tr>\n<tr>\n<td>Humano Mercenário</td>\n<td>1</td>\n<td>A1 áreas 3, 4 e 5</td>\n<td>Golpe Covarde opcional (+2 ataque, +2d6)</td>\n</tr>\n<tr>\n<td>Lobo</td>\n<td>½</td>\n<td>A1 área 5</td>\n<td>Copiado do compêndio do sistema</td>\n</tr>\n<tr>\n<td>Zhura</td>\n<td>4</td>\n<td>A1 área 7</td>\n<td>Ferreira Elemental (escolhe o elemento na janela do ataque, +1d6); Ordens (+2 em perícias até o fim da cena, pelo cartão)</td>\n</tr>\n<tr>\n<td>Humano Matador</td>\n<td>2</td>\n<td>A2 áreas 6 e 8</td>\n<td>Golpe Covarde opcional (+2 ataque, +3d6)</td>\n</tr>\n<tr>\n<td>Mago Matador</td>\n<td>3</td>\n<td>A2 áreas 6 e 8</td>\n<td>8 magias do compêndio, CD 19, 28 PM; Arcano de Batalha (+4 automático em Seta Infalível e Bola de Fogo)</td>\n</tr>\n<tr>\n<td>Jaren</td>\n<td>5</td>\n<td>A2 área 8</td>\n<td>Espada com +2d4 ácido automático; Bomba de Ácido (6d4+6, Ref CD 23, botão Vulnerável); Pasmo (1 rodada) ao ouvir falar de Lonien</td>\n</tr>\n<tr>\n<td>Guardião de Aço</td>\n<td>4</td>\n<td>A3 área 6; A4 áreas 2 e 6</td>\n<td>Pancada com botão Atordoado (1 rodada), que some sozinho e leva o Desprevenido junto</td>\n</tr>\n<tr>\n<td>Guardião de Rubi</td>\n<td>5</td>\n<td>A3 área 7; A4 área 2</td>\n<td>Pancada ignora RD 10 sozinha; botão Sangrando; Sensores; rolagem de fortificação 75%</td>\n</tr>\n<tr>\n<td>Troll Rubi</td>\n<td>5</td>\n<td>A3 áreas 5 e 7</td>\n<td>Garra ignora RD 10 sozinha; Dilacerar; cura acelerada 15 (automática); imune a fogo; fortificação 50%</td>\n</tr>\n<tr>\n<td>Abominação Rubi</td>\n<td>8</td>\n<td>A4 área 7</td>\n<td>Pancada ignora RD 15 + Sangrando; mordida com Atordoado (1 rodada); Dilacerar; cura acelerada 10 (automática); imune a atordoado e paralisado</td>\n</tr>\n<tr>\n<td>K (hostil)</td>\n<td>5</td>\n<td>A3 área 3 ou epílogo</td>\n<td>Guardião de rubi com Int 2 (o livro diz \"Inteligência 15\", notação antiga)</td>\n</tr>\n</tbody>\n</table>\n<p>Gorloggs (A2 área 5) ficaram de fora, como você decidiu antes. As fichas de Guardião de Rubi, Abominação Rubi e K usam as artes da pasta <em>2. NPCs/Aventura 2</em>.</p>"}, {"name": "Perigos", "html": "<table>\n<thead>\n<tr>\n<th>Perigo</th>\n<th>Onde</th>\n<th>No ator</th>\n</tr>\n</thead>\n<tbody>\n<tr>\n<td>Caixotes de Bombas</td>\n<td>A2 área 3</td>\n<td>Rolagem de 2d4 bombas e do dano para cada quantidade (Ref CD 20)</td>\n</tr>\n<tr>\n<td>Armadilha de Gás Inflamável</td>\n<td>A2 área 4</td>\n<td>1d12 de perda por rodada (Fort CD 20) e explosão de 12d6 (Ref CD 20)</td>\n</tr>\n<tr>\n<td>Corredor Explosivo</td>\n<td>A2 área 7</td>\n<td>6d6 por bomba (Ref CD 17), padrão de 3m</td>\n</tr>\n<tr>\n<td>Desafio de Heredrimm</td>\n<td>A3 área 4</td>\n<td>Pistas da balança com as CDs</td>\n</tr>\n<tr>\n<td>Enigma do Sol e da Lua</td>\n<td>A3 área 7</td>\n<td>Solução e pistas; avisa do troll e do guardião</td>\n</tr>\n<tr>\n<td>Abismo</td>\n<td>A4 área 3</td>\n<td>Atletismo CD 20 ou Acrobacia CD 15</td>\n</tr>\n<tr>\n<td>Caminho Diagonal</td>\n<td>A4 área 4</td>\n<td>Diagonal é o caminho seguro; 4d8 ácido por turno; link de Imóvel</td>\n</tr>\n<tr>\n<td>Porta do Último Experimento</td>\n<td>A4 área 5</td>\n<td>2d12 de perda por rodada (Fort CD 20)</td>\n</tr>\n</tbody>\n</table>\n<p>O ND dos perigos é só referência (o nível do grupo no andar); o livro não dá ND para eles.</p>"}, {"name": "Itens", "html": "<table>\n<thead>\n<tr>\n<th>Item</th>\n<th>Automação</th>\n</tr>\n</thead>\n<tbody>\n<tr>\n<td>Manopla dos Anões</td>\n<td>Gasta 1 PM ao usar; botão +2 Força por 1 rodada</td>\n</tr>\n<tr>\n<td>Machado anão de aço-rubi</td>\n<td>Certeira, precisa e ignora RD 10, tudo automático</td>\n</tr>\n<tr>\n<td>Flechas de aço-rubi (x10)</td>\n<td>Opção \"Flecha de aço-rubi\" na janela do ataque (ignora RD 10)</td>\n</tr>\n<tr>\n<td>Pistola certeira + 10 balas</td>\n<td>Certeira automática</td>\n</tr>\n<tr>\n<td>Espada de injeção alquímica de Jaren</td>\n<td>Opções na janela: ácido +2d4 ou fogo alquímico +1d6</td>\n</tr>\n<tr>\n<td>Anotações sobre Trolls</td>\n<td>Opção +1d6 em um ataque contra troll (apagar depois de usar)</td>\n</tr>\n<tr>\n<td>Parceiro: K (Veterano)</td>\n<td>+2 Defesa permanente enquanto estiver na ficha; rolagem novamente pela macro <strong>A2 · K — Rolar novamente</strong></td>\n</tr>\n<tr>\n<td>Parceira: Lonien (Veterana)</td>\n<td>+2 em resistências permanente; cura 4d8+4 sozinha quando o herói cai a 0 PV (1x por cena). A macro <strong>A2 · Lonien — Cura de Emergência</strong> cura na hora</td>\n</tr>\n<tr>\n<td>Terços da chave, peça triangular, chave do cofre de Zhura, pedaços de aço-rubi, Tabuletas de Tallaka</td>\n<td>Tesouros com a descrição de onde estão e para que servem</td>\n</tr>\n</tbody>\n</table>"}, {"name": "Como usar na mesa", "html": "<ul>\n<li><strong>Bônus opcionais</strong> (Golpe Covarde, elemento da Zhura, injeção, flecha de aço-rubi): Shift+clique no ataque e marque na janela.</li>\n<li><strong>Condições</strong> (Atordoado, Sangrando, Vulnerável, Pasmo): depois do ataque, selecione o token de quem falhou na resistência e clique no efeito do cartão do chat.</li>\n<li><strong>Atordoado (1 rodada)</strong> some sozinho no início do turno seguinte. Sangrando e Vulnerável usam a condição padrão do sistema, que dura a cena.</li>\n<li><strong>Diário Roteiro de Encontros</strong>: uma página por andar, com os links das fichas (arraste direto para a cena).</li>\n<li><strong>Documentos para os jogadores</strong>: bilhete de Zhura, lembrete do anão e os diários de Tallaka, prontos para \"Mostrar aos jogadores\".</li>\n</ul>"}, {"name": "O que fica na mão do mestre", "html": "<ul>\n<li>\"Uma vez por cena por criatura\" do atordoamento e \"uma vez por rodada\" do Bloqueio com Escudo.</li>\n<li>Dilacerar: clicar quando as duas garras acertarem o mesmo alvo.</li>\n<li>Fortificação: rolagem própria, clicada quando acontecer. A cura acelerada do troll rubi e da Abominação é automática no início do turno (em combate); o aviso no chat lembra de descontar o dano de ácido do troll.</li>\n<li>Recarga da Bomba de Ácido e efeitos da Visão da Verdade (Sensores).</li>\n<li>Pedido de clemência de Stroka (&lt;15 PV) e de Jaren (&lt;10 PV): anotado na biografia de cada um.</li>\n<li>Rolagem novamente do K: macro <strong>A2 · K — Rolar novamente</strong>, logo depois do teste.</li>\n</ul>"}]) },
	{ name: "A2 · Roteiro de encontros", folder: pasta.JournalEntry.id, flags: FLAGS("roteiro"), pages: paginas(roteiro) },
	{ name: "A2 · Documentos para os jogadores", folder: pasta.JournalEntry.id, flags: FLAGS("documentos"), pages: documentos.map(([n, t], i) => ({ name: n, type: "text", sort: (i + 1) * 100, title: { show: true, level: 1 }, text: { content: `<p>${t}</p>`, format: 1 } })) },
	{ name: "A2 · Roteiro dos andares 3, 4 e epílogo", folder: pasta.JournalEntry.id, flags: FLAGS("roteiro34"), pages: paginas([{"name": "Visão geral", "html": "<p><strong>Aventura 2 — O Segredo das Minas</strong> · Para as sessões depois do Andar 2. Grupo de 6 PJs, nível 6 ao entrar no Andar 3 e 7 no Andar 4 (marcos do livro).</p>\n<table>\n<thead>\n<tr>\n<th>Andar</th>\n<th>Livro</th>\n<th>Núcleo</th>\n<th>Terço da chave</th>\n<th>Quem brilha</th>\n</tr>\n</thead>\n<tbody>\n<tr>\n<td>3</td>\n<td>Parte 3, p. 36–38</td>\n<td>Laboratório de Tallaka, golem K, enigmas, trolls rubi</td>\n<td>3º, preso no construto da área 8</td>\n<td>Badawi (selos), Bel, Kaelion</td>\n</tr>\n<tr>\n<td>4</td>\n<td>Parte 4, p. 38–40</td>\n<td>Diário sombrio, armadilhas, Abominação Rubi, cofre vazio</td>\n<td>Usa os três</td>\n<td>Badawi (a fera acorda), Octo, Kaelion</td>\n</tr>\n<tr>\n<td>Epílogo</td>\n<td>p. 40–41</td>\n<td>Selar a mina (Lonien) ou preservar (K)</td>\n<td>—</td>\n<td>Badawi, Kaelion, Thor</td>\n</tr>\n</tbody>\n</table>\n<p><strong>Fio condutor:</strong> Tallaka começou com boas intenções e terminou usando o próprio povo como cobaia. O andar 4 é o espelho de Aleister (Octo), de Ezequias (o que ele vai virar) e da fera (algo corrompido dentro de um corpo vivo, como Badawi).</p>"}, {"name": "Andar 3 — As Sobras da Guerra", "html": "<p>Pedra esculpida em ângulos retos, gemas mágicas iluminam. Ninguém passou por aqui em décadas: nem Jaren, nem os Bastiões.</p>\n<p><strong>A fera de Badawi:</strong> fica mais inquieta. Ele sente o puxão \"logo abaixo\".</p>\n<table>\n<thead>\n<tr>\n<th>Área</th>\n<th>O que tem</th>\n<th>Notas</th>\n</tr>\n</thead>\n<tbody>\n<tr>\n<td>1</td>\n<td>Corredor com três portas</td>\n<td>—</td>\n</tr>\n<tr>\n<td>2</td>\n<td><strong>Laboratório de Tallaka</strong></td>\n<td>Pergaminhos em anão (Conhecimento CD 15 ou tradutor por T$ 30): guerra contra os finntroll, aço-rubi, K, \"novos espécimes\". Porta com nicho <strong>triangular</strong> (a peça está na área 5)</td>\n</tr>\n<tr>\n<td>3</td>\n<td><strong>Golem K</strong> desperta</td>\n<td>Pergunta por Tallaka. Não é hostil, a menos que desrespeitem a memória dela. Vira parceiro especial</td>\n</tr>\n<tr>\n<td>4</td>\n<td><strong>Desafio de Heredrimm</strong> (balança)</td>\n<td>Igualar o peso dos dois lados. Pistas: Heredrimm = Khalmyr (CD 15), equilíbrio literal na doutrina anã (CD 20), plataformas cedem (Investigação/Percepção CD 20)</td>\n</tr>\n<tr>\n<td>5</td>\n<td><strong>2 trolls rubi</strong></td>\n<td>Peça triangular presa num troll. Use os desenhos de trolls do Andar 1 (+1d6)</td>\n</tr>\n<tr>\n<td>6</td>\n<td><strong>4 guardiões de aço</strong></td>\n<td>K avisa que eram guardas programados</td>\n</tr>\n<tr>\n<td>7</td>\n<td><strong>Enigma do Sol e da Lua</strong></td>\n<td>Apagar as lamparinas em sentido horário a partir da porta (sol se põe, lua sobe). Pistas: Azgher e Tenebra (CD 10), Tenebra é a heroína anã (CD 15), Tenebra vence toda noite (CD 20). Depois: guardião de rubi + troll rubi; baú de tesouro ND 6</td>\n</tr>\n<tr>\n<td>8</td>\n<td><strong>O Terço Final</strong></td>\n<td>Troll rubi + guardião de rubi. <strong>3º terço</strong> acoplado no construto</td>\n</tr>\n</tbody>\n</table>\n<p><strong>Ganchos pessoais:</strong>\n- <strong>Badawi:</strong> sugestão de bônus de +2 para entender mecanismos de contenção (a porta triangular, a balança). As portas que se trancam sozinhas são selos anões, o assunto dele.\n- <strong>Bel:</strong> o laboratório de Tallaka é pesquisa sem fé, como a da mãe dela. Bom lugar para achar uma anotação de Aloysius, se ele passou por aqui (decisão sua: Al chegou até o Andar 3?).\n- <strong>Kaelion:</strong> guardiões e trolls com aço-rubi, construtos como o golem das Cinzas Vermelhas.\n- <strong>Thor:</strong> K pergunta o que é um lefou. É a primeira pessoa (coisa) que pergunta sem medo.\n- <strong>Em Yuvalin, se K subir:</strong> Ezequias fica fascinado e enche K de perguntas sobre os experimentos.</p>"}, {"name": "Andar 4 — Os Segredos de Tallaka", "html": "<p><strong>Para ler ao chegar:</strong></p>\n<blockquote>\n<p>O elevador para e o frio que sai do corredor não é de pedra. Badawi sente: o que o chamou desde Zakharov está aqui, e está acordado.</p>\n</blockquote>\n<table>\n<thead>\n<tr>\n<th>Área</th>\n<th>O que tem</th>\n<th>Notas</th>\n</tr>\n</thead>\n<tbody>\n<tr>\n<td>1</td>\n<td>Corredor</td>\n<td>—</td>\n</tr>\n<tr>\n<td>2</td>\n<td><strong>2 guardiões de aço + 1 guardião de rubi</strong></td>\n<td>Porta Ladinagem CD 20. <strong>Manopla dos Anões</strong> e tesouro ND 7</td>\n</tr>\n<tr>\n<td>3</td>\n<td><strong>Abismo</strong> de 6m</td>\n<td>Atletismo CD 20 ou Acrobacia CD 15. Ossos de anões perto (Cura CD 15)</td>\n</tr>\n<tr>\n<td>4</td>\n<td><strong>Caminho Diagonal</strong></td>\n<td>Só a diagonal é segura (3 escolhas). Investigação CD 25 revela. Teias corrosivas: Ref CD 25, 4d8 ácido por turno, Força CD 25 para sair</td>\n</tr>\n<tr>\n<td>5</td>\n<td><strong>Último experimento</strong> (documentos)</td>\n<td>Ladinagem CD 20 ativa gás (2d12 por 3 rodadas, Fort CD 20); 25 no teste ou Investigação CD 25 evita. <strong>Diário sombrio:</strong> Tallaka enganou anões de Doherimm, usou-os como cobaias e queimou os corpos. O artefato \"ficava trancado no cofre\"</td>\n</tr>\n<tr>\n<td>6</td>\n<td><strong>2 guardiões de aço</strong></td>\n<td>—</td>\n</tr>\n<tr>\n<td>7</td>\n<td><strong>O Cofre</strong></td>\n<td>Três nichos para os terços. Dentro: <strong>Abominação Rubi</strong> (ND 8). Depois: corpo de Tallaka, 2 pedaços de aço-rubi, 10 flechas de aço-rubi, machado anão de aço-rubi, tesouro ND 8. <strong>O pedestal do artefato está vazio</strong></td>\n</tr>\n</tbody>\n</table>\n<p><strong>O diário sombrio (área 5) é a cena de interpretação do andar:</strong>\n- <strong>K</strong> fica abalado: \"Guerras nunca são simples\".\n- <strong>Octo:</strong> Tallaka é Aleister. Cobaias compradas com mentiras, mortas e esquecidas. Ele pode reconhecer o padrão das anotações (sugestão: Aleister leu ou copiou Tallaka).\n- <strong>Badawi:</strong> \"aço-rubi aplicado direto em organismos vivos\". O que a fera sente é isso.\n- <strong>Ultred:</strong> Tallaka sentenciou sem certeza, como os barões fizeram com ele.</p>\n<h3>A Abominação Rubi e a fera de Badawi</h3>\n<p>É a primeira cena em que o selo pode ceder. Regra opcional do \"selo instável\" (combine com o jogador antes; deve ser tensão, não castigo):\n- <strong>Gatilhos:</strong> Badawi cai a 0 PV, um aliado cai na frente dele, ou ele está a até 9m da Abominação.\n- <strong>Teste:</strong> Vontade CD 23 (15 + ND 8). Sucesso: segura a fera e ganha +1d6 de dano de trevas até o fim da cena. Falha: a fera assume por 1d4 rodadas e ataca a criatura mais próxima, aliada ou inimiga; o jogador decide o que ela faz dentro disso.\n- <strong>Crescimento:</strong> a cada aventura, a CD cai 2.</p>\n<p><strong>Abominação para 6 PJs:</strong> +2 em testes e dano, +40% PV (322 → cerca de 450). Ela tem cura acelerada 10, fortificação 75% e imunidade a atordoamento e paralisia; pancada ignora RD 15 e causa sangramento. Ficha pronta no Foundry pelo script da Aventura 2 (ajustar PV na mão).</p>\n<h3>O pedestal vazio</h3>\n<p>O artefato não está na mina. K não sabe explicar. Deixe a pergunta no ar: quem levou? (No livro, ele reaparece mais tarde; aqui também cabe Aloysius ter passado antes, se você quiser ligar à Bel.)</p>"}, {"name": "Epílogo — Selar ou preservar", "html": "<p>De volta a Yuvalin, com o pedestal vazio.</p>\n<ul>\n<li><strong>Lonien</strong> (se for aliada) quer selar a mina com um desabamento: \"Vocês não estarão aqui para impedir todos!\"</li>\n<li><strong>K</strong> quer preservar: \"Ela deu a vida para descobrir as propriedades do aço-rubi.\"</li>\n<li><strong>Preservar:</strong> K vira aliado permanente (30% de desconto em melhorias de armas e armaduras). Lonien não ataca, mas eles não são bem-vindos na loja de poções.</li>\n<li><strong>Destruir:</strong> K fica hostil e luta até a morte. Lonien vira aliada permanente (loja com 30% de desconto; Jaren lá, tentando mudar de vida).</li>\n<li><strong>Meio-termo:</strong> teste estendido de Diplomacia CD 25 (3 sucessos) mantém os dois.</li>\n</ul>\n<p><strong>Badawi tem a melhor opinião da mesa:</strong> selar sem destruir é literalmente o ensinamento de Dahriol. Sugestão: ele propõe um <strong>selo de Dahriol</strong> na câmara, que a mantém fechada para enxeridos e aberta para K. Isso pode valer como o meio-termo (ou dar +5 no teste estendido).</p>\n<p><strong>Ezequias</strong> recebe o relato. O artefato sumido o perturba mais do que ele admite. Momentos para plantar:\n- <strong>Thor:</strong> revelação de meio-irmão (sugestão do documento de backgrounds).\n- <strong>Octo:</strong> \"Já vi esse trabalho antes\", sobre as cicatrizes.\n- <strong>Badawi:</strong> Ezequias pede de novo para estudar o selo, agora com a desculpa da Abominação.\n- <strong>Tabuletas de Tallaka:</strong> se entregues, cada PJ ganha uma melhoria.</p>\n<p><strong>Marco:</strong> o grupo termina a A2 no <strong>8º nível</strong> e segue para a Aventura 3, Blefe Fatal (Aslavi).</p>"}, {"name": "Decisões em aberto", "html": "<ul>\n<li>Aloysius passou pela câmara? Até que andar?</li>\n<li>Badawi conta da fera ou esconde?</li>\n<li>Regra do selo instável: usar ou não?</li>\n<li>Destino de Jaren (vivo com Lonien ou morto) muda o epílogo.</li>\n</ul>"}]) }
]);

const ul = (arr) => (arr.length ? `<ul>${arr.map((x) => `<li>${x}</li>`).join("")}</ul>` : "<p>—</p>");
ChatMessage.create({
	whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id),
	content: `<h3>${NOME_PASTA}</h3><p><b>Criados (${relatorio.criados.length}):</b></p>${ul(relatorio.criados)}` + (relatorio.avisos.length ? `<p><b>Avisos:</b></p>${ul(relatorio.avisos)}` : "")
});
