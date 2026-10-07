import { readFile } from "node:fs/promises";
import { parseCsv, toNumber } from "./lib/analysis.mjs";

const root = new URL("..", import.meta.url);
const fredGasUrl = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=GASREGW";
const maxLagDays = Number.parseInt(process.env.MAX_GAS_DATA_LAG_DAYS ?? "14", 10);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function daysBetween(left, right) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(`${right}T00:00:00Z`) - Date.parse(`${left}T00:00:00Z`)) / msPerDay);
}

async function fetchFredGas() {
  const response = await fetch(fredGasUrl, {
    headers: { "user-agent": "gas-prices-interactive freshness checker" },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Unable to fetch FRED GASREGW freshness data: ${response.status}`);
  return parseCsv(await response.text())
    .map((row) => ({ date: row.observation_date, value: toNumber(row.GASREGW) }))
    .filter((row) => row.date && row.value !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function main() {
  const dataset = JSON.parse(await readFile(new URL("public/data/series.json", root), "utf8"));
  const officialRows = await fetchFredGas();
  const officialLatest = officialRows.at(-1);

  assert(officialLatest, "FRED GASREGW returned no usable observations.");
  assert(dataset.metrics?.lastDate, "Dataset lacks metrics.lastDate.");

  const lagDays = daysBetween(dataset.metrics.lastDate, officialLatest.date);
  assert(
    lagDays <= maxLagDays,
    `Dataset is ${lagDays} days behind FRED GASREGW (${dataset.metrics.lastDate} vs ${officialLatest.date}); max allowed is ${maxLagDays}.`,
  );

  console.log(
    `Freshness OK: dataset ${dataset.metrics.lastDate}; FRED GASREGW ${officialLatest.date}; lag ${lagDays} days; latest official $${officialLatest.value.toFixed(3)}.`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
