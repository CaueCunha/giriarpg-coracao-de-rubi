// Teste estendido genérico (N sucessos antes de X falhas). Macro de script, só o mestre.
// Selecione os tokens que vão rolar e rode a macro. O progresso fica salvo entre sessões.
// Opcional: dano por falha (aplicado a quem falhou), ex.: "1d6[perda]".
// Botões "+1 sucesso" e "+1 falha" servem para efeitos que contam direto.
// Exemplos (Aventura 2): Negociar com Zhura (andar 1, área 7): Diplomacia ou Intimidação CD 25 (20 com Stroka), 3 sucessos.
// Epílogo, meio-termo entre Lonien e K: Diplomacia CD 25, 3 sucessos.
if (!game.user.isGM) return ui.notifications.warn("Só o mestre roda esta macro.");
const { DialogV2 } = foundry.applications.api;
const FLAG = "cdr-testes";
const testes = foundry.utils.deepClone(game.user.getFlag("world", FLAG) ?? {});
const P = CONFIG.T20?.pericias ?? {};
const nomePericia = (id) => { const v = P[id]; return game.i18n.localize(typeof v === "string" ? v : v?.label ?? id); };
const ids = Object.keys(canvas.tokens.controlled[0]?.actor?.system?.pericias ?? game.actors.find((a) => a.type === "character")?.system?.pericias ?? { sobr: 1 });
const opcoesPericia = ids.map((id) => `<option value="${id}" ${id === "sobr" ? "selected" : ""}>${nomePericia(id)}</option>`).join("");
const lista = Object.entries(testes).map(([n, t]) =>
  `<option value="${n}">${n}: ${t.s}/${t.need} sucessos, ${t.f}/${t.maxF} falhas (CD ${t.cd})</option>`).join("");

const content = `
<fieldset><legend>Teste em andamento</legend>
  <select name="atual">${lista || "<option value=''>nenhum</option>"}</select>
  <label>Perícia desta rolagem <select name="periciaRolagem"><option value="">a do teste</option>${opcoesPericia}</select></label>
  <label>Bônus situacional <input type="number" name="bonus" value="0"></label>
</fieldset>
<fieldset><legend>Novo teste</legend>
  <label>Nome <input type="text" name="nome" placeholder="Negociar com Zhura"></label>
  <label>Perícia <select name="pericia">${opcoesPericia}</select></label>
  <label>CD <input type="number" name="cd" value="15"></label>
  <label>Sucessos <input type="number" name="need" value="3"></label>
  <label>Falhas máximas <input type="number" name="maxF" value="3"></label>
  <label>Tempo por teste <input type="text" name="tempo" value="1 hora"></label>
  <label>Dano por falha (opcional) <input type="text" name="dano" placeholder="1d6[perda]"></label>
</fieldset>`;

const escolha = await DialogV2.wait({
  window: { title: "Teste estendido" }, content, rejectClose: false,
  buttons: [
    { action: "rolar", label: "Rolar (tokens selecionados)", default: true, callback: (e, b) => ({ a: "rolar", f: b.form.elements }) },
    { action: "mais", label: "+1 sucesso", callback: (e, b) => ({ a: "mais", f: b.form.elements }) },
    { action: "menos", label: "+1 falha", callback: (e, b) => ({ a: "menos", f: b.form.elements }) },
    { action: "novo", label: "Novo teste", callback: (e, b) => ({ a: "novo", f: b.form.elements }) },
    { action: "apagar", label: "Apagar teste", callback: (e, b) => ({ a: "apagar", f: b.form.elements }) },
  ],
});
if (!escolha) return;
const f = escolha.f;
const gravar = async () => { await game.user.unsetFlag("world", FLAG); if (Object.keys(testes).length) await game.user.setFlag("world", FLAG, testes); };

if (escolha.a === "novo") {
  const nome = f.nome.value.trim() || `Teste ${Object.keys(testes).length + 1}`;
  testes[nome] = { pericia: f.pericia.value, cd: Number(f.cd.value), need: Number(f.need.value), maxF: Number(f.maxF.value),
    tempo: f.tempo.value, dano: f.dano.value.trim(), s: 0, f: 0, n: 0 };
  await gravar();
  return ui.notifications.info(`Teste "${nome}" criado. Rode a macro de novo para rolar.`);
}
const nome = f.atual.value;
if (!nome || !testes[nome]) return ui.notifications.warn("Nenhum teste escolhido.");
if (escolha.a === "apagar") { delete testes[nome]; await gravar(); return ui.notifications.info(`Teste "${nome}" apagado.`); }

const t = testes[nome];
const linhas = [];
if (escolha.a === "mais") { t.s++; linhas.push("+1 sucesso (manual)"); }
else if (escolha.a === "menos") { t.f++; linhas.push("+1 falha (manual)"); }
else {
  const tokens = canvas.tokens.controlled;
  if (!tokens.length) return ui.notifications.warn("Selecione os tokens que vão rolar.");
  const pid = f.periciaRolagem.value || t.pericia;
  const bonus = Number(f.bonus.value) || 0;
  for (const tok of tokens) {
    const a = tok.actor;
    const v = a.system.pericias?.[pid]?.value ?? 0;
    const r = await new Roll(`1d20 + ${v} + ${bonus}`).evaluate();
    await r.toMessage({ speaker: ChatMessage.getSpeaker({ token: tok.document }), flavor: `${nome}: ${nomePericia(pid)} (CD ${t.cd})` });
    const ok = r.total >= t.cd;
    ok ? t.s++ : t.f++;
    linhas.push(`${a.name}: ${r.total} ${ok ? "✔" : "✘"}`);
    if (!ok && t.dano) {
      const d = await new Roll(t.dano).evaluate();
      await d.toMessage({ speaker: ChatMessage.getSpeaker({ token: tok.document }), flavor: `${nome}: dano da falha` });
      await a.applyDamageV2(d, 1);
    }
  }
  t.n++;
}
let fim = "";
if (t.s >= t.need) fim = `<p><b>Sucesso!</b> ${t.s} sucessos.</p>`;
else if (t.f >= t.maxF) fim = `<p><b>Fracasso.</b> ${t.f} falhas.</p>`;
ChatMessage.create({ whisper: ChatMessage.getWhisperRecipients("GM"), content:
  `<h3>${nome}</h3><p>${linhas.join("<br>")}</p><p>Progresso: ${t.s}/${t.need} sucessos, ${t.f}/${t.maxF} falhas. Rolagens feitas: ${t.n} (× ${t.tempo}).</p>${fim}` });
if (fim) delete testes[nome];
await gravar();

