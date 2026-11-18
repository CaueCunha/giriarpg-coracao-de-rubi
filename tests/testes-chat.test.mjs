/**
 * Cartão de teste no chat (scripts/testes-chat.mjs): as macros pedem, o jogador rola no botão do cartão.
 * Nada é rolado pelos personagens na macro, e o dano não é aplicado sozinho.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { criarMundo, carregarModulo, prepararMesa, problemas, MODULO } from "./ajudantes.mjs";
import { politicaRoteiro } from "../tools/sim/dialogos.mjs";
import { resolver } from "../scripts/testes-chat.mjs";

const api = (mundo) => mundo.game.modules.get(MODULO).api;
const pedidoDe = (c) => c.flags?.[MODULO]?.pedido;
const resultados = (mundo) => mundo.chat.filter((c) => c.flags?.[MODULO]?.resultado);

test("resolver: metade, falha com dano e faixas", () => {
	assert.equal(resolver({ cd: 20, dano: "6d6", efeito: "metade" }, 20).passou, true);
	assert.match(resolver({ cd: 20, dano: "6d6", efeito: "metade" }, 20).texto, /metade/);
	assert.match(resolver({ cd: 20, dano: "6d6", efeito: "metade" }, 19).texto, /dano todo/);
	assert.equal(resolver({ cd: 15, danoNaFalha: "1d6[perda]" }, 10).dano, "1d6[perda]");
	assert.equal(resolver({ cd: 15, danoNaFalha: "1d6[perda]" }, 15).dano, null);
	const faixas = [[19, "cai", "10d6[impacto]"], [24, "muros"], [999, "portões"]];
	assert.deepEqual(resolver({ faixas }, 12), { passou: null, texto: "cai", dano: "10d6[impacto]" });
	assert.equal(resolver({ faixas }, 30).texto, "portões");
});

async function mesa(semente, politica) {
	const mundo = await criarMundo({ semente, politica });
	await carregarModulo(mundo, { ready: true });
	await api(mundo).puxar({ atos: ["patamar1", "patamar2", "patamar3", "campanha"] });
	await prepararMesa(mundo, { alvoNpc: false });
	// O chat do simulador guarda mensagens simples fora da coleção: o Mestre acha o cartão por aqui.
	const get = mundo.game.messages.get?.bind(mundo.game.messages);
	mundo.game.messages.get = (id) => mundo.chat.find((c) => c.id === id) ?? get?.(id);
	return mundo;
}

test("Ases nas Alturas: o cartão traz o dano e o botão de Reflexos; o jogador rola e nada é aplicado", async () => {
	const mundo = await mesa("chat-ases", politicaRoteiro([{ botao: "canhoes" }]));
	const pj = mundo.game.actors.find((a) => a.type === "character");
	const pv = pj.system.attributes.pv.value;
	mundo.chat.length = 0;
	await mundo.game.macros.find((m) => m.name === "A4 · Ases nas Alturas").execute();
	await mundo.aguardarOcioso();
	const cartao = mundo.chat.find(pedidoDe);
	assert.ok(cartao, "faltou o cartão no chat");
	assert.equal(cartao.whisper, undefined, "o cartão é para todos");
	assert.equal(pedidoDe(cartao).pericia, "refl");
	assert.equal(cartao.rolls.length, 1, "faltou a rolagem do dano");
	assert.match(cartao.content, /roll--dano/);
	assert.equal(resultados(mundo).length, 0, "a macro não pode rolar pelos personagens");
	await api(mundo).rolarPedido(cartao);
	await mundo.aguardarOcioso();
	const res = resultados(mundo);
	assert.ok(res.length >= 1, "o botão devia rolar o teste");
	assert.match(res[0].flavor, /Canhões do Vento Vasto/);
	assert.match(res[0].flavor, /Passou|Falhou/);
	assert.equal(pj.system.attributes.pv.value, pv, "o dano não pode ser aplicado sozinho");
	assert.deepEqual(problemas(mundo, { avisos: true }), []);
	mundo.encerrar();
});

test("O Julgamento: o placar conta quando o resultado do jogador chega", async () => {
	const mundo = await mesa("chat-julgamento", politicaRoteiro([{ botao: "rolar" }]));
	mundo.chat.length = 0;
	await mundo.game.macros.find((m) => m.name === "A1 · O Julgamento").execute();
	await mundo.aguardarOcioso();
	const cartao = mundo.chat.find(pedidoDe);
	assert.ok(cartao, "faltou o cartão");
	assert.equal(pedidoDe(cartao).gancho, "julgamento");
	assert.deepEqual(mundo.game.user.getFlag("world", "cdrJulgamento").s + mundo.game.user.getFlag("world", "cdrJulgamento").f, 0);
	await api(mundo).rolarPedido(cartao);
	await api(mundo).resultadosContados();
	await mundo.aguardarOcioso();
	const st = mundo.game.user.getFlag("world", "cdrJulgamento");
	assert.equal(st.s + st.f, 1, "o resultado devia contar no placar");
	assert.ok(mundo.chat.some((c) => /O Julgamento/.test(c.content ?? "") && /sucessos/.test(c.content ?? "") && c.whisper), "faltou o placar para o mestre");
	// o mesmo personagem não rola duas vezes o mesmo cartão
	await api(mundo).rolarPedido(cartao);
	await api(mundo).resultadosContados();
	await mundo.aguardarOcioso();
	const st2 = mundo.game.user.getFlag("world", "cdrJulgamento");
	assert.equal(st2.s + st2.f, 1);
	mundo.encerrar();
});
