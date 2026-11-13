const $ = (selector, root = document) => root.querySelector(selector);
const moneyFormat = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const compactMoney = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const money = (cents) => moneyFormat.format(cents / 100);
const cents = (reais) => Math.round(Number(reais) * 100);
const esc = (value) => String(value).replace(/[&<>"']/g, (part) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[part]);
const statusLabel = { proposta: "Proposta", fechado: "Fechado", recebido: "Recebido" };
const views = { visao: "Visão geral", equipe: "Equipe", servicos: "Serviços", simulador: "Simulador" };
const shared = !!supabaseConfig;
const storageKey = "mutirao-mentoria-nov-2026";
const saleDialog = $("#sale-dialog");
const saleForm = $("#sale-form");
const peopleDialog = $("#people-dialog");
const peopleForm = $("#people-form");
const simForm = $("#sim-form");
const authDialog = $("#auth-dialog");
const authForm = $("#auth-form");
const field = (form, name) => form.elements.namedItem(name);
const dateBR = (date) => date.split("-").reverse().join("/");
const searchKey = (value) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
const makeId = () => globalThis.crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) => n.toString(16).padStart(8, "0")).join("");
const empty = (message) => `<p class="empty">${esc(message)}</p>`;
let data = initialState();
let revision = 0;
let ready = false;
let busy = false;
let editingSale = null;
let editingScenario = null;
let activeView = "";
let authMode = "password";
let loginEmail = "";

function notice(message, error = false) {
  const box = $("#notice");
  box.hidden = !message;
  box.classList.toggle("error", error);
  box.textContent = message;
}

function formError(form, message) {
  const box = $(".form-error", form);
  box.hidden = !message;
  box.textContent = message;
}

function setState(saved) {
  if (saved?.data && !validState(saved.data)) throw new Error("Os dados salvos têm um formato inválido.");
  revision = saved?.revision ?? 0;
  data = saved?.data ?? initialState();
}

async function loadState() {
  setState(shared ? await loadSharedDashboard() : JSON.parse(localStorage.getItem(storageKey) || "null"));
}

async function save(change) {
  if (!ready || busy) throw new Error("Aguarde o carregamento do painel e tente novamente.");
  const next = structuredClone(data);
  change(next);
  if (!validState(next)) throw new Error("Revise os campos preenchidos e tente novamente.");
  busy = true;
  try {
    if (shared) {
      revision = await saveSharedDashboard(revision, next);
    } else {
      const latest = JSON.parse(localStorage.getItem(storageKey) || "null");
      if ((latest?.revision ?? 0) !== revision) {
        const error = new Error("O painel foi atualizado em outra aba. Reabra o formulário para tentar novamente.");
        error.conflict = true;
        throw error;
      }
      localStorage.setItem(storageKey, JSON.stringify({ revision: revision + 1, data: next }));
      revision += 1;
    }
    data = next;
    render();
  } catch (error) {
    if (shared && [401, 403].includes(error.status)) disconnect();
    if (error.conflict) {
      await loadState();
      render();
      if (saleDialog.open) saleDialog.close();
      if (peopleDialog.open) peopleDialog.close();
      fillScenario();
      notice(error.message, true);
    }
    throw error;
  } finally {
    busy = false;
  }
}

function setAuthMode(mode) {
  authMode = mode;
  const passwords = mode === "password";
  const checkingCode = mode === "verify";
  const password = field(authForm, "password");
  const code = field(authForm, "code");
  field(authForm, "email").readOnly = checkingCode;
  password.closest("label").hidden = !passwords;
  password.required = passwords;
  password.disabled = !passwords;
  code.closest("label").hidden = !checkingCode;
  code.required = checkingCode;
  code.disabled = !checkingCode;
  $("#auth-submit").textContent = passwords ? "Entrar" : checkingCode ? "Confirmar acesso" : "Enviar e-mail";
  $("#auth-switch").textContent = passwords ? "Entrar por e-mail" : checkingCode ? "Pedir outro e-mail" : "Usar senha";
  $("#auth-help").hidden = passwords;
  $("#auth-help").textContent = checkingCode
    ? "Digite o código. Se receber um link, copie o endereço e cole aqui."
    : "O Supabase envia um código ou link de acesso para contas cadastradas.";
  formError(authForm, "");
}

function openAuth(message = "") {
  authForm.reset();
  setAuthMode("send");
  formError(authForm, message);
  if (!authDialog.open) authDialog.showModal();
}

function disconnect() {
  clearSession();
  ready = false;
  revision = 0;
  data = initialState();
  if (saleDialog.open) saleDialog.close();
  if (peopleDialog.open) peopleDialog.close();
  fillScenario();
  render();
  $("#auth-action").textContent = "Entrar";
  $("#storage-label").textContent = "Aguardando acesso";
}

async function connect() {
  await loadState();
  ready = true;
  $("#auth-action").textContent = "Sair";
  $("#storage-label").textContent = "Dados compartilhados";
  render();
}

function requireAccess() {
  if (ready) return true;
  if (shared && !session) openAuth();
  else notice("Aguarde o carregamento dos dados do painel.", true);
  return false;
}

function route() {
  const fragment = location.hash.slice(1);
  const view = Object.hasOwn(views, fragment) ? fragment : "visao";
  if (view === activeView) return;
  const changed = activeView !== "";
  activeView = view;
  for (const section of document.querySelectorAll(".view")) section.hidden = section.id !== view;
  for (const link of document.querySelectorAll("nav a")) {
    if (link.hash === "#" + view) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  $("#breadcrumb").textContent = views[view];
  if (changed) window.scrollTo(0, 0);
}

function render() {
  const { received, pipeline, late } = stats(data);
  const remaining = Math.max(0, TEAM_TARGET - received);
  const days = countDays(todayAt(), DEADLINE);
  const percentage = received / TEAM_TARGET * 100;
  $("#goal-progress").value = Math.min(100, percentage);
  $("#goal-percent").textContent = decimal.format(percentage) + "%";
  $("#goal-total").textContent = money(received) + " recebidos";
  $("#days-left").textContent = days;
  $("#days-caption").textContent = days === 1 ? "dia restante" : days ? "dias restantes" : "prazo encerrado";
  $("#received").textContent = money(received);
  $("#remaining").textContent = money(remaining);
  $("#closed-note").textContent = money(pipeline) + " fechados a receber até o prazo";
  $("#pace").textContent = days ? money(Math.ceil(remaining / days)) + "/dia" : "—";
  $("#pace-note").textContent = days ? "Inclui hoje e o dia 30" : "Prazo encerrado em 30/11";
  $("#team-list").innerHTML = data.people.map((name, index) =>
    `<article class="person"><span class="avatar" aria-hidden="true">${index + 1}</span><div class="person-copy"><h3>${esc(name)}</h3></div></article>`
  ).join("");
  const personFilter = $("#person-filter");
  const filterBefore = personFilter.value;
  personFilter.innerHTML = '<option value="">Todos</option>' + personOptions();
  personFilter.value = filterBefore;
  $("#late-note").hidden = !late;
  $("#late-note").textContent = money(late) + " recebidos após o prazo.";
  renderSales();
  renderScenarios();
  renderProjection();
}

function personOptions() {
  return data.people.map((name, index) => `<option value="${index}">${esc(name)}</option>`).join("");
}

function saleLine(sale, compact = false) {
  const details = [data.people[sale.person], compact ? "" : sale.client, compact ? "" : dateBR(sale.date)].filter(Boolean);
  return `<article class="sale-line"><div><strong>${esc(sale.title)}</strong><small>${esc(details.join(" · "))}</small></div><div class="amount"><strong>${money(sale.amount)}</strong><small><span class="pill ${sale.status}">${statusLabel[sale.status]}</span></small></div><button class="text-link edit-sale" type="button" data-action="edit-sale" data-id="${esc(sale.id)}" aria-label="Editar venda ${esc(sale.title)}">Editar</button></article>`;
}

function renderSales() {
  const recent = data.sales.slice().reverse();
  $("#recent-sales").innerHTML = recent.length ? recent.slice(0, 3).map((sale) => saleLine(sale, true)).join("") : empty("Nenhuma venda registrada.");
  const status = $("#status-filter").value;
  const person = $("#person-filter").value;
  const filtered = recent.filter((sale) => (!status || status === sale.status) && (person === "" || Number(person) === sale.person));
  $("#sales-list").innerHTML = filtered.length ? filtered.map((sale) => saleLine(sale)).join("") : empty(recent.length ? "Nenhuma venda com esses filtros." : "Nenhuma venda registrada.");
}

function renderCatalog() {
  const categoryFilter = $("#category-filter").value;
  const query = searchKey($("#catalog-search").value);
  const matches = catalog.map((item, index) => ({ item, index })).filter(({ item }) =>
    (!categoryFilter || categoryFilter === item[0]) && searchKey(item.flat(3).join(" ")).includes(query));
  $("#catalog-list").innerHTML = matches.length ? matches.map(({ item, index }) => {
    const [category, name, ranges, detail, unit = ""] = item;
    const options = ranges.map(([mode, low, high], variant) => {
      const price = compactMoney.format(low) + (high ? " – " + compactMoney.format(high) : "") + (unit ? " " + unit : "");
      return `<button class="ref" type="button" data-action="use-price" data-index="${index}" data-variant="${variant}" aria-label="Simular ${esc(name)}, ${esc(mode)}, ${price}"><span>${esc(mode)}</span><span><strong>${price}</strong><span aria-hidden="true">↗</span></span></button>`;
    }).join("");
    return `<article class="card roomy catalog-card"><span class="category">${esc(category)}</span><h2>${esc(name)}</h2><p>${esc(detail)}</p>${options}</article>`;
  }).join("") : empty("Nenhum serviço encontrado.");
}

function readScenario() {
  const value = (name) => field(simForm, name).value.trim();
  return {
    id: editingScenario ?? "",
    title: value("title"), audience: value("audience"), promise: value("promise"), delivery: value("delivery"),
    price: cents(value("price")), cost: cents(value("cost")), fee: cents(value("fee")),
    quantity: Number(value("quantity")), days: Number(value("days")),
  };
}

function renderProjection() {
  const scenario = readScenario();
  const remaining = Math.max(0, TEAM_TARGET - stats(data).received);
  $("#projection-balance").textContent = money(remaining);
  const hasQuantity = field(simForm, "quantity").validity.valid;
  const hasDays = field(simForm, "days").validity.valid;
  const hasPrice = ["price", "cost", "fee"].every((name) => field(simForm, name).validity.valid);
  const { gross, net, need, within, perDay, coverage } = project(scenario, remaining);
  $("#estimate").textContent = money(hasPrice && hasQuantity ? net : 0);
  $("#gross").textContent = money(hasPrice && hasQuantity ? gross : 0);
  $("#sales-per-day").textContent = hasQuantity && hasDays ? decimal.format(perDay) : "—";
  $("#units-needed").textContent = !remaining ? "0" : hasPrice && hasQuantity && need !== null ? decimal.format(need) : "—";
  $("#coverage").textContent = remaining && hasPrice && hasQuantity ? decimal.format(coverage) + "%" : "—";
  const note = $("#projection-note");
  note.classList.toggle("warning", hasDays && !within);
  if (!remaining) note.textContent = "A meta coletiva já foi atingida.";
  else if (!hasDays) note.textContent = "Informe um prazo entre 1 e 365 dias.";
  else if (!within) note.textContent = "Esse prazo ultrapassa 30 de novembro.";
  else if (!hasPrice) note.textContent = "Informe o preço para calcular a projeção.";
  else if (net === 0) note.textContent = "O líquido estimado para o mutirão é zero.";
  else if (remaining <= net) note.textContent = "A oferta projetada cobre o saldo da meta coletiva dentro do prazo informado.";
  else note.textContent = "Com essa oferta, ainda faltariam " + money(remaining - net) + " para a meta coletiva.";
}

function renderScenarios() {
  $("#saved-scenarios").innerHTML = data.scenarios.length ? data.scenarios.map((item) => {
    const { net, within } = project(item, TEAM_TARGET);
    const details = item.quantity + " × " + money(item.price) + " · " + item.days + " " + (item.days === 1 ? "dia" : "dias") + (within ? "" : " · Após o prazo");
    return `<article class="scenario-line"><div><strong>${esc(item.title)}</strong><small>${details}</small></div><div><strong>${money(net)}</strong><small>Líquido estimado</small></div><div class="scenario-actions"><button class="text-link" type="button" data-action="edit-scenario" data-id="${esc(item.id)}">Editar</button><button class="text-link danger" type="button" data-action="delete-scenario" data-id="${esc(item.id)}">Excluir</button></div></article>`;
  }).join("") : empty("Nenhum cenário salvo.");
}

function fillScenario(item, expanded = false) {
  simForm.reset();
  editingScenario = item?.id || null;
  if (item) {
    for (const key of ["title", "quantity", "days", "audience", "promise", "delivery"]) field(simForm, key).value = item[key] ?? "";
    for (const key of ["price", "cost", "fee"]) field(simForm, key).value = (item[key] ?? 0) / 100;
  }
  $("#offer-details").open = expanded;
  $("#save-sim").textContent = editingScenario ? "Atualizar cenário" : "Salvar cenário";
  renderProjection();
}

function showScenario(item, expanded = false) {
  fillScenario(item, expanded);
  location.hash = "simulador";
  route();
  window.scrollTo(0, 0);
  field(simForm, "title").focus({ preventScroll: true });
}

function dateLabel() {
  const date = field(saleForm, "date");
  const received = field(saleForm, "status").value === "recebido";
  $("#sale-date-label span").textContent = received ? "Data do recebimento" : "Previsão de recebimento";
  date.max = received ? todayAt() : "";
}

function openSale(item) {
  if (!requireAccess()) return;
  editingSale = item?.id ?? null;
  saleForm.reset();
  formError(saleForm, "");
  field(saleForm, "person").innerHTML = personOptions();
  for (const key of ["title", "client", "person", "status"]) {
    if (item) field(saleForm, key).value = item[key];
  }
  field(saleForm, "amount").value = item ? item.amount / 100 : "";
  field(saleForm, "date").value = item?.date ?? todayAt();
  $("#sale-heading").textContent = item ? "Editar venda" : "Registrar venda";
  $("#delete-sale").hidden = !item;
  dateLabel();
  saleDialog.showModal();
}

function openPeople() {
  if (!requireAccess()) return;
  formError(peopleForm, "");
  $("#people-fields").innerHTML = data.people.map((name, index) =>
    `<label>Participante ${index + 1} <input name="person-${index}" value="${esc(name)}" maxlength="70" required></label>`).join("");
  peopleDialog.showModal();
}

async function submit(form, button, change, message, dialog) {
  if (busy) return false;
  button.disabled = true;
  if (dialog) formError(form, "");
  try {
    await save(change);
    if (dialog?.open) dialog.close();
    notice(message);
    return true;
  } catch (error) {
    if (dialog?.open) formError(form, error.message);
    else notice(error.message, true);
    return false;
  } finally {
    button.disabled = false;
  }
}

saleForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = (name) => field(saleForm, name).value.trim();
  const sale = { id: editingSale ?? makeId(), title: value("title"), client: value("client"),
    person: Number(value("person")), amount: cents(value("amount")), status: value("status"), date: value("date") };
  return submit(saleForm, event.submitter, (next) => {
    const index = next.sales.findIndex((entry) => entry.id === sale.id);
    if (index < 0) next.sales.push(sale);
    else next.sales[index] = sale;
  }, "Venda salva.", saleDialog);
});

peopleForm.addEventListener("submit", (event) => {
  event.preventDefault();
  return submit(peopleForm, event.submitter, (next) => {
    next.people = next.people.map((_, index) => field(peopleForm, "person-" + index).value.trim());
  }, "Participantes atualizados.", peopleDialog);
});

simForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireAccess()) return;
  const item = readScenario();
  item.id ||= makeId();
  const saved = await submit(simForm, event.submitter, (next) => {
    const index = next.scenarios.findIndex((entry) => entry.id === item.id);
    if (index < 0) next.scenarios.push(item);
    else next.scenarios[index] = item;
  }, "Cenário salvo.");
  if (saved) fillScenario(item, $("#offer-details").open);
});

$("#auth-switch").addEventListener("click", () => {
  setAuthMode(authMode === "password" || authMode === "verify" ? "send" : "password");
});
authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  $("#auth-switch").disabled = true;
  formError(authForm, "");
  try {
    const email = field(authForm, "email").value.trim();
    if (authMode === "send") {
      await sendAccessCode(email);
      loginEmail = email;
      setAuthMode("verify");
      field(authForm, "code").focus();
      return;
    }
    if (authMode === "password") await signInWithPassword(email, field(authForm, "password").value);
    else await verifyAccessCode(loginEmail, field(authForm, "code").value.trim());
    await connect();
    authForm.reset();
    authDialog.close();
    notice("");
  } catch (error) {
    if (session) disconnect();
    let message = error.message;
    if (error.status === 429) message = "Muitas tentativas. Aguarde antes de tentar novamente.";
    else if (error.status !== 403 && authMode === "send") message = "Não foi possível enviar o e-mail. Verifique seu cadastro e tente novamente.";
    else if (error.status && error.status !== 403 && authMode === "verify") message = "Código ou link inválido ou expirado.";
    else if (error.status && error.status !== 403) message = "Não foi possível entrar. Verifique os dados da sua conta.";
    formError(authForm, message);
  } finally {
    button.disabled = false;
    $("#auth-switch").disabled = false;
  }
});

$("#auth-action").addEventListener("click", async (event) => {
  if (busy) return;
  if (!session) return openAuth();
  const button = event.currentTarget;
  button.disabled = true;
  try { await signOut(); } catch { /* O dispositivo encerra a sessão mesmo sem resposta do servidor. */ }
  finally { disconnect(); button.disabled = false; notice(""); }
});

$("#delete-sale").addEventListener("click", (event) => {
  if (!window.confirm("Excluir esta venda do painel?")) return;
  return submit(saleForm, event.currentTarget, (next) => {
    next.sales = next.sales.filter((sale) => sale.id !== editingSale);
  }, "Venda excluída.", saleDialog);
});

document.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action], button[data-close]");
  if (!button) return;
  const { action, close, id, index, variant } = button.dataset;
  if (close) return document.getElementById(close).close();
  if (action === "new-sale") return openSale();
  if (action === "rename") return openPeople();
  if (action === "edit-sale") return openSale(data.sales.find((sale) => sale.id === id));
  if (action === "use-idea") return showScenario(ideas[Number(index)], true);
  if (action === "reset-sim") return fillScenario();
  if (action === "edit-scenario") return showScenario(data.scenarios.find((item) => item.id === id), true);
  if (action === "delete-scenario") {
    if (!window.confirm("Excluir este cenário?")) return;
    const saved = await submit(simForm, button, (next) => {
      next.scenarios = next.scenarios.filter((item) => item.id !== id);
    }, "Cenário excluído.");
    if (saved && editingScenario === id) fillScenario();
  }
  if (action === "use-price") {
    const [, title, ranges, detail, unit = ""] = catalog[Number(index)];
    const [mode, low, high = low] = ranges[Number(variant)];
    const draft = { title, price: cents((low + high) / 2), quantity: 1, days: Math.max(1, Math.min(7, countDays(todayAt(), DEADLINE))),
      delivery: detail + ". Referência " + mode.toLowerCase() + (unit ? " " + unit : "") + "." };
    return showScenario(draft);
  }
});

for (const id of ["#status-filter", "#person-filter"]) $(id).addEventListener("change", renderSales);
$("#catalog-search").addEventListener("input", renderCatalog);
$("#category-filter").addEventListener("change", renderCatalog);
simForm.addEventListener("input", renderProjection);
field(saleForm, "status").addEventListener("change", dateLabel);
window.addEventListener("hashchange", route);
window.addEventListener("storage", async (event) => {
  if (shared || event.key !== storageKey || busy || saleDialog.open || peopleDialog.open || editingScenario) return;
  try { await loadState(); render(); } catch (error) { notice(error.message, true); }
});
window.addEventListener("focus", async () => {
  if (!shared || !ready || busy || saleDialog.open || peopleDialog.open) return;
  const previousSession = session;
  const previousRevision = revision;
  try {
    const result = await loadSharedDashboard();
    if (!busy && session === previousSession && revision === previousRevision
      && !saleDialog.open && !peopleDialog.open && !editingScenario) {
      setState(result);
      render();
    }
  }
  catch (error) {
    if (busy || !session) return;
    if ([401, 403].includes(error.status)) disconnect();
    notice(error.message, true);
  }
});

$("#offer-source").href = OFFER_SOURCE;
$("#services-options").innerHTML = catalog.map(([, title]) => `<option value="${esc(title)}"></option>`).join("");
$("#category-filter").insertAdjacentHTML("beforeend", [...new Set(catalog.map(([category]) => category))]
  .map((category) => `<option>${esc(category)}</option>`).join(""));
$("#ideas-list").innerHTML = ideas.map((idea, index) =>
  `<article class="idea"><h3>${esc(idea.title)}</h3><strong>${money(idea.price)} por venda</strong><p>${esc(idea.delivery)}</p><button class="button" type="button" data-action="use-idea" data-index="${index}">Usar no simulador ↗</button></article>`).join("");
route();
renderCatalog();
render();
if (shared) {
  $("#auth-action").hidden = false;
  $("#storage-label").textContent = "Aguardando acesso";
  if (restoreSession()) connect().catch((error) => { disconnect(); notice(error.message, true); });
} else {
  loadState().then(() => { ready = true; render(); }).catch((error) => {
    $("#storage-label").textContent = "Dados indisponíveis";
    notice(error.message, true);
  });
}
