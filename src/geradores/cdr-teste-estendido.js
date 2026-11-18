// Teste estendido genérico (N sucessos antes de X falhas). Macro de script, só o mestre.
// Selecione os tokens que vão rolar (ou nenhum, para qualquer jogador) e rode a macro. O progresso fica salvo entre sessões.
// Rolar manda ao chat um cartão com um botão por personagem: cada jogador rola pela ficha.
// Opcional: dano por falha (rolado para quem falha e aplicado pelo mestre num botão do resumo), ex.: "1d6[perda]".
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
    { action: "rolar", label: "Pedir o teste no chat", default: true, callback: (e, b) => ({ a: "rolar", f: b.form.elements }) },
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
if (escolha.a === "mais" || escolha.a === "menos") {
  escolha.a === "mais" ? t.s++ : t.f++;
  let fim = "";
  if (t.s >= t.need) fim = `<p><b>Sucesso!</b> ${t.s} sucessos.</p>`;
  else if (t.f >= t.maxF) fim = `<p><b>Fracasso.</b> ${t.f} falhas.</p>`;
  ChatMessage.create({ whisper: ChatMessage.getWhisperRecipients("GM"), content:
    `<h3>${nome}</h3><p>${escolha.a === "mais" ? "+1 sucesso" : "+1 falha"} (manual)</p><p>Progresso: ${t.s}/${t.need} sucessos, ${t.f}/${t.maxF} falhas. Rolagens feitas: ${t.n} (× ${t.tempo}).</p>${fim}` });
  if (fim) delete testes[nome];
  await gravar();
  return;
}
// Rolar: o cartão vai ao chat com um botão por personagem; cada jogador rola pela ficha. Quando todos rolarem, a macro
// conta sucessos e falhas; o dano da falha aparece num botão que só o mestre vê (nada é aplicado sozinho).
const testesApi = game.modules.get("giriarpg-coracao-de-rubi")?.api?.testes;
if (!testesApi) return ui.notifications.warn("Ative o módulo Coração de Rubi.");
const selecionados = [...new Set(canvas.tokens.controlled.map((tk) => tk.actor).filter(Boolean))];
const herois = selecionados.length ? selecionados : game.users.filter((u) => !u.isGM && u.character).map((u) => u.character);
if (!herois.length) return ui.notifications.warn("Selecione os tokens que vão rolar.");
const pid = f.periciaRolagem.value || t.pericia;
const bonus = Number(f.bonus.value) || 0;
const res = await testesApi.pedir({
  titulo: nome,
  texto: `Teste estendido: ${t.s}/${t.need} sucessos, ${t.f}/${t.maxF} falhas (cada rolagem leva ${t.tempo}).`,
  testes: herois.map((a) => ({ ator: a, pericia: pid, cd: t.cd, bonus })),
  falha: t.dano ? { texto: "sofre o dano da falha" } : null
});
if (!res?.length) return;
const atual = foundry.utils.deepClone(game.user.getFlag("world", FLAG) ?? {});
const tt = atual[nome] ?? t;
const A = testesApi.acoes();
const linhas = [];
for (const x of res) {
  x.passou ? tt.s++ : tt.f++;
  let l = `${x.nome}: ${x.total} ${x.passou ? "✔" : "✘"}`;
  if (!x.passou && tt.dano && x.ator) {
    const d = await testesApi.rolarDano(tt.dano, `${nome}: dano da falha`);
    l += ` · dano da falha <b>${d.total}</b> ${A.dano(x.ator, d)}`;
  }
  linhas.push(l);
}
tt.n++;
let fim = "";
if (tt.s >= tt.need) fim = `<p><b>Sucesso!</b> ${tt.s} sucessos.</p>`;
else if (tt.f >= tt.maxF) fim = `<p><b>Fracasso.</b> ${tt.f} falhas.</p>`;
await A.enviar({ whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id), content:
  `<h3>${nome}</h3><p>${linhas.join("<br>")}</p><p>Progresso: ${tt.s}/${tt.need} sucessos, ${tt.f}/${tt.maxF} falhas. Rolagens feitas: ${tt.n} (× ${tt.tempo}).</p>${fim}` });
if (fim) delete atual[nome]; else atual[nome] = tt;
for (const k of Object.keys(testes)) delete testes[k];
Object.assign(testes, atual);
await gravar();
