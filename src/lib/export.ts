import type { AppDataset, ChartPoint, PriceMode } from "../types";
import { formatDate } from "./chart";
import { europePriceForMode, gasPriceForMode, nearestEuropePoint } from "./series";

export function visibleSeriesCsv(dataset: AppDataset, points: ChartPoint[], priceMode: PriceMode) {
  const visibleEurope = dataset.europeSeries.filter((point) => point.date >= points[0].date && point.date <= points.at(-1)!.date);
  const rows = [
    [
      "date",
      "display_date",
      "us_gas_price",
      "us_gas_price_mode",
      "eu_petrol_usd_per_gallon",
      "market_index",
      "market_indexed_to_range_start",
      "cadence",
    ],
    ...points.map((point) => {
      const europe = nearestEuropePoint(visibleEurope, point.date);
      const europePrice = europe ? europePriceForMode(europe, priceMode) : null;
      return [
        point.date,
        formatDate(point.date),
        gasPriceForMode(point, priceMode).toFixed(3),
        priceMode,
        europePrice == null ? "" : europePrice.toFixed(2),
        point.marketIndex == null ? "" : point.marketIndex.toFixed(2),
        point.marketNormalized == null ? "" : point.marketNormalized.toFixed(2),
        "cadence" in point ? point.cadence : "weekly",
      ];
    }),
  ];

  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value: string) {
  if (!/[",\n]/.test(value)) return value;
  return `"${value.replaceAll("\"", "\"\"")}"`;
}
