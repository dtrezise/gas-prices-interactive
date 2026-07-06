import type { AppDataset, OverlayKey, PriceMode, ViewMode } from "../types";
import { clampDateRange } from "./series";

export const defaultOverlays: Record<OverlayKey, boolean> = {
  market: true,
  europe: true,
  presidents: true,
  events: true,
  recessions: true,
};

const viewModes: ViewMode[] = ["timeline", "events", "administrations", "methodology", "research"];
const overlayKeys: OverlayKey[] = ["market", "europe", "presidents", "events", "recessions"];

export interface UrlViewState {
  mode: ViewMode;
  startDate: string;
  endDate: string;
  priceMode: PriceMode;
  overlays: Record<OverlayKey, boolean>;
  activeStockSymbols: string[] | null;
}

export function readViewState(dataset: AppDataset): UrlViewState {
  const params = new URLSearchParams(window.location.search);
  const mode = viewModes.includes(params.get("view") as ViewMode) ? (params.get("view") as ViewMode) : "timeline";
  const priceMode = params.get("price") === "real" ? "real" : "actual";
  const range = clampDateRange(dataset, params.get("start") || "1990-01-01", params.get("end") || dataset.metrics.lastDate);
  const overlayParam = params.get("overlays");
  const overlays = overlayParam
    ? Object.fromEntries(overlayKeys.map((key) => [key, overlayParam.split(",").includes(key)])) as Record<OverlayKey, boolean>
    : defaultOverlays;
  const stocks = params.get("stocks");

  return {
    mode,
    priceMode,
    overlays,
    startDate: range.startDate,
    endDate: range.endDate,
    activeStockSymbols: stocks ? stocks.split(",").filter(Boolean) : null,
  };
}

export function writeViewState(state: UrlViewState) {
  const params = new URLSearchParams();
  params.set("view", state.mode);
  params.set("start", state.startDate);
  params.set("end", state.endDate);
  params.set("price", state.priceMode);
  params.set("overlays", overlayKeys.filter((key) => state.overlays[key]).join(","));
  if (state.activeStockSymbols?.length) params.set("stocks", state.activeStockSymbols.join(","));
  window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
}

