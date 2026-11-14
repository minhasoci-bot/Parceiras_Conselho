// Página inicial. Depende de `catalog`, `products` (catalog.js) e `DEADLINE` (model.js).
// Mecânicas de rolagem portadas da análise da Launchpad: Lenis + ScrollTrigger, galeria em coverflow
// presa à rolagem, túnel 3D, título que explode com física, cards empilhados e faixa em loop.
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const motion = !reduceMotion && !!(window.gsap && window.ScrollTrigger && window.Lenis);
if (!motion) document.documentElement.classList.add("static");
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeOutCubic = (t) => 1 - (1 - t) ** 3;
const smoothstep = (t) => t * t * (3 - 2 * t);
const money = (value) => "R$ " + value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const fold = (text) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/* ---------- Dados do catálogo ---------- */
const AREAS = ["Design", "Web", "Vídeo", "Copy e roteiro", "Fotografia", "Estratégia", "Gestão", "Infoprodutos"];
const TAGS = {
  "Design": "arte artes post posts feed instagram story stories banner visual criativo carrossel carrosseis",
  "Web": "site pagina paginas landing vendas venda internet",
  "Fotografia": "foto fotos ensaio retrato perfil imagem imagens ia",
  "Vídeo": "video videos reels reel edicao editar youtube vsl",
  "Copy e roteiro": "texto textos copy legenda legendas roteiro escrever escrita",
  "Estratégia": "planejamento planejar calendario estrategia analise conteudo diagnostico",
  "Gestão": "gestao gerenciar redes social sociais trafego anuncio anuncios ads direct atendimento mensal",
  "Infoprodutos": "curso workshop kit guia template templates precificacao oferta minicurso",
};
const STOP = new Set("a o as os de da do das dos e em no na nos nas um uma uns umas para pra pro pros pras com que meu minha meus minhas eu quero preciso gostaria fazer criar algo sobre por ser".split(" "));
const services = [
  ...catalog.map(([area, title, ranges, detail, unit = ""]) => {
    const low = Math.min(...ranges.map(([, value]) => value));
    const options = ranges.map(([label, from, to]) => label + " " + money(from) + (to && to !== from ? "–" + to : "")).join(" · ");
    return { area, title, detail, from: low, unit, options };
  }),
  ...products.map((item) => ({ area: "Infoprodutos", title: item.title, detail: item.delivery, from: item.price / 100, unit: "", options: item.category })),
].map((item) => ({ ...item, haystack: fold([item.area, item.title, item.detail, item.options, TAGS[item.area]].join(" ")) }));
const minOf = (area) => Math.min(...services.filter((item) => item.area === area).map((item) => item.from));
const find = (title) => services.find((item) => item.title === title);

/* ---------- Rolagem suave (Lenis + ScrollTrigger) ---------- */
let lenis = null;
if (motion) {
  gsap.registerPlugin(ScrollTrigger);
  lenis = new Lenis({ duration: 0.65, easing: (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)), wheelMultiplier: 0.6 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}
function scrollToTarget(target, duration = 1.1) {
  if (lenis) lenis.scrollTo(target, { offset: typeof target === "number" ? 0 : -64, duration });
  else if (typeof target === "number") scrollTo({ top: target, behavior: reduceMotion ? "auto" : "smooth" });
  else target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
}
document.addEventListener("click", (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link) return;
  const id = link.getAttribute("href").slice(1);
  const target = id === "start" ? 0 : document.getElementById(id);
  if (target === null) return;
  event.preventDefault();
  closeSheet();
  scrollToTarget(target);
});

/* ---------- Navegação ---------- */
const nav = $("#nav");
const menu = $("#nav-menu");
const sheet = $("#nav-sheet");
function closeSheet() { sheet.hidden = true; menu.setAttribute("aria-expanded", "false"); }
menu.addEventListener("click", () => {
  const open = sheet.hidden;
  sheet.hidden = !open;
  menu.setAttribute("aria-expanded", String(open));
});
addEventListener("keydown", (event) => { if (event.key === "Escape") closeSheet(); });
const onNavScroll = () => nav.classList.toggle("compact", scrollY > innerHeight * 0.6);
addEventListener("scroll", onNavScroll, { passive: true });
onNavScroll();

/* ---------- Hero ---------- */
const heroTitle = $("#hero-title");
"Descreva, o mutirão cria".split(" ").forEach((word, index) => {
  if (index) heroTitle.append(" ");
  const span = document.createElement("span");
  span.className = "hero-in";
  span.style.setProperty("--d", (0.1 + index * 0.09).toFixed(2) + "s");
  span.textContent = word;
  heroTitle.append(span);
});
const phrases = [
  "Preciso de artes de carrossel para o meu perfil",
  "Quero uma landing page para vender meu curso",
  "Edição de Reels para o mês inteiro",
  "Um calendário de conteúdos para dezembro",
  "Fotos profissionais para o meu perfil",
];
const typed = $("#typed");
const promptInput = $("#prompt-input");
promptInput.placeholder = " ";
if (reduceMotion) typed.textContent = phrases[0];
else setTimeout(function typeLoop(index = 0, length = 0, deleting = false) {
  const phrase = phrases[index];
  length = deleting ? Math.max(0, length - 2) : length + 1;
  typed.textContent = phrase.slice(0, length);
  let wait = deleting ? 16 : 35;
  if (!deleting && length === phrase.length) { deleting = true; wait = 2600; }
  else if (deleting && length === 0) { deleting = false; index = (index + 1) % phrases.length; wait = 400; }
  setTimeout(() => typeLoop(index, length, deleting), wait);
}, 1350);

/* ---------- Catálogo e busca ---------- */
const list = $("#service-list");
const filters = $("#catalog-filters");
const status = $("#catalog-status");
const defaultStatus = status.textContent;
let activeArea = "Todos";
["Todos", ...AREAS].forEach((name) => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = name;
  button.addEventListener("click", () => setFilter(name));
  filters.append(button);
});
function render(items, matched = false) {
  list.replaceChildren(...items.map((item, index) => {
    const li = document.createElement("li");
    li.className = "service" + (matched ? " match" : "");
    li.style.animationDelay = Math.min(index, 12) * 30 + "ms";
    li.innerHTML = `<small></small><h3></h3><p></p><span class="price">a partir de <strong>${money(item.from)}</strong>${item.unit ? " " + item.unit : ""}</span>`;
    $("small", li).textContent = item.area;
    $("h3", li).textContent = item.title;
    $("p", li).textContent = item.detail;
    li.title = item.options;
    return li;
  }));
  if (motion) ScrollTrigger.refresh();
}
function markFilter() {
  [...filters.children].forEach((button) => button.setAttribute("aria-pressed", String(button.textContent === activeArea)));
}
function setFilter(area) {
  activeArea = area;
  status.textContent = defaultStatus;
  markFilter();
  render(area === "Todos" ? services : services.filter((item) => item.area === area));
}
function search(query) {
  const stems = fold(query).split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !STOP.has(word))
    .map((word) => word.replace(/(oes|aes|ais|eis|es|s)$/, ""));
  const scored = services
    .map((item) => ({ item, score: stems.reduce((sum, stem) => sum + (stem.length > 2 && item.haystack.includes(stem) ? (fold(item.title).includes(stem) ? 3 : 1) : 0), 0) }))
    .filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score).slice(0, 6);
  activeArea = scored.length ? "" : "Todos";
  markFilter();
  if (!scored.length) {
    status.textContent = "Não achamos um serviço exato para isso. Veja o catálogo completo abaixo.";
    render(services);
  } else {
    status.textContent = scored.length === 1 ? "Este serviço combina com o que você descreveu:" : `Estes ${scored.length} serviços combinam com o que você descreveu:`;
    render(scored.map((entry) => entry.item), true);
  }
}
$("#prompt-form").addEventListener("submit", (event) => {
  event.preventDefault();
  search(promptInput.value.trim() || typed.textContent || phrases[0]);
  scrollToTarget($("#catalogo"), 1.4);
});
$("#final-cta").addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  scrollToTarget(0, 1.6);
  setTimeout(() => promptInput.focus({ preventScroll: true }), reduceMotion ? 0 : 1700);
});
setFilter("Todos");

/* ---------- Cursor personalizado ---------- */
const ICONS = {
  nav: '<path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  back: '<path d="M20 12H5M11 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  up: '<path d="M12 20V5M6 11l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  external: '<path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  send: '<path d="M3 11.5 21 4l-7.5 18-2.2-8.3z" fill="currentColor"/>',
  text: '<path d="M9 4h6M9 20h6M12 4v16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  dot: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
  menu: '<path d="M4 8h16M4 16h16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  plus: '<path d="M12 4v16M4 12h16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  arrows: '<path d="M9 6l-6 6 6 6M15 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  scroll: '<path d="M12 4v16M6 14l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  sparkle: '<path d="M12 2c.5 5.3 4.7 9.5 10 10-5.3.5-9.5 4.7-10 10-.5-5.3-4.7-9.5-10-10 5.3-.5 9.5-4.7 10-10z" fill="currentColor"/>',
};
ICONS.close = ICONS.plus;
const SIZES = { default: 12, hover: 40, plus: 52, close: 52, arrows: 52, scroll: 52 };
const cursor = $("#cursor");
if (!reduceMotion && matchMedia("(pointer: fine)").matches && !matchMedia("(forced-colors: active)").matches) {
  const icon = $(".cursor-icon", cursor);
  let x = 0, y = 0, mode = "", last = null;
  const modeFor = (element) => {
    const tagged = element?.closest("[data-cursor]");
    if (tagged) return tagged.dataset.cursor;
    const link = element?.closest("a");
    if (link) return link.host && link.host !== location.host ? "external" : "nav";
    return element?.closest("button, input, label, [role=button]") ? "hover" : "default";
  };
  const setMode = (next) => {
    if (next === mode) return;
    mode = next;
    cursor.dataset.mode = next;
    cursor.style.setProperty("--size", (SIZES[next] ?? 40) + "px");
    cursor.classList.toggle("has-icon", !!ICONS[next]);
    icon.innerHTML = ICONS[next] ? `<svg viewBox="0 0 24 24">${ICONS[next]}</svg>` : "";
  };
  const refresh = () => setMode(modeFor(document.elementFromPoint(x, y) ?? last));
  document.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse") return;
    x = event.clientX; y = event.clientY;
    cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    document.documentElement.classList.add("cursor-on");
  }, { passive: true });
  document.addEventListener("pointerover", (event) => { last = event.target; setMode(modeFor(event.target)); }, { passive: true });
  document.addEventListener("pointerout", (event) => { if (!event.relatedTarget) document.documentElement.classList.remove("cursor-on"); });
  addEventListener("scroll", () => requestAnimationFrame(refresh), { passive: true, capture: true });
  new MutationObserver(refresh).observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ["data-cursor"] });
  setMode("default");
}

/* ---------- Brilho WebGL do topo (ruído "neuro" que segue o ponteiro) ---------- */
const layerNeuro = $("#layer-neuro");
(function neuro() {
  const canvas = $("#neuro");
  const gl = canvas.getContext("webgl", { premultipliedAlpha: false, alpha: true });
  if (!gl) return;
  const vertex = `precision mediump float; varying vec2 vUv; attribute vec2 a_position;
    void main() { vUv = .5 * (a_position + 1.); gl_Position = vec4(a_position, 0.0, 1.0); }`;
  const fragment = `precision mediump float; varying vec2 vUv;
    uniform float u_time; uniform float u_ratio; uniform vec2 u_pointer; uniform float u_cap;
    vec2 rotate(vec2 uv, float th) { return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv; }
    float neuro(vec2 uv, float t, float p) {
      vec2 acc = vec2(0.); vec2 res = vec2(0.); float scale = 8.;
      for (int j = 0; j < 15; j++) {
        uv = rotate(uv, 1.); acc = rotate(acc, 1.);
        vec2 layer = uv * scale + float(j) + acc - t - p;
        acc += sin(layer); res += (.5 + .5 * cos(layer)) / scale; scale *= 1.2;
      }
      return res.x + res.y;
    }
    void main() {
      vec2 uv = .5 * vUv; uv.x *= u_ratio;
      vec2 pointer = vUv - u_pointer; pointer.x *= u_ratio;
      float p = clamp(length(pointer), 0., 1.); p = .5 * pow(1. - p, 2.);
      float t = .00012 * u_time;
      float n = neuro(uv, t, p);
      n = 1.2 * pow(n, 3.); n += pow(n, 10.); n = max(.0, n - .5); n *= (1. - length(vUv - .5));
      vec3 color = vec3(.62, .86, .28) * min(n, u_cap);
      gl_FragColor = vec4(color, n);
    }`;
  const compile = (type, source) => { const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader); return shader; };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  const u = (name) => gl.getUniformLocation(program, name);
  const [uTime, uRatio, uPointer, uCap] = ["u_time", "u_ratio", "u_pointer", "u_cap"].map(u);
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const pointer = { x: .5, y: .5, tx: .5, ty: .5 };
  addEventListener("pointermove", (event) => { pointer.tx = event.clientX / innerWidth; pointer.ty = event.clientY / innerHeight; }, { passive: true });
  const start = performance.now();
  let raf = 0;
  function draw() {
    const width = Math.round(canvas.clientWidth * dpr), height = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; gl.viewport(0, 0, width, height); }
    pointer.x += (pointer.tx - pointer.x) * .05;
    pointer.y += (pointer.ty - pointer.y) * .05;
    gl.uniform1f(uTime, reduceMotion ? 0 : performance.now() - start);
    gl.uniform1f(uRatio, width / height);
    gl.uniform2f(uPointer, pointer.x, 1 - pointer.y);
    gl.uniform1f(uCap, 2.5);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  const loop = () => { draw(); raf = requestAnimationFrame(loop); };
  if (reduceMotion) { draw(); addEventListener("resize", draw); return; }
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && layerNeuro.style.display !== "none") { if (!raf) loop(); }
    else { cancelAnimationFrame(raf); raf = 0; }
  }).observe(canvas);
  new MutationObserver(() => {
    if (layerNeuro.style.display === "none") { cancelAnimationFrame(raf); raf = 0; } else if (!raf) loop();
  }).observe(layerNeuro, { attributes: true, attributeFilter: ["style"] });
})();

/* ---------- Túnel 3D de serviços (three.js) ---------- */
const layerGallery = $("#layer-gallery");
const gallery = (function tunnel() {
  if (!motion || !window.THREE) return { seek() {} };
  const canvas = $("#gallery");
  const P = { count: 320, spreadX: 460, spreadY: 290, depth: 300, nearOffset: 40, planeSize: 20, planeJitter: .4, fov: 62 };
  const rand = (n) => { const t = Math.sin(n * 127.1) * 43758.5453; return t - Math.floor(t); };
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, 115, 290);
  const camera = new THREE.PerspectiveCamera(P.fov, 1, .1, 600);
  const geometry = new THREE.PlaneGeometry(1, 1);
  const palette = [["#d8f386", "#0f1f17"], ["#f3f6ef", "#192421"], ["#183d30", "#f3f6ef"], ["#e9e2d3", "#2a241a"], ["#1d2a24", "#d8f386"], ["#dcecdd", "#183d30"], ["#4c9b6a", "#0f1f17"], ["#2f4a39", "#eefcc6"]];
  const textures = services.map((item, index) => {
    const tile = document.createElement("canvas");
    tile.width = 256; tile.height = 320;
    const ctx = tile.getContext("2d");
    const [bg, ink] = palette[index % palette.length];
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 256, 320);
    ctx.fillStyle = ink; ctx.globalAlpha = .14;
    ctx.beginPath(); ctx.arc(200 + (index % 3) * 10, 250, 90, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = .7; ctx.font = "700 13px 'DM Sans', sans-serif"; ctx.fillText(item.area.toUpperCase(), 20, 34);
    ctx.globalAlpha = 1; ctx.font = "34px 'Fraunces', Georgia, serif";
    const words = item.title.split(" "); let line = "", y = 120;
    for (const word of words) {
      if (ctx.measureText(line + word).width > 216 && line) { ctx.fillText(line.trim(), 20, y); y += 38; line = ""; }
      line += word + " ";
    }
    ctx.fillText(line.trim(), 20, y);
    ctx.globalAlpha = .75; ctx.font = "500 15px 'DM Sans', sans-serif";
    ctx.fillText("a partir de " + money(item.from), 20, 292);
    const texture = new THREE.CanvasTexture(tile);
    texture.anisotropy = 4;
    return texture;
  });
  const frames = [];
  for (let i = 0; i < P.count; i++) {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: textures[i % textures.length], fog: true }));
    const size = P.planeSize * (1 - P.planeJitter * rand(i * 3.7));
    mesh.scale.set(size * .8, size, 1);
    scene.add(mesh);
    frames.push({ mesh, base: P.nearOffset + rand(i * 11.3) * P.depth, x: (rand(i * 1.3) - .5) * P.spreadX, y: (rand(i * 5.1) - .5) * P.spreadY });
  }
  let travel = 0, target = 0, exitTravel = 1, last = performance.now(), width = 0, height = 0;
  function computeExit() {
    const tan = Math.tan(THREE.MathUtils.degToRad(P.fov) / 2), aspect = camera.aspect || 1;
    exitTravel = Math.max(1, ...frames.map((f) => f.base - Math.max((Math.abs(f.x) - f.mesh.scale.x / 2) / (tan * aspect), (Math.abs(f.y) - f.mesh.scale.y / 2) / tan, 0)));
  }
  function size() {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    if (w === width && h === height) return;
    width = w; height = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    computeExit();
  }
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, .1); last = now;
    if (layerGallery.style.display !== "block") return;
    size();
    travel += (target * exitTravel - travel) * Math.min(dt * 8, 1);
    for (const f of frames) {
      const z = f.base - travel;
      f.mesh.visible = z > 0;
      if (f.mesh.visible) f.mesh.position.set(f.x, f.y, -z);
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
  return { seek(value) { target = clamp01(value); } };
})();

/* ---------- Galeria de áreas em coverflow (presa à rolagem) ---------- */
const TEMPLATES = [
  { kind: "wordmark", label: "Design", need: "pro seu feed", brand: "Arte & Feed", word: "FEED", left: "Design", right: "Mutirão",
    tagline: "Carrossel, estática\ne banner", address: "a partir de\n" + money(minOf("Design")) + " por arte", cats: ["Carrossel", "Stories"],
    style: { bg: "#f3f6ef", ink: "#192421", shape: "#d8f386" } },
  { kind: "statement", label: "Landing page", need: "pra vender online", brand: "Página no ar", word: money(find("Criação de landing page").from).replace("R$ ", "R$"),
    body: find("Criação de landing page").detail, left: "Web", right: "Por página", style: { bg: "#183d30", ink: "#f3f6ef", shape: "#d8f386" } },
  { kind: "editorial", label: "Edição de vídeo", need: "pros seus Reels e YouTube", brand: "Corte Certo", left: "Vídeo", right: "Edição",
    headline: ["REELS,", "VSL E", "YOUTUBE"], accent: "edição que segura", cta: "VER SERVIÇOS", foot: ["EDIÇÃO SIMPLES OU ELABORADA", "A PARTIR DE " + money(minOf("Vídeo"))],
    style: { bg: "#e9e2d3", ink: "#2a241a", shape: "#c9b98f" } },
  { kind: "editorial", label: "Estratégia de conteúdo", need: "pro seu calendário", brand: "Plano Claro", left: "Estratégia", right: "Mensal",
    headline: ["CONTEÚDO", "COM", "CALENDÁRIO"], accent: "planejado mês a mês", cta: "VER SERVIÇOS", foot: ["CALENDÁRIO, ANÁLISE E ESTRATÉGIA", "A PARTIR DE " + money(minOf("Estratégia"))],
    style: { bg: "#dcecdd", ink: "#183d30", shape: "#9fcfa9" } },
  { kind: "statement", label: "Gestão de redes", need: "pras suas redes, todo mês", brand: "Rede Viva", word: "Redes",
    body: "Gestão de redes, social selling, tráfego e head de conteúdo, com preço de referência mensal.", left: "Gestão", right: "/ mês",
    style: { bg: "#d8f386", ink: "#0f1f17", shape: "#183d30" } },
  { kind: "wordmark", label: "Copy e roteiro", need: "pras suas páginas e posts", brand: "Boa Palavra", word: "COPY", left: "Texto", right: "Roteiro",
    tagline: "Carrossel, VSL\ne landing page", address: "a partir de\n" + money(minOf("Copy e roteiro")), cats: ["Copy", "Roteiro"],
    style: { bg: "#111714", ink: "#f3f6ef", shape: "#4c9b6a" } },
];
const ITEMS = [...TEMPLATES.map((t) => ({ label: t.label, need: t.need })), { label: "Catálogo completo", need: "todas as áreas do mutirão" }];
const track = $("#picker-track");
const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function page(t) {
  const bar = `<span class="tpl__bar"><span>${esc(t.left)}</span><span>${esc(t.brand)}</span><span>${esc(t.right)}</span></span>`;
  if (t.kind === "wordmark") return `<span class="tpl__page" aria-hidden="true">${bar}<span class="tpl__word">${esc(t.word)}</span>
      <span class="tpl__block"><i style="width:60%;height:60%"></i><i style="width:30%;height:30%"></i></span>
      <span class="tpl__corner tpl__corner--l">${esc(t.tagline)}</span><span class="tpl__corner tpl__corner--r">${esc(t.address)}</span>
      <span class="tpl__cats">${t.cats.map((c) => `<span>${esc(c)}<span>→</span></span>`).join("")}</span></span>`;
  if (t.kind === "editorial") return `<span class="tpl__page" aria-hidden="true">${bar}
      <span class="tpl__shot tpl__shot--a"></span><span class="tpl__shot tpl__shot--b"></span><span class="tpl__shot tpl__shot--c"></span>
      <span class="tpl__center"><span class="tpl__lede">${esc(t.headline[0])}</span><span class="tpl__accent">${esc(t.accent)}</span>
      ${t.headline.slice(1).map((h) => `<span class="tpl__lede">${esc(h)}</span>`).join("")}<span class="tpl__link">${esc(t.cta)}</span></span>
      <span class="tpl__foot"><span>${esc(t.foot[0])}</span><span>${esc(t.foot[1])}</span></span></span>`;
  return `<span class="tpl__page" aria-hidden="true">${bar}<span class="tpl__giant">${esc(t.word)}</span>
      <span class="tpl__object"><b></b></span><span class="tpl__para">${esc(t.body)}</span></span>`;
}
TEMPLATES.forEach((t) => {
  const li = document.createElement("li");
  li.innerHTML = `<span class="tpl" style="--tpl-bg:${t.style.bg};--tpl-ink:${t.style.ink};--tpl-shape:${t.style.shape}">${page(t)}<span class="sr-only">${esc(t.label)} — ${esc(t.need)}</span></span>`;
  track.append(li);
});
const exploreLi = document.createElement("li");
exploreLi.innerHTML = `<span class="tpl tpl--explore" data-cursor="scroll"><span class="tpl__page"><span class="tpl__explore-title">Explore o catálogo inteiro</span></span></span>`;
track.append(exploreLi);
const cards = [...track.children];
const explorePage = $(".tpl__page", exploreLi);
const exploreTitle = $(".tpl__explore-title", exploreLi);
const dots = $("#picker-dots");
const fills = ITEMS.map((item, index) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "picker__dot";
  button.style.setProperty("--d", (0.3 + index * 0.06) + "s");
  button.setAttribute("aria-label", "Ir para " + item.label);
  button.innerHTML = '<span class="picker__dot-visual"><i class="picker__dot-fill"></i></span>';
  button.addEventListener("click", () => goToCard(index));
  dots.append(button);
  return $(".picker__dot-fill", button);
});
const caption = $("#picker-caption");
const rail = $("#picker-rail");
const panel = $("#picker-panel");
const float = $("#picker-float");
const viewport = $("#picker-viewport");
let activeCard = -1, step = 0, total = 0, exit = 0;
function renderCaption(index) {
  if (index === activeCard) return;
  activeCard = index;
  [...dots.children].forEach((dot, i) => { if (i === index) dot.setAttribute("data-on", ""); else dot.removeAttribute("data-on"); dot.setAttribute("aria-current", String(i === index)); });
  cards.forEach((card, i) => card.classList.toggle("is-active", i === index));
  $("#picker-next").setAttribute("aria-label", index === ITEMS.length - 1 ? "Explorar o catálogo" : "Próxima área");
  if (index === ITEMS.length - 1) { caption.replaceChildren(); return; }
  const item = ITEMS[index];
  const name = [...item.label].map((ch, i, all) => `<span class="picker__caption-char" style="--i:${i};--n:${all.length}" aria-hidden="true">${ch === " " ? "&nbsp;" : esc(ch)}</span>`).join("");
  caption.innerHTML = `<div class="picker__caption-inner"><span class="picker__caption-name" aria-label="${esc(item.label)}">${name}</span><span class="picker__caption-need">${esc(item.need)}</span></div>`;
}
function measurePicker() {
  step = cards[0].firstElementChild.offsetWidth + 24;
  total = step * (ITEMS.length - 1);
  exit = innerHeight * 0.6;
  rail.style.height = `calc(100vh + ${total + exit}px)`;
}
function goToCard(index) {
  index = Math.min(ITEMS.length - 1, Math.max(0, index));
  if (!motion) { viewport.scrollTo({ left: index * step, behavior: "smooth" }); return; }
  const top = rail.getBoundingClientRect().top + scrollY;
  lenis.scrollTo(top + (total / (ITEMS.length - 1)) * index, { duration: 0.7 });
}
$("#picker-next").addEventListener("click", () => {
  if (activeCard === ITEMS.length - 1) {
    if (!motion) { scrollToTarget($("#catalogo")); return; }
    const top = rail.getBoundingClientRect().top + scrollY;
    lenis.scrollTo(top + total + exit, { duration: 1.1 });
  } else goToCard(activeCard + 1);
});
new IntersectionObserver(([entry]) => float.classList.toggle("is-in", entry.isIntersecting)).observe(panel);
renderCaption(0);

if (motion) {
  measurePicker();
  const pickerTrigger = ScrollTrigger.create({
    trigger: rail, start: "top top", end: "bottom bottom", scrub: true,
    onUpdate: applyPicker, onRefresh: applyPicker,
  });
  function applyPicker(self) {
    const v = total / (total + exit), y = self.progress, b = ITEMS.length - 1;
    const x = smoothstep(clamp01((y - v) / (1 - v)));
    const O = clamp01(y / v);
    const D = x * Math.max(0, (innerWidth - Math.max(1, step - 24)) / 2 - 24 + 40);
    track.style.transform = `translate3d(${(-total * O - D).toFixed(1)}px, 0, 0)`;
    const A = O * b, j = Math.min(b, Math.max(0, Math.round(A)));
    renderCaption(j);
    cards.forEach((card, e) => {
      const n = e - A, r = Math.max(-1, Math.min(1, n)), i = Math.min(Math.abs(n) / 2, 1);
      card.style.transform = (e === b ? `translateX(${D.toFixed(1)}px) ` : "") + `rotateY(${(-r * 38).toFixed(2)}deg) translateZ(${(-i * 200).toFixed(1)}px) scale(${(1 - i * .08).toFixed(4)})`;
      card.style.opacity = e === b ? "1" : ((1 - i * .5) * (1 - clamp01(x * 2))).toFixed(3);
    });
    const M = j === 0 ? 0 : j - .5, Pn = j === b ? b : j + .5, F = clamp01((A - M) / (Pn - M));
    fills.forEach((fill, e) => { fill.style.transform = `scaleX(${e === j ? F.toFixed(3) : 0})`; });
    const scale = 1 + (Math.max(innerWidth / Math.max(1, explorePage.offsetWidth), innerHeight / Math.max(1, explorePage.offsetHeight)) - 1) * x;
    explorePage.style.transform = x > 0 ? `scale(${scale.toFixed(4)})` : "";
    explorePage.style.borderRadius = (18 * (1 - x)).toFixed(1) + "px";
    const r3 = clamp01(x * 3);
    explorePage.style.opacity = String(1 - r3 * .999);
    exploreTitle.style.filter = x > 0 ? `blur(${(r3 * 10).toFixed(1)}px)` : "";
    explorePage.style.setProperty("--glass", (1 - r3).toFixed(3));
    explorePage.dataset.glass = 1 - r3 <= 0 ? "off" : "on";
    const past = y >= 1 && self.scroll() - self.end > innerHeight;
    if (!past) gallery.seek(x * .12);
    if (y >= 1) { if (!past) { layerGallery.style.display = "block"; layerGallery.style.opacity = "1"; layerGallery.style.clipPath = ""; } }
    else {
      const near = clamp01(1 - Math.abs(b - A) / .18);
      if (x > 0 || near > 0) {
        const rect = explorePage.getBoundingClientRect(), radius = 18 * (1 - x) * scale, i = .2 * near;
        layerGallery.style.display = "block";
        layerGallery.style.opacity = (i + (1 - i) * r3).toFixed(3);
        layerGallery.style.clipPath = `inset(${Math.max(0, rect.top).toFixed(1)}px ${Math.max(0, innerWidth - rect.right).toFixed(1)}px ${Math.max(0, innerHeight - rect.bottom).toFixed(1)}px ${Math.max(0, rect.left).toFixed(1)}px round ${radius.toFixed(1)}px)`;
      } else { layerGallery.style.display = "none"; layerGallery.style.opacity = "0"; layerGallery.style.clipPath = ""; }
    }
    const L = 1 - clamp01(x * 2);
    layerNeuro.style.opacity = String(L);
    layerNeuro.style.display = L <= 0 ? "none" : "";
    caption.style.opacity = String(L);
    caption.style.setProperty("--arrive", clamp01((.5 - Math.abs(A - j)) / .28).toFixed(3));
    float.style.opacity = String(L);
    float.style.pointerEvents = L < .5 ? "none" : "";
    panel.style.visibility = x >= 1 ? "hidden" : "visible";
  }
  addEventListener("resize", () => { measurePicker(); ScrollTrigger.refresh(); });
  document.fonts.ready.then(() => { measurePicker(); ScrollTrigger.refresh(); });
}

/* ---------- Showcase: título digitado pela rolagem, explosão com física e leque de cards ---------- */
const STEPS = [
  { tint: "#f3f6ef", word: "Descreva", body: "Conte o que você precisa com as suas palavras. A gente encontra o serviço certo no catálogo." },
  { tint: "#dcecdd", word: "Combine", body: "Escopo, prazo e preço acertados antes de começar, a partir dos valores de referência." },
  { tint: "#d8f386", word: "Receba", body: "A entrega chega pronta para usar. E cada venda soma na meta coletiva do grupo." },
];
const wheel = $("#tb-wheel");
const slots = STEPS.map((s, index) => {
  const slot = document.createElement("div");
  slot.className = "tb-slot";
  slot.innerHTML = `<article class="tb-card" style="--tint:${s.tint}"><span class="tb-card__rule" aria-hidden="true"></span>
    <div class="tb-card__center"><span class="tb-card__num">${index + 1}</span><h3 class="tb-card__word">${s.word}</h3></div>
    <p class="tb-card__body">${s.body}</p></article>`;
  wheel.append(slot);
  return slot;
});
const lines = $$(".tb-line");
const LINES = ["Se você precisa,", "a gente cria."];
const chars = lines.flatMap((line, index) => {
  const out = [];
  for (const ch of LINES[index]) {
    if (ch === " ") { line.append(" "); continue; }
    const span = document.createElement("span");
    span.className = "tb-char";
    const inner = document.createElement("span");
    inner.className = "tb-char__inner";
    inner.textContent = ch;
    span.append(inner);
    line.append(span);
    out.push(span);
  }
  return out;
});
const tbLayer = $("#tb-layer");
if (motion) {
  const headline = $("#tb-headline");
  const caret = document.createElement("span");
  caret.className = "tb-caret";
  const fixHeights = () => lines.forEach((line) => {
    const kids = [...line.children], prev = kids.map((k) => k.style.display);
    kids.forEach((k) => (k.style.display = "inline-block"));
    line.style.height = ""; line.style.height = line.clientHeight + "px";
    kids.forEach((k, i) => (k.style.display = prev[i]));
  });
  fixHeights();
  let engine = null, bodies = [], exploded = false, shown = 0, dealt = -1, lastTick = 0;
  let stepDeg = parseFloat(getComputedStyle(tbLayer).getPropertyValue("--step")) || 6.2;
  const tick = () => {
    if (!engine) return;
    const now = performance.now(), dt = lastTick ? Math.min(now - lastTick, 50) : 1000 / 60;
    lastTick = now;
    Matter.Engine.update(engine, dt);
    for (const b of bodies) b.el.style.transform = `translate(${b.body.position.x - b.x0}px, ${b.body.position.y - b.y0}px) rotate(${b.body.angle}rad) scale(${b.scale})`;
  };
  function explode() {
    if (!window.Matter) { gsap.to(chars, { autoAlpha: 0, duration: .3, ease: "power2.in" }); return; }
    gsap.ticker.remove(tick);
    bodies = [];
    engine = Matter.Engine.create({ gravity: { x: 0, y: 0 } });
    const box = headline.getBoundingClientRect(), cx = box.left + box.width / 2, cy = box.top + box.height / 2;
    for (const ch of chars) {
      const el = ch.firstElementChild, r = el.getBoundingClientRect();
      if (!r.width) continue;
      const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2;
      const body = Matter.Bodies.rectangle(x0, y0, r.width, r.height, { frictionAir: .08, restitution: .4, density: .001 });
      const dx = x0 - cx, dy = y0 - cy, d = Math.hypot(dx, dy) || 1;
      const speed = 9 + Math.random() * 10;
      Matter.Body.setVelocity(body, { x: dx / d * speed * 1.5 + (Math.random() - .5) * 2, y: dy / d * speed * 1.5 - (Math.random() * 5 + 8) });
      Matter.Body.setAngularVelocity(body, (Math.random() - .5) * .5);
      Matter.Composite.add(engine.world, body);
      bodies.push({ el, body, x0, y0, scale: 1 });
    }
    const shuffled = [...bodies].sort(() => Math.random() - .5);
    shuffled.forEach((b, i) => gsap.to(b, { scale: 0, duration: .25, delay: .4 + i * .006, ease: "back.in(2)",
      onComplete: i === shuffled.length - 1 ? () => { tick(); gsap.ticker.remove(tick); } : undefined }));
    lastTick = 0;
    gsap.ticker.add(tick);
  }
  function restore() {
    if (!bodies.length || !engine) { gsap.to(chars, { autoAlpha: 1, duration: .3, ease: "power2.out" }); return; }
    gsap.ticker.remove(tick);
    const from = bodies.map((b) => ({ x: b.body.position.x - b.x0, y: b.body.position.y - b.y0, rotation: b.body.angle * 180 / Math.PI }));
    for (const b of bodies) { gsap.killTweensOf(b.el); gsap.killTweensOf(b); }
    gsap.fromTo(bodies.map((b) => b.el), { x: (i) => from[i].x, y: (i) => from[i].y, rotation: (i) => from[i].rotation, scale: .8 },
      { autoAlpha: 1, x: 0, y: 0, rotation: 0, scale: 1, duration: .4, ease: "expo.out", stagger: { each: .006, from: "random" }, clearProps: "transform" });
    Matter.Composite.clear(engine.world, false);
    bodies = [];
  }
  const deal = (i) => {
    slots[i].classList.add("on");
    gsap.killTweensOf(slots[i]);
    gsap.set(slots[i], { rotation: i * stepDeg });
    gsap.fromTo(slots[i], { scale: .94 }, { scale: 1, ease: "elastic.out(0.6, 0.3)", duration: .5 });
  };
  function fan(progress) {
    const target = Math.min(slots.length - 1, Math.floor(progress / .39));
    if (target === dealt) return;
    if (target > dealt) for (let i = dealt + 1; i <= target; i++) deal(i);
    else for (let i = dealt; i > target; i--) slots[i].classList.remove("on");
    gsap.to(wheel, { rotation: -target * stepDeg + stepDeg / 2 * target, ease: "elastic.out(0.6, 0.3)", duration: .5 });
    dealt = target;
  }
  function unfan() {
    if (dealt < 0) return;
    slots.forEach((s) => s.classList.remove("on"));
    gsap.to(wheel, { rotation: 0, duration: .3, ease: "power2.out" });
    dealt = -1;
  }
  const TYPE_END = 2.6 / 6, BLAST = 3 / 6;
  function blast(e) {
    const t = Math.min(e / TYPE_END, 1), n = Math.round(t * chars.length), changed = n !== shown;
    while (shown < n) chars[shown++].style.display = "inline-block";
    while (shown > n) chars[--shown].style.display = "none";
    if (t < 1) { if (changed || !caret.isConnected) (shown === 0 ? lines[0].prepend(caret) : chars[shown - 1].after(caret)); }
    else caret.remove();
    const on = e >= BLAST;
    if (on !== exploded) { exploded = on; on ? explode() : restore(); }
    if (e <= BLAST) unfan(); else fan(Math.min((e - BLAST) / (1 - BLAST), .999));
  }
  addEventListener("resize", () => {
    fixHeights();
    stepDeg = parseFloat(getComputedStyle(tbLayer).getPropertyValue("--step")) || 6.2;
    slots.forEach((s, i) => { if (s.classList.contains("on")) gsap.set(s, { rotation: i * stepDeg }); });
    if (dealt >= 0) gsap.set(wheel, { rotation: -dealt * stepDeg + stepDeg / 2 * dealt });
  });
  document.fonts.ready.then(fixHeights);
  ScrollTrigger.create({
    trigger: "#showcase", start: "top bottom", end: "bottom bottom", scrub: true,
    onUpdate: applyShowcase, onRefresh: applyShowcase,
  });
  function applyShowcase(self) {
    const r = self.progress, c = innerHeight / (self.end - self.start);
    const l = clamp01((r - c) / (1 - c)), u = clamp01((l - .28) / (.34 - .28)), d = clamp01((l - .28) / (1 - .28));
    if (l > 0) {
      layerGallery.style.display = u >= 1 ? "none" : "block";
      layerGallery.style.opacity = String(1 - u);
      layerGallery.style.clipPath = "";
      tbLayer.style.opacity = String(u);
    } else tbLayer.style.opacity = "0";
    const showcase = $("#showcase"), wantsScroll = u < 1 && r > 0;
    if (wantsScroll !== showcase.hasAttribute("data-cursor")) wantsScroll ? (showcase.dataset.cursor = "scroll") : showcase.removeAttribute("data-cursor");
    blast(d);
    if (u < 1) gallery.seek(.12 + .88 * clamp01(r / (c + (1 - c) * .34)));
  }
} else {
  chars.forEach((c) => (c.style.display = "inline"));
  slots.forEach((s) => s.classList.add("on"));
}

/* ---------- Capacidades: cards que sobem e empilham ---------- */
const capCards = $$(".cap-card");
const capTitles = $$(".cap-title");
$("#cap-grid").innerHTML = ["Arte de carrossel", "Criação de landing page", "Edição de Reels simples", "Copy de VSL", "Calendário de conteúdos", "Gestão de tráfego"]
  .map((title) => { const s = find(title); return `<div><small>${esc(s.area)}</small><b>${esc(s.title)}</b><span>a partir de ${money(s.from)}</span></div>`; }).join("");
if (motion) {
  const fadeWindow = (v) => clamp01((v - .35) / .45);
  const titleState = (cur, next) => { const n = clamp01((cur - .5) / .5), r = 1 - clamp01(next / .5); return { opacity: n * r, lift: (1 - n) * 10 - (1 - r) * 10 }; };
  ScrollTrigger.create({
    trigger: "#cap-pin", start: "top top", end: "bottom bottom",
    onUpdate: applyCap, onRefresh: applyCap,
  });
  function applyCap(self) {
    const h = innerHeight;
    const o = capCards.map((_, n) => (n === 0 ? 1 : clamp01((self.progress - (n - 1) * .47) / .51)));
    capCards.forEach((card, n) => {
      let above = 0;
      for (let m = n + 1; m < capCards.length; m++) above += o[m];
      const rest = -above * 26, from = n === 0 ? rest : h, y = from + (rest - from) * easeOutCubic(o[n]);
      card.style.transform = `translateX(-50%) translateY(${y.toFixed(1)}px) scale(${(1 - above * .05).toFixed(3)})`;
      card.style.filter = `brightness(${(1 - above * .14).toFixed(2)})`;
      card.style.zIndex = String(n);
    });
    capTitles.forEach((title, t) => {
      const s = titleState(fadeWindow(o[t]), t + 1 < o.length ? fadeWindow(o[t + 1]) : 0);
      title.style.opacity = s.opacity.toFixed(3);
      title.style.transform = `translateY(${s.lift.toFixed(1)}px)`;
      title.setAttribute("aria-hidden", s.opacity < .5 ? "true" : "false");
    });
  }
}
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const daysLeft = Math.round((Date.parse(DEADLINE) - Date.parse(today)) / 86400000) + 1;
$("#days-left").textContent = daysLeft > 1 ? daysLeft + " dias" : daysLeft === 1 ? "Último dia" : "Encerrado";

/* ---------- Por que: carrossel com arraste e roda do mouse ---------- */
const prev = $("#why-prev"), next = $("#why-next");
if (window.Swiper) {
  const swiper = new Swiper("#why-swiper", {
    slidesPerView: "auto", spaceBetween: 24, speed: reduceMotion ? 0 : 600, resistanceRatio: .85,
    freeMode: { enabled: true, momentum: !reduceMotion, momentumBounce: true, sticky: false },
    mousewheel: { forceToAxis: true },
  });
  const sync = () => { prev.disabled = swiper.isBeginning; next.disabled = swiper.isEnd; };
  swiper.on("progress", sync); swiper.on("resize", sync); sync();
  prev.addEventListener("click", () => swiper.slidePrev());
  next.addEventListener("click", () => swiper.slideNext());
} else {
  const el = $("#why-swiper .swiper-wrapper");
  el.style.overflowX = "auto";
  prev.addEventListener("click", () => el.scrollBy({ left: -416, behavior: "smooth" }));
  next.addEventListener("click", () => el.scrollBy({ left: 416, behavior: "smooth" }));
}

/* ---------- FAQ: faixa curva em loop e acordeão ---------- */
(function loop() {
  const W = 1440, H = 320, MID = H / 2, AMP = 100;
  const path = $("#loop-path");
  path.setAttribute("d", `M -320 ${MID} Q -160 ${MID - AMP} 0 ${MID} T 320 ${MID} T 640 ${MID} T 960 ${MID} T 1280 ${MID} T 1600 ${MID}`);
  const a = $("#loop-a"), b = $("#loop-b"), marks = $("#loop-marks"), measureWord = $("#loop-measure-word");
  const WORD = "Perguntas frequentes", GAP = " ".repeat(7);
  let length = 0, unit = 0, wordLen = 0, reps = 1, offset = 0, markEls = [];
  function layout() {
    length = path.getTotalLength();
    measureWord.textContent = WORD + GAP;
    unit = measureWord.getComputedTextLength();
    measureWord.textContent = WORD;
    wordLen = measureWord.getComputedTextLength();
    if (!unit) return;
    reps = Math.max(1, Math.round(length / unit));
    const text = (WORD + GAP).repeat(reps);
    for (const tp of [a, b]) { tp.textContent = text; tp.setAttribute("textLength", length); tp.setAttribute("lengthAdjust", "spacing"); }
    marks.replaceChildren();
    markEls = Array.from({ length: reps }, () => {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.innerHTML = '<rect x="-30" y="-30" width="60" height="60" rx="17" fill="#0f1f17"/><ellipse rx="15" ry="6" fill="none" stroke="#d8f386" stroke-width="3" transform="rotate(45)"/><ellipse rx="15" ry="6" fill="none" stroke="#d8f386" stroke-width="3" transform="rotate(-45)"/><circle r="3" fill="#d8f386"/>';
      marks.append(g);
      return g;
    });
    place();
  }
  function place() {
    a.setAttribute("startOffset", offset);
    b.setAttribute("startOffset", offset - length);
    const scale = length / (unit * reps);
    markEls.forEach((g, k) => {
      let pos = (k * unit + wordLen + (unit - wordLen) / 2) * scale + offset;
      pos = ((pos % length) + length) % length;
      const p = path.getPointAtLength(pos), q = path.getPointAtLength(Math.min(length, pos + 1));
      const angle = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI;
      g.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${angle.toFixed(1)})`);
    });
  }
  document.fonts.ready.then(layout);
  layout();
  if (reduceMotion) return;
  let raf = 0, lastTime = 0;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = lastTime ? Math.min(now - lastTime, 50) / 1000 : 0;
    lastTime = now;
    if (!length) return;
    offset = (offset + 55 * dt) % length;
    place();
  };
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) { if (!raf) { lastTime = 0; raf = requestAnimationFrame(frame); } }
    else { cancelAnimationFrame(raf); raf = 0; }
  }).observe($("#loop-svg"));
})();
$$(".faq-q").forEach((button) => {
  const item = button.parentElement;
  const panelEl = $(".faq-a", item);
  const id = "faq-" + [...item.parentElement.children].indexOf(item);
  button.id = id + "-q"; panelEl.id = id + "-a";
  button.setAttribute("aria-controls", panelEl.id);
  panelEl.setAttribute("aria-labelledby", button.id);
  panelEl.setAttribute("aria-hidden", "true");
  button.addEventListener("click", () => {
    const open = !item.classList.contains("open");
    $$(".faq-list li").forEach((li) => {
      li.classList.remove("open");
      const q = $(".faq-q", li);
      q.setAttribute("aria-expanded", "false");
      q.dataset.cursor = "plus";
      $(".faq-a", li).setAttribute("aria-hidden", "true");
    });
    if (open) {
      item.classList.add("open");
      button.setAttribute("aria-expanded", "true");
      button.dataset.cursor = "close";
      panelEl.setAttribute("aria-hidden", "false");
    }
    if (motion) setTimeout(() => ScrollTrigger.refresh(), 320);
  });
});

/* ---------- Chamada final: campo binário com ondas e brilho do ponteiro ---------- */
(function binary() {
  const canvas = $("#binary");
  const ctx = canvas.getContext("2d", { alpha: false });
  const LEVELS = [0, .12, .22, .36, .55, .8], GLYPHS = ["0", "1"], RADIUS = 7;
  const hash = (a, b, c) => { let r = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(c, 1442695041); r = Math.imul(r ^ (r >>> 13), 1274126177); r ^= r >>> 16; return (r >>> 0) / 4294967296; };
  let cell = 0, cols = 0, rows = 0, tiles = [], grain, flip, painted, ptr = { x: 0, y: 0, inside: false, col: -1e3, row: -1e3, strength: 0 }, raf = 0, startMs = 0, lastMs = 0;
  function makeTiles() {
    tiles = LEVELS.flatMap((alpha) => GLYPHS.map((g) => {
      if (!alpha) return null;
      const t = document.createElement("canvas"); t.width = t.height = cell;
      const c = t.getContext("2d");
      c.font = `${Math.round(cell * .72)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
      c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = `rgba(216, 243, 134, ${alpha})`;
      c.fillText(g, cell / 2, cell / 2);
      return t;
    }));
  }
  function layout() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return false;
    const dpr = Math.min(devicePixelRatio || 1, 2), nextCell = Math.max(1, Math.round(16 * dpr));
    const width = Math.round(w * dpr), height = Math.round(h * dpr);
    if (canvas.width === width && canvas.height === height && cell === nextCell) return false;
    if (cell !== nextCell) { cell = nextCell; makeTiles(); }
    canvas.width = width; canvas.height = height;
    cols = Math.ceil(width / cell); rows = Math.ceil(height / cell);
    grain = new Float32Array(cols * rows); flip = new Float32Array(cols * rows); painted = new Uint8Array(cols * rows).fill(255);
    for (let r = 0, i = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) { grain[i] = (hash(c, r, 1) - .5) * .3; flip[i] = hash(c, r, 2); }
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, width, height);
    return true;
  }
  function draw(t) {
    if (!cols) return;
    if (ptr.inside) {
      const rect = canvas.getBoundingClientRect(), px = cell / (canvas.width / rect.width);
      const col = (ptr.x - rect.left) / px, row = (ptr.y - rect.top) / px;
      if (ptr.x >= rect.left && ptr.x <= rect.right && ptr.y >= rect.top && ptr.y <= rect.bottom) {
        if (ptr.strength === 0) { ptr.col = col; ptr.row = row; } else { ptr.col += (col - ptr.col) * .42; ptr.row += (row - ptr.row) * .42; }
        ptr.strength = Math.min(1, ptr.strength + .3);
      } else ptr.strength = Math.max(0, ptr.strength - .045);
    } else ptr.strength = Math.max(0, ptr.strength - .045);
    ctx.fillStyle = "#000";
    const boost = ptr.strength * .55, R2 = RADIUS * RADIUS;
    for (let r = 0, i = 0; r < rows; r++) {
      const rowWave = Math.sin(r * .19 + t * -.42), rs = Math.sin(r * .13), rc = Math.cos(r * .13), dy = r - ptr.row;
      for (let c = 0; c < cols; c++, i++) {
        const d = c * .13 + t * .27;
        let m = Math.min(1, Math.max(0, .5 + (Math.sin(c * .24 + t * .55) + rowWave + Math.sin(d) * rc + Math.cos(d) * rs) * .24 + grain[i]));
        if (boost > .001) { const dx = c - ptr.col, dist = dx * dx + dy * dy; if (dist < R2) { const k = 1 - dist / R2; m = Math.min(1, m + boost * k * k); } }
        const idx = Math.min(LEVELS.length - 1, (m * m * LEVELS.length) | 0) * 2 + (((m * 3 + flip[i]) | 0) & 1);
        if (idx === painted[i]) continue;
        painted[i] = idx;
        const x = c * cell, y = r * cell;
        ctx.fillRect(x, y, cell, cell);
        if (tiles[idx]) ctx.drawImage(tiles[idx], x, y);
      }
    }
  }
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    if (now - lastMs < 1000 / 30) return;
    lastMs = now; if (!startMs) startMs = now;
    draw((now - startMs) / 1000);
  };
  addEventListener("pointermove", (event) => { ptr.x = event.clientX; ptr.y = event.clientY; ptr.inside = true; }, { passive: true });
  document.addEventListener("pointerleave", () => (ptr.inside = false));
  new ResizeObserver(() => { if (layout()) draw(0); }).observe(canvas);
  layout();
  if (reduceMotion) { draw(0); return; }
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) { if (!raf) raf = requestAnimationFrame(frame); }
    else { cancelAnimationFrame(raf); raf = 0; }
  }).observe(canvas);
})();

if (motion) addEventListener("load", () => ScrollTrigger.refresh());
