import { readFile } from "node:fs/promises";
import { domainOf } from "./lib/analysis.mjs";

const root = new URL("..", import.meta.url);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function json(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

function isTrusted(url, policy) {
  const domain = domainOf(url);
  if (policy.forbiddenDomains.some((blocked) => domain === blocked || domain.endsWith(`.${blocked}`))) return false;
  return policy.allowedDomains.some((allowed) => domain === allowed.replace(/^www\./, ""));
}

async function main() {
  const [dataset, events, policy] = await Promise.all([
    json("public/data/series.json"),
    json("data/events.json"),
    json("data/source-policy.json"),
  ]);

  assert(dataset.policy?.noReddit === true, "Dataset must explicitly enforce no-Reddit policy.");
  assert(Array.isArray(dataset.series) && dataset.series.length > 1500, "Expected long weekly gas-price series.");
  assert(Array.isArray(dataset.annualSeries) && dataset.metrics.annualObservations >= 70, "Expected annual gasoline history back to 1949.");
  assert(Array.isArray(dataset.europeSeries) && dataset.metrics.europeanObservations > 1000, "Expected European Commission weekly petrol series.");
  assert(Array.isArray(dataset.cpiMonthly) && dataset.cpiMonthly.length > 900, "Expected CPI history for inflation adjustment.");
  assert(Array.isArray(dataset.oilStockSeries) && dataset.metrics.oilCompanyCount >= 7, "Expected major oil-company stock series.");
  assert(dataset.metrics.longFirstDate <= "1949-07-01", "Long view must begin in 1949.");
  assert(dataset.cpiMonthly[0].date <= "1949-01-01", "CPI history must support the 1949 long view.");
  assert(dataset.metrics.europeFirstDate >= "2005-01-01", "European series starts before approved source scope.");
  assert(dataset.metrics.firstDate >= "1990-01-01", "Series starts before approved scope.");
  assert(dataset.metrics.lastDate <= new Date().toISOString().slice(0, 10), "Series contains future-dated observations.");

  for (const point of dataset.series) {
    assert(/^\d{4}-\d{2}-\d{2}$/.test(point.date), `Bad series date: ${point.date}`);
    assert(Number.isFinite(point.gasPrice), `Missing gas price for ${point.date}`);
    assert(Number.isFinite(point.gasPriceReal), `Missing inflation-adjusted gas price for ${point.date}`);
  }

  for (const point of dataset.europeSeries) {
    assert(/^\d{4}-\d{2}-\d{2}$/.test(point.date), `Bad EU series date: ${point.date}`);
    assert(Number.isFinite(point.euGasEurPerLiter), `Bad EU price for ${point.date}`);
    assert(Number.isFinite(point.euGasUsdPerGallon), `Bad converted EU price for ${point.date}`);
    assert(Number.isFinite(point.euGasUsdPerGallonReal), `Bad inflation-adjusted EU price for ${point.date}`);
    assert(point.euGasEurPerLiter > 0 && point.euGasEurPerLiter < 4, `EU price out of expected range for ${point.date}`);
  }

  for (const point of dataset.annualSeries) {
    assert(/^\d{4}-\d{2}-\d{2}$/.test(point.date), `Bad annual series date: ${point.date}`);
    assert(Number.isFinite(point.gasPrice), `Bad annual gasoline price for ${point.date}`);
    assert(Number.isFinite(point.gasPriceReal), `Bad annual inflation-adjusted gasoline price for ${point.date}`);
  }

  for (const point of dataset.cpiMonthly) {
    assert(/^\d{4}-\d{2}-\d{2}$/.test(point.date), `Bad CPI date: ${point.date}`);
    assert(Number.isFinite(point.value) && point.value > 0, `Bad CPI value for ${point.date}`);
  }

  for (const source of dataset.sources) {
    assert(isTrusted(source.url, policy), `Untrusted dataset source: ${source.url}`);
  }

  for (const series of dataset.oilStockSeries) {
    assert(series.symbol && series.name, "Oil stock series missing symbol or name.");
    assert(isTrusted(series.sourceUrl, policy), `Untrusted oil stock source for ${series.symbol}: ${series.sourceUrl}`);
    assert(Array.isArray(series.points) && series.points.length > 200, `Expected monthly stock history for ${series.symbol}.`);
    for (const point of series.points) {
      assert(/^\d{4}-\d{2}-\d{2}$/.test(point.date), `Bad stock date for ${series.symbol}: ${point.date}`);
      assert(Number.isFinite(point.close) && point.close > 0, `Bad stock close for ${series.symbol} on ${point.date}`);
    }
  }

  const ids = new Set();
  for (const event of events) {
    assert(event.id && !ids.has(event.id), `Missing or duplicate event id: ${event.id}`);
    ids.add(event.id);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(event.date), `Bad event date: ${event.id}`);
    assert(event.title && event.summary && event.whyIncluded, `Event lacks required narrative fields: ${event.id}`);
    assert(["high", "medium", "low"].includes(event.confidence), `Bad confidence for ${event.id}`);
    assert(Array.isArray(event.sources) && event.sources.length > 0, `Event lacks sources: ${event.id}`);
    for (const sourceUrl of event.sources) {
      assert(isTrusted(sourceUrl, policy), `Untrusted event source for ${event.id}: ${sourceUrl}`);
    }
  }

  assert(dataset.events.length === events.length, "Generated event count does not match curated source file.");
  assert(dataset.recessions.length > 0, "Expected recession spans.");
  assert(dataset.administrations.length >= 15, "Expected administration summaries back to 1949.");
  console.log(`Verified ${dataset.series.length} observations, ${events.length} events, ${dataset.sources.length} core sources.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
