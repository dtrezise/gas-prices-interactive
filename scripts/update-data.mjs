import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { buildRecessionSpans, nearestPriorValue, parseCsv, pctChange, pearsonCorrelation, toNumber } from "./lib/analysis.mjs";

const root = new URL("..", import.meta.url);
const dataDir = new URL("data/", root);
const publicDataDir = new URL("public/data/", root);
const startDate = "1990-01-01";
const execFileAsync = promisify(execFile);

const fred = {
  gas: "https://fred.stlouisfed.org/graph/fredgraph.csv?id=GASREGW",
  nasdaq: "https://fred.stlouisfed.org/graph/fredgraph.csv?id=NASDAQCOM",
  recessions: "https://fred.stlouisfed.org/graph/fredgraph.csv?id=USREC",
};

const europeanCommissionOilBulletin =
  "https://energy.ec.europa.eu/document/download/906e60ca-8b6a-44e7-8589-652854d2fd3f_en?filename=Weekly_Oil_Bulletin_Prices_History_maticni_4web.xlsx";

async function fetchCsv(url) {
  const response = await fetchWithRetry(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return parseCsv(await response.text());
}

async function fetchArrayBuffer(url) {
  const response = await fetchWithRetry(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.arrayBuffer();
}

async function fetchWithRetry(url, attempts = 3) {
  let lastResponse;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      lastResponse = await fetch(url, {
        headers: { "user-agent": "gas-prices-interactive data updater" },
        signal: AbortSignal.timeout(30000),
      });
      if (lastResponse.ok || lastResponse.status < 500) return lastResponse;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 750));
  }
  if (!lastResponse && lastError) throw lastError;
  return lastResponse;
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

async function extractEuropeRows() {
  const workbookPath = join(tmpdir(), `eu-oil-bulletin-${Date.now()}.xlsx`);
  const workbook = Buffer.from(await fetchArrayBuffer(europeanCommissionOilBulletin));
  await writeFile(workbookPath, workbook);
  try {
    const scriptPath = new URL("extract-eu-prices.py", import.meta.url).pathname;
    const { stdout } = await execFileAsync(process.env.PYTHON ?? "python3", [scriptPath, workbookPath], {
      maxBuffer: 10 * 1024 * 1024,
    });
    return JSON.parse(stdout);
  } finally {
    await rm(workbookPath, { force: true });
  }
}

async function existingDataset() {
  try {
    return JSON.parse(await readFile(new URL("series.json", publicDataDir), "utf8"));
  } catch {
    return null;
  }
}

async function fetchCsvOrFallback(url, fallbackRows, label) {
  try {
    return await fetchCsv(url);
  } catch (error) {
    if (!fallbackRows?.length) throw error;
    console.warn(`Using committed ${label} fallback because live fetch failed: ${error.message}`);
    return fallbackRows;
  }
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
  const existing = await existingDataset();
  const gasRows = await fetchCsvOrFallback(
    fred.gas,
    existing?.series?.map((point) => ({ observation_date: point.date, GASREGW: String(point.gasPrice) })),
    "gasoline",
  );
  const marketRows = await fetchCsvOrFallback(
    fred.nasdaq,
    existing?.series
      ?.filter((point) => point.marketIndex != null)
      .map((point) => ({ observation_date: point.date, NASDAQCOM: String(point.marketIndex) })),
    "market",
  );
  const recessionRows = await fetchCsvOrFallback(
    fred.recessions,
    existing?.recessionMonthly,
    "recession",
  );
  const europeRows = await extractEuropeRows();
  const [eventsRaw, presidentsRaw] = await Promise.all([
    readFile(new URL("events.json", dataDir), "utf8").then(JSON.parse),
    readFile(new URL("presidents.json", dataDir), "utf8").then(JSON.parse),
  ]);

  const gas = cleanFredSeries(gasRows, "GASREGW");
  const market = cleanFredSeries(marketRows, "NASDAQCOM");
  const recessionMonthly = cleanFredSeries(recessionRows, "USREC");
  const europe = europeRows.filter((row) => row.date >= startDate && row.euGasEurPerLiter !== null);
  const europeSeries = europe.map((row, index) => ({
    ...row,
    euGasWeeklyChangePct: index > 0 ? round(pctChange(row.euGasEurPerLiter, europe[index - 1].euGasEurPerLiter), 2) : null,
  }));
  const points = enrichGasWithMarket(gas, market);
  const events = eventsRaw.filter((event) => event.date >= startDate).sort((a, b) => a.date.localeCompare(b.date));
  const presidents = presidentsRaw.filter((president) => president.end >= startDate);

  const dataset = {
    generatedAt: new Date().toISOString(),
    policy: {
      sourceTier: "strict official",
      marketOverlay: "NASDAQ Composite via FRED is used as the long market-index proxy. DJIA is cited for context but not redistributed as a long raw series because of source copyright restrictions.",
      europeOverlay: "European Commission Weekly Oil Bulletin EU average Euro-super 95 prices are shown in the source workbook's native unit, EUR/liter.",
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
        id: "ec-oil-bulletin",
        label: "EU average Euro-super 95 petrol price",
        publisher: "European Commission Directorate-General for Energy",
        url: "https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en",
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
      europeanObservations: europeSeries.length,
      firstDate: points[0]?.date,
      lastDate: points.at(-1)?.date,
      europeFirstDate: europeSeries[0]?.date,
      europeLastDate: europeSeries.at(-1)?.date,
      gasMarketWeeklyChangeCorrelation: round(pearsonCorrelation(points, "gasWeeklyChangePct", "marketWeeklyChangePct"), 3),
    },
    series: points,
    europeSeries,
    recessionMonthly,
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
  console.log(`Wrote ${europeSeries.length} EU weekly observations through ${dataset.metrics.europeLastDate}`);
  console.log(`Gas/market weekly change correlation: ${dataset.metrics.gasMarketWeeklyChangeCorrelation}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
