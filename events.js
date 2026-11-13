(() => {
  const phases = { captura: "Captação", aquecimento: "Aquecimento", evento: "Evento", vendas: "Vendas", pos: "Pós-evento" };
  const channels = { grupos: "WhatsApp · grupos", privado: "WhatsApp · privado", instagram: "Instagram · privado", email: "E-mail", outro: "Outro" };
  const eventStates = { planejado: "Planejado", em_andamento: "Em andamento", concluido: "Concluído", arquivado: "Arquivado" };
  const progress = { pendente: "Pendente", andamento: "Em andamento", feito: "Concluído" };
  const messageStates = { rascunho: "Rascunho", revisao: "Em revisão", agendado: "Agendado", enviado: "Enviado", cancelado: "Cancelado" };
  const linkStates = { pendente: "Pendente", pronto: "Validado" };
  const teams = { estrategia: "Estratégia", comercial: "Comercial", design: "Design", copy: "Copy", video: "Vídeo", dev: "Dev" };
  const panel = {
    brief: { name: "Estratégia", verb: "Editar planejamento", description: "Defina o objetivo, o público e a oferta que vão orientar a equipe." },
    task: { name: "Tarefas", verb: "Nova tarefa", description: "Acompanhe responsáveis, prazos e entregas por fase.", states: progress },
    message: { name: "Calendário de comunicação", verb: "Nova mensagem", description: "Planeje a copy e acompanhe a publicação nos grupos e canais privados.", states: messageStates },
    agenda: { name: "Roteiro do dia", verb: "Novo bloco", description: "Organize a ordem, a duração e a condução de cada bloco.", states: progress },
    link: { name: "Links da operação", verb: "Novo link", description: "Centralize páginas, grupos, pesquisas, materiais e checkout.", states: linkStates },
  };
  const briefFields = [
    ["logistics", "Formato, local ou plataforma"],
    ["goal", "Objetivo e indicadores de sucesso"],
    ["audience", "Público e lista VIP"],
    ["narrative", "Narrativa, tese e mensagens aprovadas"],
    ["offer", "Oferta, entregáveis e bônus"],
    ["identity", "Identidade visual e materiais"],
    ["followup", "Regras de venda e pós-evento"],
  ];
  const dialog = $("#event-dialog");
  const form = $("#event-form");
  const picker = $("#event-picker");
  const feedback = $("#event-feedback");
  const panelContent = $("#event-panel-content");
  const phaseFilter = $("#event-filter-phase");
  const statusFilter = $("#event-filter-status");
  const channelFilter = $("#event-filter-channel");
  const eventRoute = "/rest/v1/mutirao_mentoria_events";
  let events = [];
  let section = "brief";
  let editor = null;
  let request = 0;
  let saving = false;

  const allowed = () => ready && !!session && (accessRole === "member" || accessRole === "admin");
  const active = () => events.find((event) => event.id === picker.value);
  const itemsFor = (event, kind) => (event.plan.items || []).filter((item) => item?.kind === kind);
  const input = (name, label, type = "text", limits = "") =>
    `<label>${label}<input name="${name}" type="${type}" ${limits}></label>`;
  const area = (name, label) => `<label>${label}<textarea name="${name}" rows="3" maxlength="5000"></textarea></label>`;
  const options = (values) => Object.entries(values).map(([value, label]) =>
    `<option value="${esc(value)}">${esc(label)}</option>`).join("");
  const select = (name, label, values) => `<label>${label}<select name="${name}">${options(values)}</select></label>`;
  const pair = (...fields) => `<div class="event-field-pair">${fields.join("")}</div>`;
  const setFeedback = (text) => { feedback.textContent = text; feedback.hidden = !text; };
  const replaceEvent = (saved) => { events = [saved, ...events.filter((event) => event.id !== saved.id)]; };
  const stateName = (states, key) => Object.hasOwn(states, key) ? states[key] : "";
  const safeUrl = (value) => {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : "";
    } catch { return ""; }
  };
  const formatDate = (date) => isDate(date) ? dateBR(date) : "";
  const eligibleOwner = (item) => {
    const member = currentMembers.find((person) => person.user_id === item.owner);
    return member?.email || item.ownerLabel || "";
  };

  function templatePlan() {
    const item = (kind, title, phase, fields = {}) => ({
      id: makeId(), kind, title, phase, status: Object.keys(panel[kind].states)[0], ...fields,
    });
    return { brief: {}, items: [
      item("task", "Definir objetivo, narrativa e oferta", "captura", { team: "estrategia" }),
      item("task", "Criar identidade visual e peças", "captura", { team: "design" }),
      item("task", "Revisar e aprovar mensagens", "aquecimento", { team: "copy" }),
      item("task", "Testar transmissão e materiais de apoio", "evento", { team: "video" }),
      item("task", "Organizar atendimento e follow-up", "pos", { team: "comercial" }),
      item("message", "Convite inicial", "captura", { channel: "grupos" }),
      item("message", "Reativar contatos", "captura", { channel: "privado" }),
      item("message", "Lembrete do evento", "aquecimento", { channel: "grupos" }),
      item("message", "Abertura das vendas", "vendas", { channel: "grupos" }),
      item("agenda", "Abertura", "evento", { order: 1, duration: 10 }),
      item("agenda", "Bloco principal", "evento", { order: 2, duration: 25 }),
      item("agenda", "Demonstração ou prática", "evento", { order: 3, duration: 25 }),
      item("agenda", "Oferta e encerramento", "evento", { order: 4, duration: 10 }),
      item("link", "Página de captura", "captura"),
      item("link", "Página de obrigado", "captura"),
      item("link", "Grupo do evento", "aquecimento"),
      item("link", "Pesquisa", "aquecimento"),
      item("link", "Transmissão", "evento"),
      item("link", "Checkout", "vendas"),
    ] };
  }

  function renderPicker(selected) {
    picker.replaceChildren(new Option(events.length ? "Selecione um evento" : "Nenhum evento", ""),
      ...events.map((event) => new Option(event.title + (event.status === "arquivado" ? " · arquivado" : ""), event.id)));
    picker.disabled = !events.length;
    picker.value = events.some((event) => event.id === selected)
      ? selected
      : (events.find((event) => event.status !== "arquivado") || events[0])?.id || "";
  }

  async function fetchEvents(selected = picker.value) {
    if (!allowed()) return;
    const operation = ++request;
    const generation = accessGeneration;
    const reload = $("#event-reload");
    reload.disabled = true;
    setFeedback("");
    if (!events.length) $("#event-empty").hidden = true;
    try {
      const result = await supabaseRequest(
        eventRoute + "?select=id,title,event_date,status,revision,plan&order=created_at.desc",
        { token: await accessToken() },
      );
      if (operation !== request || generation !== accessGeneration || !allowed()) return;
      events = result;
      renderPicker(selected);
      renderEvent();
    } catch (error) {
      if (operation !== request || generation !== accessGeneration) return;
      setFeedback("Não foi possível carregar os eventos. Tente atualizar.");
      if (error.status === 401) disconnect();
    } finally {
      if (operation === request) reload.disabled = false;
    }
  }

  function renderEvent() {
    const event = active();
    $("#event-empty").hidden = !!event;
    $("#event-workspace").hidden = !event;
    if (!event) return;
    $("#event-current-title").textContent = event.title;
    $("#event-current-status").textContent = stateName(eventStates, event.status);
    $("#event-current-date").textContent = formatDate(event.event_date) || "Data a definir";
    const tasks = itemsFor(event, "task");
    const messages = itemsFor(event, "message");
    const links = itemsFor(event, "link");
    const duration = itemsFor(event, "agenda").reduce((sum, item) => sum + (Number(item.duration) || 0), 0);
    $("#event-overview-metrics").innerHTML = [
      [tasks.filter((item) => item.status === "feito").length + "/" + tasks.length, "Tarefas concluídas"],
      [messages.filter((item) => item.status === "enviado").length + "/" + messages.length, "Mensagens enviadas"],
      [duration + " min", "Duração do roteiro"],
      [links.filter((item) => item.status === "pronto").length + "/" + links.length, "Links validados"],
    ].map(([value, label]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join("");
    renderPanel();
  }

  function selectSection(next, render = true) {
    if (!Object.hasOwn(panel, next)) return;
    section = next;
    phaseFilter.innerHTML = options({ "": "Todas", ...phases });
    statusFilter.innerHTML = options({ "": "Todos", ...panel[next].states });
    channelFilter.innerHTML = options({ "": "Todos", ...channels });
    for (const button of document.querySelectorAll("[data-event-section]")) {
      button.setAttribute("aria-pressed", String(button.dataset.eventSection === next));
    }
    if (render) renderPanel();
  }

  function renderPanel() {
    const event = active();
    if (!event) return;
    const { name, verb, description, states } = panel[section];
    $("#event-panel-heading").textContent = name;
    $("#event-panel-description").textContent = description;
    $("#event-add").textContent = verb;
    $("#event-filters").hidden = section === "brief";
    $("#event-channel-filter").hidden = section !== "message";
    if (section === "brief") {
      panelContent.innerHTML = `<div class="event-brief">${briefFields.map(([key, label]) =>
        `<article><h4>${label}</h4><p>${esc(event.plan.brief[key] || "A definir")}</p></article>`).join("")}</div>`;
      return;
    }
    const all = itemsFor(event, section);
    const shown = all.filter((item) =>
      (!phaseFilter.value || item.phase === phaseFilter.value)
      && (!statusFilter.value || item.status === statusFilter.value)
      && (section !== "message" || !channelFilter.value || item.channel === channelFilter.value));
    const compareTime = (a, b) => String(a.time || "99").localeCompare(String(b.time || "99"));
    shown.sort((a, b) => section === "agenda"
      ? ((a.order ?? 999) - (b.order ?? 999)) || compareTime(a, b)
      : String(a.date || "9999").localeCompare(String(b.date || "9999")) || compareTime(a, b));
    panelContent.innerHTML = shown.length ? `<ul class="event-list">${shown.map((item) => {
      const meta = [stateName(phases, item.phase), stateName(channels, item.channel), stateName(teams, item.team),
        formatDate(item.date), item.time, item.duration ? item.duration + " min" : "", eligibleOwner(item), item.code].filter(Boolean);
      const link = safeUrl(item.url);
      const notes = item.notes || "";
      const stateClass = ["feito", "enviado", "pronto"].includes(item.status) ? " recebido"
        : ["andamento", "revisao", "agendado"].includes(item.status) ? " fechado" : "";
      return `<li class="event-list-item">
        ${section === "agenda" ? `<span class="event-agenda-order">${esc(item.order || "—")}</span>` : ""}
        <div class="event-list-copy">
          <h4>${esc(item.title)}</h4><p>${meta.map(esc).join(" · ")}</p>
          ${link ? `<a class="text-link event-resource" href="${esc(link)}" target="_blank" rel="noopener noreferrer">Abrir link ↗</a>` : ""}
          ${notes ? `<details><summary>${section === "message" ? "Ver copy" : "Ver observações"}</summary><p>${esc(notes)}</p></details>` : ""}
        </div>
        <span class="pill${stateClass}">${esc(stateName(states, item.status) || "Sem status")}</span>
        <button class="button small" type="button" data-event-edit="${esc(item.id)}" aria-label="Editar ${esc(item.title)}">Editar</button>
      </li>`;
    }).join("")}</ul>` : empty(all.length ? "Nenhum item corresponde aos filtros." : "Nenhum item nesta seção.");
  }

  function edit(kind, item) {
    if (!allowed() || saving) return;
    const event = active();
    if (kind !== "new" && !event) return;
    editor = { kind, event, item };
    const fields = $("#event-form-fields");
    const names = { task: "tarefa", message: "mensagem", agenda: "bloco", link: "link" };
    const status = (states) => select("status", "Status", states);
    if (kind === "new" || kind === "brief") {
      $("#event-dialog-heading").textContent = kind === "new" ? "Novo evento" : "Editar planejamento";
      fields.innerHTML = input("title", "Nome do evento", "text", "required maxlength=120")
        + pair(input("event_date", "Data do evento", "date"), status(eventStates))
        + (kind === "new"
          ? select("template", "Começar com", { launch: "Modelo de lançamento", blank: "Evento em branco" })
          : briefFields.map(([key, label]) => area(key, label)).join(""));
    } else {
      $("#event-dialog-heading").textContent = (item ? "Editar " : "Adicionar ") + names[kind];
      const date = input("date", kind === "task" ? "Prazo" : "Data", "date");
      const time = input("time", "Horário", "time");
      const owners = { "": "Sem responsável", ...Object.fromEntries(currentMembers.filter((m) => m.user_id).map((m) => [m.user_id, m.email])) };
      if (item?.owner && !Object.hasOwn(owners, item.owner)) owners[item.owner] = item.ownerLabel || "Participante removido";
      const owner = select("owner", kind === "agenda" ? "Quem conduz" : "Responsável", owners);
      const extra = {
        task: pair(date, select("team", "Área", { "": "Sem área", ...teams })) + owner,
        message: pair(date, time) + pair(select("channel", "Canal", channels), input("code", "Código", "text", "maxlength=40")) + owner,
        agenda: pair(input("order", "Ordem", "number", "required min=1 max=999"), input("duration", "Duração em minutos", "number", "required min=1 max=1440"))
          + pair(time, owner),
        link: owner,
      };
      fields.innerHTML = input("title", kind === "message" ? "Assunto" : "Título", "text", "required maxlength=120")
        + pair(select("phase", "Fase", phases), status(panel[kind].states)) + extra[kind]
        + (kind === "link" || kind === "message" ? input("url", kind === "message" ? "Link da copy ou material" : "Endereço", "url", "maxlength=2000") : "")
        + area("notes", kind === "message" ? "Copy da mensagem" : "Observações");
    }
    const values = kind === "brief" ? { ...event, ...event.plan.brief } : item || {};
    for (const inputField of fields.querySelectorAll("[name]")) {
      const value = values[inputField.name];
      if (value != null) inputField.value = value;
    }
    if (kind === "agenda" && !item) {
      field(form, "phase").value = "evento";
      field(form, "order").value = Math.max(0, ...itemsFor(event, "agenda").map((row) => Number(row.order) || 0)) + 1;
    }
    $("#event-remove-item").hidden = !item;
    formError(form, "");
    dialog.showModal();
    field(form, "title").focus();
  }

  function getEdits() {
    const values = Object.fromEntries(Array.from(new FormData(form), ([key, value]) => [key, value.trim()]));
    if (!values.title) throw new Error("Preencha o título.");
    return values;
  }

  async function saveEvent(payload, event) {
    if (saving || !allowed()) return;
    const generation = accessGeneration;
    const saveButton = $("#event-save");
    const deleteButton = $("#event-remove-item");
    saving = true;
    // Evita que uma atualização iniciada antes da gravação substitua o resultado novo.
    request += 1;
    $("#event-reload").disabled = true;
    saveButton.disabled = true;
    deleteButton.disabled = true;
    formError(form, "");
    try {
      const response = await supabaseRequest(event
        ? eventRoute + "?id=eq." + event.id + "&revision=eq." + event.revision
        : eventRoute, {
        method: event ? "PATCH" : "POST",
        token: await accessToken(),
        representation: true,
        body: event ? { ...payload, revision: event.revision + 1 } : payload,
      });
      if (generation !== accessGeneration || !allowed()) return;
      if (!response?.length) throw new Error("O evento foi atualizado em outra sessão. Copie alterações ainda não salvas, feche esta janela e clique em Atualizar.");
      replaceEvent(response[0]);
      renderPicker(response[0].id);
      if (!event) selectSection("brief", false);
      renderEvent();
      dialog.close();
      setFeedback("");
      notice(event ? "Evento atualizado." : "Evento criado.");
    } catch (error) {
      if (generation !== accessGeneration) return;
      if (error.status === 401) disconnect();
      else formError(form, error.message || "Não foi possível salvar.");
    } finally {
      saving = false;
      saveButton.disabled = false;
      deleteButton.disabled = false;
      $("#event-reload").disabled = false;
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!editor || saving || !allowed()) return;
    try {
      const { kind, event: current, item } = editor;
      const values = getEdits();
      if (kind === "new" || kind === "brief") {
        const plan = kind === "new"
          ? (values.template === "launch" ? templatePlan() : { brief: {}, items: [] })
          : { ...current.plan, brief: Object.fromEntries(briefFields.map(([key]) => [key, values[key]])) };
        saveEvent({ title: values.title, event_date: values.event_date || null, status: values.status, plan }, kind === "new" ? null : current);
        return;
      }
      if (values.url && !safeUrl(values.url)) throw new Error("Informe um endereço válido que comece com http:// ou https://.");
      if (kind === "link" && values.status === "pronto" && !values.url) throw new Error("Preencha o endereço para validar o link.");
      if (kind === "message" && values.status === "agendado" && (!values.date || !values.time)) {
        throw new Error("Preencha data e horário para marcar a mensagem como agendada.");
      }
      if (values.order) values.order = Number(values.order);
      if (values.duration) values.duration = Number(values.duration);
      if (values.owner) values.ownerLabel = eligibleOwner({ owner: values.owner, ownerLabel: item?.ownerLabel });
      const next = { ...values, kind, id: item?.id || makeId() };
      const items = item ? current.plan.items.map((row) => row.id === item.id ? next : row) : [...current.plan.items, next];
      saveEvent({ plan: { ...current.plan, items } }, current);
    } catch (error) {
      formError(form, error.message);
    }
  });

  $("#event-remove-item").addEventListener("click", () => {
    if (!editor?.item || saving || !allowed() || !window.confirm("Excluir este item do planejamento?")) return;
    const { event, item } = editor;
    saveEvent({ plan: { ...event.plan, items: event.plan.items.filter((row) => row.id !== item.id) } }, event);
  });
  dialog.addEventListener("close", () => {
    editor = null;
    $("#event-form-fields").replaceChildren();
  });
  $("#event-new").addEventListener("click", () => edit("new"));
  $("#event-reload").addEventListener("click", () => { if (!saving) fetchEvents(); });
  $("#event-add").addEventListener("click", () => edit(section));
  picker.addEventListener("change", () => { selectSection("brief", false); renderEvent(); });
  $("#event-sections").addEventListener("click", (event) => {
    const button = event.target.closest("[data-event-section]");
    if (button) selectSection(button.dataset.eventSection);
  });
  $("#event-filters").addEventListener("change", renderPanel);
  panelContent.addEventListener("click", (event) => {
    const button = event.target.closest("[data-event-edit]");
    const current = active();
    if (!button || !current) return;
    const item = itemsFor(current, section).find((row) => row.id === button.dataset.eventEdit);
    if (item) edit(section, item);
  });
  document.addEventListener("mutirao:route", (event) => {
    if (event.detail === "eventos" && !saving && !dialog.open) fetchEvents();
  });
  document.addEventListener("mutirao:disconnect", () => {
    request += 1;
    events = [];
    if (dialog.open) dialog.close();
    editor = null;
    picker.replaceChildren(new Option("Selecione um evento", ""));
    for (const id of ["event-current-title", "event-current-status", "event-current-date", "event-overview-metrics", "event-panel-content", "event-form-fields"]) {
      $("#" + id).replaceChildren();
    }
    $("#event-reload").disabled = false;
    $("#event-workspace").hidden = true;
    setFeedback("");
    selectSection("brief", false);
  });
  selectSection("brief", false);
})();
