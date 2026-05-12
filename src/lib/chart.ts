import type { SeriesPoint } from "../types";

export function dateToMs(date: string) {
  return new Date(`${date}T00:00:00Z`).getTime();
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function extent(values: number[]) {
  return [Math.min(...values), Math.max(...values)] as const;
}

export function niceMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

export function formatYear(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCFullYear();
}

export function nearestPoint(points: SeriesPoint[], targetMs: number) {
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

export function pathFromPoints<T>(
  points: T[],
  x: (point: T) => number,
  y: (point: T) => number | null,
) {
  let drawing = false;
  return points
    .map((point) => {
      const yValue = y(point);
      if (yValue == null || !Number.isFinite(yValue)) {
        drawing = false;
        return "";
      }
      const command = drawing ? "L" : "M";
      drawing = true;
      return `${command}${x(point).toFixed(2)},${yValue.toFixed(2)}`;
    })
    .filter(Boolean)
    .join(" ");
}
