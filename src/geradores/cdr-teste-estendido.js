// Teste estendido genérico (N sucessos antes de X falhas). Macro de script, só o mestre.
// Selecione os tokens que vão rolar (ou nenhum, para qualquer jogador) e rode a macro. O progresso fica salvo entre sessões.
// Rolar manda ao chat um cartão com o botão do teste: cada jogador rola o seu (com tokens selecionados, só eles).
// Opcional: dano por falha (quem falha vê a rolagem do dano, aplicada pelos botões), ex.: "1d6[perda]".
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
// Rolar: o cartão vai ao chat e cada jogador rola no botão. Sucessos e falhas são contados quando o resultado
// chega; quem falha vê o dano da falha num cartão (aplicado pelos botões do cartão).
const api = game.modules.get("giriarpg-coracao-de-rubi")?.api;
if (!api?.pedirTeste) return ui.notifications.warn("Ative o módulo Coração de Rubi.");
const pid = f.periciaRolagem.value || t.pericia;
t.n++;
await gravar();
await api.pedirTeste({
  titulo: nome, img: "icons/svg/d20-highlight.svg",
  alvos: canvas.tokens.controlled.map((tk) => tk.actor?.id).filter(Boolean),
  texto: `<p>Teste estendido: ${t.s}/${t.need} sucessos, ${t.f}/${t.maxF} falhas (cada rolagem leva ${t.tempo}).</p>`,
  pericia: pid, cd: t.cd, bonus: Number(f.bonus.value) || 0,
  sucesso: "avança no teste.", falha: "não avança" + (t.dano ? " e sofre o dano da falha." : "."),
  danoNaFalha: t.dano || null,
  gancho: "estendido", dados: { nome }
});
