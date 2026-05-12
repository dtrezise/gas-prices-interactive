import { mkdir, readFile, writeFile } from "node:fs/promises";
import { buildRecessionSpans, nearestPriorValue, parseCsv, pctChange, pearsonCorrelation, toNumber } from "./lib/analysis.mjs";

const root = new URL("..", import.meta.url);
const dataDir = new URL("data/", root);
const publicDataDir = new URL("public/data/", root);
const startDate = "1990-01-01";

const fred = {
  gas: "https://fred.stlouisfed.org/graph/fredgraph.csv?id=GASREGW",
  nasdaq: "https://fred.stlouisfed.org/graph/fredgraph.csv?id=NASDAQCOM",
  recessions: "https://fred.stlouisfed.org/graph/fredgraph.csv?id=USREC",
};

async function fetchCsv(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "gas-prices-interactive data updater" },
  });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return parseCsv(await response.text());
}

function cleanFredSeries(rows, valueKey) {
  return rows
    .map((row) => ({
      date: row.observation_date,
      value: toNumber(row[valueKey]),
    }))
    .filter((row) => row.date >= startDate && row.value !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function enrichGasWithMarket(gasRows, marketRows) {
  const firstMarket = nearestPriorValue(marketRows, gasRows[0].date);
  return gasRows.map((gas, index) => {
    const market = nearestPriorValue(marketRows, gas.date);
    const previous = index > 0 ? gasRows[index - 1] : null;
    const marketPrevious = previous ? nearestPriorValue(marketRows, previous.date) : null;
    return {
      date: gas.date,
      gasPrice: round(gas.value, 3),
      gasWeeklyChangePct: previous ? round(pctChange(gas.value, previous.value), 2) : null,
      marketIndex: market ? round(market.value, 2) : null,
      marketNormalized: market && firstMarket ? round((market.value / firstMarket.value) * 100, 2) : null,
      marketWeeklyChangePct: market && marketPrevious ? round(pctChange(market.value, marketPrevious.value), 2) : null,
    };
  });
}

function round(value, places) {
  if (value == null) return null;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function administrationSummaries(points, presidents) {
  return presidents
    .map((president) => {
      const termPoints = points.filter((point) => point.date >= president.start && point.date < president.end);
      if (termPoints.length < 2) return null;
      const first = termPoints[0];
      const last = termPoints.at(-1);
      const high = termPoints.reduce((best, point) => (point.gasPrice > best.gasPrice ? point : best), first);
      const low = termPoints.reduce((best, point) => (point.gasPrice < best.gasPrice ? point : best), first);
      return {
        ...president,
        startGas: first.gasPrice,
        endGas: last.gasPrice,
        changePct: round(pctChange(last.gasPrice, first.gasPrice), 1),
        highGas: high.gasPrice,
        highDate: high.date,
        lowGas: low.gasPrice,
        lowDate: low.date,
        weeks: termPoints.length,
      };
    })
    .filter(Boolean);
}

async function main() {
  await mkdir(publicDataDir, { recursive: true });
  const [gasRows, marketRows, recessionRows, eventsRaw, presidentsRaw] = await Promise.all([
    fetchCsv(fred.gas),
    fetchCsv(fred.nasdaq),
    fetchCsv(fred.recessions),
    readFile(new URL("events.json", dataDir), "utf8").then(JSON.parse),
    readFile(new URL("presidents.json", dataDir), "utf8").then(JSON.parse),
  ]);

  const gas = cleanFredSeries(gasRows, "GASREGW");
  const market = cleanFredSeries(marketRows, "NASDAQCOM");
  const recessionMonthly = cleanFredSeries(recessionRows, "USREC");
  const points = enrichGasWithMarket(gas, market);
  const events = eventsRaw.filter((event) => event.date >= startDate).sort((a, b) => a.date.localeCompare(b.date));
  const presidents = presidentsRaw.filter((president) => president.end >= startDate);

  const dataset = {
    generatedAt: new Date().toISOString(),
    policy: {
      sourceTier: "strict official",
      marketOverlay: "NASDAQ Composite via FRED is used as the long market-index proxy. DJIA is cited for context but not redistributed as a long raw series because of source copyright restrictions.",
      noReddit: true,
    },
    sources: [
      {
        id: "gasregw",
        label: "US Regular All Formulations Gas Price",
        publisher: "U.S. Energy Information Administration via FRED",
        url: "https://fred.stlouisfed.org/series/GASREGW",
      },
      {
        id: "nasdaqcom",
        label: "NASDAQ Composite",
        publisher: "Nasdaq, Inc. via FRED",
        url: "https://fred.stlouisfed.org/series/NASDAQCOM",
      },
      {
        id: "usrec",
        label: "NBER recession indicator",
        publisher: "Federal Reserve Bank of St. Louis / NBER via FRED",
        url: "https://fred.stlouisfed.org/series/USREC",
      },
      {
        id: "djia-context",
        label: "Dow Jones Industrial Average context",
        publisher: "S&P Dow Jones Indices / FRED",
        url: "https://fred.stlouisfed.org/series/DJIA",
      },
    ],
    metrics: {
      weeklyObservations: points.length,
      firstDate: points[0]?.date,
      lastDate: points.at(-1)?.date,
      gasMarketWeeklyChangeCorrelation: round(pearsonCorrelation(points, "gasWeeklyChangePct", "marketWeeklyChangePct"), 3),
    },
    series: points,
    recessions: buildRecessionSpans(recessionMonthly),
    presidents,
    administrations: administrationSummaries(points, presidents),
    events,
  };

  await writeFile(new URL("series.json", publicDataDir), `${JSON.stringify(dataset, null, 2)}\n`);
  await writeFile(
    new URL("sources.json", publicDataDir),
    `${JSON.stringify({ generatedAt: dataset.generatedAt, sources: dataset.sources, eventSources: events }, null, 2)}\n`,
  );

  console.log(`Wrote ${points.length} weekly observations through ${dataset.metrics.lastDate}`);
  console.log(`Gas/market weekly change correlation: ${dataset.metrics.gasMarketWeeklyChangeCorrelation}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
