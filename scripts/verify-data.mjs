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
  assert(dataset.metrics.firstDate >= "1990-01-01", "Series starts before approved scope.");
  assert(dataset.metrics.lastDate <= new Date().toISOString().slice(0, 10), "Series contains future-dated observations.");

  for (const point of dataset.series) {
    assert(/^\d{4}-\d{2}-\d{2}$/.test(point.date), `Bad series date: ${point.date}`);
    assert(Number.isFinite(point.gasPrice), `Missing gas price for ${point.date}`);
  }

  for (const source of dataset.sources) {
    assert(isTrusted(source.url, policy), `Untrusted dataset source: ${source.url}`);
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
  assert(dataset.administrations.length >= 6, "Expected administration summaries.");
  console.log(`Verified ${dataset.series.length} observations, ${events.length} events, ${dataset.sources.length} core sources.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
