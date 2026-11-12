// Diagnóstico das condições do Tormenta20 (sistema 1.6.5)
// Somente leitura: não altera nada no mundo. Rode como GM numa macro de Script.
// Mostra: (1) pastas de efeitos/condições e onde elas estão aninhadas,
// (2) ícones de condição (CONFIG.statusEffects) que não carregam.

const linhas = [];
const caminho = (f) => {
	const partes = [];
	let atual = f;
	while (atual) {
		partes.unshift(atual.name);
		atual = atual.folder;
	}
	return partes.join(" / ");
};

linhas.push(`<h3>Sistema</h3><p>${game.system.id} ${game.system.version} | Foundry ${game.version}</p>`);

// 1) Pastas (Folder) relacionadas a efeitos, condições ou tormenta20
const pastas = game.folders.filter((f) => /efeito|condi|effect|tormenta/i.test(f.name));
linhas.push("<h3>Pastas relevantes</h3>");
if (!pastas.length) linhas.push("<p>Nenhuma pasta com 'efeito', 'condição' ou 'tormenta' no nome.</p>");
for (const f of pastas) {
	linhas.push(`<p><b>[${f.type}]</b> ${caminho(f)} <i>(${f.contents.length} itens, id ${f.id})</i></p>`);
}

// 2) Ícones das condições
linhas.push("<h3>Ícones das condições</h3>");
const quebrados = [];
// No T20 1.6 CONFIG.statusEffects é um objeto (id → condição); no Foundry puro é uma lista.
const STATUS = Array.isArray(CONFIG.statusEffects) ? CONFIG.statusEffects : Object.values(CONFIG.statusEffects ?? {});
for (const s of STATUS) {
	const img = s.img ?? s.icon;
	if (!img) continue;
	try {
		const r = await fetch(img, { method: "HEAD" });
		if (!r.ok) quebrados.push(`${s.id ?? s.name}: ${img} (${r.status})`);
	} catch (e) {
		quebrados.push(`${s.id ?? s.name}: ${img} (erro)`);
	}
}
linhas.push(`<p>${STATUS.length} condições, ${quebrados.length} com ícone quebrado.</p>`);
if (quebrados.length) linhas.push(`<p>${quebrados.join("<br>")}</p>`);

// Amostra de onde os ícones apontam
const amostra = STATUS.slice(0, 3).map((s) => s.img ?? s.icon).join("<br>");
linhas.push(`<p><b>Exemplos de caminho:</b><br>${amostra}</p>`);

ChatMessage.create({
	content: linhas.join(""),
	whisper: ChatMessage.getWhisperRecipients("GM"),
});
