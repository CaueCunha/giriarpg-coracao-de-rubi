// Correção das condições do Tormenta20 1.6.5 (Foundry v14)
//
// Causa: ao abrir o mundo, o sistema cria o compêndio do mundo "Condições"
// (world.statuses) copiando os efeitos da pasta de condições do compêndio
// "Efeitos" do sistema. O código procura a pasta pelo id "69zW3EVSgASXTmsp",
// mas no compêndio da 1.6.5 essa pasta tem o id "STATUSEFFECTS000". Nada é
// copiado, o compêndio fica vazio e o menu de condições do token fica sem nada.
//
// Esta macro copia as condições que faltam para world.statuses. Não apaga nada.
// Rode como GM, uma vez em cada mundo, e depois recarregue a página (F5).

if (!game.user.isGM) return ui.notifications.error("Rode esta macro como Mestre.");

const origem = game.packs.get("tormenta20.efeitos");
if (!origem) return ui.notifications.error("Compêndio tormenta20.efeitos não encontrado.");

let destino = game.packs.get("world.statuses");
if (!destino) {
	destino = await foundry.documents.collections.CompendiumCollection.createCompendium({
		label: "Condições",
		name: "statuses",
		type: "ActiveEffect",
		ownership: { ASSISTANT: "OWNER", PLAYER: "OBSERVER" }
	});
}

// Backup do que já existe em world.statuses (baixa um JSON, se houver algo)
const existentes = await destino.getDocuments();
if (existentes.length) {
	const backup = JSON.stringify(existentes.map((d) => d.toObject()), null, 2);
	foundry.utils.saveDataToFile(backup, "application/json", `backup-world-statuses-${game.world.id}.json`);
}

// Condições do compêndio do sistema: pasta "Condições" (id STATUSEFFECTS000)
const pastaCondicoes = origem.folders.find((f) => f.id === "STATUSEFFECTS000" || /condi/i.test(f.name));
if (!pastaCondicoes) return ui.notifications.error("Pasta de condições não encontrada no compêndio Efeitos.");

const docs = await origem.getDocuments();
const condicoes = docs.filter((d) => (d.folder?.id ?? d._source.folder) === pastaCondicoes.id);

const jaTem = new Set(existentes.map((d) => d.statuses.first()));
const criar = condicoes.filter((d) => !jaTem.has(d.statuses.first())).map((d) => {
	const obj = d.toObject();
	obj.folder = null;
	return obj;
});

if (!criar.length) {
	return ui.notifications.info(`Nada a copiar: world.statuses já tem ${existentes.length} condições.`);
}

await destino.configure({ locked: false });
await ActiveEffect.createDocuments(criar, { keepId: true, pack: destino.collection });
await destino.configure({ locked: true });

ChatMessage.create({
	content: `<p><b>Condições corrigidas</b> em ${game.world.title}: ${criar.length} copiadas `
		+ `(havia ${existentes.length}). Recarregue a página (F5) para o menu de condições aparecer.</p>`,
	whisper: ChatMessage.getWhisperRecipients("GM")
});
