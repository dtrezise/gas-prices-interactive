import type { AnnualSeriesPoint, AppDataset, ChartPoint, EuropeSeriesPoint, OilStockSeries, PriceMode } from "../types";
import { dateToMs } from "./chart";

export function visibleChartPoints(dataset: AppDataset, startDate: string, endDate: string): ChartPoint[] {
  const weekly = dataset.series.filter((point) => point.date >= startDate && point.date <= endDate);
  if (startDate < "1990-01-01") {
    return [
      ...dataset.annualSeries.filter((point) => point.date >= startDate && point.date < "1990-01-01" && point.date <= endDate),
      ...weekly,
    ];
  }
  return weekly;
}

export function gasPriceForMode(point: ChartPoint, mode: PriceMode) {
  return mode === "real" ? point.gasPriceReal : point.gasPrice;
}

export function europePriceForMode(point: EuropeSeriesPoint, mode: PriceMode) {
  return mode === "real" ? point.euGasUsdPerGallonReal : point.euGasUsdPerGallon;
}

export function normalizeStockSeries(series: OilStockSeries, startDate: string, endDate: string) {
  const points = series.points.filter((point) => point.date >= startDate && point.date <= endDate);
  if (!points.length) return { ...series, points: [] as Array<{ date: string; index: number }> };
  const base = points[0].close;
  return {
    ...series,
    points: points.map((point) => ({
      date: point.date,
      index: (point.close / base) * 100,
    })),
  };
}

export function nearestChartPoint(points: ChartPoint[], targetMs: number) {
  let best = points[0];
  let bestDistance = Math.abs(dateToMs(best.date) - targetMs);
  for (const point of points) {
    const distance = Math.abs(dateToMs(point.date) - targetMs);
    if (distance < bestDistance) {
      best = point;
      bestDistance = distance;
    }
  }
  return best;
}

export function nearestEuropePoint(points: EuropeSeriesPoint[], targetDate: string) {
  if (!points.length) return null;
  const target = dateToMs(targetDate);
  let best = points[0];
  let bestDistance = Math.abs(dateToMs(best.date) - target);
  for (const point of points) {
    const distance = Math.abs(dateToMs(point.date) - target);
    if (distance < bestDistance) {
      best = point;
      bestDistance = distance;
    }
  }
  return best;
}

export function maxDateString(left: string, right: string) {
  return left > right ? left : right;
}

export function minDateString(left: string, right: string) {
  return left < right ? left : right;
}

export function clampDateRange(dataset: AppDataset, startDate: string, endDate: string) {
  const minDate = dataset.metrics.longFirstDate;
  const maxDate = dataset.metrics.lastDate;
  const nextStart = clampDate(startDate, minDate, maxDate);
  const nextEnd = clampDate(endDate, nextStart, maxDate);
  return { startDate: nextStart, endDate: nextEnd };
}

function clampDate(date: string, minDate: string, maxDate: string) {
  if (date < minDate) return minDate;
  if (date > maxDate) return maxDate;
  return date;
}

