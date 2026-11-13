const $ = (selector, root = document) => root.querySelector(selector);
const moneyFormat = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const compactMoney = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const money = (cents) => moneyFormat.format(cents / 100);
const cents = (reais) => Math.round(Number(reais) * 100);
const esc = (value) => String(value).replace(/[&<>"']/g, (part) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[part]);
const statusLabel = { proposta: "Proposta", fechado: "Fechado", recebido: "Recebido" };
const views = { visao: "Visão geral", equipe: "Vendas", servicos: "Catálogo", simulador: "Simulador" };
const shared = !!supabaseConfig;
const storageKey = "mutirao-mentoria-nov-2026";
const saleDialog = $("#sale-dialog");
const saleForm = $("#sale-form");
const simForm = $("#sim-form");
const itemList = $("#scenario-items");
const authDialog = $("#auth-dialog");
const authForm = $("#auth-form");
const accessDialog = $("#access-dialog");
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
let scenarioDirty = false;
let catalogMode = "services";
let activeView = "";
let creatingAccount = false;
let accessRole = null;
let checkingPendingAccess = false;

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
  if (!session) throw new Error("Entre com e-mail e senha para salvar alterações.");
  if (!ready || busy) throw new Error("Aguarde o carregamento do painel e tente novamente.");
  const next = structuredClone(data);
  change(next);
  if (!validState(next)) throw new Error("Revise os campos preenchidos e tente novamente.");
  busy = true;
  try {
    revision = await saveSharedDashboard(revision, next);
    data = next;
    render();
  } catch (error) {
    if ([401, 403].includes(error.status)) disconnect();
    if (error.conflict) {
      await loadState();
      render();
      if (saleDialog.open) saleDialog.close();
      fillScenario();
      notice(error.message, true);
    }
    throw error;
  } finally {
    busy = false;
  }
}

function openAuth() {
  if (authDialog.open) return;
  authForm.reset();
  setAuthMode(false);
  authDialog.showModal();
}

function setAuthMode(create) {
  creatingAccount = create;
  const password = field(authForm, "password");
  password.value = "";
  password.autocomplete = create ? "new-password" : "current-password";
  password.minLength = create ? 8 : 0;
  $("#auth-heading").textContent = create ? "Criar conta" : "Entrar no painel";
  $("#auth-description").textContent = create
    ? "Escolha uma senha de pelo menos 8 caracteres. Após confirmar seu e-mail, entre para solicitar acesso."
    : "Use o e-mail e a senha da sua conta.";
  $("#auth-submit").textContent = create ? "Criar conta" : "Entrar";
  $("#auth-mode").textContent = create ? "Já tenho conta" : "Criar conta";
  formError(authForm, "");
}

let pendingTimer = null;

function startPendingPolling() {
  if (pendingTimer) return;
  pendingTimer = setInterval(async () => {
    if (accessRole !== "pending" || !session) {
      stopPendingPolling();
      return;
    }
    try {
      const role = await getAccessRole();
      if (role !== "pending") {
        stopPendingPolling();
        await connect();
      }
    } catch {
      // Ignora oscilações de conexão durante a verificação em segundo plano.
    }
  }, 10000);
}

function stopPendingPolling() {
  if (pendingTimer) {
    clearInterval(pendingTimer);
    pendingTimer = null;
  }
}

function renderAccess() {
  const isAdmin = accessRole === "admin";
  $("#auth-action").textContent = session ? "Sair" : "Entrar";
  $("#manage-access").hidden = !isAdmin || !ready;
  const adminAction = $("#admin-action");
  if (adminAction) adminAction.hidden = !isAdmin || !ready;
  $("#storage-label").textContent = ready ? "Dados compartilhados" :
    accessRole === "pending" ? "Aguardando aprovação" : "Aguardando acesso";
  if (isAdmin && ready) {
    updatePendingBadge();
  }
}

async function updatePendingBadge() {
  if (accessRole !== "admin" || !session) return;
  try {
    const requests = await listAccessRequests();
    const count = requests.length;
    for (const badgeId of ["overview-pending-badge", "header-pending-badge", "tab-pending-badge"]) {
      const el = document.getElementById(badgeId);
      if (el) {
        el.textContent = count;
        el.hidden = count === 0;
      }
    }
  } catch {
    // Mantém estado anterior em caso de erro temporário.
  }
}

let currentMembers = [];

function renderConfirmedMembers(members) {
  currentMembers = members || [];
  const count = currentMembers.length;
  $("#participant-count").textContent = decimal.format(count);
  $("#participant-label").textContent = count === 1 ? "participante confirmado" : "participantes confirmados";

  const container = $("#confirmed-members-list");
  if (!container) return;

  if (count === 0) {
    container.innerHTML = empty("Nenhum usuário confirmado ainda. Os participantes confirmados aparecerão aqui conforme entrarem no mutirão.");
    return;
  }

  container.innerHTML = currentMembers.map((member) => {
    const rawName = member.email || "Participante";
    const initial = rawName.trim().charAt(0).toUpperCase() || "?";
    const dateText = member.joined_at ? new Date(member.joined_at).toLocaleDateString("pt-BR") : "";
    const adminBadge = member.is_admin ? `<span class="pill admin-pill">Admin</span>` : "";
    return `<article class="confirmed-member-item">
      <div class="confirmed-member-info">
        <span class="confirmed-member-avatar" aria-hidden="true">${esc(initial)}</span>
        <div class="confirmed-member-text">
          <strong class="confirmed-member-name" title="${esc(rawName)}">${esc(rawName)}</strong>
          ${dateText ? `<small class="confirmed-member-date">Confirmado em ${esc(dateText)}</small>` : ""}
        </div>
      </div>
      <div class="confirmed-member-badges">
        ${adminBadge}
        <span class="pill recebido">Confirmado</span>
      </div>
    </article>`;
  }).join("");
}

async function refreshConfirmedMembers() {
  let list = [];
  let remoteSuccess = false;
  if (shared) {
    try {
      const remote = await listMembers();
      if (Array.isArray(remote)) {
        list = remote.slice();
        remoteSuccess = true;
      }
    } catch {
      // Silencioso se a RPC não estiver disponível ou houver erro de rede
    }
  }

  if (Array.isArray(data?.people) && data.people.length) {
    const existingEmails = new Set(list.map((m) => m.email.toLowerCase()));
    for (const name of data.people) {
      if (name && !existingEmails.has(name.toLowerCase())) {
        list.push({ email: name, is_admin: false, joined_at: null });
        existingEmails.add(name.toLowerCase());
      }
    }
  }

  if (!list.length && shared && !remoteSuccess) {
    try {
      const count = await countParticipants();
      if (typeof count === "number" && count > 0) {
        $("#participant-count").textContent = decimal.format(count);
        $("#participant-label").textContent = count === 1 ? "participante confirmado" : "participantes confirmados";
        const container = $("#confirmed-members-list");
        if (container) {
          container.innerHTML = `<p class="empty">${decimal.format(count)} participante(s) confirmado(s) no mutirão.</p>`;
        }
        return;
      }
    } catch {
      // falha silenciosa
    }
  }

  renderConfirmedMembers(list);
}

function disconnect() {
  stopPendingPolling();
  clearSession();
  accessRole = null;
  ready = false;
  revision = 0;
  data = initialState();
  if (saleDialog.open) saleDialog.close();
  if (accessDialog.open) accessDialog.close();
  fillScenario();
  render();
  renderAccess();
  currentMembers = [];
  refreshConfirmedMembers();
}

async function connect() {
  const currentSession = session;
  const role = await getAccessRole();
  if (!session || session.refresh_token !== currentSession.refresh_token) return;
  if (role === "pending") {
    if (accessRole !== "pending") {
      try { await requestDashboardAccess(); } catch {}
    }
    if (!session || session.refresh_token !== currentSession.refresh_token) return;
    accessRole = role;
    renderAccess();
    notice("Sua solicitação foi enviada e está aguardando aprovação do administrador.");
    startPendingPolling();
    return;
  }
  stopPendingPolling();
  const saved = await loadSharedDashboard();
  if (!session || session.refresh_token !== currentSession.refresh_token) return;
  const wasPending = accessRole === "pending";
  accessRole = role;
  setState(saved);
  ready = true;
  renderAccess();
  render();
  refreshConfirmedMembers();
  notice(wasPending ? "Acesso liberado! Bem-vindo(a) ao painel do mutirão." : "");
}

function requireAccess() {
  if (ready && session) return true;
  if (!shared) notice("Configure o acesso ao painel para salvar alterações.", true);
  else if (!session) openAuth();
  else if (accessRole === "pending") notice("Aguarde a aprovação da sua conta para salvar alterações.", true);
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
  $("#late-note").hidden = !late;
  $("#late-note").textContent = money(late) + " recebidos após o prazo.";
  renderSales();
  renderScenarios();
  renderProjection();
  renderConfirmedMembers(currentMembers);
}

function saleLine(sale, compact = false) {
  const details = compact ? dateBR(sale.date) : [sale.client, dateBR(sale.date)].filter(Boolean).join(" · ");
  return `<article class="sale-line"><div><strong>${esc(sale.title)}</strong><small>${esc(details)}</small></div><div class="amount"><strong>${money(sale.amount)}</strong><small><span class="pill ${sale.status}">${statusLabel[sale.status]}</span></small></div><button class="text-link edit-sale" type="button" data-action="edit-sale" data-id="${esc(sale.id)}" aria-label="Editar venda ${esc(sale.title)}">Editar</button></article>`;
}

function renderSales() {
  const recent = data.sales.slice().reverse();
  $("#recent-sales").innerHTML = recent.length ? recent.slice(0, 3).map((sale) => saleLine(sale, true)).join("") : empty("Nenhuma venda registrada.");
  const status = $("#status-filter").value;
  const filtered = recent.filter((sale) => !status || status === sale.status);
  $("#sales-list").innerHTML = filtered.length ? filtered.map((sale) => saleLine(sale)).join("") : empty(recent.length ? "Nenhuma venda com esses filtros." : "Nenhuma venda registrada.");
}

function renderCatalog() {
  const categoryFilter = $("#category-filter").value;
  const query = searchKey($("#catalog-search").value);
  if (catalogMode === "products") {
    const matches = products.map((item, index) => ({ item, index }))
      .filter(({ item }) => searchKey([item.title, item.category, item.delivery].join(" ")).includes(query));
    $("#catalog-list").innerHTML = matches.length ? matches.map(({ item, index }) =>
      `<article class="card roomy catalog-card"><span class="category">${esc(item.category)}</span><h2>${esc(item.title)}</h2><p>${esc(item.delivery)}</p><button class="ref" type="button" data-action="use-product" data-index="${index}" aria-label="Adicionar ${esc(item.title)} ao cenário"><span>Preço para simular</span><span><strong>${money(item.price)}</strong><span aria-hidden="true">＋</span></span></button></article>`
    ).join("") : empty("Nenhum infoproduto encontrado.");
    return;
  }
  const matches = catalog.map((item, index) => ({ item, index })).filter(({ item }) =>
    (!categoryFilter || categoryFilter === item[0]) && searchKey(item.flat(3).join(" ")).includes(query));
  $("#catalog-list").innerHTML = matches.length ? matches.map(({ item, index }) => {
    const [category, name, , detail, unit = ""] = item;
    const price = compactMoney.format(catalogOffers.servico[index].price / 100) + (unit ? " " + unit : "");
    return `<article class="card roomy catalog-card"><span class="category">${esc(category)}</span><h2>${esc(name)}</h2><p>${esc(detail)}</p><button class="ref" type="button" data-action="use-price" data-index="${index}" aria-label="Adicionar ${esc(name)} ao cenário"><span>Adicionar ao cenário</span><span><strong>${price}</strong><span aria-hidden="true">＋</span></span></button></article>`;
  }).join("") : empty("Nenhum serviço encontrado.");
}

function readOffer(row) {
  const value = (name) => $(`[name="${name}"]`, row).value.trim();
  return {
    type: value("type"), title: value("item-title"),
    audience: value("audience"), promise: value("promise"), delivery: value("delivery"),
    price: cents(value("price")), cost: cents(value("cost")), fee: cents(value("fee")),
    quantity: Number(value("quantity")), days: Number(value("days")),
  };
}

function readScenario() {
  return { id: editingScenario ?? "", title: field(simForm, "title").value.trim(),
    items: Array.from(itemList.children, readOffer) };
}

function renderProjection() {
  const remaining = Math.max(0, TEAM_TARGET - stats(data).received);
  const offers = Array.from(itemList.children, (row) => {
    const item = readOffer(row);
    const valid = !!item.title && [...row.querySelectorAll('input[type="number"]')].every((input) => input.validity.valid);
    return { row, item, valid };
  });
  const included = offers.filter((offer) => offer.valid);
  const today = todayAt();
  const { gross, net, byDeadline, quantity, coverage, lateItems, lines } = projectScenario(included.map(({ item }) => item), remaining, today);
  for (const { row, item, valid } of offers) {
    const result = $(".offer-result", row);
    result.classList.remove("warning");
    if (!item.title) result.textContent = "Selecione um item do catálogo.";
    else result.textContent = valid ? "" : "Preencha preço, quantidade e prazo para calcular.";
  }
  for (const [index, { row }] of included.entries()) {
    const line = lines[index];
    const result = $(".offer-result", row);
    result.classList.toggle("warning", !line.within || line.net < 0);
    result.textContent = money(line.net) + " líquidos · " + decimal.format(line.perDay)
      + " vendas/dia · " + (line.within ? "Dentro do prazo" : "Após o prazo");
  }
  $("#projection-balance").textContent = money(remaining);
  $("#estimate").textContent = money(byDeadline);
  $("#gross").textContent = money(gross);
  $("#net-total").textContent = money(net);
  $("#planned-sales").textContent = decimal.format(quantity);
  $("#coverage").textContent = remaining && included.length ? decimal.format(coverage) + "%" : "—";
  $("#projected-balance").textContent = money(Math.max(0, remaining - byDeadline));
  const note = $("#projection-note");
  const partial = included.length !== offers.length;
  note.classList.toggle("warning", lateItems > 0 || partial);
  if (!offers.length) note.textContent = "Adicione um serviço ou infoproduto para simular.";
  else if (partial) note.textContent = "Projeção parcial. Complete os campos dos demais itens.";
  else if (lateItems === 1) note.textContent = "Um item ultrapassa o prazo.";
  else if (lateItems > 1) note.textContent = lateItems + " itens ultrapassam o prazo.";
  else if (!remaining) note.textContent = "A meta coletiva já foi atingida.";
  else if (remaining <= byDeadline) note.textContent = "O cenário cobre o saldo da meta coletiva.";
  else note.textContent = "";
}

function renderScenarios() {
  const today = todayAt();
  $("#saved-scenarios").innerHTML = data.scenarios.length ? data.scenarios.map((scenario) => {
    const items = scenarioItems(scenario);
    const { byDeadline, quantity, lateItems } = projectScenario(items, TEAM_TARGET, today);
    const details = items.map((item) => item.quantity + " × " + item.title).join(" · ");
    return `<article class="scenario-line"><div><strong>${esc(scenario.title)}</strong><small>${esc(details)}</small><small>${quantity} vendas planejadas${lateItems ? " · Inclui itens após o prazo" : ""}</small></div><div><strong>${money(byDeadline)}</strong><small>Líquido até o prazo</small></div><div class="scenario-actions"><button class="text-link" type="button" data-action="edit-scenario" data-id="${esc(scenario.id)}">Editar</button><button class="text-link danger" type="button" data-action="delete-scenario" data-id="${esc(scenario.id)}">Excluir</button></div></article>`;
  }).join("") : empty("Nenhum cenário salvo.");
}

function setOfferOptions(row, type, title = "") {
  const select = $('[name="item-title"]', row);
  const placeholder = new Option("Selecione " + (type === "servico" ? "um serviço" : "um infoproduto"), "");
  placeholder.disabled = true;
  const options = catalogOffers[type].map((item) => new Option(item.title, item.title));
  if (title && !options.some((option) => option.value === title)) {
    options.unshift(new Option(title + " (item salvo)", title));
  }
  select.replaceChildren(placeholder, ...options);
  select.value = title;
}

function appendOffer(item) {
  const row = $("#scenario-item-template").content.firstElementChild.cloneNode(true);
  $('[name="type"]', row).value = item.type;
  setOfferOptions(row, item.type, item.title);
  for (const key of ["quantity", "days", "audience", "promise", "delivery"]) {
    if (item[key] !== undefined) $(`[name="${key}"]`, row).value = item[key];
  }
  for (const key of ["price", "cost", "fee"]) {
    if (item[key] !== undefined) $(`[name="${key}"]`, row).value = item[key] / 100;
  }
  $(".offer-source", row).href = OFFER_SOURCE;
  itemList.append(row);
  return row;
}

function updateItems() {
  for (const [index, row] of Array.from(itemList.children).entries()) {
    $("legend", row).textContent = "Item " + (index + 1);
    $('[data-action="remove-item"]', row).setAttribute("aria-label", "Remover item " + (index + 1));
  }
  for (const button of document.querySelectorAll('[data-action="add-service"], [data-action="add-product"]')) {
    button.disabled = itemList.children.length >= MAX_SCENARIO_ITEMS;
  }
  $("#save-sim").disabled = !itemList.children.length;
  renderProjection();
}

function fillScenario(scenario) {
  field(simForm, "title").value = scenario?.title ?? "";
  editingScenario = scenario?.id ?? null;
  scenarioDirty = false;
  itemList.replaceChildren();
  if (scenario) for (const item of scenarioItems(scenario)) appendOffer(item);
  $("#save-sim").textContent = editingScenario ? "Atualizar cenário" : "Salvar cenário";
  updateItems();
}

function showScenario(scenario) {
  fillScenario(scenario);
  location.hash = "simulador";
  route();
  window.scrollTo(0, 0);
  field(simForm, "title").focus({ preventScroll: true });
}

function addOffer(item, fromCatalog = false) {
  if (itemList.children.length >= MAX_SCENARIO_ITEMS) {
    notice("Este cenário já tem o máximo de " + MAX_SCENARIO_ITEMS + " itens.", true);
    return;
  }
  const row = appendOffer(item);
  scenarioDirty = true;
  updateItems();
  if (fromCatalog) {
    notice(item.title + " foi adicionado ao cenário.");
  } else {
    $('[name="item-title"]', row).focus();
  }
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
  for (const key of ["title", "client", "status"]) {
    if (item) field(saleForm, key).value = item[key];
  }
  field(saleForm, "amount").value = item ? item.amount / 100 : "";
  field(saleForm, "date").value = item?.date ?? todayAt();
  $("#sale-heading").textContent = item ? "Editar venda" : "Registrar venda";
  $("#delete-sale").hidden = !item;
  dateLabel();
  saleDialog.showModal();
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
    amount: cents(value("amount")), status: value("status"), date: value("date") };
  return submit(saleForm, event.submitter, (next) => {
    const index = next.sales.findIndex((entry) => entry.id === sale.id);
    if (index < 0) next.sales.push(sale);
    else next.sales[index] = sale;
  }, "Venda salva.", saleDialog);
});

simForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireAccess()) return;
  const item = readScenario();
  item.id ||= makeId();
  const draftAtSave = JSON.stringify(item.items);
  const saved = await submit(simForm, event.submitter, (next) => {
    const index = next.scenarios.findIndex((entry) => entry.id === item.id);
    if (index < 0) next.scenarios.push(item);
    else next.scenarios[index] = item;
  }, "Cenário salvo.");
  if (saved) {
    editingScenario = item.id;
    scenarioDirty = draftAtSave !== JSON.stringify(readScenario().items) || field(simForm, "title").value.trim() !== item.title;
    $("#save-sim").textContent = "Atualizar cenário";
  }
});

function authErrorMessage(error) {
  if (error.code === "invalid_credentials") return "E-mail ou senha incorretos.";
  if (error.code === "email_not_confirmed") return "Confirme o e-mail da sua conta para entrar.";
  if (error.code === "weak_password") return "Escolha uma senha mais forte.";
  if (error.code === "signup_disabled") return "O cadastro está desativado. Fale com a pessoa responsável pelo mutirão.";
  if (error.code === "email_address_not_authorized") return "O envio de confirmação para este endereço está indisponível. Fale com a pessoa responsável pelo mutirão.";
  if (error.code === "over_email_send_rate_limit") return "O limite de envio de e-mails do projeto foi atingido. Tente mais tarde.";
  if (error.status === 429) return "O Supabase limitou temporariamente esta solicitação. Aguarde antes de tentar novamente.";
  return error.message;
}

$("#auth-mode").addEventListener("click", () => setAuthMode(!creatingAccount));
authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("#auth-submit");
  if (button.disabled) return;
  button.disabled = true;
  $("#auth-mode").disabled = true;
  formError(authForm, "");
  const password = field(authForm, "password");
  try {
    const email = field(authForm, "email").value.trim();
    if (creatingAccount) {
      await createAccount(email, password.value);
      if (!session) {
        setAuthMode(false);
        authDialog.close();
        notice("Confira seu e-mail para confirmar a conta. Depois, entre para solicitar acesso.");
        return;
      }
    } else {
      await signInWithPassword(email, password.value);
    }
    await connect();
    authForm.reset();
    authDialog.close();
  } catch (error) {
    if (session) disconnect();
    formError(authForm, authErrorMessage(error));
  } finally {
    password.value = "";
    button.disabled = false;
    $("#auth-mode").disabled = false;
  }
});

function openAccessDialog(tab = "pending") {
  if (accessRole !== "admin" || !ready) return;
  accessDialog.showModal();
  switchAccessTab(tab);
}

function switchAccessTab(tab) {
  const isPending = tab === "pending";
  $("#tab-pending").classList.toggle("active", isPending);
  $("#tab-pending").setAttribute("aria-selected", String(isPending));
  $("#tab-members").classList.toggle("active", !isPending);
  $("#tab-members").setAttribute("aria-selected", String(!isPending));
  $("#pending-section").hidden = !isPending;
  $("#members-section").hidden = isPending;
  if (isPending) renderAccessRequests();
  else renderMembersList();
}

async function renderAccessRequests() {
  $("#access-error").hidden = true;
  $("#access-list").textContent = "Carregando solicitações…";
  try {
    const requests = await listAccessRequests();
    updatePendingBadge();
    $("#access-list").innerHTML = requests.length ? requests.map(({ user_id, email, requested_at }) => {
      const dateText = requested_at ? new Date(requested_at).toLocaleDateString("pt-BR") : "";
      return `<div class="access-request">
        <div>
          <span>${esc(email)}</span>
          ${dateText ? `<small>Solicitado em ${esc(dateText)}</small>` : ""}
        </div>
        <div class="access-actions">
          <button class="button small danger outline" type="button" data-action="reject-access" data-id="${esc(user_id)}" aria-label="Recusar ${esc(email)}">Recusar</button>
          <button class="button small primary" type="button" data-action="approve-access" data-id="${esc(user_id)}" aria-label="Aprovar ${esc(email)}">Aprovar</button>
        </div>
      </div>`;
    }).join("") : empty("Nenhuma solicitação pendente.");
  } catch (error) {
    $("#access-list").textContent = "";
    showAccessError(error);
  }
}

async function renderMembersList() {
  $("#access-error").hidden = true;
  $("#members-list").textContent = "Carregando participantes…";
  try {
    const members = await listMembers();
    $("#members-list").innerHTML = members.length ? members.map(({ user_id, email, is_admin }) =>
      `<div class="access-request">
        <div>
          <span>${esc(email)}</span>
          <small><span class="member-tag ${is_admin ? "admin" : ""}">${is_admin ? "Administrador" : "Participante"}</span></small>
        </div>
        <div class="access-actions">
          ${!is_admin ? `<button class="button small danger outline" type="button" data-action="remove-member" data-id="${esc(user_id)}" aria-label="Remover ${esc(email)}">Remover</button>` : ""}
        </div>
      </div>`
    ).join("") : empty("Nenhum participante cadastrado.");
  } catch (error) {
    $("#members-list").textContent = "";
    showAccessError(error);
  }
}

function showAccessError(error) {
  const message = $("#access-error");
  message.textContent = error.message;
  message.hidden = false;
}

$("#tab-pending").addEventListener("click", () => switchAccessTab("pending"));
$("#tab-members").addEventListener("click", () => switchAccessTab("members"));
$("#manage-access").addEventListener("click", () => openAccessDialog("pending"));
$("#admin-action")?.addEventListener("click", () => openAccessDialog("pending"));

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
  const { action, close, id, index } = button.dataset;
  if (close) return document.getElementById(close).close();
  if (action === "approve-access") {
    if (accessRole !== "admin" || button.disabled) return;
    button.disabled = true;
    try {
      await approveDashboardAccess(id);
      await Promise.all([renderAccessRequests(), refreshConfirmedMembers()]);
    } catch (error) {
      button.disabled = false;
      showAccessError(error);
    }
    return;
  }
  if (action === "reject-access") {
    if (accessRole !== "admin" || button.disabled) return;
    if (!window.confirm("Recusar esta solicitação de acesso?")) return;
    button.disabled = true;
    try {
      await rejectDashboardAccess(id);
      await renderAccessRequests();
    } catch (error) {
      button.disabled = false;
      showAccessError(error);
    }
    return;
  }
  if (action === "remove-member") {
    if (accessRole !== "admin" || button.disabled) return;
    if (!window.confirm("Remover o acesso deste participante ao painel?")) return;
    button.disabled = true;
    try {
      await removeMember(id);
      await Promise.all([renderMembersList(), refreshConfirmedMembers()]);
    } catch (error) {
      button.disabled = false;
      showAccessError(error);
    }
    return;
  }
  if (action === "new-sale") return openSale();
  if (action === "edit-sale") return openSale(data.sales.find((sale) => sale.id === id));
  if (action === "add-service" || action === "add-product") {
    return addOffer({ type: action === "add-service" ? "servico" : "infoproduto" });
  }
  if (action === "remove-item") {
    button.closest(".scenario-item").remove();
    scenarioDirty = true;
    updateItems();
    return $('[data-action="add-service"]').focus();
  }
  if (action === "catalog-services" || action === "catalog-products") {
    catalogMode = action === "catalog-services" ? "services" : "products";
    $('[data-action="catalog-services"]').setAttribute("aria-pressed", String(catalogMode === "services"));
    $('[data-action="catalog-products"]').setAttribute("aria-pressed", String(catalogMode === "products"));
    $("#catalog-category").hidden = catalogMode === "products";
    $("#catalog-search").value = "";
    $("#catalog-search").placeholder = catalogMode === "products" ? "Ex.: workshop ou guia" : "Ex.: Reels ou estratégia";
    return renderCatalog();
  }
  if (action === "use-product") return addOffer(catalogOffers.infoproduto[Number(index)], true);
  if (action === "reset-sim" || action === "edit-scenario") {
    if (busy) return;
    if (scenarioDirty && !window.confirm("Descartar as alterações do cenário atual?")) return;
    if (action === "reset-sim") return showScenario();
    return showScenario(data.scenarios.find((item) => item.id === id));
  }
  if (action === "delete-scenario") {
    if (!requireAccess()) return;
    if (!window.confirm("Excluir este cenário?")) return;
    const saved = await submit(simForm, button, (next) => {
      next.scenarios = next.scenarios.filter((item) => item.id !== id);
    }, "Cenário excluído.");
    if (saved && editingScenario === id) fillScenario();
  }
  if (action === "use-price") return addOffer(catalogOffers.servico[Number(index)], true);
});

$("#status-filter").addEventListener("change", renderSales);
$("#catalog-search").addEventListener("input", renderCatalog);
$("#category-filter").addEventListener("change", renderCatalog);
simForm.addEventListener("input", (event) => {
  scenarioDirty = true;
  if (event.target.tagName !== "SELECT") renderProjection();
});
simForm.addEventListener("change", (event) => {
  if (event.target.tagName !== "SELECT") return;
  const row = event.target.closest(".scenario-item");
  const type = $('[name="type"]', row).value;
  if (event.target.name === "type") setOfferOptions(row, type);
  const title = $('[name="item-title"]', row).value;
  const item = catalogOffers[type].find((offer) => offer.title === title);
  $('[name="price"]', row).value = item ? item.price / 100 : "";
  for (const key of ["audience", "promise", "delivery"]) {
    $(`[name="${key}"]`, row).value = item?.[key] ?? "";
  }
  scenarioDirty = true;
  renderProjection();
});
field(saleForm, "status").addEventListener("change", dateLabel);
window.addEventListener("hashchange", route);
window.addEventListener("storage", async (event) => {
  if (shared || event.key !== storageKey || busy || saleDialog.open || editingScenario) return;
  try { await loadState(); render(); } catch (error) { notice(error.message, true); }
});
window.addEventListener("focus", async () => {
  if (!shared) return;
  refreshConfirmedMembers();
  if (accessRole === "pending" && session) {
    if (checkingPendingAccess) return;
    checkingPendingAccess = true;
    try { await connect(); }
    catch (error) { notice(error.message, true); }
    finally { checkingPendingAccess = false; }
    return;
  }
  if (!ready || busy || saleDialog.open) return;
  const previousSession = session;
  const previousRevision = revision;
  try {
    const result = await loadSharedDashboard();
    if (!busy && session === previousSession && revision === previousRevision
      && !saleDialog.open && !editingScenario) {
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

$("#services-options").innerHTML = [...catalog.map(([, title]) => title), ...products.map((item) => item.title)]
  .map((title) => `<option value="${esc(title)}"></option>`).join("");
$("#category-filter").insertAdjacentHTML("beforeend", [...new Set(catalog.map(([category]) => category))]
  .map((category) => `<option>${esc(category)}</option>`).join(""));
if (shared) discardLegacySignInRedirect();
route();
renderCatalog();
updateItems();
render();
if (shared) {
  $("#auth-action").hidden = false;
  $("#storage-label").textContent = "Aguardando acesso";
  initializeSharedAccess();
  refreshConfirmedMembers();
} else {
  loadState().then(() => {
    render();
    refreshConfirmedMembers();
  }).catch((error) => {
    $("#storage-label").textContent = "Dados indisponíveis";
    notice(error.message, true);
  });
}

async function initializeSharedAccess() {
  try {
    if (!restoreSession()) return;
    await connect();
  } catch (error) {
    disconnect();
    notice(error.message, true);
  }
}
