(function timeline() {
  "use strict";

  // ===== Rotas Supabase =====
  const eventRoute = "/rest/v1/mutirao_mentoria_events";
  const machineRoute = "/rest/v1/mutirao_mentoria_machines";
  const machineColumns = "id,title,status,revision,plan";

  // Labels dos itens de checklist (da machine-model.js)
  const checklistLabels = {
    product:  "Produto",
    identity: "Identidade do produto",
    page:     "Página de vendas",
    checkout: "Checkout",
    organic:  "Tráfego orgânico",
    copy:     "Copy e roteiro",
    ads:      "Tráfego pago",
    budget:   "Orçamento",
  };

  // ===== Estado =====
  let allRows   = [];      // array plano de linhas do Gantt
  let rawEvents   = [];    // eventos brutos do Supabase
  let rawMachines = [];    // máquinas brutas do Supabase
  let viewStart = null;    // Date — primeiro dia visível
  let dayWidth  = 32;      // px por dia
  let request   = 0;       // geração para evitar race conditions
  let detailRow = null;    // linha atualmente aberta no painel lateral
  let dragState = null;    // { row, startX, origDate, barEl }

  // ===== DOM =====
  const container   = document.getElementById("timeline-container");
  const sidebarEl   = document.getElementById("timeline-sidebar");
  const scrollEl    = document.getElementById("timeline-scroll");
  const headerEl    = document.getElementById("timeline-header");
  const rowsEl      = document.getElementById("timeline-rows");
  const detailEl    = document.getElementById("timeline-detail");
  const detailTitle = document.getElementById("timeline-detail-title");
  const detailBody  = document.getElementById("timeline-detail-body");
  const feedbackEl  = document.getElementById("timeline-feedback");
  const loadingEl   = document.getElementById("timeline-loading");
  const emptyEl     = document.getElementById("timeline-empty");

  // ===== Helpers =====
  function isoDate(d) {
    // Retorna YYYY-MM-DD em horário local
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function parseDate(str) {
    if (!str) return null;
    // Evita deslocamento de fuso ao fazer new Date("YYYY-MM-DD")
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function diffDays(a, b) {
    return Math.round((b - a) / 86400000);
  }

  function dateBRfull(str) {
    const d = parseDate(str);
    if (!d) return "—";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  }

  function statusBadge(status) {
    const labels = { pendente: "Pendente", andamento: "Em andamento", feito: "Feito", nao_aplica: "Não se aplica" };
    return labels[status] || status || "—";
  }

  function escHtml(v) {
    return String(v ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
    );
  }

  function showFeedback(msg, isError = true) {
    feedbackEl.textContent = msg;
    feedbackEl.hidden = !msg;
    feedbackEl.className = isError ? "form-error" : "inline-note";
  }

  // ===== Busca de dados =====
  async function load() {
    const gen = ++request;
    loadingEl.hidden = false;
    container.hidden = true;
    emptyEl.hidden = true;
    showFeedback("");

    try {
      const token = await accessToken();
      const [eventsResp, machinesResp] = await Promise.all([
        supabaseRequest(
          `${eventRoute}?select=id,title,event_date,status,revision,plan&order=created_at.asc`,
          { token }
        ),
        supabaseRequest(
          `${machineRoute}?select=${machineColumns}&order=created_at.asc`,
          { token }
        ),
      ]);

      if (gen !== request) return;

      rawEvents   = Array.isArray(eventsResp)   ? eventsResp   : [];
      rawMachines = Array.isArray(machinesResp) ? machinesResp : [];

      buildRows();
      render();
    } catch (err) {
      if (gen !== request) return;
      showFeedback("Erro ao carregar a timeline: " + (err.message || "tente novamente."));
    } finally {
      if (gen === request) loadingEl.hidden = true;
    }
  }

  // ===== Construção do array de linhas =====
  function buildRows() {
    allRows = [];

    // ---- Eventos ----
    for (const event of rawEvents) {
      const tasks = (event.plan?.items || []).filter((i) => i.kind === "task" && i.date);
      if (!tasks.length) continue;

      allRows.push({
        type: "group", source: "event",
        id: "eg-" + event.id, eventId: event.id,
        label: event.title || "Evento sem título",
        status: event.status,
        date: event.event_date || null,
      });

      for (const task of tasks) {
        allRows.push({
          type: "task", source: "event",
          id: "et-" + event.id + "-" + task.id,
          eventId: event.id, taskId: task.id,
          label: task.title || "Tarefa",
          date: task.date,
          status: task.status || "pendente",
          phase: task.phase,
          team: task.team,
          owner: task.owner,
          ownerLabel: task.ownerLabel || "",
          notes: task.notes || "",
        });
      }
    }

    // ---- Infoprodutos (máquinas) ----
    for (const machine of rawMachines) {
      const checklist = machine.plan?.checklist || {};
      const items = Object.entries(checklist)
        .filter(([, v]) => v && v.date)
        .map(([key, v]) => ({ key, ...v }));
      if (!items.length) continue;

      allRows.push({
        type: "group", source: "machine",
        id: "mg-" + machine.id, machineId: machine.id,
        label: machine.title || "Infoproduto sem título",
        status: machine.status,
      });

      for (const item of items) {
        allRows.push({
          type: "task", source: "machine",
          id: "mt-" + machine.id + "-" + item.key,
          machineId: machine.id, checklistKey: item.key,
          label: checklistLabels[item.key] || item.key,
          date: item.date,
          status: item.status || "pendente",
          owner: item.owner,
          ownerLabel: item.ownerLabel || "",
          notes: item.notes || "",
          url: item.url || "",
        });
      }
    }
  }

  // ===== Cálculo do intervalo de datas =====
  function computeDateRange() {
    const dates = allRows.filter((r) => r.date).map((r) => parseDate(r.date)).filter(Boolean);
    if (!dates.length) return { start: new Date(), totalDays: 60 };

    const minMs = Math.min(...dates.map((d) => d.getTime()));
    const maxMs = Math.max(...dates.map((d) => d.getTime()));
    const start = new Date(minMs);
    start.setDate(start.getDate() - 7);   // margem esquerda
    const end = new Date(maxMs);
    end.setDate(end.getDate() + 14);      // margem direita
    const totalDays = Math.max(60, diffDays(start, end));
    return { start, totalDays };
  }

  // ===== Renderização principal =====
  function render() {
    if (!allRows.length) {
      emptyEl.hidden = false;
      container.hidden = true;
      return;
    }
    emptyEl.hidden = true;
    container.hidden = false;

    const { start, totalDays } = computeDateRange();
    viewStart = start;

    renderHeader(start, totalDays);
    renderSidebarAndRows(start, totalDays);
    scrollToToday();
  }

  // ===== Cabeçalho do Gantt (meses + dias) =====
  function renderHeader(start, totalDays) {
    const totalWidth = totalDays * dayWidth;

    // Linha de meses
    let monthHtml = "";
    let d = new Date(start);
    while (d < addDays(start, totalDays)) {
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd   = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const colStart   = Math.max(0, diffDays(start, monthStart));
      const colEnd     = Math.min(totalDays, diffDays(start, monthEnd));
      const colWidth   = (colEnd - colStart) * dayWidth;
      const label      = monthStart.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
      monthHtml += `<div class="timeline-month-cell" style="left:${colStart * dayWidth}px;width:${colWidth}px">${escHtml(label)}</div>`;
      d = monthEnd;
    }

    // Linha de dias
    let dayHtml = "";
    const today = isoDate(new Date());
    for (let i = 0; i < totalDays; i++) {
      const day = addDays(start, i);
      const isToday = isoDate(day) === today;
      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
      dayHtml += `<div class="timeline-day-cell${isWeekend ? " weekend" : ""}${isToday ? " today" : ""}" style="left:${i * dayWidth}px;width:${dayWidth}px">${day.getDate()}</div>`;
    }

    headerEl.style.width = totalWidth + "px";
    headerEl.innerHTML = `<div class="timeline-months" style="width:${totalWidth}px">${monthHtml}</div><div class="timeline-days" style="width:${totalWidth}px">${dayHtml}</div>`;
  }

  // ===== Sidebar + linhas do Gantt =====
  function renderSidebarAndRows(start, totalDays) {
    const totalWidth = totalDays * dayWidth;
    const today = isoDate(new Date());
    const todayOffset = diffDays(start, parseDate(today) || new Date());

    let sidebarHtml = "";
    let rowsHtml = "";

    // Linha de hoje
    const todayLineStyle = todayOffset >= 0 && todayOffset <= totalDays
      ? `<div class="timeline-today-line" style="left:${todayOffset * dayWidth}px"></div>`
      : "";

    // Colunas de fins de semana para fundo
    let weekendBg = "";
    for (let i = 0; i < totalDays; i++) {
      const day = addDays(start, i);
      if (day.getDay() === 0 || day.getDay() === 6) {
        weekendBg += `<div class="timeline-weekend-col" style="left:${i * dayWidth}px;width:${dayWidth}px"></div>`;
      }
    }

    for (const row of allRows) {
      const isGroup = row.type === "group";
      const rowClass = isGroup ? "timeline-sidebar-row group" : "timeline-sidebar-row";

      // Sidebar
      sidebarHtml += `<div class="${rowClass}" title="${escHtml(row.label)}">${escHtml(row.label)}</div>`;

      // Bar
      if (!isGroup && row.date) {
        const dateObj = parseDate(row.date);
        const offset = diffDays(start, dateObj);
        const left = offset * dayWidth;
        const width = Math.max(dayWidth, dayWidth); // tarefas de 1 dia mínimo
        const statusAttr = row.status || "pendente";
        const ownerText = row.ownerLabel ? escHtml(row.ownerLabel) : "";

        rowsHtml += `<div class="timeline-row" data-row-id="${escHtml(row.id)}">` +
          `<div class="timeline-bar" data-status="${statusAttr}" data-row-id="${escHtml(row.id)}" ` +
          `style="left:${left}px;width:${width}px" title="${escHtml(row.label)}${ownerText ? " · " + row.ownerLabel : ""}">${escHtml(row.label)}</div>` +
          `</div>`;
      } else {
        rowsHtml += `<div class="timeline-row group-row" data-row-id="${escHtml(row.id)}"></div>`;
      }
    }

    sidebarEl.innerHTML = sidebarHtml;
    rowsEl.style.width = totalWidth + "px";
    rowsEl.innerHTML = `${weekendBg}${todayLineStyle}${rowsHtml}`;

  }

  // ===== Eventos nas barras (anexados uma única vez) =====
  rowsEl.addEventListener("click", onBarClick);
  rowsEl.addEventListener("pointerdown", onBarPointerDown);

  function onBarClick(e) {
    const bar = e.target.closest(".timeline-bar");
    if (!bar) return;
    if (dragState?.moved) return; // foi drag, não click
    const rowId = bar.dataset.rowId;
    const row = allRows.find((r) => r.id === rowId);
    if (row) openDetail(row);
  }

  // ===== Drag & drop nas barras =====
  function onBarPointerDown(e) {
    const bar = e.target.closest(".timeline-bar");
    if (!bar) return;
    const rowId = bar.dataset.rowId;
    const row = allRows.find((r) => r.id === rowId);
    if (!row || row.type === "group") return;

    dragState = { row, startX: e.clientX, origDate: row.date, barEl: bar, moved: false };
    bar.setPointerCapture(e.pointerId);
    bar.addEventListener("pointermove", onBarPointerMove);
    bar.addEventListener("pointerup", onBarPointerUp, { once: true });
    bar.addEventListener("pointercancel", onBarPointerUp, { once: true });
  }

  function onBarPointerMove(e) {
    if (!dragState) return;
    const dx = e.clientX - dragState.startX;
    const daysDelta = Math.round(dx / dayWidth);
    if (daysDelta !== 0) dragState.moved = true;

    const origDateObj = parseDate(dragState.origDate);
    if (!origDateObj) return;
    const origOffset = diffDays(viewStart, origDateObj);
    const newOffset  = origOffset + daysDelta;
    dragState.barEl.style.left = newOffset * dayWidth + "px";
  }

  async function onBarPointerUp(e) {
    const bar = dragState?.barEl;
    if (!dragState) return;
    const { row, startX, origDate, moved } = dragState;
    dragState = null;

    if (bar) {
      bar.removeEventListener("pointermove", onBarPointerMove);
    }

    if (!moved) return;

    const dx = e.clientX - startX;
    const daysDelta = Math.round(dx / dayWidth);
    if (daysDelta === 0) {
      // Restaura posição
      const origDateObj = parseDate(origDate);
      if (origDateObj && bar) bar.style.left = diffDays(viewStart, origDateObj) * dayWidth + "px";
      return;
    }

    const origDateObj = parseDate(origDate);
    if (!origDateObj) return;
    const newDate = isoDate(addDays(origDateObj, daysDelta));

    try {
      await saveTaskDate(row, newDate);
    } catch (err) {
      showFeedback("Não foi possível salvar: " + (err.message || "tente novamente."));
      // Restaura posição visual
      buildRows();
      render();
    }
  }

  // ===== Salvar data via PATCH =====
  async function saveTaskDate(row, newDate) {
    const token = await accessToken();

    if (row.source === "event") {
      const event = rawEvents.find((e) => e.id === row.eventId);
      if (!event) return;

      const updatedItems = (event.plan?.items || []).map((i) =>
        i.id === row.taskId ? { ...i, date: newDate } : i
      );
      const result = await supabaseRequest(
        `${eventRoute}?id=eq.${event.id}&revision=eq.${event.revision}&select=id,title,event_date,status,revision,plan`,
        { method: "PATCH", token, representation: true,
          body: { plan: { ...event.plan, items: updatedItems }, revision: event.revision + 1 } }
      );
      if (Array.isArray(result) && result[0]) {
        const idx = rawEvents.findIndex((e) => e.id === event.id);
        if (idx >= 0) rawEvents[idx] = result[0];
      }

    } else if (row.source === "machine") {
      const machine = rawMachines.find((m) => m.id === row.machineId);
      if (!machine) return;

      const updatedChecklist = {
        ...machine.plan?.checklist,
        [row.checklistKey]: { ...(machine.plan?.checklist?.[row.checklistKey] || {}), date: newDate },
      };
      const result = await supabaseRequest(
        `${machineRoute}?id=eq.${machine.id}&revision=eq.${machine.revision}&select=${machineColumns}`,
        { method: "PATCH", token, representation: true,
          body: { plan: { ...machine.plan, checklist: updatedChecklist }, revision: machine.revision + 1 } }
      );
      if (Array.isArray(result) && result[0]) {
        const idx = rawMachines.findIndex((m) => m.id === machine.id);
        if (idx >= 0) rawMachines[idx] = result[0];
      }
    }

    // Atualiza linha em memória
    row.date = newDate;
    buildRows();
    render();
    // Se o detalhe está aberto para esta linha, atualiza
    if (detailRow?.id === row.id) openDetail(row);
  }

  // ===== Salvar status via PATCH =====
  async function saveTaskStatus(row, newStatus) {
    const token = await accessToken();

    if (row.source === "event") {
      const event = rawEvents.find((e) => e.id === row.eventId);
      if (!event) return;

      const updatedItems = (event.plan?.items || []).map((i) =>
        i.id === row.taskId ? { ...i, status: newStatus } : i
      );
      const result = await supabaseRequest(
        `${eventRoute}?id=eq.${event.id}&revision=eq.${event.revision}&select=id,title,event_date,status,revision,plan`,
        { method: "PATCH", token, representation: true,
          body: { plan: { ...event.plan, items: updatedItems }, revision: event.revision + 1 } }
      );
      if (Array.isArray(result) && result[0]) {
        const idx = rawEvents.findIndex((e) => e.id === event.id);
        if (idx >= 0) rawEvents[idx] = result[0];
      }

    } else if (row.source === "machine") {
      const machine = rawMachines.find((m) => m.id === row.machineId);
      if (!machine) return;

      const updatedChecklist = {
        ...machine.plan?.checklist,
        [row.checklistKey]: { ...(machine.plan?.checklist?.[row.checklistKey] || {}), status: newStatus },
      };
      const result = await supabaseRequest(
        `${machineRoute}?id=eq.${machine.id}&revision=eq.${machine.revision}&select=${machineColumns}`,
        { method: "PATCH", token, representation: true,
          body: { plan: { ...machine.plan, checklist: updatedChecklist }, revision: machine.revision + 1 } }
      );
      if (Array.isArray(result) && result[0]) {
        const idx = rawMachines.findIndex((m) => m.id === machine.id);
        if (idx >= 0) rawMachines[idx] = result[0];
      }
    }

    row.status = newStatus;
    // Re-renderiza barra (atualiza cor)
    const barEl = rowsEl.querySelector(`.timeline-bar[data-row-id="${CSS.escape(row.id)}"]`);
    if (barEl) barEl.dataset.status = newStatus;
    if (detailRow?.id === row.id) openDetail(row);
    buildRows();
    render();
  }

  // ===== Painel de detalhes =====
  function openDetail(row) {
    detailRow = row;
    detailTitle.textContent = row.label;

    const sourceLabel = row.source === "event" ? "Evento" : "Infoproduto";
    const projectName = row.source === "event"
      ? (rawEvents.find((e) => e.id === row.eventId)?.title || "")
      : (rawMachines.find((m) => m.id === row.machineId)?.title || "");

    const statusOptions = [
      { v: "pendente",   l: "Pendente" },
      { v: "andamento",  l: "Em andamento" },
      { v: "feito",      l: "Feito" },
      { v: "nao_aplica", l: "Não se aplica" },
    ];

    const statusSelect = statusOptions.map((o) =>
      `<option value="${o.v}"${row.status === o.v ? " selected" : ""}>${o.l}</option>`
    ).join("");

    detailBody.innerHTML = `
      <dl class="timeline-detail-dl">
        <div><dt>Projeto</dt><dd>${escHtml(projectName)} <span class="pill">${escHtml(sourceLabel)}</span></dd></div>
        ${row.phase ? `<div><dt>Fase</dt><dd>${escHtml(row.phase)}</dd></div>` : ""}
        ${row.team ? `<div><dt>Área</dt><dd>${escHtml(row.team)}</dd></div>` : ""}
        ${row.ownerLabel ? `<div><dt>Responsável</dt><dd>${escHtml(row.ownerLabel)}</dd></div>` : ""}
      </dl>
      <div class="timeline-detail-field">
        <label>Data
          <input type="date" id="detail-date-input" value="${escHtml(row.date || "")}" class="timeline-detail-input">
        </label>
      </div>
      <div class="timeline-detail-field">
        <label>Status
          <select id="detail-status-select" class="timeline-detail-input">${statusSelect}</select>
        </label>
      </div>
      ${row.notes ? `<div class="timeline-detail-field"><p class="timeline-detail-notes"><strong>Observações</strong><br>${escHtml(row.notes)}</p></div>` : ""}
      ${row.url ? `<div class="timeline-detail-field"><a href="${escHtml(row.url)}" target="_blank" rel="noopener" class="text-link">Ver link externo ↗</a></div>` : ""}
    `;

    detailEl.hidden = false;

    // Listener de data
    const dateInput = detailEl.querySelector("#detail-date-input");
    dateInput.addEventListener("change", async () => {
      if (!dateInput.value) return;
      try {
        await saveTaskDate(row, dateInput.value);
        showFeedback("Data atualizada.", false);
        setTimeout(() => showFeedback(""), 2500);
      } catch (err) {
        showFeedback("Erro ao salvar: " + (err.message || "tente novamente."));
      }
    });

    // Listener de status
    const statusSelect2 = detailEl.querySelector("#detail-status-select");
    statusSelect2.addEventListener("change", async () => {
      try {
        await saveTaskStatus(row, statusSelect2.value);
        showFeedback("Status atualizado.", false);
        setTimeout(() => showFeedback(""), 2500);
      } catch (err) {
        showFeedback("Erro ao salvar: " + (err.message || "tente novamente."));
      }
    });
  }

  document.getElementById("timeline-detail-close").addEventListener("click", () => {
    detailEl.hidden = true;
    detailRow = null;
  });

  // ===== Controles de zoom e navegação =====
  document.getElementById("timeline-zoom-in").addEventListener("click", () => {
    dayWidth = Math.min(80, dayWidth + 8);
    if (!container.hidden) render();
  });

  document.getElementById("timeline-zoom-out").addEventListener("click", () => {
    dayWidth = Math.max(16, dayWidth - 8);
    if (!container.hidden) render();
  });

  document.getElementById("timeline-today").addEventListener("click", scrollToToday);

  function scrollToToday() {
    if (!viewStart) return;
    const today = parseDate(isoDate(new Date()));
    const offset = diffDays(viewStart, today);
    scrollEl.scrollLeft = Math.max(0, offset * dayWidth - scrollEl.clientWidth / 2);
  }

  // ===== Sincronização de scroll vertical =====
  let syncingScroll = false;
  scrollEl.addEventListener("scroll", () => {
    if (syncingScroll) return;
    syncingScroll = true;
    sidebarEl.scrollTop = scrollEl.scrollTop;
    syncingScroll = false;
  });
  sidebarEl.addEventListener("scroll", () => {
    if (syncingScroll) return;
    syncingScroll = true;
    scrollEl.scrollTop = sidebarEl.scrollTop;
    syncingScroll = false;
  });

  // ===== Roteamento =====
  document.addEventListener("mutirao:route", (e) => {
    if (e.detail === "timeline") load();
  });

  document.addEventListener("mutirao:disconnect", () => {
    request++;
    allRows = [];
    rawEvents = [];
    rawMachines = [];
    container.hidden = true;
    emptyEl.hidden = true;
    loadingEl.hidden = true;
    detailEl.hidden = true;
    detailRow = null;
    showFeedback("");
  });
})();
