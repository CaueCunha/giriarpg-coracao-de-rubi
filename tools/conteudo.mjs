/**
 * O que entra no módulo, por ato. Cada gerador em src/geradores é a fonte do conteúdo dele: o build
 * roda os geradores num Foundry simulado, na ordem abaixo (a mesma do mega script), e grava o
 * resultado como compêndios. Para incluir uma aventura nova, ponha o gerador em src/geradores,
 * acrescente o nome aqui e rode "npm run build".
 */
export const MODULO = "giriarpg-coracao-de-rubi";

/**
 * "Atos" aqui são os patamares da campanha (pastas de cima dos compêndios). As aventuras são as pastas
 * que cada gerador cria. Coração de Rubi: 6 aventuras, do 1º ao 20º nível.
 */
export const ATOS = [
	{
		id: "patamar1",
		rotulo: "Patamar 1 · Iniciante (aventuras 1 e 2)",
		cor: "#3f5f7a",
		geradores: ["a1-forja-de-herois", "a2-segredo-das-minas"]
	},
	{
		id: "patamar2",
		rotulo: "Patamar 2 · Veterano (aventuras 3 e 4)",
		cor: "#7a3f5f",
		geradores: ["a3-blefe-fatal"]
	},
	{
		id: "campanha",
		rotulo: "Campanha (ferramentas do mestre e artefatos dos jogadores)",
		cor: "#6b5a2f",
		geradores: ["pjs-dado-de-aniversario"],
		/** Macros avulsas: o arquivo inteiro (ou o comando) vira o comando da macro. */
		macros: [
			{ comando: '// Puxa do compêndio para o mundo só as aventuras escolhidas (nada é substituído).\ngame.modules.get("giriarpg-coracao-de-rubi")?.api?.abrirPuxar();', nome: "CdR · Puxar do compêndio", img: "icons/svg/download.svg", role: "importador" },
			{ comando: '// Lista o que mudou no compêndio e atualiza só o que você marcar (o que foi editado à mão fica como está).\ngame.modules.get("giriarpg-coracao-de-rubi")?.api?.abrirAtualizar();', nome: "CdR · Atualizar do compêndio", img: "icons/svg/upgrade.svg", role: "atualizador" },
			{ comando: '// Apaga do mundo o conteúdo do Coração de Rubi para você puxar só o que quiser do compêndio.\n// Guarda uma cópia num compêndio do mundo e não apaga o que você editou, a não ser que você marque.\ngame.modules.get("giriarpg-coracao-de-rubi")?.api?.abrirLimpar();', nome: "CdR · Limpar do mundo", img: "icons/svg/trash.svg", role: "limpador" },
			{ arquivo: "cdr-teste-estendido", nome: "CdR · Teste estendido", img: "icons/svg/d20-highlight.svg", role: "testeEstendido" },
			{ arquivo: "cdr-aco-rubi", nome: "CdR · Aço-rubi (aplicar ou remover)", img: "systems/tormenta20/icons/itens/gerais/aco-rubi.webp", role: "acoRubi" },
			{ arquivo: "cdr-corrigir-aprimoramentos", nome: "CdR · Corrigir aprimoramentos antigos", img: "icons/svg/upgrade.svg", role: "corrigirAprimoramentos" },
			{ arquivo: "cdr-corrigir-condicoes", nome: "CdR · Corrigir condições (T20 1.6.5)", img: "icons/svg/daze.svg", role: "corrigirCondicoes" },
			{ arquivo: "cdr-diagnostico-condicoes", nome: "CdR · Diagnóstico de condições", img: "icons/svg/hazard.svg", role: "diagnosticoCondicoes" }
		]
	}
];

/**
 * Compêndios do módulo, um por tipo (como no Giria T20). Dentro de cada um: uma pasta por patamar e, nela, as
 * pastas das aventuras (as mesmas que os geradores criam). `filtro` escolhe os documentos do tipo que entram.
 * `antigo` é o sufixo dos compêndios por ato até a v0.16 (ato1-ameacas...), para redirecionar os UUIDs antigos.
 */
export const PACKS = [
	{ nome: "ameacas", documento: "Actor", rotulo: "Ameaças e NPCs", colecao: "actors", antigo: "ameacas" },
	{ nome: "poderes", documento: "Item", rotulo: "Poderes", colecao: "items", antigo: "itens", filtro: (d) => d.type === "poder" },
	{ nome: "itens", documento: "Item", rotulo: "Itens", colecao: "items", antigo: "itens", filtro: (d) => d.type !== "poder" },
	{ nome: "diarios", documento: "JournalEntry", rotulo: "Diários", colecao: "journal", antigo: "diarios" },
	{ nome: "tabelas", documento: "RollTable", rotulo: "Tabelas", colecao: "tables", antigo: "tabelas" },
	{ nome: "macros", documento: "Macro", rotulo: "Macros", colecao: "macros", antigo: "macros" }
];

/** Valores que sobrevivem a uma atualização (a mesa muda; a atualização copia do documento antigo). */
export { PRESERVAR } from "../scripts/assinatura.mjs";
