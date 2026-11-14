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
  const copyReferenceRoute = "/rest/v1/mutirao_mentoria_event_copy_references?select=template_code,source_code,source_url";
  let events = [];
  let copyReferences = new Map();
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

    const messages = messageTemplates(eventDate).map(({ title, phase, offset, ...fields }) =>
      item("message", title, phase, { ...fields, date: dateAt(offset) }));

    const agenda = [
      ["Abertura e boas-vindas", 5, "Apresente a equipe, confirme a duração e oriente o uso do chat."],
      ["Contexto e promessa do encontro", 5, "Mostre o problema que será resolvido e o que o público vai conseguir fazer."],
      ["Conteúdo principal", 20, "Apresente o passo a passo e conecte os pontos com exemplos do público."],
      ["Demonstração ou prática", 15, "Mostre uma aplicação e reserve tempo para o público testar."],
      ["Apresentação da oferta", 10, "Explique entregáveis, investimento, bônus, garantia e prazo."],
      ["Perguntas e respostas", 10, "Responda às dúvidas da transmissão e repita o próximo passo."],
      ["Encerramento e próximos passos", 5, "Informe como acessar o replay ou a oferta e onde pedir suporte."],
    ].map(([title, duration, notes], index) => item("agenda", title, "evento", {
      order: index + 1, date: eventDate, duration, notes,
    }));

    const links = [
      ["Página de captura", "captura", -10, "Valide inscrição, integração e redirecionamento no celular."],
      ["Página de obrigado", "captura", -10, "Confirme a inscrição e mostre como entrar no grupo."],
      ["Grupo do evento no WhatsApp", "aquecimento", -10, "Confira o convite, a descrição e as permissões do grupo."],
      ["Pesquisa com inscritos", "aquecimento", -3, "Teste o formulário e a gravação das respostas."],
      ["WhatsApp comercial", "aquecimento", -3, "Teste o contato e a mensagem inicial de atendimento."],
      ["Transmissão", "evento", -1, "Confira o acesso de participantes e os recursos do anfitrião."],
      ["Página de vendas", "vendas", -1, "Revise preço, prazos, bônus, garantia e botões de compra."],
      ["Checkout à vista", "vendas", -1, "Confira produto, valor e meios de pagamento."],
      ["Boleto de entrada", "vendas", -1, "Preencha se houver essa modalidade na oferta."],
      ["Boleto do saldo", "vendas", -1, "Confira valor restante e condições de vencimento."],
      ["Checkout de upgrade de 6 meses", "vendas", -1, "Preencha se a oferta incluir essa opção."],
      ["Checkout de upgrade de 1 ano", "vendas", -1, "Preencha se a oferta incluir essa opção."],
      ["Replay", "pos", 1, "Teste o acesso e confirme a data de retirada."],
    ].map(([title, phase, offset, notes]) => item("link", title, phase, { date: dateAt(offset), notes }));

    return {
      brief: {
        logistics: "Formato: [online, presencial ou híbrido]. Horário e fuso: [a definir]. Local ou plataforma: [a definir].",
        goal: "Objetivo do encontro: [resultado esperado]. Metas: [inscrições], [presença], [conversão] e [receita].",
        audience: "Público prioritário: [perfil e problema]. Lista VIP: [critérios e canal]. Contatos antigos: [segmentos para reativação].",
        narrative: "Problema: [dor do público]. Promessa: [transformação]. Provas e exemplos: [materiais aprovados].",
        offer: "Oferta: [nome e entregáveis]. Investimento: [valor e condições]. Bônus: [itens e validade]. Garantia: [regras aprovadas].",
        identity: "Identidade visual: [referências]. Materiais: [páginas, peças de divulgação, slides e vídeos].",
        followup: "Inscrições até [data e hora]. Replay até [data]. Nas mensagens de venda em grupo, convide para conversar no privado. Informe valores, formas de pagamento e checkout no atendimento individual.",
      },
      items: [...tasks, ...messages, ...agenda, ...links],
    };
  }

  function messageTemplates(eventDate) {
    const launchDate = formatDate(eventDate) || "[data do evento]";
    const groupMessages = [
      ["Convite inicial", "captura", -9, "18:00", `O que muda no seu trabalho quando [mudança do mercado] vira rotina? Quero te mostrar como se preparar e onde existe espaço para cobrar pela sua estratégia.\n\nNo dia ${launchDate}, às [hora do evento], vou abrir esse plano ao vivo em [evento]. No grupo VIP você recebe [materiais VIP] e o link de acesso. Entre aqui: [link do grupo VIP].`],
      ["Da execução à estratégia", "captura", -8, "12:00", `Se o cliente só te procura para executar, o seu trabalho acaba sendo comparado pelo preço. Em [evento], vou mostrar como sair desse lugar e assumir as decisões que dão direção ao projeto.\n\nÉ dia ${launchDate}, às [hora do evento]. No grupo você recebe [materiais VIP] e o acesso à aula: [link do grupo VIP].`],
      ["Quando o cliente pede só um post", "captura", -7, "12:00", "O cliente pede um post para hoje. Qual seria sua primeira resposta?\nA) Faço e mando.\nB) Pergunto o que ele quer alcançar e proponho o melhor formato.\n\nDaqui a uma semana vou mostrar como transformar essa segunda resposta em uma entrega que o cliente valoriza. Entre no grupo: [link do grupo VIP]."],
      ["Volume de clientes ou valor por projeto", "captura", -6, "12:00", `Dois profissionais podem ter o mesmo faturamento com rotinas completamente diferentes. Um atende muitos clientes com pedidos pequenos. O outro conduz poucos projetos com mais impacto. Qual parte da sua entrega hoje sustenta o preço que você quer cobrar?\n\nVou abrir essa conversa em [evento], dia ${launchDate}. Entre no grupo: [link do grupo VIP].`],
      ["Bastidores dos materiais", "captura", -5, "12:00", "Estou preparando [material VIP] e encontrei [oportunidade ou exemplo] que vale compartilhar. A ideia é você sair da aula com algo para aplicar em [ação concreta].\n\nO material e o acesso serão enviados pelo grupo: [link do grupo VIP]."],
      ["Quando estudar mais já não resolve", "captura", -3, "12:00", `Você já tem aulas salvas e anotações suficientes. Qual decisão ainda falta tomar para mudar [problema do público]? Em [evento], vou propor um ponto de partida e mostrar como usar [material VIP].\n\nReserve ${launchDate}, às [hora do evento]. Entre no grupo: [link do grupo VIP].`],
      ["Quando o pacote vira uma lista sem fim", "captura", -2, "12:00", "O pacote começou com posts. Vieram Stories, Reels, directs e até suporte ao tráfego. O preço continuou igual. Se isso te soa familiar, faltam dois dias para a aula em que vou mostrar como organizar e defender o escopo.\n\nEntre no grupo para receber o acesso: [link do grupo VIP]."],
      ["Amanhã é o evento", "captura", -1, "12:00", "Amanhã, às [hora do evento], vamos trabalhar [tema] ao vivo. Quem já está no grupo recebe [materiais VIP] e o link da sala. Se falta confirmar sua participação, entre por aqui: [link do grupo VIP]."],
      ["Inscrições no dia do evento", "captura", 0, "12:00", "O encontro é hoje, às [hora do evento]. Vou mostrar [caso real] e como aplicar [aprendizado] no seu trabalho. Separei [materiais VIP] para quem acompanhar.\n\nO acesso à sala sai pelo grupo: [link do grupo VIP]."],
      ["Última chamada para inscrições", "captura", 0, "18:00", "A aula começa hoje às [hora do evento]. Se você quer acompanhar [resultado da aula], entre no grupo antes de começarmos. Vou enviar o acesso por lá: [link do grupo VIP]."],
      ["Boas-vindas e enquete do grupo VIP", "aquecimento", -3, "12:00", `Que bom ter você no grupo de [evento]! Reserve ${launchDate}, às [hora do evento]. Quero entender quem vai estar na aula. Em qual momento você está hoje?\n\n• Começando na área\n• Atendendo clientes por conta própria\n• Coordenando uma equipe ou agência\n• Migrando de outra área do marketing`],
      ["Faltam dois dias", "aquecimento", -2, "12:00", "Daqui a dois dias a gente se encontra! Estou terminando [material VIP] e separei [exemplo] para mostrar na aula. Bloqueie o horário de [hora do evento] e traga uma pergunta sobre [tema]."],
      ["Lembrete da véspera", "aquecimento", -1, "12:00", "Amanhã, às [hora do evento], a gente vai trabalhar [promessa do evento]. Separe um caderno, bloqueie o horário na agenda e ative as notificações do grupo. O acesso à aula vai aparecer por aqui."],
      ["Áudio e mensagem no dia do evento", "evento", 0, "12:00", "Áudio curto\nOi, pessoal! Estou fechando os últimos detalhes da aula de hoje. Separei um exemplo de [mudança que você testou] e vou mostrar como usar isso para [resultado]. Venham com uma pergunta e espaço para anotar. A gente se encontra às [hora do evento].\n\nMensagem para enviar depois do áudio\nHoje tem aula! Deixe o horário de [hora do evento] livre, separe o material para anotar e acompanhe o grupo para pegar o acesso."],
      ["Faltam algumas horas", "evento", 0, "16:00", "Já já a gente se encontra. Agenda livre? Material à mão? Notificações do grupo ligadas? Às [hora do evento], mando por aqui o acesso para você acompanhar [atividade da aula]."],
      ["Bastidores e aviso de 30 minutos", "evento", 0, "19:30", "Grave um vídeo curto mostrando o ambiente e [material VIP] antes de enviar.\n\nA equipe já está com tudo pronto por aqui. Em 30 minutos, começamos [evento] e vou mostrar [o que será apresentado]. Te vejo na sala!"],
      ["Sala aberta", "evento", 0, "19:55", "Pode entrar, a sala está aberta: [link da transmissão]. Chegue agora para acompanhar a primeira parte e mande um oi no chat."],
      ["Transmissão ao vivo", "evento", 0, "20:05", "A aula já começou. Estamos falando de [tópico em andamento] e ainda dá para pegar o exemplo completo. Entre aqui: [link da transmissão]."],
      ["Convite para entrar durante a live", "evento", 0, "20:20", "Ainda estamos ao vivo e a próxima parte mostra [demonstração ou próximo bloco]. Se você se atrasou, entre agora para acompanhar: [link da transmissão]."],
      ["Oferta e abertura das vendas", "vendas", 0, "21:00", "As vagas para [oferta] estão abertas. É para quem [perfil] e quer alcançar [resultado aprovado].\n\nO programa inclui [entregáveis] e, nesta edição, [bônus aprovados]. A garantia funciona conforme [condições da garantia].\n\nTemos [vagas disponíveis]. Se quiser saber como participar, me chama no privado."],
      ["Bônus e garantia", "vendas", 0, "22:30", "Se você ficou com dúvidas depois da apresentação, vale olhar dois pontos: [garantia e critérios] e [bônus ou prioridade à vista]. Quer saber quais condições de entrada se aplicam ao seu caso? Me chama no privado que eu te explico."],
      ["Enquete sobre matrícula", "vendas", 1, "12:00", "Em que ponto você está com [oferta]?\n\n• Já confirmei minha vaga\n• Ainda estou decidindo\n• Quero entender a condição de entrada\n• Tenho uma dúvida sobre o programa\n\nSe precisar de ajuda, me manda uma mensagem no privado."],
      ["Opções de pagamento", "vendas", 1, "15:00", "Se o cartão está travando sua decisão, vale conversar sobre [alternativa de pagamento aprovada]. Posso explicar como funciona a entrada, quando vence o saldo e quais são os critérios. Me chama no privado."],
      ["Replay e próximo passo", "pos", 1, "18:00", "Se o replay for liberado, confirme o prazo antes de enviar.\n\nA gravação de [evento] está disponível até [prazo do replay]: [link do replay]. Assista e veja como aplicar [aprendizado]. Se quiser conversar sobre [oferta], me chama no privado."],
      ["Vagas restantes e prioridade à vista", "vendas", 2, "12:00", "Agora restam [vagas disponíveis] para [oferta]. Para quem escolher o pagamento à vista, [prioridade ou benefício aprovado]. Se quiser saber como entrar e quando começa, me chama no privado."],
      ["Lembrete de condição de pagamento", "vendas", 4, "12:00", "O prazo para entrar em [oferta] é [data e hora do encerramento]. Se sua dúvida é como pagar, ainda dá para conversar sobre [alternativa aprovada]. Me chama no privado que eu te explico."],
      ["Últimas horas para entrar", "vendas", 4, "18:00", "As inscrições de [oferta] fecham às [hora do encerramento]. Se você quer chegar a [resultado aprovado] e ainda precisa esclarecer algo para decidir, me chama no privado até esse horário."],
    ];
    const privateMessages = [
      ["Reativar contato", "captura", -7, "", `Oi, [nome]! Você tinha me contado que queria [interesse anterior]. Lembrei disso ao preparar [evento], porque vou mostrar [aprendizado] ao vivo no dia ${launchDate}, às [hora do evento]. No grupo você já recebe [materiais VIP] e o acesso à aula: [link do grupo VIP]. Você consegue participar?`],
      ["Apresentar os materiais VIP", "captura", -3, "", "Oi, [nome]! Separei [material 1] para te ajudar com [objetivo], além de [material 2] para explorar [oportunidade]. Vou usar os dois na aula de [evento]. Se quiser receber, entre aqui: [link do grupo VIP]."],
      ["Última chamada no privado", "captura", 0, "", "Oi, [nome], nosso encontro é hoje às [hora do evento]. Vou enviar o acesso à sala pelo grupo. Se você ainda estiver de fora, pode entrar aqui: [link do grupo VIP]. Te vejo na aula?"],
      ["Abertura e condições de pagamento", "vendas", 0, "22:00", "Oi, [nome]! Você chegou a ver a aula? Abri as vagas para [oferta] e lembrei do que você falou sobre [objetivo]. Temos [condição aprovada] para quem precisa de outra forma de pagamento. Quer que eu te explique como funciona?"],
      ["Enviar replay", "pos", 1, "15:00", "Use se o replay estiver disponível.\n\nOi, [nome]! A gravação de ontem fica disponível até [prazo]: [link do replay]. Tem uma parte sobre [tema do interesse da pessoa] em [minutagem]. Se assistir, me conta o que quer testar primeiro."],
      ["Ajudar com pagamento pendente", "vendas", 4, "12:00", "Oi, [nome]! Como ficaram suas dúvidas sobre [oferta]? As vagas estão perto de fechar e ainda posso te orientar sobre [forma de pagamento aprovada]. Me responde por aqui se quiser que eu veja o seu caso."],
      ["Último contato sobre a turma", "pos", 11, "12:00", "Oi, [nome]! Estou encerrando as conversas desta turma hoje. Se você ainda quiser entrar, pode me responder até [hora do encerramento]. Se agora não for o momento, tudo bem também."],
    ];
    const messagesFor = (entries, channel, prefix) => entries.map(([title, phase, offset, time, notes], index) => ({
      title, phase, offset, time, notes, channel,
      code: prefix + "-" + String(index + 1).padStart(2, "0"),
    }));
    return [...messagesFor(groupMessages, "grupos", "GRUPO"), ...messagesFor(privateMessages, "privado", "PRIVADO")];
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
      const auth = { token: await accessToken() };
      const [result, references] = await Promise.all([
        supabaseRequest(eventRoute + "?select=id,title,event_date,status,revision,plan&order=created_at.desc", auth),
        supabaseRequest(copyReferenceRoute, auth).catch(() => null),
      ]);
      if (operation !== request || generation !== accessGeneration || !allowed()) return;
      events = result;
      if (Array.isArray(references)) copyReferences = new Map(references.map((reference) => [reference.template_code, reference]));
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
      const reference = section === "message" ? copyReferences.get(item.code) : null;
      const source = reference && safeUrl(reference.source_url);
      const notes = item.notes || "";
      const completed = item.status === "feito" || item.status === "enviado" || (section === "link" && item.status === "pronto");
      const stateClass = completed ? " recebido"
        : ["andamento", "revisao", "agendado", "pronto"].includes(item.status) ? " fechado" : "";
      return `<li class="event-list-item">
        ${section === "agenda" ? `<span class="event-agenda-order">${esc(item.order || "—")}</span>` : ""}
        <div class="event-list-copy">
          <h4>${esc(item.title)}</h4><p>${meta.map(esc).join(" · ")}</p>
          ${link ? `<a class="text-link event-resource" href="${esc(link)}" target="_blank" rel="noopener noreferrer">Abrir link ↗</a>` : ""}
          ${source && source !== link ? `<a class="text-link event-resource" href="${esc(source)}" target="_blank" rel="noopener noreferrer">Copy original (${esc(reference.source_code)}) ↗</a>` : ""}
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
        + pair(input("event_date", "Data de lançamento do evento", "date"), status(eventStates))
        + (kind === "new"
          ? select("template", "Começar com", { launch: "Modelo de lançamento", blank: "Evento em branco" })
            + '<p class="event-template-hint">Informe o dia do evento. O modelo usa essa data para montar o cronograma de tarefas, mensagens, roteiro e validação de links.</p>'
          : briefFields.map(([key, label]) => area(key, label)).join(""));
    } else {
      $("#event-dialog-heading").textContent = (item ? "Editar " : "Adicionar ") + names[kind];
      const date = input("date", kind === "task" ? "Prazo" : kind === "link" ? "Prazo para validar o link" : "Data", "date");
      const time = input("time", "Horário", "time");
      const owners = { "": "Sem responsável", ...Object.fromEntries(currentMembers.filter((m) => m.user_id).map((m) => [m.user_id, m.email])) };
      if (item?.owner && !Object.hasOwn(owners, item.owner)) owners[item.owner] = item.ownerLabel || "Participante removido";
      const owner = select("owner", kind === "agenda" ? "Quem conduz" : "Responsável", owners);
      const extra = {
        task: pair(date, select("team", "Área", { "": "Sem área", ...teams })) + owner,
        message: pair(date, time) + pair(select("channel", "Canal", channels), input("code", "Código", "text", "maxlength=40")) + owner,
        agenda: pair(input("order", "Ordem", "number", "required min=1 max=999"), input("duration", "Duração em minutos", "number", "required min=1 max=1440"))
          + pair(date, time) + owner,
        link: pair(date, owner),
      };
      fields.innerHTML = input("title", kind === "message" ? "Assunto" : "Título", "text", "required maxlength=120")
        + pair(select("phase", "Fase", phases), status(panel[kind].states)) + extra[kind]
        + (kind === "link" || kind === "message" ? input("url", kind === "message" ? "Link da copy ou material" : "Endereço", "url", "maxlength=2000") : "")
        + area("notes", kind === "message" ? "Copy da mensagem" : "Observações");
      if (kind === "message" && item?.code) {
        const template = messageTemplates(event.event_date).find(({ code, channel }) => code === item.code && channel === item.channel);
        if (template && template.notes !== item.notes) {
          fields.insertAdjacentHTML("beforeend", '<button class="button small" type="button" id="event-apply-copy">Usar copy do modelo</button>');
          $("#event-apply-copy", fields).addEventListener("click", () => {
            const copy = field(form, "notes");
            if (copy.value.trim() && copy.value !== template.notes && !window.confirm("Substituir o texto desta mensagem pela copy do modelo?")) return;
            copy.value = template.notes;
            copy.focus();
          });
        }
      }
    }
    const values = kind === "brief" ? { ...event, ...event.plan.brief } : item || {};
    for (const inputField of fields.querySelectorAll("[name]")) {
      const value = values[inputField.name];
      if (value != null) inputField.value = value;
    }
    if (kind === "agenda" && !item) {
      field(form, "phase").value = "evento";
      field(form, "date").value = event.event_date || "";
      field(form, "order").value = Math.max(0, ...itemsFor(event, "agenda").map((row) => Number(row.order) || 0)) + 1;
    }
    if (kind === "new") {
      const template = field(form, "template");
      const launchDate = field(form, "event_date");
      const hint = $(".event-template-hint", fields);
      const updateDateRequirement = () => {
        launchDate.required = template.value === "launch";
        hint.hidden = !launchDate.required;
      };
      template.addEventListener("change", updateDateRequirement);
      updateDateRequirement();
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
        if (kind === "new" && values.template === "launch" && !isDate(values.event_date)) {
          throw new Error("Informe uma data de lançamento válida para montar o cronograma.");
        }
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
    copyReferences.clear();
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
