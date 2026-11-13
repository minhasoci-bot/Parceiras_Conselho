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

const products = [
  { title: "Kit de planejamento de conteúdo", category: "Kit de templates", price: 3700,
    delivery: "Calendário editável, checklist e modelo de briefing para planejar posts." },
  { title: "Workshop com kit de conteúdo", category: "Workshop", price: 9700,
    audience: "Profissionais autônomos que precisam planejar a semana",
    promise: "Planejar a próxima semana de posts durante uma oficina prática.",
    delivery: "Encontro em grupo com calendário editável e checklist de publicação." },
  { title: "Minicurso de estratégia de conteúdo", category: "Minicurso", price: 19700,
    delivery: "Aulas curtas e exercícios para definir temas, formatos e frequência de publicação." },
  { title: "Guia de oferta e precificação", category: "Guia digital", price: 4700,
    delivery: "Passo a passo e planilha para calcular custos, montar uma oferta e testar preços." },
];

function fixedPrice(ranges) {
  const total = ranges.reduce((sum, [, low, high = low]) => sum + (low + high) / 2, 0);
  return Math.round(total / ranges.length);
}

const catalogOffers = {
  servico: catalog.map(([, title, ranges, detail, unit]) => ({
    type: "servico", title, price: fixedPrice(ranges) * 100,
    delivery: detail + (unit ? ". Preço de referência mensal." : ""),
  })),
  infoproduto: products.map((item) => ({ ...item, type: "infoproduto" })),
};
