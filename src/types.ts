export type Confidence = "high" | "medium" | "low";

export type EventCategory = "war" | "opec" | "macro" | "supply" | "policy";

export interface SeriesPoint {
  date: string;
  gasPrice: number;
  gasWeeklyChangePct: number | null;
  marketIndex: number | null;
  marketNormalized: number | null;
  marketWeeklyChangePct: number | null;
}

export interface EuropeSeriesPoint {
  date: string;
  euGasEurPerLiter: number;
  euGasWeeklyChangePct: number | null;
}

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

export interface AppDataset {
  generatedAt: string;
  policy: {
    sourceTier: string;
    marketOverlay: string;
    europeOverlay: string;
    noReddit: boolean;
  };
  sources: DataSource[];
  metrics: {
    weeklyObservations: number;
    europeanObservations: number;
    firstDate: string;
    lastDate: string;
    europeFirstDate: string;
    europeLastDate: string;
    gasMarketWeeklyChangeCorrelation: number | null;
  };
  series: SeriesPoint[];
  europeSeries: EuropeSeriesPoint[];
  recessions: RecessionSpan[];
  presidents: PresidentTerm[];
  administrations: AdministrationSummary[];
  events: EventMarker[];
}

export type OverlayKey = "market" | "presidents" | "events" | "recessions";
export type ViewMode = "timeline" | "europe" | "events" | "administrations" | "research";
