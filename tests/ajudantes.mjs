/** Ajudantes dos testes: mundo simulado com o módulo carregado e uma mesa pronta. */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { criarMundo } from "../tools/sim/mundo.mjs";
import { lerPackFonte } from "../tools/sim/sistema.mjs";
import { RAIZ, FONTE_PACKS, GERADORES } from "../tools/caminhos.mjs";
import { MODULO } from "../tools/conteudo.mjs";

export { criarMundo, RAIZ, GERADORES, MODULO };

export const manifesto = () => JSON.parse(fs.readFileSync(path.join(RAIZ, "module.json"), "utf8"));
export const lerGerador = (nome) => fs.readFileSync(path.join(GERADORES, `${nome}.js`), "utf8");

let versaoScript = 0;

/**
 * Registra o módulo no mundo, carrega os compêndios (das fontes JSON ou de um diretório com
 * os packs extraídos do LevelDB) e roda o script do módulo (init + ready).
 */
export async function carregarModulo(mundo, { dirPacks = FONTE_PACKS, ready = false } = {}) {
	const m = manifesto();
	const mod = mundo.registrarModulo(MODULO, { version: m.version, title: m.title, flags: m.flags });
	for (const p of m.packs) {
		const { docs, pastas } = lerPackFonte(path.join(dirPacks, p.name));
		mundo.adicionarPack({ id: `${MODULO}.${p.name}`, name: p.name, label: p.label, type: p.type, packageName: MODULO, packageType: "module" }, docs, pastas);
	}
	mundo.instalar();
	await import(`${pathToFileURL(path.join(RAIZ, "scripts", "cdr.mjs")).href}?v=${++versaoScript}`);
	mundo.chamarHook("init");
	mundo.chamarHook("setup");
	if (ready) {
		mundo.chamarHook("ready");
		await mundo.aguardarOcioso();
	}
	return mod;
}

/** Cena com quatro PJs (um controlado) e um alvo. */
export async function prepararMesa(mundo, { alvoNpc = true } = {}) {
	await mundo.criarCena("Mesa de teste");
	const pjs = [];
	const nomes = ["Balthazar", "Felix Percival", "Hanna", "Rak"];
	for (const [i, n] of nomes.entries()) {
		const pj = await mundo.criarPJ(n, { nivel: 3 + i, treinadas: ["luta", "atua", "fort", "vont", "perc", "sobr", "dipl", "ladi"] });
		const jog = await mundo.criarJogador(`Jogador ${i + 1}`, pj);
		pjs.push({ pj, jog, token: await mundo.colocarToken(pj) });
	}
	pjs[0].token.control();
	mundo.usuario._source.character = null;
	if (alvoNpc) {
		const npc = mundo.game.actors.find((a) => a.type === "npc");
		if (npc) {
			const t = await mundo.colocarToken(npc);
			t.setTarget(true);
		}
	}
	return pjs;
}

/** Erros relevantes do mundo, formatados. */
export function problemas(mundo, { descartes = true, avisos = false } = {}) {
	const out = mundo.erros.map((e) => `[erro] ${e.origem}: ${e.erro?.stack?.split("\n").slice(0, 3).join(" ← ") ?? e.erro}`);
	for (const r of mundo.relatorio) {
		if (r.tipo === "erro" || r.tipo === "link-quebrado" || (descartes && (r.tipo === "descartado" || r.tipo === "legado")) || (avisos && r.tipo === "aviso")) {
			out.push(`[${r.tipo}] ${r.origem}: ${r.documento} · ${r.caminho} · ${r.mensagem}${r.valor !== undefined ? ` (${JSON.stringify(r.valor)?.slice(0, 80)})` : ""}`);
		}
	}
	for (const n of mundo.notificacoes) if (n.tipo === "error") out.push(`[notificação de erro] ${n.origem}: ${n.msg}`);
	return out;
}

/** Zera os registros do mundo (para medir só o próximo passo). */
export function limparRegistros(mundo) {
	mundo.erros.length = 0;
	mundo.relatorio.length = 0;
	mundo.notificacoes.length = 0;
	mundo.chat.length = 0;
	mundo.dialogos.length = 0;
}
