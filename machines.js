(() => {
  const { states, taskStates, stages, checklist, metricGroups, emptyPlan, samplePlan, estimate, completion } = machineModel;
  const route = "/rest/v1/mutirao_mentoria_machines";
  const columns = "id,title,status,revision,plan";
  const gallery = $("#machine-gallery");
  const cards = $("#machine-cards");
  const workspace = $("#machine-workspace");
  const tabs = $("#machine-tabs");
  const panel = $("#machine-panel");
  const dialog = $("#machine-dialog");
  const form = $("#machine-form");
  const formFields = $("#machine-form-fields");
  const submit = $("#machine-submit");
  const close = $("#machine-close");
  const localKey = "mutirao-infoproduct-machines";
  const allowed = () => !shared || (ready && !!session && ["member", "admin"].includes(accessRole));
  const currency = (value) => moneyFormat.format(value);
  let machines = [];
  let currentId = null;
  let stage = "produto";
  let editor = null;
  let request = 0;
  let scenarioRequest = 0;
  let pendingSave = null;
  let loaded = false;

  const active = () => machines.find(({ id }) => id === currentId);
  function readLocal() {
    const rows = JSON.parse(localStorage.getItem(localKey) || "[]");
    if (!Array.isArray(rows)) throw new Error("Os projetos locais estão em um formato inválido.");
    return rows;
  }

  async function readMachines(fields, filter = "") {
    if (!shared) return readLocal();
    return supabaseRequest(route + "?select=" + fields + "&order=created_at.desc,id.desc" + filter, { token: await accessToken() });
  }

  async function loadScenarioOffers() {
    if (!allowed()) return;
    const version = ++scenarioRequest;
    const status = $("#scenario-machine-status");
    setScenarioMachineOffers([]);
    status.hidden = false;
    status.textContent = "Carregando produtos criados em Infoprodutos…";
    try {
      const rows = await readMachines("id,title,status,price:plan->metricas->price", "&status=eq.no_ar");
      if (version !== scenarioRequest || !allowed()) return;
      const offers = rows.filter(({ id, status, title }) => (
        MACHINE_ID_PATTERN.test(id) && status === "no_ar" && isText(title, 120, true)
      )).map(({ id, title, price, plan }) => ({
        id, title, price: cents(price ?? plan?.metricas?.price),
      }));
      setScenarioMachineOffers(offers);
      status.textContent = offers.length ? "" : "Para usar um produto criado em Infoprodutos, marque o projeto como No ar.";
      status.hidden = !!offers.length;
    } catch {
      if (version !== scenarioRequest || !allowed()) return;
      status.textContent = "Não foi possível carregar os produtos criados. Reabra o Simulador para tentar de novo.";
    }
  }

  function feedback(message = "", error = false) {
    const box = $("#machine-feedback");
    box.textContent = message;
    box.classList.toggle("form-error", error);
    box.hidden = !message;
  }

  function normalized(row) {
    const plan = emptyPlan();
    for (const key of Object.keys(plan)) {
      const saved = row.plan?.[key];
      if (saved && typeof saved === "object" && !Array.isArray(saved)) plan[key] = saved;
    }
    return { ...row, plan };
  }

  function safeLink(value) {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function errorMessage(error) {
    if (error.code === "PGRST205" || error.code === "42P01") return "Aplique a migração da Máquina de Infoprodutos no Supabase para liberar os projetos.";
    if (error.status === 401 || error.status === 403) return "Sua sessão ou seu acesso mudou. Entre novamente para continuar.";
    return error.message;
  }

  function statusPill(status) {
    return `<span class="pill machine-pill" data-machine-status="${esc(status)}">${esc(states[status] || states.rascunho)}</span>`;
  }

  function renderGallery() {
    const empty = $("#machine-empty");
    empty.hidden = !loaded || !!machines.length;
    cards.innerHTML = machines.map((machine) => {
      const { complete } = completion(machine.plan);
      return `<article class="event-card machine-card">
        <button class="event-card-body" type="button" data-machine-open="${esc(machine.id)}">
          <span class="event-card-meta">${statusPill(machine.status)}<span>${complete}/${checklist.length} resolvidos</span></span>
          <strong class="event-card-title">${esc(machine.title)}</strong>
          <span class="machine-card-summary">${esc(machine.plan.produto.promise || "Defina a primeira vitória do cliente.")}</span>
          <span class="event-card-track" aria-hidden="true"><span style="width:${complete / checklist.length * 100}%"></span></span>
          <span class="event-card-link">Abrir planejamento <span aria-hidden="true">→</span></span>
        </button>
      </article>`;
    }).join("");
  }

  async function load({ preserveFeedback = false } = {}) {
    if (!allowed() || pendingSave) return;
    const version = ++request;
    const refresh = $("#machine-refresh");
    const loading = $("#machine-loading");
    refresh.disabled = true;
    loading.hidden = false;
    if (!preserveFeedback) feedback();
    try {
      const rows = await readMachines(columns);
      if (version !== request || !allowed()) return;
      machines = rows.filter(({ id }) => MACHINE_ID_PATTERN.test(id)).map(normalized);
      loaded = true;
      render();
    } catch (error) {
      if (version === request && allowed()) feedback(errorMessage(error), true);
    } finally {
      if (version === request) {
        refresh.disabled = false;
        loading.hidden = true;
      }
    }
  }

  function render() {
    const machine = active();
    gallery.hidden = !!machine;
    workspace.hidden = !machine;
    $("#machine-new").hidden = !!machine;
    if (!machine) {
      currentId = null;
      renderGallery();
      return;
    }
    $("#machine-title").textContent = machine.title;
    $("#machine-state").textContent = states[machine.status] || states.rascunho;
    const { complete, skipped } = completion(machine.plan);
    $("#machine-progress-text").textContent = `${complete} de ${checklist.length} itens resolvidos${skipped ? ` · ${skipped} sem aplicação` : ""}`;
    $("#machine-progress").max = checklist.length;
    $("#machine-progress").value = complete;
    for (const button of tabs.querySelectorAll("button")) {
      button.setAttribute("aria-pressed", String(button.dataset.machineStage === stage));
    }
    renderPanel(machine);
  }

  function renderPanel(machine) {
    const { title, intro, groups } = stages[stage];
    let content;
    if (stage === "checklist") content = renderChecklist(machine);
    else if (stage === "metricas") content = renderMetrics(machine);
    else content = renderStage(machine, groups);
    panel.innerHTML = `<div class="section-header planning-heading">
      <div><h3 id="machine-panel-heading" tabindex="-1">${title}</h3><p>${intro}</p></div>
      ${stage === "metricas" ? '<button type="button" class="button primary" data-machine-edit>Editar premissas</button>' : ""}
      </div>${content}`;
  }

  function renderStage(machine, groups) {
    const data = machine.plan[stage];
    const hasJourney = ["funil", "esteira", "ascensao"].includes(stage);
    const journey = hasJourney
      ? `<ol class="machine-flow" aria-label="Sequência de ${stages[stage].label.toLowerCase()}">${groups.map(({ title }, index) =>
        `<li><a href="#machine-block-${index}" data-machine-jump="${index}">${title}</a></li>`).join("")}</ol>`
      : "";
    const ladder = stage === "esteira"
      ? `<ol class="machine-ladder" aria-label="Esteira de ofertas">
        ${[["Low", machine.title], ["Mid", data.midName], ["High", data.highName], ["Acompanhamento", data.careName]].map(([tier, name]) =>
          `<li><span>${tier}</span><strong>${esc(name || "A definir")}</strong></li>`).join("")}
      </ol>`
      : "";
    const groupsHtml = groups.map(({ title, fields }, index) => {
      const highlights = ["promise", "lead", "offer", "lowMidSignal", "midHighSignal", "highCareSignal"];
      const filled = fields.filter(([key]) => data[key]).length;
      return `<section class="planning-block" aria-labelledby="machine-block-${index}">
        <header class="planning-block-header">
          <h4 id="machine-block-${index}" tabindex="-1">${title}</h4>
          <button class="button small" type="button" data-machine-edit="${index}" aria-label="Editar ${title}">Editar</button>
        </header>
        ${filled ? `<dl class="planning-facts">${fields.map(([key, label]) =>
          `<div${highlights.includes(key) ? ' class="planning-highlight"' : ""}><dt>${label}</dt>
            <dd${data[key] ? "" : ' class="planning-missing"'}>${esc(data[key] || "A definir")}</dd></div>`).join("")}</dl>`
          : `<p class="planning-missing">${esc(fields[0][2] || "Preencha este bloco para continuar o planejamento.")}</p>`}
      </section>`;
    }).join("");
    return ladder + journey + `<div class="planning-stack">${groupsHtml}</div>`;
  }

  function renderChecklist(machine) {
    const members = new Map(currentMembers.map(({ user_id, email }) => [user_id, email]));
    return `<ol class="machine-checklist">${checklist.map(([key, title, description], index) => {
      const task = machine.plan.checklist[key] || {};
      const status = taskStates[task.status] ? task.status : "pendente";
      const owner = members.get(task.owner) || task.ownerLabel || "Sem responsável";
      const date = task.date ? new Date(task.date + "T12:00:00").toLocaleDateString("pt-BR") : "Sem prazo";
      const link = safeLink(task.url);
      return `<li>
        <span class="machine-check-index" aria-hidden="true">${index + 1}</span>
        <div class="machine-task"><h4>${title}</h4><p>${description}</p>
          <p class="machine-task-meta">${esc(owner)} · ${esc(date)}${link ? ` · <a href="${esc(link)}" target="_blank" rel="noopener noreferrer">Abrir entrega ↗</a>` : ""}</p>
          ${task.notes ? `<p class="machine-task-notes">${esc(task.notes)}</p>` : ""}
        </div>
        <span class="pill machine-pill" data-machine-status="${status}">${taskStates[status]}</span>
        <button class="button small" type="button" data-machine-task="${key}" aria-label="Editar ${title}">Editar</button>
      </li>`;
    }).join("")}</ol>`;
  }

  function renderMetrics(machine) {
    const values = machine.plan.metricas;
    const hasValues = Object.keys(values).length > 0;
    const summary = estimate(values);
    const indicators = [
      ["Compradores previstos", decimal.format(summary.buyers)],
      ["Ticket médio inicial", currency(summary.ticket)],
      ["Receita bruta inicial", currency(summary.gross)],
      ["Saldo inicial estimado", currency(summary.net)],
      ["CPA de mídia paga", summary.cpa === null ? "—" : currency(summary.cpa)],
      ["CPA de equilíbrio inicial", currency(summary.breakEven)],
      ["LTV bruto esperado", currency(summary.ltv)],
    ];
    const metric = ([label, value], primary = false) =>
      `<div${primary ? ' class="machine-metric-primary"' : ""}><span>${label}</span><strong>${hasValues ? value : "—"}</strong></div>`;
    return `<div class="machine-metric-results">
      ${metric(indicators[3], true)}
      <div class="machine-indicators">${indicators.filter((_, index) => index !== 3).map((indicator) => metric(indicator)).join("")}</div>
      </div>
      <p class="machine-metric-note">O saldo desconta tráfego, taxas e custos variáveis. O ticket inclui complementos ponderados pela adesão. O LTV bruto inclui as compras esperadas ao longo da esteira.</p>
      <details class="machine-metric-details"><summary>Ver premissas usadas na projeção</summary>
      ${metricGroups.map(({ title, fields }) => `<div class="machine-group">
        <h4>${title}</h4><dl class="machine-assumptions">${fields.map(([key, label]) =>
          `<div><dt>${label}</dt><dd>${values[key] == null ? "—" : esc(label.includes("R$") ? currency(Number(values[key])) : decimal.format(Number(values[key])) + (label.includes("%") ? "%" : ""))}</dd></div>`).join("")}</dl>
      </div>`).join("")}</details>`;
  }

  function field(name, label, hint, type = "textarea", value = "") {
    const encoded = esc(value ?? "");
    let markup;
    if (Array.isArray(type)) {
      const choices = type.map((entry) => Array.isArray(entry) ? entry : [entry, entry]);
      markup = `<select name="${name}">${choices.map(([key, text]) =>
        `<option value="${esc(key)}"${key === value ? " selected" : ""}>${esc(text)}</option>`).join("")}</select>`;
    } else if (type === "textarea") {
      markup = `<textarea name="${name}" rows="3" maxlength="4000" placeholder="${esc(hint)}">${encoded}</textarea>`;
    } else {
      const attrs = typeof type === "object" ? type : { type: type === "input" ? "text" : type, maxlength: name === "title" ? 120 : 350 };
      markup = `<input name="${name}" value="${encoded}" placeholder="${esc(hint)}" ${Object.entries(attrs).map(([key, val]) => `${key}="${esc(val)}"`).join(" ")}${name === "title" ? " required" : ""}>`;
    }
    return `<label>${label}${markup}</label>`;
  }

  function group(title, fields) {
    return `<fieldset class="machine-edit-group"><legend>${title}</legend><div>${fields.join("")}</div></fieldset>`;
  }

  function showEditor(kind, key, groupIndex) {
    if (!allowed() || pendingSave || dialog.open) return;
    const machine = active();
    if (kind !== "new" && !machine) return;
    editor = { kind, key, groupIndex, machine };
    let title, fields;
    if (kind === "new" || kind === "settings") {
      title = kind === "new" ? "Nova máquina" : "Editar projeto";
      fields = field("title", "Nome do projeto", "Ex.: Kit de portfólio para Social Media", "input", machine?.title);
      fields += kind === "new"
        ? field("template", "Como começar", "", [["blank", "Projeto guiado em branco"], ["sample", "Exemplo preenchido · Portfólio Social Media"]], "blank")
        : field("status", "Status do projeto", "", Object.entries(states), machine.status);
    } else if (kind === "task") {
      const task = machine.plan.checklist[key] || {};
      const [, taskTitle, description] = checklist.find(([id]) => id === key);
      const owners = currentMembers.map(({ user_id, email }) => [user_id, email || "Participante"]);
      if (task.owner && !owners.some(([id]) => id === task.owner)) owners.push([task.owner, task.ownerLabel || "Participante anterior"]);
      title = taskTitle;
      fields = `<p class="machine-edit-hint">${description}</p>` +
        field("status", "Status da entrega", "", Object.entries(taskStates), task.status || "pendente") +
        field("owner", "Responsável", "", [["", "Sem responsável"], ...owners], task.owner || "") +
        field("date", "Prazo", "", "date", task.date) +
        field("url", "Link da entrega", "https://", { type: "url", maxlength: 1000 }, task.url) +
        field("notes", "Notas", "Registre o que falta ou o resultado da validação.", "textarea", task.notes);
    } else if (key === "metricas") {
      title = "Premissas da simulação";
      const data = machine.plan.metricas;
      fields = metricGroups.map(({ title, fields }) => group(title, fields.map(([name, label, max, step]) =>
        field(name, label, "", { type: "number", min: 0, max, step, inputmode: "decimal" }, data[name])))).join("");
    } else {
      const selected = stages[key].groups[groupIndex];
      title = "Editar " + selected.title;
      const data = machine.plan[key];
      fields = selected.fields.map(([name, label, hint, type]) =>
        field(name, label, hint, Array.isArray(type) ? [["", "Selecione…"], ...type] : type, data[name])).join("");
    }
    $("#machine-dialog-heading").textContent = title;
    formFields.innerHTML = fields;
    formError(form, "");
    dialog.showModal();
    formFields.querySelector("input,select,textarea")?.focus();
  }

  function payload({ kind, key, machine }) {
    const data = Object.fromEntries(Array.from(new FormData(form), ([name, value]) => [name, value.trim()]));
    if (kind === "new" || kind === "settings") {
      if (!data.title) throw new Error("Informe um nome para o projeto.");
      if (kind === "settings") return { title: data.title, status: data.status };
      return { title: data.title, status: "rascunho", plan: data.template === "sample" ? samplePlan() : emptyPlan() };
    }
    if (kind === "task") {
      if (data.url && !safeLink(data.url)) throw new Error("Informe um link com http:// ou https://.");
      if (data.owner) data.ownerLabel = form.elements.owner.selectedOptions[0].textContent;
      return { plan: { ...machine.plan, checklist: { ...machine.plan.checklist, [key]: data } } };
    }
    let section = { ...machine.plan[key], ...data };
    if (key === "metricas") {
      const values = Object.entries(data).filter(([, value]) => value !== "");
      section = Object.fromEntries(values.map(([name, value]) => [name, Number(value)]));
      if (section.paidBuyers > estimate(section).buyers + 0.000001) {
        throw new Error("Os compradores atribuídos à mídia não podem superar o total previsto.");
      }
    }
    return { plan: { ...machine.plan, [key]: section } };
  }

  async function persist(data, machine) {
    if (shared) {
      const filter = machine ? `id=eq.${machine.id}&revision=eq.${machine.revision}&` : "";
      const rows = await supabaseRequest(route + "?" + filter + "select=" + columns, {
        method: machine ? "PATCH" : "POST",
        body: machine ? { ...data, revision: machine.revision + 1 } : data,
        token: await accessToken(), representation: true,
      });
      return rows?.[0];
    }
    const rows = readLocal();
    const index = machine && rows.findIndex(({ id, revision }) => id === machine.id && revision === machine.revision);
    if (index === -1) return null;
    const saved = machine
      ? { ...rows[index], ...data, revision: machine.revision + 1 }
      : { ...data, id: crypto.randomUUID(), revision: 0 };
    if (machine) rows[index] = saved;
    else rows.unshift(saved);
    localStorage.setItem(localKey, JSON.stringify(rows));
    return saved;
  }

  async function save(event) {
    event.preventDefault();
    if (!allowed() || !editor || pendingSave) return;
    const edit = editor;
    const operation = Symbol();
    let stale = false;
    pendingSave = operation;
    request += 1;
    $("#machine-refresh").disabled = false;
    $("#machine-loading").hidden = true;
    submit.disabled = close.disabled = true;
    formError(form, "");
    try {
      const saved = await persist(payload(edit), edit.machine);
      if (pendingSave !== operation || !allowed()) return;
      if (!saved) {
        stale = true;
        formError(form, "Outra pessoa atualizou este projeto. Seus campos continuam aqui para copiar. Feche o formulário para carregar a versão atual.");
        submit.disabled = true;
        return;
      }
      const machine = normalized(saved);
      machines = [machine, ...machines.filter(({ id }) => id !== machine.id)];
      dialog.close();
      currentId = machine.id;
      if (edit.kind === "new") stage = "produto";
      render();
      if (edit.kind === "new") {
        $("#machine-title").focus();
        window.scrollTo(0, 0);
      } else if (edit.kind === "task") {
        $(`[data-machine-task="${edit.key}"]`, panel)?.focus({ preventScroll: true });
      } else if (edit.kind === "section") {
        $(`[data-machine-edit="${edit.groupIndex ?? ""}"]`, panel)?.focus({ preventScroll: true });
      }
      feedback(edit.kind === "new" ? "Máquina criada." : "Alterações salvas.");
    } catch (error) {
      if (pendingSave === operation && allowed()) formError(form, errorMessage(error));
    } finally {
      if (pendingSave === operation) {
        pendingSave = null;
        close.disabled = false;
        submit.disabled = stale;
        if (stale) edit.stale = true;
      }
    }
  }

  function exportPlan() {
    const machine = active();
    if (!machine || !allowed()) return;
    const lines = [`# ${machine.title}`, "", `Status: ${states[machine.status] || states.rascunho}`, ""];
    for (const [key, { title, groups }] of Object.entries(stages)) {
      if (!groups) continue;
      lines.push(`## ${title}`, "");
      for (const { title, fields } of groups) {
        lines.push(`### ${title}`, "");
        for (const [name, label] of fields) lines.push(`- **${label}** — ${machine.plan[key][name] || "A definir"}`);
        lines.push("");
      }
    }
    lines.push("## Checklist para ir ao ar", "");
    for (const [key, label] of checklist) {
      const task = machine.plan.checklist[key] || {};
      lines.push(`- ${label}: ${taskStates[task.status] || taskStates.pendente}`);
      if (task.ownerLabel) lines.push(`  - Responsável: ${task.ownerLabel}`);
      if (task.date) lines.push(`  - Prazo: ${task.date}`);
      if (safeLink(task.url)) lines.push(`  - Entrega: ${task.url}`);
      if (task.notes) lines.push(`  - Notas: ${task.notes}`);
    }
    lines.push("", "## Simulador", "");
    if (Object.keys(machine.plan.metricas).length) {
      const { buyers, ticket, gross, net, cpa, breakEven, ltv } = estimate(machine.plan.metricas);
      lines.push(
        `- Compradores previstos: ${decimal.format(buyers)}`, `- Ticket médio inicial: ${currency(ticket)}`,
        `- Receita bruta inicial: ${currency(gross)}`, `- Saldo inicial estimado: ${currency(net)}`,
        `- CPA de mídia paga: ${cpa === null ? "A definir" : currency(cpa)}`,
        `- CPA de equilíbrio inicial: ${currency(breakEven)}`, `- LTV bruto esperado: ${currency(ltv)}`, "",
      );
      for (const { title, fields } of metricGroups) {
        lines.push(`### ${title}`, "");
        for (const [key, label] of fields) {
          if (Object.hasOwn(machine.plan.metricas, key)) lines.push(`- ${label}: ${machine.plan.metricas[key]}`);
        }
        lines.push("");
      }
    } else lines.push("Premissas a definir.", "");
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = (machine.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "maquina") + ".md";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  tabs.innerHTML = Object.entries(stages).map(([key, { label }]) =>
    `<button type="button" class="button" data-machine-stage="${key}" aria-pressed="false">${label}</button>`).join("");
  $("#machine-new").addEventListener("click", () => showEditor("new"));
  $("#machine-refresh").addEventListener("click", () => load());
  $("#machine-settings").addEventListener("click", () => showEditor("settings"));
  $("#machine-export").addEventListener("click", exportPlan);
  $("#machine-checklist-link").addEventListener("click", () => {
    selectStage("checklist");
    $("#machine-panel-heading").focus();
  });
  $("#machine-back").addEventListener("click", () => {
    const previous = currentId;
    currentId = null;
    feedback();
    render();
    ($(`[data-machine-open="${previous}"]`, cards) || $("#machine-gallery-heading")).focus({ preventScroll: true });
  });
  cards.addEventListener("click", (event) => {
    const button = event.target.closest("[data-machine-open]");
    if (!button || !allowed() || pendingSave) return;
    currentId = button.dataset.machineOpen;
    stage = "produto";
    feedback();
    render();
    $("#machine-title").focus();
  });
  function selectStage(next) {
    if (!allowed() || next === stage) return;
    stage = next;
    feedback();
    render();
  }
  tabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-machine-stage]");
    if (button) selectStage(button.dataset.machineStage);
  });
  panel.addEventListener("click", (event) => {
    const jump = event.target.closest("[data-machine-jump]");
    if (jump) {
      event.preventDefault();
      const heading = $(`#machine-block-${jump.dataset.machineJump}`, panel);
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({ block: "start" });
      return;
    }
    const task = event.target.closest("[data-machine-task]");
    const edit = event.target.closest("[data-machine-edit]");
    if (task) showEditor("task", task.dataset.machineTask);
    else if (edit) showEditor("section", stage, edit.dataset.machineEdit);
  });
  form.addEventListener("submit", save);
  dialog.addEventListener("cancel", (event) => { if (pendingSave) event.preventDefault(); });
  dialog.addEventListener("close", () => {
    const stale = editor?.stale;
    editor = null;
    submit.disabled = false;
    formFields.replaceChildren();
    if (stale) load();
  });
  document.addEventListener("mutirao:route", (event) => {
    if (event.detail === "infoprodutos" && !dialog.open) load();
    if (event.detail === "vendas/simulador") loadScenarioOffers();
  });
  document.addEventListener("mutirao:disconnect", () => {
    request += 1;
    scenarioRequest += 1;
    setScenarioMachineOffers([]);
    $("#scenario-machine-status").hidden = true;
    pendingSave = null;
    machines = [];
    currentId = null;
    loaded = false;
    close.disabled = submit.disabled = false;
    if (dialog.open) dialog.close();
    editor = null;
    formFields.replaceChildren();
    panel.replaceChildren();
    $("#machine-title").textContent = "";
    $("#machine-loading").hidden = true;
    $("#machine-refresh").disabled = false;
    feedback();
    render();
  });
  if (!shared) {
    $("[data-machine-nav]").hidden = false;
    if (activeView === "infoprodutos") load();
    if (activeView === "vendas/simulador") loadScenarioOffers();
  }
})();
