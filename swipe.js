(() => {
  const route = "/rest/v1/mutirao_mentoria_swipe_items";
  const localKey = "mutirao-mentoria-swipe-file";

  const formats = {
    carrossel: { label: "Carrossel", icon: "🎠", badgeClass: "format-carrossel" },
    video: { label: "Vídeo / Reels", icon: "🎬", badgeClass: "format-video" },
    estatico: { label: "Post Estático", icon: "🖼️", badgeClass: "format-estatico" },
    outro: { label: "Outro formato", icon: "💡", badgeClass: "format-outro" },
  };

  const categories = {
    atracao: { label: "🎯 Atração / Topo", badgeClass: "cat-atracao" },
    retencao: { label: "🧠 Autoridade / Retenção", badgeClass: "cat-retencao" },
    conversao: { label: "💰 Conversão / Vendas", badgeClass: "cat-conversao" },
    storytelling: { label: "📖 Storytelling", badgeClass: "cat-storytelling" },
    design: { label: "🎨 Direção de Arte", badgeClass: "cat-design" },
    tutorial: { label: "🛠️ Tutorial", badgeClass: "cat-tutorial" },
    gancho: { label: "⚡ Quebra de Padrão", badgeClass: "cat-gancho" },
    geral: { label: "Geral", badgeClass: "cat-geral" },
  };

  const sampleItems = [
    {
      id: "sample-carrossel-01",
      url: "https://www.instagram.com/p/DB1A2B3c4D5/",
      title: "Carrossel de 7 passos: Arquitetura de ofertas de alto valor",
      format: "carrossel",
      category: "conversao",
      author: "@umcaracaramelo",
      caption: `Você não tem um problema de tráfego. Você tem um problema de oferta.\n\nQuando a oferta é genérica, você precisa de 10x mais pessoas para vender 1 unidade. Quando a oferta tem um mecanismo proprietário, 10 pessoas bastam para fazer o primeiro caixa.\n\nArrasta para o lado e veja as 7 etapas que usamos no Laboratório para transformar ideias soltas em infoprodutos e serviços com valor percebido inquestionável.\n\nSalve este post para consultar quando for precificar sua próxima mentoria.`,
      notes: `GANCHO: Começa quebrando a crença mais comum ("tráfego" vs "oferta").\nESTRUTURA: 7 lâminas limpas, com 1 ideia por slide, tipografia pesada e respiro visual.\nCTA: Comando para salvar e aplicar na precificação de mentoria.`,
      thumbnail_url: "",
      revision: 0,
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: "sample-video-02",
      url: "https://www.instagram.com/reel/C8x9y0z1A2B/",
      title: "Reels de corte rápido: Gancho dos 3 segundos com quebra de padrão",
      format: "video",
      category: "atracao",
      author: "@headdeconteudo",
      caption: `Se os 3 primeiros segundos do seu vídeo não provocam uma pergunta na cabeça de quem assiste, o scroll leva embora todo o seu esforço.\n\n3 formas de abrir seu Reels hoje:\n1. Ação no meio da cena (in media res)\n2. O contraste entre o que todo mundo faz e o que dá resultado\n3. Uma confissão honesta sobre um erro que custou caro\n\nQual dessas você vai testar no próximo vídeo?`,
      notes: `VÍDEO / REELS: Movimento contínuo de câmera, legenda sincronizada com palavras-chave destacadas.\nRITMO: Troca de enquadramento a cada 2.5s para reter atenção.\nCTA: Pergunta final nos comentários gerando engajamento direto.`,
      thumbnail_url: "",
      revision: 0,
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
    {
      id: "sample-estatico-03",
      url: "https://www.instagram.com/p/Cz7890abcdef/",
      title: "Post estático: 'Menos ferramenta. Mais sistema.'",
      format: "estatico",
      category: "design",
      author: "@laboratoriodeinteracao",
      caption: `Parar de acumular ferramentas é o primeiro passo para ter clareza.\n\nUma esteira bem desenhada em um papel em branco vende mais do que 15 softwares desintegrados que ninguém da sua equipe consegue operar.\n\nMarca não é só o que você diz. É o que ela faz você fazer.`,
      notes: `DESIGN & COPY CONCISA: Contraste cromático forte (#101014 x #FFF4E8), tipografia grotesca marcante e frase que vira axioma da marca.\nExcelente para topo de funil de autoridade.`,
      thumbnail_url: "",
      revision: 0,
      created_at: new Date(Date.now() - 86400000 * 8).toISOString(),
    },
  ];

  const allowed = () => !shared || (ready && !!session && ["member", "admin"].includes(accessRole));

  let items = [];
  let currentEditingId = null;
  let activeInspectedId = null;
  let searchTerm = "";
  let formatFilter = "";
  let categoryFilter = "";
  let loading = false;
  let requestCounter = 0;

  // Elementos da interface
  const viewSection = $("#swipe");
  const newBtn = $("#swipe-new-btn");
  const emptyNewBtn = $("#swipe-empty-new-btn");
  const loadSamplesBtn = $("#swipe-load-samples-btn");
  const refreshBtn = $("#swipe-refresh-btn");
  const searchInput = $("#swipe-search-input");
  const formatSelect = $("#swipe-filter-format");
  const categorySelect = $("#swipe-filter-category");
  const statsLabel = $("#swipe-count-label");
  const feedbackEl = $("#swipe-feedback");
  const loadingEl = $("#swipe-loading");
  const emptyEl = $("#swipe-empty");
  const galleryGrid = $("#swipe-gallery-grid");

  // Diálogo de Edição / Criação
  const dialog = $("#swipe-dialog");
  const form = $("#swipe-form");
  const dialogHeading = $("#swipe-dialog-heading");
  const formError = $("#swipe-form-error");
  const deleteBtn = $("#swipe-delete-btn");
  const submitBtn = $("#swipe-submit-btn");
  const urlInput = $("#swipe-form-url");
  const formatInput = $("#swipe-form-format");
  const categoryInput = $("#swipe-form-category");
  const authorInput = $("#swipe-form-author");
  const captionInput = $("#swipe-form-caption");
  const notesInput = $("#swipe-form-notes");
  const pasteCaptionBtn = $("#swipe-paste-caption-btn");

  // Diálogo de Detalhes / Inspeção
  const detailDialog = $("#swipe-detail-dialog");
  const detailTitle = $("#swipe-detail-title");
  const detailFormatPill = $("#swipe-detail-format-pill");
  const detailCategoryPill = $("#swipe-detail-category-pill");
  const detailAuthor = $("#swipe-detail-author");
  const detailExternalLink = $("#swipe-detail-external-link");
  const detailEmbedContainer = $("#swipe-detail-embed-container");
  const detailCaption = $("#swipe-detail-caption");
  const detailNotes = $("#swipe-detail-notes");
  const detailNotesSection = $("#swipe-detail-notes-section");
  const detailPrompt = $("#swipe-detail-prompt");
  const copyCaptionBtn = $("#swipe-copy-caption-btn");
  const copyPromptBtn = $("#swipe-copy-prompt-btn");
  const detailEditBtn = $("#swipe-detail-edit-btn");

  function setFeedback(msg = "", isError = false) {
    if (!feedbackEl) return;
    feedbackEl.textContent = msg;
    feedbackEl.classList.toggle("form-error", isError);
    feedbackEl.hidden = !msg;
  }

  function setFormError(msg = "") {
    if (!formError) return;
    formError.textContent = msg;
    formError.hidden = !msg;
  }

  function parseInstagramUrl(raw) {
    if (!raw || typeof raw !== "string") return null;
    const clean = raw.trim();
    // Ex.: https://www.instagram.com/p/C-abc123_/?igsh=xyz ou /reel/abc/ ou /reels/abc/
    const match = clean.match(/instagram\.com\/(?:[^\/]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
    if (!match) return null;
    const rawKind = match[1].toLowerCase();
    const shortcode = match[2];
    const isVideo = rawKind === "reel" || rawKind === "reels" || rawKind === "tv";
    const canonicalType = isVideo ? "reel" : "p";
    const canonicalUrl = `https://www.instagram.com/${canonicalType}/${shortcode}/`;
    const embedUrl = `https://www.instagram.com/${canonicalType}/${shortcode}/embed/captioned/`;

    return {
      shortcode,
      isVideo,
      canonicalType,
      canonicalUrl,
      embedUrl,
    };
  }

  function readLocal() {
    try {
      const stored = localStorage.getItem(localKey);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeLocal(list) {
    try {
      localStorage.setItem(localKey, JSON.stringify(list));
    } catch {}
  }

  async function loadItems() {
    if (!allowed()) return;
    const operation = ++requestCounter;
    loading = true;
    setFeedback("");
    if (loadingEl) loadingEl.hidden = items.length > 0;

    try {
      let rows = [];
      if (shared) {
        try {
          rows = await supabaseRequest(
            route + "?select=id,url,title,format,category,author,caption,notes,thumbnail_url,revision,created_at&order=created_at.desc",
            { token: await accessToken() }
          );
        } catch (err) {
          // Fallback para local se a tabela ainda não tiver sido criada no Supabase
          console.warn("Supabase swipe fetch fallback para local:", err);
          rows = readLocal();
        }
      } else {
        rows = readLocal();
      }

      if (operation !== requestCounter || !allowed()) return;

      // Se não houver referências, preenche com as de exemplo locais
      if (!rows || rows.length === 0) {
        const local = readLocal();
        if (local && local.length > 0) {
          rows = local;
        }
      }

      items = rows || [];
      renderGallery();
    } catch (error) {
      if (operation !== requestCounter) return;
      setFeedback("Não foi possível carregar o Swipe File. Tente atualizar.", true);
    } finally {
      if (operation === requestCounter) {
        loading = false;
        if (loadingEl) loadingEl.hidden = true;
      }
    }
  }

  async function saveItem(payload) {
    if (!allowed()) throw new Error("Acesso não autorizado.");
    setFeedback("");

    if (shared) {
      try {
        if (payload.id && items.some((i) => i.id === payload.id)) {
          // Atualização
          const updated = await supabaseRequest(
            route + "?id=eq." + payload.id + "&select=id,url,title,format,category,author,caption,notes,thumbnail_url,revision,created_at",
            {
              method: "PATCH",
              token: await accessToken(),
              body: {
                url: payload.url,
                title: payload.title,
                format: payload.format,
                category: payload.category,
                author: payload.author,
                caption: payload.caption,
                notes: payload.notes,
                thumbnail_url: payload.thumbnail_url,
                revision: (payload.revision || 0) + 1,
              },
              representation: true,
            }
          );
          const savedRow = Array.isArray(updated) ? updated[0] : updated;
          if (savedRow) {
            const idx = items.findIndex((i) => i.id === savedRow.id);
            if (idx !== -1) items[idx] = savedRow;
          }
        } else {
          // Inserção
          const inserted = await supabaseRequest(
            route + "?select=id,url,title,format,category,author,caption,notes,thumbnail_url,revision,created_at",
            {
              method: "POST",
              token: await accessToken(),
              body: {
                url: payload.url,
                title: payload.title,
                format: payload.format,
                category: payload.category,
                author: payload.author,
                caption: payload.caption,
                notes: payload.notes,
                thumbnail_url: payload.thumbnail_url,
              },
              representation: true,
            }
          );
          const newRow = Array.isArray(inserted) ? inserted[0] : inserted;
          if (newRow) items.unshift(newRow);
        }
        writeLocal(items);
        return;
      } catch (err) {
        console.warn("Falha no salvamento Supabase, gravando local:", err);
      }
    }

    // Fallback Local
    if (payload.id && items.some((i) => i.id === payload.id)) {
      const idx = items.findIndex((i) => i.id === payload.id);
      items[idx] = { ...items[idx], ...payload, revision: (items[idx].revision || 0) + 1 };
    } else {
      const newLocalItem = {
        ...payload,
        id: payload.id || ("local-" + makeId()),
        revision: 0,
        created_at: new Date().toISOString(),
      };
      items.unshift(newLocalItem);
    }
    writeLocal(items);
  }

  async function deleteItem(id) {
    if (!allowed()) throw new Error("Acesso não autorizado.");
    if (shared) {
      try {
        await supabaseRequest(route + "?id=eq." + id, {
          method: "DELETE",
          token: await accessToken(),
        });
      } catch (err) {
        console.warn("Falha ao apagar no Supabase:", err);
      }
    }
    items = items.filter((item) => item.id !== id);
    writeLocal(items);
    renderGallery();
  }

  function getFilteredItems() {
    const q = searchTerm.toLowerCase().trim();
    return items.filter((item) => {
      if (formatFilter && item.format !== formatFilter) return false;
      if (categoryFilter && item.category !== categoryFilter) return false;
      if (!q) return true;
      const titleMatch = item.title?.toLowerCase().includes(q);
      const captionMatch = item.caption?.toLowerCase().includes(q);
      const notesMatch = item.notes?.toLowerCase().includes(q);
      const authorMatch = item.author?.toLowerCase().includes(q);
      return titleMatch || captionMatch || notesMatch || authorMatch;
    });
  }

  function renderGallery() {
    if (!galleryGrid) return;
    const filtered = getFilteredItems();

    // Atualiza contadores
    const totalCount = items.length;
    const filterCount = filtered.length;
    if (statsLabel) {
      if (totalCount === 0) {
        statsLabel.textContent = "Nenhuma publicação salva";
      } else if (filterCount === totalCount) {
        const carouselCount = items.filter((i) => i.format === "carrossel").length;
        const videoCount = items.filter((i) => i.format === "video").length;
        const staticCount = items.filter((i) => i.format === "estatico").length;
        statsLabel.textContent = `${totalCount} ${totalCount === 1 ? "referência" : "referências"} (${carouselCount} carrosséis, ${videoCount} vídeos, ${staticCount} estáticos)`;
      } else {
        statsLabel.textContent = `Exibindo ${filterCount} de ${totalCount} referências salvas`;
      }
    }

    if (emptyEl) emptyEl.hidden = items.length > 0;

    galleryGrid.replaceChildren();

    if (items.length > 0 && filtered.length === 0) {
      const noResults = document.createElement("div");
      noResults.className = "card roomy";
      noResults.style.gridColumn = "1 / -1";
      noResults.style.textAlign = "center";
      noResults.innerHTML = `<h3>Nenhuma publicação encontrada</h3><p class="muted">Tente ajustar o termo da busca ou os filtros de formato e pilar.</p>`;
      galleryGrid.appendChild(noResults);
      return;
    }

    for (const item of filtered) {
      galleryGrid.appendChild(createCardElement(item));
    }
  }

  function createCardElement(item) {
    const card = document.createElement("article");
    card.className = "swipe-card";
    card.dataset.id = item.id;

    const fmt = formats[item.format] || formats.carrossel;
    const cat = categories[item.category] || categories.geral;
    const parsed = parseInstagramUrl(item.url);
    const hasThumb = Boolean(item.thumbnail_url);

    let mediaHtml = "";
    if (hasThumb) {
      mediaHtml = `<img class="swipe-thumb" src="${esc(item.thumbnail_url)}" alt="${esc(item.title)}" loading="lazy">`;
    } else if (parsed) {
      // Exibe um preview interativo usando iframe com lazy loading
      mediaHtml = `
        <div class="swipe-card-embed-preview">
          <iframe class="swipe-embed-iframe" src="${esc(parsed.embedUrl)}" width="100%" height="420" frameborder="0" scrolling="no" allowtransparency="true" loading="lazy"></iframe>
        </div>`;
    } else {
      mediaHtml = `
        <div class="swipe-card-media-placeholder">
          <span class="swipe-format-big-icon" aria-hidden="true">${fmt.icon}</span>
          <span class="pill ${fmt.badgeClass}">${fmt.label}</span>
        </div>`;
    }

    const captionSnippet = item.caption ? esc(item.caption.slice(0, 160)) + (item.caption.length > 160 ? "…" : "") : "";
    const notesSnippet = item.notes ? esc(item.notes.slice(0, 110)) + (item.notes.length > 110 ? "…" : "") : "";

    card.innerHTML = `
      <div class="swipe-card-header">
        <div class="swipe-card-badges">
          <span class="pill ${fmt.badgeClass}">${fmt.icon} ${fmt.label}</span>
          <span class="pill ${cat.badgeClass}">${cat.label}</span>
        </div>
        ${item.author ? `<span class="swipe-card-author" title="${esc(item.author)}">${esc(item.author)}</span>` : ""}
      </div>
      <div class="swipe-card-media" data-action="view-detail">
        ${mediaHtml}
      </div>
      <div class="swipe-card-body">
        <h3 class="swipe-card-title" data-action="view-detail">${esc(item.title)}</h3>
        ${captionSnippet ? `<div class="swipe-card-caption-snippet" title="Clique para ver a legenda inteira" data-action="view-detail">${captionSnippet}</div>` : ""}
        ${notesSnippet ? `<div class="swipe-card-notes-snippet"><strong>💡 O que modelar:</strong> ${notesSnippet}</div>` : ""}
      </div>
      <div class="swipe-card-footer">
        <div class="swipe-card-actions">
          <button class="button small primary" type="button" data-action="view-detail">Ver publicação</button>
          ${item.caption ? `<button class="button small" type="button" data-action="copy-caption" title="Copiar legenda para a área de transferência">📋 Copiar legenda</button>` : ""}
        </div>
        <div class="swipe-card-actions">
          ${item.url ? `<a class="text-link" href="${esc(item.url)}" target="_blank" rel="noopener" title="Abrir link original no Instagram">↗ IG</a>` : ""}
          <button class="text-link" type="button" data-action="edit" title="Editar referência">Editar</button>
        </div>
      </div>
    `;

    return card;
  }

  // Abre Modal de Criação / Edição
  function openEditor(item = null) {
    if (!dialog || !form) return;
    currentEditingId = item?.id || null;
    setFormError("");

    if (item) {
      dialogHeading.textContent = "Editar referência do Swipe File";
      submitBtn.textContent = "Salvar alterações";
      deleteBtn.hidden = false;

      urlInput.value = item.url || "";
      form.elements.namedItem("title").value = item.title || "";
      formatInput.value = item.format || "carrossel";
      categoryInput.value = item.category || "geral";
      authorInput.value = item.author || "";
      captionInput.value = item.caption || "";
      notesInput.value = item.notes || "";
      form.elements.namedItem("thumbnail_url").value = item.thumbnail_url || "";
    } else {
      dialogHeading.textContent = "Salvar publicação no Swipe File";
      submitBtn.textContent = "Salvar no Swipe File";
      deleteBtn.hidden = true;
      form.reset();
      formatInput.value = "carrossel";
      categoryInput.value = "atracao";
    }

    dialog.showModal();
    (item ? form.elements.namedItem("title") : urlInput).focus();
  }

  // Gera modelo de conteúdo a partir da referência
  function generateContentBriefing(item) {
    const fmt = formats[item.format] || formats.carrossel;
    const cat = categories[item.category] || categories.geral;
    const firstLines = (item.caption || "").split("\n").filter(Boolean).slice(0, 2).join(" ");

    return `[ESTRUTURA PARA NOVO CONTEÚDO BASEADA NESTE SWIPE]
Referência: ${item.title}
Autor de inspiração: ${item.author || "Não informado"}
Formato: ${fmt.label} | Pilar: ${cat.label}

1. GANCHO / ABERTURA (Primeiros 3 segundos ou Capa do carrossel):
- Tese / Conflito inicial: Baseado em "${firstLines || item.title}"
- Fórmula: Quebra de crença comum do nosso nicho + promessa tangível de transformação.

2. DESENVOLVIMENTO (Lâminas do carrossel ou Roteiro do vídeo):
- Passo 1: O erro invisível que a audiência comete.
- Passo 2: O contraste entre o jeito amador e o jeito profissional.
- Passo 3: O mecanismo proprietário (o passo a passo prático).
- Passo 4: O efeito Ahaa / síntese memorável.

3. NOTAS DE MODELAGEM DA EQUIPE:
${item.notes ? item.notes : "Manter ritmo enxuto, tipografia legível e contraste de cores."}

4. CHAMADA PARA AÇÃO (CTA FINAL):
- Conduzir para comentário-chave ou salvar para consulta prática.`;
  }

  // Abre Modal de Detalhes / Inspeção Imersiva
  function openDetail(item) {
    if (!detailDialog || !item) return;
    activeInspectedId = item.id;

    const fmt = formats[item.format] || formats.carrossel;
    const cat = categories[item.category] || categories.geral;
    const parsed = parseInstagramUrl(item.url);

    detailTitle.textContent = item.title;
    detailFormatPill.textContent = `${fmt.icon} ${fmt.label}`;
    detailFormatPill.className = `pill ${fmt.badgeClass}`;
    detailCategoryPill.textContent = cat.label;
    detailCategoryPill.className = `pill ${cat.badgeClass}`;
    detailAuthor.textContent = item.author || "Instagram";

    if (item.url) {
      detailExternalLink.href = item.url;
      detailExternalLink.hidden = false;
    } else {
      detailExternalLink.hidden = true;
    }

    // Embed da Mídia
    detailEmbedContainer.replaceChildren();
    if (parsed) {
      const iframe = document.createElement("iframe");
      iframe.src = parsed.embedUrl;
      iframe.width = "100%";
      iframe.height = "740";
      iframe.style.minHeight = "640px";
      iframe.style.height = "740px";
      iframe.frameBorder = "0";
      iframe.scrolling = "auto";
      iframe.allowFullscreen = true;
      iframe.setAttribute("allowtransparency", "true");
      iframe.className = "swipe-detail-iframe";
      detailEmbedContainer.appendChild(iframe);

      // Controles adicionais de visualização da mídia
      const mediaFooter = document.createElement("div");
      mediaFooter.className = "swipe-media-footer-controls";
      let currentHeight = 740;
      let isCaptioned = true;

      mediaFooter.innerHTML = `
        <button type="button" class="button small" data-action="expand-media" title="Aumentar altura se a imagem for longa">Aumentar altura ↕</button>
        <button type="button" class="button small" data-action="toggle-caption-mode" title="Alternar entre modo somente mídia ou completo">Alternar modo ⇋</button>
        <a class="button small" href="${esc(item.url)}" target="_blank" rel="noopener" title="Abrir publicação original no Instagram">Abrir no Instagram ↗</a>
      `;
      detailEmbedContainer.appendChild(mediaFooter);

      mediaFooter.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-action]");
        if (!btn) return;
        const act = btn.dataset.action;
        if (act === "expand-media") {
          currentHeight += 180;
          iframe.style.height = `${currentHeight}px`;
          iframe.height = currentHeight;
        } else if (act === "toggle-caption-mode") {
          isCaptioned = !isCaptioned;
          const newUrl = isCaptioned
            ? `https://www.instagram.com/${parsed.canonicalType}/${parsed.shortcode}/embed/captioned/`
            : `https://www.instagram.com/${parsed.canonicalType}/${parsed.shortcode}/embed/`;
          iframe.src = newUrl;
        }
      });
    } else if (item.thumbnail_url) {
      const img = document.createElement("img");
      img.src = item.thumbnail_url;
      img.alt = item.title;
      img.style.width = "100%";
      img.style.borderRadius = "8px";
      detailEmbedContainer.appendChild(img);
    } else {
      detailEmbedContainer.innerHTML = `
        <div class="swipe-card-media-placeholder" style="padding:48px 16px;">
          <span class="swipe-format-big-icon">${fmt.icon}</span>
          <p>Link: <a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.url)}</a></p>
        </div>`;
    }

    // Legenda
    if (item.caption) {
      detailCaption.textContent = item.caption;
      copyCaptionBtn.hidden = false;
    } else {
      detailCaption.textContent = "Nenhuma legenda foi informada para esta publicação.";
      copyCaptionBtn.hidden = true;
    }

    // Notas de modelagem
    if (item.notes) {
      detailNotes.textContent = item.notes;
      detailNotesSection.hidden = false;
    } else {
      detailNotesSection.hidden = true;
    }

    // Briefing de modelagem para novo conteúdo
    const briefingText = generateContentBriefing(item);
    detailPrompt.textContent = briefingText;

    detailDialog.showModal();
  }

  // Copia texto com feedback visual temporário no botão
  async function copyWithFeedback(button, text) {
    if (!text) return;
    const originalText = button.textContent;
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = "Copiado! ✓";
    } catch {
      window.prompt("Copie o texto abaixo:", text);
      return;
    }
    setTimeout(() => {
      button.textContent = originalText;
    }, 2000);
  }

  // Auto-detecta formato e limpa link ao colar
  function handleUrlInput() {
    const raw = urlInput.value;
    const parsed = parseInstagramUrl(raw);
    if (!parsed) return;

    // Ajusta URL para a versão limpa canônica
    urlInput.value = parsed.canonicalUrl;

    // Se for Reels/Vídeo e o usuário ainda não tiver mexido ou tiver default, ajusta
    if (parsed.isVideo && formatInput.value !== "video") {
      formatInput.value = "video";
    } else if (!parsed.isVideo && formatInput.value === "video") {
      formatInput.value = "carrossel";
    }
  }

  // Iniciar listeners
  function setupEvents() {
    if (newBtn) newBtn.addEventListener("click", () => openEditor());
    if (emptyNewBtn) emptyNewBtn.addEventListener("click", () => openEditor());
    if (refreshBtn) refreshBtn.addEventListener("click", () => loadItems());

    if (loadSamplesBtn) {
      loadSamplesBtn.addEventListener("click", async () => {
        for (const s of sampleItems) {
          if (!items.some((i) => i.url === s.url)) {
            await saveItem(s);
          }
        }
        renderGallery();
      });
    }

    if (urlInput) {
      urlInput.addEventListener("input", handleUrlInput);
      urlInput.addEventListener("paste", () => setTimeout(handleUrlInput, 50));
    }

    if (pasteCaptionBtn) {
      pasteCaptionBtn.addEventListener("click", async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (text && captionInput) {
            captionInput.value = text;
            captionInput.focus();
          }
        } catch {
          alert("Não foi possível acessar a área de transferência. Cole usando Ctrl+V diretamente no campo.");
        }
      });
    }

    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        searchTerm = e.target.value;
        renderGallery();
      });
    }

    if (formatSelect) {
      formatSelect.addEventListener("change", (e) => {
        formatFilter = e.target.value;
        renderGallery();
      });
    }

    if (categorySelect) {
      categorySelect.addEventListener("change", (e) => {
        categoryFilter = e.target.value;
        renderGallery();
      });
    }

    // Ações na galeria de cards
    if (galleryGrid) {
      galleryGrid.addEventListener("click", async (e) => {
        const card = e.target.closest(".swipe-card");
        if (!card) return;
        const item = items.find((i) => i.id === card.dataset.id);
        if (!item) return;

        const actionEl = e.target.closest("[data-action]");
        const action = actionEl?.dataset?.action;

        if (action === "copy-caption") {
          await copyWithFeedback(actionEl, item.caption);
        } else if (action === "edit") {
          openEditor(item);
        } else if (action === "view-detail" || !actionEl) {
          openDetail(item);
        }
      });
    }

    // Submissão do Formulário
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        setFormError("");

        const formData = new FormData(form);
        const url = (formData.get("url") || "").toString().trim();
        const title = (formData.get("title") || "").toString().trim();
        const format = (formData.get("format") || "carrossel").toString();
        const category = (formData.get("category") || "geral").toString();
        const author = (formData.get("author") || "").toString().trim();
        const caption = (formData.get("caption") || "").toString().trim();
        const notes = (formData.get("notes") || "").toString().trim();
        const thumbnail_url = (formData.get("thumbnail_url") || "").toString().trim();

        if (!url) {
          setFormError("Informe o link da publicação do Instagram.");
          return;
        }
        if (!title) {
          setFormError("Informe um título ou ângulo para identificar a referência.");
          return;
        }

        submitBtn.disabled = true;
        try {
          await saveItem({
            id: currentEditingId,
            url,
            title,
            format,
            category,
            author,
            caption,
            notes,
            thumbnail_url,
          });
          dialog.close();
          renderGallery();
        } catch (err) {
          setFormError(err.message || "Erro ao salvar referência no Swipe File.");
        } finally {
          submitBtn.disabled = false;
        }
      });
    }

    // Exclusão de item
    if (deleteBtn) {
      deleteBtn.addEventListener("click", async () => {
        if (!currentEditingId) return;
        if (!confirm("Tem certeza que deseja excluir esta referência do Swipe File?")) return;
        deleteBtn.disabled = true;
        try {
          await deleteItem(currentEditingId);
          dialog.close();
        } catch (err) {
          setFormError(err.message || "Não foi possível excluir a referência.");
        } finally {
          deleteBtn.disabled = false;
        }
      });
    }

    // Ações do Diálogo de Detalhes
    if (copyCaptionBtn) {
      copyCaptionBtn.addEventListener("click", () => {
        const item = items.find((i) => i.id === activeInspectedId);
        if (item?.caption) copyWithFeedback(copyCaptionBtn, item.caption);
      });
    }

    if (copyPromptBtn) {
      copyPromptBtn.addEventListener("click", () => {
        if (detailPrompt.textContent) copyWithFeedback(copyPromptBtn, detailPrompt.textContent);
      });
    }

    if (detailEditBtn) {
      detailEditBtn.addEventListener("click", () => {
        const item = items.find((i) => i.id === activeInspectedId);
        if (item) {
          detailDialog.close();
          openEditor(item);
        }
      });
    }

    // Auto-ajuste de altura dos embeds do Instagram via postMessage (MEASURE)
    window.addEventListener("message", (event) => {
      if (!event || !event.data) return;
      let data = event.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      if (data?.type === "MEASURE" && data?.details?.height) {
        const newHeight = Math.max(500, Math.ceil(data.details.height) + 16);
        let matched = false;
        for (const iframe of document.querySelectorAll("iframe")) {
          try {
            if (iframe.contentWindow === event.source) {
              iframe.style.height = `${newHeight}px`;
              iframe.height = newHeight;
              matched = true;
              break;
            }
          } catch {}
        }
        if (!matched && detailDialog && detailDialog.open) {
          const detailIframe = detailEmbedContainer?.querySelector("iframe");
          if (detailIframe) {
            detailIframe.style.height = `${newHeight}px`;
            detailIframe.height = newHeight;
          }
        }
      }
    });

    // Roteamento e Desconexão
    document.addEventListener("mutirao:route", (e) => {
      if (e.detail === "swipe") {
        loadItems();
      }
    });

    document.addEventListener("mutirao:disconnect", () => {
      items = [];
      currentEditingId = null;
      activeInspectedId = null;
      if (dialog && dialog.open) dialog.close();
      if (detailDialog && detailDialog.open) detailDialog.close();
      if (galleryGrid) galleryGrid.replaceChildren();
      if (emptyEl) emptyEl.hidden = true;
      if (loadingEl) loadingEl.hidden = true;
      setFeedback("");
    });
  }

  setupEvents();
})();
