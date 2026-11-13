(() => {
  const phases = { captura: "Captação", aquecimento: "Aquecimento", evento: "Evento", vendas: "Vendas", pos: "Pós-evento" };
  const channels = { grupos: "WhatsApp · grupos", privado: "WhatsApp · privado", instagram: "Instagram · privado", email: "E-mail", outro: "Outro" };
  const eventStates = { planejado: "Planejado", em_andamento: "Em andamento", concluido: "Concluído", arquivado: "Arquivado" };
  const progress = { pendente: "Pendente", andamento: "Em andamento", feito: "Concluído" };
  const messageStates = { rascunho: "Rascunho", revisao: "Em revisão", pronto: "Pronto para enviar", agendado: "Agendado", enviado: "Enviado", cancelado: "Cancelado" };
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
  const closeEditor = $("[data-close='event-dialog']", dialog);
  const gallery = $("#event-gallery");
  const galleryHeading = $("#event-gallery-heading");
  const galleryGrid = $("#event-gallery-grid");
  const galleryBack = $("#event-gallery-back");
  const loading = $("#event-loading");
  const feedback = $("#event-feedback");
  const panelContent = $("#event-panel-content");
  const phaseFilter = $("#event-filter-phase");
  const statusFilter = $("#event-filter-status");
  const channelFilter = $("#event-filter-channel");
  const eventRoute = "/rest/v1/mutirao_mentoria_events";
  let events = [];
  let selectedEventId = null;
  let section = "brief";
  let editor = null;
  let request = 0;
  let saving = false;

  const allowed = () => ready && !!session && (accessRole === "member" || accessRole === "admin");
  const active = () => events.find((event) => event.id === selectedEventId);
  const itemsFor = (event, kind) => (event.plan.items || []).filter((item) => item?.kind === kind);
  const taskProgress = (event) => {
    const tasks = itemsFor(event, "task");
    return { done: tasks.filter((item) => item.status === "feito").length, total: tasks.length };
  };
  const input = (name, label, type = "text", limits = "") =>
    `<label>${label}<input name="${name}" type="${type}" ${limits}></label>`;
  const area = (name, label) => `<label>${label}<textarea name="${name}" rows="3" maxlength="5000"></textarea></label>`;
  const options = (values) => Object.entries(values).map(([value, label]) =>
    `<option value="${esc(value)}">${esc(label)}</option>`).join("");
  const select = (name, label, values) => `<label>${label}<select name="${name}">${options(values)}</select></label>`;
  const pair = (...fields) => `<div class="event-field-pair">${fields.join("")}</div>`;
  const setFeedback = (text) => { feedback.textContent = text; feedback.hidden = !text; };
  const replaceEvent = (saved) => {
    const index = events.findIndex(({ id }) => id === saved.id);
    if (index === -1) events.unshift(saved);
    else events[index] = saved;
  };
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

  function templatePlan(eventDate) {
    const item = (kind, title, phase, fields = {}) => ({
      id: makeId(), kind, title, phase, status: Object.keys(panel[kind].states)[0], ...fields,
    });
    const eventDay = isDate(eventDate) ? Date.parse(eventDate) : NaN;
    const dateAt = (offset) => {
      if (!Number.isFinite(eventDay)) return "";
      const date = new Date(eventDay + offset * DAY).toISOString().split("T")[0];
      return isDate(date) ? date : "";
    };
    const tasks = [
      ["Definir objetivo, metas, narrativa e oferta", "captura", "estrategia", -12],
      ["Criar identidade visual, peças e materiais", "captura", "design", -11],
      ["Publicar páginas de captura e obrigado", "captura", "dev", -10],
      ["Preparar grupos, segmentação e pesquisa", "captura", "comercial", -10],
      ["Revisar e aprovar copies de grupos e privado", "captura", "copy", -10],
      ["Conferir inscrições e respostas da pesquisa", "aquecimento", "estrategia", -2],
      ["Ensaiar o roteiro e testar transmissão, áudio e gravação", "evento", "video", -1],
      ["Testar página de vendas, checkouts e opções de pagamento", "vendas", "dev", -1],
      ["Acompanhar chat, presença e dúvidas ao vivo", "evento", "comercial", 0],
      ["Publicar replay e enviar devolutiva", "pos", "video", 1],
      ["Fazer follow-up e recuperar pagamentos pendentes", "vendas", "comercial", 1],
      ["Consolidar resultados e aprendizados", "pos", "estrategia", 12],
    ].map(([title, phase, team, offset]) => item("task", title, phase, { team, date: dateAt(offset) }));

    const groupMessages = [
      ["Convite inicial", "captura", -9, "18:00", "Oi! No dia [data], vou mostrar como [benefício]. Garanta sua vaga em [link da inscrição]."],
      ["Para quem é o evento", "captura", -8, "12:00", "Se você quer [objetivo] e trava em [dificuldade], este encontro foi feito para você. Inscreva-se em [link]."],
      ["Antes e depois", "captura", -7, "12:00", "O que muda quando você [ação]? Vou comparar os dois caminhos com um exemplo ao vivo. Inscreva-se em [link]."],
      ["Dúvida frequente", "captura", -6, "12:00", "Muita gente me pergunta [dúvida]. No encontro, vou mostrar como resolver isso. Reserve sua vaga em [link]."],
      ["Bastidores dos materiais", "captura", -5, "12:00", "Olha o que estou preparando para o encontro: [material]. Você vai usá-lo para [ação]. Inscreva-se em [link]."],
      ["O que vamos aprender", "captura", -3, "12:00", "Vamos passar por [tema 1], [tema 2] e [tema 3]. Venha com uma dúvida para aplicar no seu caso. Inscrições em [link]."],
      ["Prévia de um exemplo", "captura", -2, "12:00", "Já reparou em [exemplo]? Vou abrir o passo a passo ao vivo. Participe em [link da inscrição]."],
      ["Amanhã é o evento", "captura", -1, "12:00", "Amanhã, às [hora], começa [evento]. Se ainda precisa se inscrever, use [link]."],
      ["Inscrições no dia do evento", "captura", 0, "12:00", "É hoje! [Evento] começa às [hora]. Sua inscrição é feita em [link]."],
      ["Última chamada para inscrições", "captura", 0, "18:00", "Começamos às [hora]. Se ainda quiser participar, faça sua inscrição em [link]."],
      ["Boas-vindas ao grupo do evento", "aquecimento", -3, "12:00", "Bem-vinda ao grupo de [evento]! Salve [data e hora] e conte pra gente qual é sua maior dúvida sobre [tema]."],
      ["Faltam dois dias", "aquecimento", -2, "12:00", "Faltam dois dias para [evento]. Conte como podemos ajudar respondendo à pesquisa em [link]."],
      ["Lembrete da véspera", "aquecimento", -1, "12:00", "Nosso encontro é amanhã às [hora]. Deixe o link [transmissão] salvo para entrar na hora."],
      ["Áudio de boas-vindas", "evento", 0, "12:00", "Grave um áudio curto com a promessa do encontro, o horário e o que levar. Envie [link da transmissão] na mesma mensagem."],
      ["Faltam algumas horas", "evento", 0, "16:00", "Nos vemos em algumas horas. Separe [material] para acompanhar a prática e entre por [link]."],
      ["Bastidores e aviso de 30 minutos", "evento", 0, "19:30", "Mostre em um vídeo curto o que já está pronto. Inclua a chamada: começamos em 30 minutos. Entre em [link]."],
      ["Sala aberta", "evento", 0, "19:55", "A sala está aberta. Entre em [link] e diga no chat de onde você está acompanhando."],
      ["Transmissão ao vivo", "evento", 0, "20:05", "Já estamos ao vivo! Entre em [link] para acompanhar [tópico em andamento]."],
      ["Convite para entrar durante a live", "evento", 0, "20:20", "Ainda dá tempo de ver [bloco]. Já estamos mostrando [exemplo]. Entre em [link]."],
      ["Oferta e abertura das vendas", "vendas", 0, "21:00", "As inscrições para [oferta] abriram. Você recebe [entregáveis]. Confira o valor e as condições em [link]."],
      ["Bônus e garantia", "vendas", 0, "22:30", "Para quem entrar até [prazo], [bônus aprovado]. As condições de garantia estão em [link]."],
      ["Enquete sobre matrícula", "vendas", 1, "12:00", "Você conseguiu concluir a matrícula? Responda: já concluí, tenho dúvidas ou preciso de ajuda com o pagamento."],
      ["Opções de pagamento", "vendas", 1, "15:00", "Se você precisa de outra forma de pagamento, confira as opções em [link] ou fale com [contato]."],
      ["Replay e próximo passo", "pos", 1, "18:00", "O replay está em [link] até [prazo]. Para colocar em prática com [oferta], veja [página de vendas]."],
      ["Dúvidas antes do encerramento", "vendas", 2, "12:00", "As inscrições ficam abertas até [data e hora]. Qual dúvida você quer esclarecer antes de decidir?"],
      ["Lembrete de condição de pagamento", "vendas", 4, "12:00", "A condição [condição aprovada] vai até [prazo]. Se precisar de suporte para concluir, chame [contato]."],
      ["Últimas horas para entrar", "vendas", 4, "18:00", "As inscrições encerram às [hora]. Se já decidiu participar, finalize em [link]."],
    ];
    const privateMessages = [
      ["Reativar contato", "captura", -7, "", "Oi, [nome]. Lembrei de você porque vamos falar de [tema]. Quer que eu te mande o link do encontro?"],
      ["Apresentar entregáveis", "captura", -3, "", "Oi, [nome]. No encontro você vai sair com [material] para [ação]. Ainda faz sentido para você?"],
      ["Última chamada no privado", "captura", 0, "", "Oi, [nome]. Passando porque o encontro é hoje às [hora]. Se quiser participar, aqui está [link]."],
      ["Abertura e condições de pagamento", "vendas", 0, "22:00", "Oi, [nome]. As inscrições para [oferta] abriram. Quer ajuda para entender as condições de pagamento?"],
      ["Enviar replay", "pos", 1, "15:00", "Oi, [nome]. Aqui está o replay [link]. No trecho [minutagem] falamos sobre [dúvida da pessoa]."],
      ["Ajudar com pagamento pendente", "vendas", 4, "12:00", "Oi, [nome]. Você conseguiu concluir a inscrição? Posso te ajudar com [etapa pendente]."],
      ["Último contato sobre a turma", "pos", 11, "12:00", "Oi, [nome]. Estou fechando o acompanhamento desta turma. Você quer que eu te avise sobre uma próxima edição?"],
    ];
    const messagesFor = (entries, channel, prefix) => entries.map(([title, phase, offset, time, notes], index) =>
      item("message", title, phase, {
        channel, date: dateAt(offset), time, notes,
        code: prefix + "-" + String(index + 1).padStart(2, "0"),
      }));

    const agenda = [
      ["Abertura e boas-vindas", 5, "Apresente a equipe, confirme a duração e oriente o uso do chat."],
      ["Contexto e promessa do encontro", 5, "Mostre o problema que será resolvido e o que o público vai conseguir fazer."],
      ["Conteúdo principal", 20, "Apresente o passo a passo e conecte os pontos com exemplos do público."],
      ["Demonstração ou prática", 15, "Mostre uma aplicação e reserve tempo para o público testar."],
      ["Apresentação da oferta", 10, "Explique entregáveis, investimento, bônus, garantia e prazo."],
      ["Perguntas e respostas", 10, "Responda às dúvidas da transmissão e repita o próximo passo."],
      ["Encerramento e próximos passos", 5, "Informe como acessar o replay ou a oferta e onde pedir suporte."],
    ].map(([title, duration, notes], index) => item("agenda", title, "evento", { order: index + 1, duration, notes }));

    const links = [
      ["Página de captura", "captura", "Valide inscrição, integração e redirecionamento no celular."],
      ["Página de obrigado", "captura", "Confirme a inscrição e mostre como entrar no grupo."],
      ["Grupo do evento no WhatsApp", "aquecimento", "Confira o convite, a descrição e as permissões do grupo."],
      ["Pesquisa com inscritos", "aquecimento", "Teste o formulário e a gravação das respostas."],
      ["WhatsApp comercial", "aquecimento", "Teste o contato e a mensagem inicial de atendimento."],
      ["Transmissão", "evento", "Confira o acesso de participantes e os recursos do anfitrião."],
      ["Página de vendas", "vendas", "Revise preço, prazos, bônus, garantia e botões de compra."],
      ["Checkout à vista", "vendas", "Confira produto, valor e meios de pagamento."],
      ["Boleto de entrada", "vendas", "Preencha se houver essa modalidade na oferta."],
      ["Boleto do saldo", "vendas", "Confira valor restante e condições de vencimento."],
      ["Checkout de upgrade de 6 meses", "vendas", "Preencha se a oferta incluir essa opção."],
      ["Checkout de upgrade de 1 ano", "vendas", "Preencha se a oferta incluir essa opção."],
      ["Replay", "pos", "Teste o acesso e confirme a data de retirada."],
    ].map(([title, phase, notes]) => item("link", title, phase, { notes }));

    return {
      brief: {
        logistics: "Formato: [online, presencial ou híbrido]. Horário e fuso: [a definir]. Local ou plataforma: [a definir].",
        goal: "Objetivo do encontro: [resultado esperado]. Metas: [inscrições], [presença], [conversão] e [receita].",
        audience: "Público prioritário: [perfil e problema]. Lista VIP: [critérios e canal]. Contatos antigos: [segmentos para reativação].",
        narrative: "Problema: [dor do público]. Promessa: [transformação]. Provas e exemplos: [materiais aprovados].",
        offer: "Oferta: [nome e entregáveis]. Investimento: [valor e condições]. Bônus: [itens e validade]. Garantia: [regras aprovadas].",
        identity: "Identidade visual: [referências]. Materiais: [páginas, peças de divulgação, slides e vídeos].",
        followup: "Inscrições até [data e hora]. Replay até [data]. Atendimento em [canal]. Follow-up para [segmentos e prazos].",
      },
      items: [...tasks, ...messagesFor(groupMessages, "grupos", "GRUPO"),
        ...messagesFor(privateMessages, "privado", "PRIVADO"), ...agenda, ...links],
    };
  }

  function renderGallery() {
    const focusedId = document.activeElement?.dataset.eventOpen;
    $("#event-empty").hidden = events.length > 0;
    galleryGrid.innerHTML = events.map((event) => {
      const { done, total } = taskProgress(event);
      const percentage = total ? Math.round(100 * done / total) : 0;
      const status = stateName(eventStates, event.status);
      const id = esc(event.id);
      return `<article class="event-card">
        <button type="button" class="event-card-body" data-event-open="${id}">
        <span class="event-card-meta"><span class="pill" data-status="${status ? esc(event.status) : ""}">${esc(status)}</span><span>${formatDate(event.event_date) || "Data a definir"}</span></span>
        <strong class="event-card-title">${esc(event.title)}</strong>
        <span class="event-card-progress">${total ? `${done} de ${total} ${total === 1 ? "tarefa concluída" : "tarefas concluídas"}` : "Sem tarefas"}
          <span class="event-card-track" aria-hidden="true"><span style="width:${percentage}%"></span></span>
        </span>
        <span class="event-card-link">Abrir planejamento <span aria-hidden="true">→</span></span>
        </button>
        <div class="event-card-actions" role="group" aria-label="Ações para ${esc(event.title)}">
          <button type="button" class="button small" data-event-manage="rename" data-id="${id}">Renomear</button>
          <button type="button" class="button small" data-event-manage="duplicate" data-id="${id}">Duplicar</button>
          <button type="button" class="button small danger" data-event-manage="delete" data-id="${id}">Apagar</button>
        </div>
      </article>`;
    }).join("");
    if (focusedId) focusEventCard(focusedId);
  }

  function focusEventCard(id) {
    const card = Array.from(galleryGrid.querySelectorAll("[data-event-open]")).find((button) => button.dataset.eventOpen === id);
    (card || galleryHeading).focus();
  }

  async function fetchEvents() {
    if (!allowed()) return;
    const operation = ++request;
    const generation = accessGeneration;
    const reload = $("#event-reload");
    reload.disabled = true;
    setFeedback("");
    loading.hidden = events.length > 0;
    if (!loading.hidden) $("#event-empty").hidden = true;
    try {
      const result = await supabaseRequest(
        eventRoute + "?select=id,title,event_date,status,revision,plan&order=created_at.desc",
        { token: await accessToken() },
      );
      if (operation !== request || generation !== accessGeneration || !allowed()) return;
      events = result;
      if (!active()) selectedEventId = null;
      renderGallery();
      renderEvent();
    } catch (error) {
      if (operation !== request || generation !== accessGeneration) return;
      setFeedback("Não foi possível carregar os eventos. Tente atualizar.");
      if (error.status === 401) disconnect();
    } finally {
      if (operation === request) {
        reload.disabled = false;
        loading.hidden = true;
      }
    }
  }

  function renderEvent() {
    const event = active();
    gallery.hidden = !!event;
    galleryHeading.hidden = !!event;
    galleryBack.hidden = !event;
    $("#event-workspace").hidden = !event;
    if (!event) return;
    $("#event-current-title").textContent = event.title;
    $("#event-current-status").textContent = stateName(eventStates, event.status);
    $("#event-current-date").textContent = formatDate(event.event_date) || "Data a definir";
    const { done, total } = taskProgress(event);
    const messages = itemsFor(event, "message");
    const links = itemsFor(event, "link");
    const duration = itemsFor(event, "agenda").reduce((sum, item) => sum + (Number(item.duration) || 0), 0);
    $("#event-overview-metrics").innerHTML = [
      [done + "/" + total, "Tarefas concluídas"],
      [messages.filter((item) => item.status === "enviado").length + "/" + messages.length, "Mensagens enviadas"],
      [duration + " min", "Duração do roteiro"],
      [links.filter((item) => item.status === "pronto").length + "/" + links.length, "Links validados"],
    ].map(([value, label]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join("");
    renderPanel();
  }

  function openEvent(id) {
    selectedEventId = id;
    selectSection("brief", false);
    renderEvent();
    galleryBack.focus();
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
      const completed = item.status === "feito" || item.status === "enviado" || (section === "link" && item.status === "pronto");
      const stateClass = completed ? " recebido"
        : ["andamento", "revisao", "agendado", "pronto"].includes(item.status) ? " fechado" : "";
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
    const managing = ["rename", "duplicate", "delete"].includes(kind);
    const event = managing ? item : active();
    if (kind !== "new" && !event) return;
    editor = { kind, event, item: managing ? null : item };
    const fields = $("#event-form-fields");
    const names = { task: "tarefa", message: "mensagem", agenda: "bloco", link: "link" };
    const status = (states) => select("status", "Status", states);
    if (managing) {
      const titles = { rename: "Renomear evento", duplicate: "Duplicar evento", delete: "Apagar evento" };
      $("#event-dialog-heading").textContent = titles[kind];
      fields.innerHTML = kind === "delete"
        ? `<p>Apagar <strong>${esc(event.title)}</strong> e todo o seu planejamento? Essa ação é definitiva.</p>`
        : input("title", "Nome do evento", "text", "required maxlength=120");
      if (kind === "rename") field(form, "title").value = event.title;
      if (kind === "duplicate") field(form, "title").value = event.title.slice(0, 112).trimEnd() + " (cópia)";
    } else if (kind === "new" || kind === "brief") {
      $("#event-dialog-heading").textContent = kind === "new" ? "Novo evento" : "Editar planejamento";
      fields.innerHTML = input("title", "Nome do evento", "text", "required maxlength=120")
        + pair(input("event_date", "Data do evento", "date"), status(eventStates))
        + (kind === "new"
          ? select("template", "Começar com", { launch: "Modelo de lançamento", blank: "Evento em branco" })
            + '<p class="event-template-hint">No modelo de lançamento, a data informada ao criar o evento preenche as datas sugeridas de tarefas e mensagens.</p>'
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
    $("#event-remove-item").hidden = !editor.item;
    const saveButton = $("#event-save");
    saveButton.textContent = { rename: "Renomear", duplicate: "Duplicar", delete: "Apagar evento" }[kind] || "Salvar";
    saveButton.classList.toggle("danger", kind === "delete");
    saveButton.classList.toggle("primary", kind !== "delete");
    formError(form, "");
    dialog.showModal();
    (field(form, "title") || closeEditor).focus();
  }

  function getEdits() {
    const values = Object.fromEntries(Array.from(new FormData(form), ([key, value]) => [key, value.trim()]));
    if (!values.title) throw new Error("Preencha o título.");
    return values;
  }

  async function saveEvent(payload, event) {
    if (saving || !allowed()) return;
    const { kind } = editor;
    const generation = accessGeneration;
    const saveButton = $("#event-save");
    const deleteButton = $("#event-remove-item");
    saving = true;
    // Evita que uma atualização iniciada antes da gravação substitua o resultado novo.
    request += 1;
    loading.hidden = true;
    $("#event-reload").disabled = true;
    saveButton.disabled = true;
    deleteButton.disabled = true;
    closeEditor.disabled = true;
    formError(form, "");
    const deleting = kind === "delete";
    try {
      const response = await supabaseRequest(event
        ? eventRoute + "?id=eq." + event.id + "&revision=eq." + event.revision + (deleting ? "&select=id" : "")
        : eventRoute, {
        method: deleting ? "DELETE" : event ? "PATCH" : "POST",
        token: await accessToken(),
        representation: true,
        body: deleting ? undefined : event ? { ...payload, revision: event.revision + 1 } : payload,
      });
      if (generation !== accessGeneration || !allowed()) return;
      if (!response?.length) throw new Error("O evento foi atualizado em outra sessão. Copie alterações ainda não salvas, feche esta janela e clique em Atualizar.");
      if (deleting) events = events.filter(({ id }) => id !== event.id);
      else replaceEvent(response[0]);
      renderGallery();
      dialog.close();
      if (kind === "new") openEvent(response[0].id);
      else {
        renderEvent();
        if (kind === "rename" || kind === "duplicate" || deleting) focusEventCard(response[0].id);
      }
      setFeedback("");
      const messages = { new: "Evento criado.", rename: "Evento renomeado.", duplicate: "Evento duplicado.", delete: "Evento apagado." };
      notice(messages[kind] || "Evento atualizado.");
    } catch (error) {
      if (generation !== accessGeneration) return;
      if (error.status === 401) disconnect();
      else formError(form, error.message || "Não foi possível salvar.");
    } finally {
      saving = false;
      saveButton.disabled = false;
      deleteButton.disabled = false;
      closeEditor.disabled = false;
      $("#event-reload").disabled = false;
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!editor || saving || !allowed()) return;
    try {
      const { kind, event: current, item } = editor;
      if (kind === "delete") {
        saveEvent(undefined, current);
        return;
      }
      const values = getEdits();
      if (kind === "rename") {
        saveEvent({ title: values.title }, current);
        return;
      }
      if (kind === "duplicate") {
        saveEvent({ title: values.title, event_date: current.event_date, status: current.status, plan: current.plan }, null);
        return;
      }
      if (kind === "new" || kind === "brief") {
        const plan = kind === "new"
          ? (values.template === "launch" ? templatePlan(values.event_date) : { brief: {}, items: [] })
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
  dialog.addEventListener("cancel", (event) => {
    if (saving) event.preventDefault();
  });
  dialog.addEventListener("close", () => {
    editor = null;
    $("#event-form-fields").replaceChildren();
  });
  $("#event-new").addEventListener("click", () => edit("new"));
  $("#event-reload").addEventListener("click", () => { if (!saving) fetchEvents(); });
  $("#event-add").addEventListener("click", () => edit(section));
  galleryGrid.addEventListener("click", (event) => {
    if (!allowed() || saving) return;
    const action = event.target.closest("[data-event-manage]");
    if (action) {
      const selected = events.find(({ id }) => id === action.dataset.id);
      if (selected) edit(action.dataset.eventManage, selected);
      return;
    }
    const card = event.target.closest("[data-event-open]");
    if (card) openEvent(card.dataset.eventOpen);
  });
  galleryBack.addEventListener("click", () => {
    const previousId = selectedEventId;
    selectedEventId = null;
    renderEvent();
    focusEventCard(previousId);
  });
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
    if (event.detail === "eventos") {
      if (!saving && !dialog.open) fetchEvents();
    } else if (selectedEventId) {
      selectedEventId = null;
      renderEvent();
    }
  });
  document.addEventListener("mutirao:disconnect", () => {
    request += 1;
    events = [];
    selectedEventId = null;
    if (dialog.open) dialog.close();
    editor = null;
    galleryGrid.replaceChildren();
    for (const id of ["event-current-title", "event-current-status", "event-current-date", "event-overview-metrics", "event-panel-content", "event-form-fields"]) {
      $("#" + id).replaceChildren();
    }
    $("#event-reload").disabled = false;
    $("#event-empty").hidden = true;
    loading.hidden = true;
    setFeedback("");
    selectSection("brief", false);
    renderEvent();
  });
  selectSection("brief", false);
})();
