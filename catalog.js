const PRICE_SOURCE = "https://whimsical.com/tabela-de-precos-marketing-digital-Neh9EL4z4pTZ6XQmm4fufw";
const OFFER_SOURCE = "https://whimsical.com/estrutura-do-infoproduto-oferta-e-precificacao-FwH9ZVg333TfNbNqpa4By9";
const catalog = [
  ["Design", "Arte de carrossel", [["Avulso", 40, 80], ["Em quantidade", 20, 30]], "Somente arte"],
  ["Design", "Arte estática", [["Avulso", 30, 60], ["Em quantidade", 10, 20]], "Feed, story e afins"],
  ["Design", "Banner", [["Avulso", 150, 250], ["Em quantidade", 80, 120]], "Somente arte"],
  ["Vídeo", "Edição de Reels simples", [["Avulso", 50, 80], ["Em quantidade", 20, 40]], "Somente edição"],
  ["Vídeo", "Edição de Reels elaborado", [["Avulso", 60, 100], ["Em quantidade", 40, 70]], "Somente edição"],
  ["Vídeo", "Edição de VSL", [["Até 40 min", 1200]], "Somente edição"],
  ["Vídeo", "Edição de vídeo para YouTube", [["Até 10 min", 300], ["Até 30 min", 700], ["Até 1 h", 1000]], "Somente edição"],
  ["Copy e roteiro", "Copy de carrossel", [["Avulso", 30, 60], ["Em quantidade", 10, 20]], "Somente texto"],
  ["Copy e roteiro", "Copy de peça estática", [["Avulso", 20, 30], ["Em quantidade", 5, 10]], "Somente texto"],
  ["Copy e roteiro", "Roteiro de Reels", [["Avulso", 30, 60], ["Em quantidade", 10, 20]], "Somente texto"],
  ["Copy e roteiro", "Copy de VSL", [["Avulso", 350, 500], ["Em quantidade", 250, 300]], "Somente texto"],
  ["Copy e roteiro", "Roteiro para YouTube", [["Avulso", 80, 100], ["Em quantidade", 150, 250]], "Somente texto"],
  ["Estratégia", "Calendário de conteúdos", [["1 mês de conteúdos", 150]], "Planejamento de conteúdo"],
  ["Estratégia", "Estratégia de conteúdo", [["Iniciante", 700], ["Experiente", 1500]], "Planejamento estratégico"],
  ["Estratégia", "Análise de perfil", [["Iniciante", 100, 150], ["Experiente", 350, 500]], "Diagnóstico do perfil"],
  ["Gestão", "Gestão de redes sociais", [["Iniciante", 800, 900], ["Experiente", 1500, 2000]], "Somente gestão", "/ mês"],
  ["Gestão", "Social selling", [["Iniciante", 600, 900], ["Experiente", 1200, 2000]], "Atendimento no direct", "/ mês"],
  ["Gestão", "Gestão de tráfego", [["Iniciante", 800, 900], ["Experiente", 1500, 2000]], "Somente gestão", "/ mês"],
  ["Gestão", "Head de conteúdo", [["Iniciante", 2000, 3000], ["Experiente", 3500, 8000]], "Estratégia, projetos e funis", "/ mês"],
];

const ideas = [
  { title: "Diagnóstico + plano de 30 dias", price: 55000, quantity: 15, days: 7, fee: 0, cost: 0,
    audience: "Pequenos negócios que publicam sem um plano",
    promise: "Sair com prioridades para o perfil e um mês de conteúdos planejado.",
    delivery: "Análise de perfil experiente (R$ 400) + calendário de um mês (R$ 150)." },
  { title: "VSL pronta para publicar", price: 160000, quantity: 6, days: 10, fee: 0, cost: 0,
    audience: "Infoprodutores com oferta definida e gravação disponível",
    promise: "Transformar a oferta e o material gravado em um vídeo de vendas.",
    delivery: "Copy avulsa de VSL (R$ 400) + edição de até 40 minutos (R$ 1.200)." },
  { title: "Workshop com kit de conteúdo", price: 9700, quantity: 45, days: 10, fee: 0, cost: 0,
    audience: "Profissionais autônomos que precisam planejar a semana",
    promise: "Planejar a próxima semana de posts durante uma oficina prática.",
    delivery: "Workshop em grupo + modelo editável de calendário + checklist. R$ 97 é uma hipótese de preço de entrada." },
];
