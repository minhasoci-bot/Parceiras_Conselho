const TEAM_TARGET = 2245500;
const DEADLINE = "2026-11-30";
const STATUSES = ["proposta", "fechado", "recebido"];
const DAY = 86400000;
const calendar = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });

function todayAt(date = new Date()) {
  return calendar.format(date);
}

function countDays(from, through) {
  return Math.max(0, Math.round((Date.parse(through) - Date.parse(from)) / DAY) + 1);
}

function initialState() {
  return { people: [], sales: [], scenarios: [] };
}

function stats(data) {
  let received = 0;
  let pipeline = 0;
  let late = 0;
  for (const sale of data.sales) {
    if (sale.status === "recebido" && sale.date > DEADLINE) late += sale.amount;
    if (sale.status === "recebido" && sale.date <= DEADLINE) received += sale.amount;
    if (sale.status === "fechado" && sale.date <= DEADLINE) pipeline += sale.amount;
  }
  return { received, pipeline, late };
}

const OFFER_TYPES = { servico: "Serviço", infoproduto: "Infoproduto" };
const MAX_SCENARIO_ITEMS = 30;

function scenarioItems(scenario) {
  if (scenario.items) return scenario.items;
  const { id, ...offer } = scenario;
  return [{ ...offer, type: "servico" }];
}

function projectScenario(items, remaining, today = todayAt()) {
  const available = countDays(today, DEADLINE);
  const lines = items.map((item) => {
    const gross = item.price * item.quantity;
    const net = Math.round(gross * (10000 - item.fee) / 10000) - item.cost * item.quantity;
    return { gross, net, within: item.days <= available, quantity: item.quantity, perDay: item.quantity / item.days };
  });
  const totals = { gross: 0, net: 0, byDeadline: 0, quantity: 0, lateItems: 0 };
  for (const line of lines) {
    totals.gross += line.gross;
    totals.net += line.net;
    totals.quantity += line.quantity;
    if (line.within) totals.byDeadline += line.net;
    else totals.lateItems += 1;
  }
  return { ...totals, lines, coverage: remaining ? Math.max(0, totals.byDeadline / remaining * 100) : 0 };
}

const isText = (value, max, required = false) => typeof value === "string" && value.length <= max && (!required || value.trim().length > 0);
const isInt = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const isDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

function validOffer(item) {
  return item && isText(item.title, 120, true)
    && isText(item.audience, 180) && isText(item.promise, 240) && isText(item.delivery, 500)
    && isInt(item.price, 1, 100000000) && isInt(item.quantity, 1, 10000) && isInt(item.days, 1, 365)
    && isInt(item.fee, 0, 10000) && isInt(item.cost, 0, 100000000);
}

function validScenario(scenario) {
  if (!scenario || !isText(scenario.id, 50, true) || !isText(scenario.title, 120, true)) return false;
  if (!Object.hasOwn(scenario, "items")) return validOffer(scenario);
  return Array.isArray(scenario.items) && scenario.items.length > 0 && scenario.items.length <= MAX_SCENARIO_ITEMS
    && scenario.items.every((item) => validOffer(item) && Object.hasOwn(OFFER_TYPES, item.type));
}

function validState(data) {
  return data && Array.isArray(data.people)
    && data.people.every((name) => isText(name, 70, true))
    && Array.isArray(data.sales) && data.sales.length <= 2000
    && data.sales.every((sale) => sale && isText(sale.id, 50, true) && isText(sale.title, 120, true)
      && isText(sale.client, 100) && isInt(sale.amount, 1, 100000000)
      && STATUSES.includes(sale.status) && isDate(sale.date))
    && new Set(data.sales.map((sale) => sale.id)).size === data.sales.length
    && Array.isArray(data.scenarios) && data.scenarios.length <= 100
    && data.scenarios.every(validScenario)
    && new Set(data.scenarios.map((item) => item.id)).size === data.scenarios.length;
}
