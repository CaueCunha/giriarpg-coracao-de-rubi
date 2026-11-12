/**
 * Os geradores (src/geradores) são as macros que o Mestre já usava para criar o conteúdo direto no
 * mundo. O build roda todos eles; aqui conferimos que cada ato roda limpo num mundo vazio, e que
 * rodar de novo (o Mestre confirma "recriar") substitui o conteúdo em vez de duplicar.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { criarMundo, lerGerador, problemas, limparRegistros } from "./ajudantes.mjs";
import { ATOS } from "../tools/conteudo.mjs";

const contar = (mundo) => Object.fromEntries(["actors", "items", "journal", "tables", "macros", "folders"].map((c) => [c, mundo.game[c].size]));

for (const ato of ATOS) {
	test(`geradores do ${ato.rotulo}: rodam limpos e são idempotentes`, async () => {
		const mundo = await criarMundo({ semente: `gerador-${ato.id}` });
		try {
			for (const g of ato.geradores) {
				limparRegistros(mundo);
				await mundo.executar(lerGerador(g), { nome: g });
				assert.deepEqual(problemas(mundo, { avisos: true }), [], `gerador ${g} na primeira execução`);
			}
			const antes = contar(mundo);
			assert.ok(antes.actors + antes.items + antes.macros > 0, "nada foi criado");

			for (const g of ato.geradores) {
				limparRegistros(mundo);
				await mundo.executar(lerGerador(g), { nome: g });
				assert.deepEqual(problemas(mundo, { avisos: true }), [], `gerador ${g} na segunda execução`);
			}
			assert.deepEqual(contar(mundo), antes, "rodar de novo duplicou ou perdeu documentos");
			assert.equal(await mundo.aguardarOcioso(), true);
		} finally {
			mundo.encerrar();
		}
	});
}
