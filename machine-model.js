const machineModel = (() => {
  const states = { rascunho: "Rascunho", validacao: "Em validação", no_ar: "No ar", arquivado: "Arquivada" };
  const taskStates = { pendente: "Pendente", andamento: "Em andamento", feito: "Validado", nao_aplica: "Não se aplica" };
  const productFormats = ["Minicurso", "Workshop", "Desafio", "E-book", "Templates", "Planilha", "Prompts", "Ferramenta", "Comunidade ou assinatura", "Combo de conteúdo e ferramentas", "Outro"];
  const triggers = ["Consumo", "Comportamento", "Tempo", "Resultado", "Nova necessidade", "Campanha"];
  const stages = {
    produto: {
      label: "Produto", title: "Produto de entrada", intro: "Escolha uma dor que o público já reconhece e entregue uma primeira vitória que faça sentido para a próxima compra.",
      groups: [
        { title: "Público e validação", fields: [
          ["audience", "Quem vai comprar?", "Ex.: Social medias iniciantes que já tentam prospectar", "input"],
          ["pain", "Dor específica", "Que problema a pessoa consegue descrever com as próprias palavras?"],
          ["desire", "Desejo existente", "O que ela já procura ou está tentando resolver?"],
          ["evidence", "Evidência de demanda", "Registre conversas, buscas, pedidos, pré-vendas ou o teste a realizar."],
        ] },
        { title: "Transformação", fields: [
          ["promise", "Promessa da oferta", "Ex.: Monte um portfólio que você consiga enviar a um cliente", "input"],
          ["before", "Antes", "Em que situação a pessoa começa?"],
          ["after", "Depois", "Qual resultado concreto ela consegue atingir e em que condição?"],
        ] },
        { title: "Oferta e entrega", fields: [
          ["format", "Formato", "", productFormats],
          ["positioning", "Posicionamento e preço", "Explique o valor da oferta e a hipótese que sustenta o preço. Registre o preço no Simulador."],
          ["delivery", "Entregáveis e organização", "Liste materiais, módulos e bônus que ajudam a chegar ao resultado."],
          ["scale", "Entrega escalável", "Explique como o cliente recebe e aplica sem depender de atendimento individual."],
        ] },
        { title: "Papel na esteira", fields: [
          ["purpose", "Função do low ticket", "Ex.: Validar a dor e converter leads em compradores"],
          ["connection", "Conexão com a próxima oferta", "Que novo problema aparece depois da primeira vitória?"],
        ] },
      ],
    },
    funil: {
      label: "Funil", title: "Da atração à primeira compra", intro: "Defina como a pessoa reconhece a dor, deixa um contato, compra e começa a usar o produto.",
      groups: [
        { title: "Atração e consciência", fields: [
          ["traffic", "Fontes de tráfego", "Conteúdo, anúncios, indicações, parcerias, busca, comunidade ou materiais gratuitos."],
          ["awareness", "Conteúdo para cada nível", "Planeje pautas de consciência, autoridade, desejo e oferta ligadas à mesma dor."],
        ] },
        { title: "Captação", fields: [
          ["lead", "Como captar o lead?", "Defina o convite, o canal de captura e como retomar o contato."],
          ["idea", "Grande ideia da copy", "Qual é o argumento que permanece coerente em conteúdo, anúncios, página, checkout e mensagens?"],
        ] },
        { title: "Página de vendas", fields: [
          ["offer", "Argumento da página de vendas", "Inclua problema, promessa, solução, benefícios, entregas, diferenciais, provas disponíveis e preço."],
          ["cta", "Chamada para ação", "Ex.: Quero montar meu portfólio", "input"],
        ] },
        { title: "Checkout e complementos", fields: [
          ["checkout", "Checkout e integrações", "Registre plataforma, formas de pagamento, order bump, rastreamento e entrega do acesso."],
          ["bump", "Order bump no checkout", "Qual complemento ajuda a obter a primeira vitória?"],
          ["upsell", "Upsell após a compra", "Qual oferta complementar faz sentido logo após a compra?"],
        ] },
        { title: "Entrega e acompanhamento do comprador", fields: [
          ["onboarding", "Acesso e primeiros passos", "Defina confirmação, acesso, instrução inicial e um contato de suporte."],
          ["buyers", "O que acompanhar depois da compra?", "Registre compra, consumo, resultado, dúvidas e novos problemas."],
        ] },
      ],
    },
    esteira: {
      label: "Esteira", title: "Low → Mid → High Ticket", intro: "Desenhe cada oferta a partir do problema que o cliente passa a ter depois de avançar.",
      groups: [
        { title: "Mid Ticket · aprofundamento", fields: [
          ["midName", "Oferta Mid Ticket", "Ex.: Formação em estratégia de Social Media", "input"],
          ["midNeed", "Problema que surge após o Low Ticket", "Que competência ou transformação mais ampla o cliente procura agora?"],
          ["midDelivery", "Transformação e entrega do Mid", "Descreva o resultado e a forma de entrega."],
        ] },
        { title: "High Ticket · transformação de alto valor", fields: [
          ["highName", "Oferta High Ticket", "Ex.: Programa de implementação", "input"],
          ["highNeed", "Problema que surge após o Mid Ticket", "Qual problema mais valioso pede profundidade, personalização ou velocidade?"],
          ["highDelivery", "Transformação e entrega do High", "Descreva o resultado, a implementação e o nível de acesso."],
        ] },
        { title: "Acompanhamento", fields: [
          ["careName", "Oferta de acompanhamento", "Ex.: Mentoria de crescimento", "input"],
          ["careNeed", "Quando o cliente precisa de proximidade?", "Que decisão, implementação ou prioridade exige direção e feedback?"],
          ["careDelivery", "Formato de acompanhamento", "Ex.: Diagnóstico, plano de ação, calls, revisão, comunidade e feedback."],
        ] },
      ],
    },
    ascensao: {
      label: "Ascensão", title: "Quando oferecer o próximo passo", intro: "Use os sinais de que o cliente obteve um resultado, percebeu uma nova necessidade e está pronto para avançar.",
      groups: [["lowMid", "Low → Mid"], ["midHigh", "Mid → High"], ["highCare", "High → Acompanhamento"]].map(([key, title]) => ({
        title, fields: [
          [key + "Trigger", "Tipo de gatilho", "", triggers],
          [key + "Signal", "Critério de prontidão", "Qual sinal mostra que o cliente está pronto?"],
          [key + "Action", "Convite e momento", "Registre mensagem, canal, prazo ou evento e o que vai medir."],
        ],
      })),
    },
    checklist: { label: "Checklist", title: "Colocar o funil no ar", intro: "Acompanhe as oito frentes com responsável, prazo e link para a entrega." },
    metricas: { label: "Simulador", title: "Receita, aquisição e LTV", intro: "Simule a receita da primeira compra, os custos de aquisição e o valor esperado ao longo da esteira." },
  };
  const checklist = [
    ["product", "Produto", "Valide promessa, formato, entregáveis, preço, oferta e acesso ao produto na plataforma."],
    ["identity", "Identidade do produto", "Defina nome, conceito, identidade visual, capa, mockups e aplicação nos materiais."],
    ["page", "Página de vendas", "Valide a argumentação, os links, as provas disponíveis, o preço e o CTA no celular."],
    ["checkout", "Checkout", "Teste pagamento, complemento, integrações, rastreamento e entrega com uma compra de teste."],
    ["organic", "Conteúdo orgânico", "Prepare conteúdos de consciência, autoridade, desejo e oferta para o mesmo público."],
    ["copy", "Copy", "Alinhe a grande ideia e a promessa em conteúdo, anúncios, página, checkout, criativos e mensagens."],
    ["ads", "Anúncios", "Planeje públicos, criativos, hipóteses de teste, remarketing e critérios de otimização."],
    ["budget", "Verba de tráfego", "Defina orçamento de teste, o que aprender, limite de CPA e critérios para pausar ou ampliar."],
  ];
  const metricGroups = [
    { title: "Entrada e conversão", fields: [
      ["visitors", "Visitas à oferta", 100000000, 1],
      ["conversion", "Conversão de visita em compra (%)", 100, .01],
      ["price", "Preço do produto de entrada (R$)", 1000000, .01],
    ] },
    { title: "Complementos da primeira compra", fields: [
      ["bumpPrice", "Preço do order bump (R$)", 1000000, .01],
      ["bumpRate", "Adesão ao order bump (%)", 100, .01],
      ["upsellPrice", "Preço do upsell (R$)", 1000000, .01],
      ["upsellRate", "Adesão ao upsell (%)", 100, .01],
    ] },
    { title: "Custos no mesmo período", fields: [
      ["adSpend", "Investimento em tráfego (R$)", 100000000, .01],
      ["paidBuyers", "Compradores atribuídos a anúncios (estimativa)", 100000000, .01],
      ["feeRate", "Taxas e deduções sobre a receita (%)", 100, .01],
      ["buyerCost", "Custo variável por comprador (R$)", 1000000, .01],
    ] },
    { title: "Ascensão da mesma coorte", fields: [
      ["midPrice", "Preço do Mid Ticket (R$)", 1000000, .01],
      ["midRate", "Dos compradores Low, quantos vão ao Mid (%)", 100, .01],
      ["highPrice", "Preço do High Ticket (R$)", 1000000, .01],
      ["highRate", "Dos compradores Mid, quantos vão ao High (%)", 100, .01],
      ["carePrice", "Receita de acompanhamento por cliente (R$)", 1000000, .01],
      ["careRate", "Dos compradores High, quantos contratam acompanhamento (%)", 100, .01],
    ] },
  ];
  const emptyPlan = () => ({ produto: {}, funil: {}, esteira: {}, ascensao: {}, checklist: {}, metricas: {} });
  function samplePlan() {
    return {
      produto: {
        audience: "Social medias iniciantes que precisam comprovar seu trabalho para prospectar.",
        pain: "Travo quando um possível cliente pede meu portfólio.",
        desire: "Ter um material pronto para mostrar meu trabalho e puxar uma conversa.",
        evidence: "Testar o convite em uma postagem e entrevistar quem pedir o material de exemplo.",
        before: "Cases espalhados em arquivos e redes, sem narrativa de resultado.",
        after: "Portfólio editável com três cases e link pronto para enviar.",
        promise: "Monte um portfólio de Social Media com três cases prontos para apresentar.",
        purpose: "Transformar seguidores em compradores e validar o interesse em prospecção.",
        format: "Templates",
        delivery: "Template editável, exemplos de cases e aula curta de aplicação.",
        scale: "Acesso automático após a compra e instruções dentro do template.",
        positioning: "Entrada de R$ 37. O valor está em transformar entregas soltas em um material utilizável para prospectar.",
        connection: "Quem consegue apresentar o próprio trabalho pode precisar de uma estratégia para conquistar e atender clientes.",
      },
      funil: {
        traffic: "Carrosséis no Instagram, indicação de colegas e anúncios dos criativos já testados no orgânico.",
        awareness: "Erros de apresentação, análise de um case, antes e depois do portfólio e demonstração do template.",
        lead: "Oferecer uma estrutura de case por e-mail e enviar uma demonstração seguida da oferta.",
        offer: "Portfólio de três cases com template e instruções. Mostrar um caso de exemplo e o que está incluído.",
        idea: "Sua experiência já rende um portfólio se você aprender a organizar o que entregou.",
        cta: "Quero montar meu portfólio",
        checkout: "Configurar preço e Pix/cartão. Validar o evento de compra e o acesso em um teste.",
        bump: "Roteiros de mensagem para enviar o portfólio.",
        upsell: "Workshop de prospecção para transformar o portfólio em conversas.",
        onboarding: "Enviar acesso, exemplo preenchido e instrução para montar o primeiro case.",
        buyers: "Acompanhar acesso, publicação do portfólio e pedidos de ajuda com prospecção.",
      },
      esteira: {
        midName: "Formação em prospecção e proposta",
        midNeed: "Já tem portfólio, mas precisa gerar reuniões e conduzir propostas.",
        midDelivery: "Curso completo com rotina de prospecção, roteiro de reunião e proposta comentada.",
        highName: "Implementação comercial",
        highNeed: "Já tem conversas comerciais, mas precisa organizar e melhorar a conversão.",
        highDelivery: "Revisão da oferta, acompanhamento da implementação e análise de reuniões.",
        careName: "Mentoria de crescimento",
        careNeed: "A operação já vende e o cliente precisa de direção para crescer sem perder margem.",
        careDelivery: "Diagnóstico, plano individual, encontros de acompanhamento e feedback.",
      },
      ascensao: {
        lowMidTrigger: "Resultado", lowMidSignal: "Publicou o portfólio e quer conquistar os primeiros clientes.",
        lowMidAction: "Convidar por e-mail para conhecer a formação após confirmar a publicação.",
        midHighTrigger: "Comportamento", midHighSignal: "Já conduz reuniões e pediu feedback sobre conversão.",
        midHighAction: "Oferecer um diagnóstico ao responder ao pedido de ajuda.",
        highCareTrigger: "Nova necessidade", highCareSignal: "Tem processo comercial e trouxe uma meta de crescimento.",
        highCareAction: "Apresentar a mentoria na revisão de resultados da implementação.",
      },
      checklist: {
        product: { status: "feito", notes: "Exemplo de produto definido e acesso revisado." },
        identity: { status: "andamento", notes: "Preparar capa e mockups dos três cases." },
      },
      metricas: {
        visitors: 1000, conversion: 3, price: 37, bumpPrice: 17, bumpRate: 20, upsellPrice: 97, upsellRate: 10,
        adSpend: 450, paidBuyers: 20, feeRate: 10, buyerCost: 3, midPrice: 997, midRate: 12,
        highPrice: 2500, highRate: 15, carePrice: 5000, careRate: 10,
      },
    };
  }

  function estimate(values) {
    const value = (key) => Math.max(0, Number(values[key]) || 0);
    const rate = (key) => Math.min(100, value(key)) / 100;
    const buyers = value("visitors") * rate("conversion");
    const ticket = value("price") + value("bumpPrice") * rate("bumpRate") + value("upsellPrice") * rate("upsellRate");
    const gross = buyers * ticket;
    const spend = value("adSpend");
    const paidBuyers = value("paidBuyers");
    const contribution = ticket * (1 - rate("feeRate")) - value("buyerCost");
    const mid = rate("midRate");
    const high = mid * rate("highRate");
    const care = high * rate("careRate");
    return {
      buyers, ticket, gross, net: buyers * contribution - spend,
      cpa: paidBuyers > 0 ? spend / paidBuyers : null,
      breakEven: Math.max(0, contribution),
      ltv: ticket + mid * value("midPrice") + high * value("highPrice") + care * value("carePrice"),
    };
  }

  function completion(plan) {
    const values = Object.values(plan.checklist);
    return {
      complete: checklist.filter(([key]) => ["feito", "nao_aplica"].includes(plan.checklist[key]?.status)).length,
      skipped: values.filter((task) => task?.status === "nao_aplica").length,
    };
  }
  return { states, taskStates, stages, checklist, metricGroups, emptyPlan, samplePlan, estimate, completion };
})();
