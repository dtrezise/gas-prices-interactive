export type Confidence = "high" | "medium" | "low";

export type EventCategory = "war" | "opec" | "macro" | "supply" | "policy";

export interface SeriesPoint {
  date: string;
  gasPrice: number;
  gasPriceReal: number;
  gasWeeklyChangePct: number | null;
  marketIndex: number | null;
  marketNormalized: number | null;
  marketWeeklyChangePct: number | null;
}

export interface EuropeSeriesPoint {
  date: string;
  euGasEurPerLiter: number;
  usdPerEur: number | null;
  euGasUsdPerGallon: number | null;
  euGasUsdPerGallonReal: number | null;
  euGasWeeklyChangePct: number | null;
}

export interface AnnualSeriesPoint {
  date: string;
  year: number;
  gasPrice: number;
  gasPriceReal: number;
  cadence: "annual";
  sourceSeries: string;
  sourceLabel: string;
}

export type PriceMode = "actual" | "real";

export type ChartPoint = (SeriesPoint | AnnualSeriesPoint) & {
  marketIndex?: number | null;
  marketNormalized?: number | null;
  marketWeeklyChangePct?: number | null;
};

export interface EventMarker {
  id: string;
  date: string;
  title: string;
  category: EventCategory;
  impact: string;
  confidence: Confidence;
  summary: string;
  whyIncluded: string;
  sources: string[];
}

export interface PresidentTerm {
  name: string;
  party: "Republican" | "Democratic";
  start: string;
  end: string;
}

export interface AdministrationSummary extends PresidentTerm {
  startGas: number;
  endGas: number;
  changePct: number;
  highGas: number;
  highDate: string;
  lowGas: number;
  lowDate: string;
  weeks: number;
}

export interface RecessionSpan {
  start: string;
  end: string;
}

export interface DataSource {
  id: string;
  label: string;
  publisher: string;
  url: string;
}

export interface OilStockPoint {
  date: string;
  close: number;
}

export interface OilStockSeries {
  symbol: string;
  name: string;
  color: string;
  sourceName: string;
  sourceUrl: string;
  points: OilStockPoint[];
}

export interface CpiPoint {
  date: string;
  value: number;
}

export interface AppDataset {
  generatedAt: string;
  policy: {
    sourceTier: string;
    marketOverlay: string;
    longView: string;
    europeOverlay: string;
    inflation: string;
    oilStocks: string;
    noReddit: boolean;
  };
  sources: DataSource[];
  metrics: {
    weeklyObservations: number;
    annualObservations: number;
    europeanObservations: number;
    longFirstDate: string;
    firstDate: string;
    lastDate: string;
    europeFirstDate: string;
    europeLastDate: string;
    cpiBaseDate: string;
    oilCompanyCount: number;
    gasMarketWeeklyChangeCorrelation: number | null;
  };
  series: SeriesPoint[];
  annualSeries: AnnualSeriesPoint[];
  europeSeries: EuropeSeriesPoint[];
  oilStockSeries: OilStockSeries[];
  cpiMonthly: CpiPoint[];
  recessions: RecessionSpan[];
  presidents: PresidentTerm[];
  administrations: AdministrationSummary[];
  events: EventMarker[];
}

export type OverlayKey = "market" | "europe" | "presidents" | "events" | "recessions";
export type ViewMode = "timeline" | "events" | "administrations" | "methodology" | "research";
