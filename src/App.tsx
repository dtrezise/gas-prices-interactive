import { AlertCircle, BarChart3, BookOpen, CalendarRange, CheckCircle2, ExternalLink, Filter, Fuel, Globe2, Landmark, LineChart, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { clamp, dateToMs, extent, formatDate, formatYear, niceMoney, pathFromPoints } from "./lib/chart";
import { loadDataset } from "./lib/data";
import type { AnnualSeriesPoint, AppDataset, EuropeSeriesPoint, EventMarker, OilStockSeries, OverlayKey, SeriesPoint, ViewMode } from "./types";

type PriceMode = "actual" | "real";

type ChartPoint = (SeriesPoint | AnnualSeriesPoint) & {
  marketIndex?: number | null;
  marketNormalized?: number | null;
  marketWeeklyChangePct?: number | null;
};

const overlays: Array<{ key: OverlayKey; label: string }> = [
  { key: "market", label: "Market" },
  { key: "europe", label: "Europe" },
  { key: "presidents", label: "Presidents" },
  { key: "events", label: "Events" },
  { key: "recessions", label: "Recessions" },
];

const ranges = [
  { label: "1949", start: "1949-01-01" },
  { label: "1990", start: "1990-01-01" },
  { label: "2000", start: "2000-01-01" },
  { label: "2010", start: "2010-01-01" },
  { label: "2020", start: "2020-01-01" },
];

function App() {
  const [dataset, setDataset] = useState<AppDataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>("timeline");
  const [startDate, setStartDate] = useState("1990-01-01");
  const [priceMode, setPriceMode] = useState<PriceMode>("actual");
  const [activeStocks, setActiveStocks] = useState<Record<string, boolean>>({});
  const [activeOverlays, setActiveOverlays] = useState<Record<OverlayKey, boolean>>({
    market: true,
    europe: true,
    presidents: true,
    events: true,
    recessions: true,
  });

  useEffect(() => {
    loadDataset()
      .then((loadedDataset) => {
        setDataset(loadedDataset);
        setActiveStocks(Object.fromEntries(loadedDataset.oilStockSeries.map((series) => [series.symbol, true])));
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, []);

  const points = useMemo(() => {
    if (!dataset) return [];
    if (startDate < "1990-01-01") {
      return [
        ...dataset.annualSeries.filter((point) => point.date >= startDate && point.date < "1990-01-01"),
        ...dataset.series,
      ];
    }
    return dataset.series.filter((point) => point.date >= startDate);
  }, [dataset, startDate]);

  if (error) {
    return (
      <main className="app-shell">
        <section className="status-panel">
          <AlertCircle aria-hidden="true" />
          <h1>Data failed to load</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  if (!dataset) {
    return (
      <main className="app-shell">
        <section className="status-panel">
          <Fuel aria-hidden="true" />
          <h1>Loading verified energy data</h1>
        </section>
      </main>
    );
  }

  const first = points[0];
  const last = points.at(-1);
  const firstGas = first ? gasPriceForMode(first, priceMode) : 0;
  const lastGas = last ? gasPriceForMode(last, priceMode) : 0;
  const change = first && last ? ((lastGas - firstGas) / firstGas) * 100 : 0;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">U.S. gasoline prices, market context, and verified events</p>
          <h1>Gas Prices Interactive</h1>
          <p className="subtitle">Automatically updated weekly</p>
        </div>
        <div className="trust-pill">
          <ShieldCheck aria-hidden="true" />
          <span>Official sources only</span>
        </div>
      </header>

      <section className="metric-strip" aria-label="Dataset summary">
        <Metric icon={<Fuel />} label={priceMode === "real" ? "Latest real gas price" : "Latest gas price"} value={last ? niceMoney(lastGas) : "n/a"} detail={last ? formatDate(last.date) : ""} />
        <Metric icon={<LineChart />} label="Range change" value={`${change >= 0 ? "+" : ""}${change.toFixed(1)}%`} detail={`Since ${formatYear(startDate)}`} />
        <Metric icon={<BarChart3 />} label="Market proxy" value="NASDAQ" detail="Official FRED series" />
        <Metric
          icon={<Globe2 />}
          label="EU petrol"
          value={dataset.europeSeries.at(-1) ? niceMoney(europePriceForMode(dataset.europeSeries.at(-1)!, priceMode) ?? 0) : "n/a"}
          detail={dataset.europeSeries.at(-1) ? formatDate(dataset.europeSeries.at(-1)!.date) : ""}
        />
      </section>

      <nav className="mode-tabs" aria-label="Views">
        <ModeButton active={mode === "timeline"} icon={<LineChart />} label="Timeline" onClick={() => setMode("timeline")} />
        <ModeButton active={mode === "events"} icon={<CalendarRange />} label="Events" onClick={() => setMode("events")} />
        <ModeButton active={mode === "administrations"} icon={<Landmark />} label="Administrations" onClick={() => setMode("administrations")} />
        <ModeButton active={mode === "research"} icon={<BookOpen />} label="Research" onClick={() => setMode("research")} />
      </nav>

      {mode === "timeline" && (
        <>
          <section className="controls-band" aria-label="Timeline controls">
            <div className="segmented" aria-label="Start year">
              {ranges.map((range) => (
                <button key={range.start} className={startDate === range.start ? "active" : ""} onClick={() => setStartDate(range.start)}>
                  {range.label}
                </button>
              ))}
            </div>
            <div className="toggle-row">
              <Filter aria-hidden="true" />
              {overlays.map((overlay) => (
                <label key={overlay.key} className="toggle">
                  <input
                    type="checkbox"
                    checked={activeOverlays[overlay.key]}
                    onChange={(event) => setActiveOverlays((current) => ({ ...current, [overlay.key]: event.target.checked }))}
                  />
                  <span>{overlay.label}</span>
                </label>
              ))}
            </div>
          </section>

          <TimelineChart dataset={dataset} points={points} overlays={activeOverlays} priceMode={priceMode} onTogglePriceMode={() => setPriceMode((current) => (current === "actual" ? "real" : "actual"))} />
          <OilStocksPanel dataset={dataset} activeStocks={activeStocks} setActiveStocks={setActiveStocks} startDate={startDate} />
          <SourceNote dataset={dataset} />
        </>
      )}

      {mode === "events" && <EventsView events={dataset.events} />}
      {mode === "administrations" && <AdministrationView dataset={dataset} />}
      {mode === "research" && <ResearchCanvas dataset={dataset} />}
    </main>
  );
}

function TimelineChart({
  dataset,
  points,
  overlays: activeOverlays,
  priceMode,
  onTogglePriceMode,
}: {
  dataset: AppDataset;
  points: ChartPoint[];
  overlays: Record<OverlayKey, boolean>;
  priceMode: PriceMode;
  onTogglePriceMode: () => void;
}) {
  const [hover, setHover] = useState<ChartPoint | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<EventMarker | null>(null);
  const width = 1180;
  const height = 560;
  const margin = { top: 26, right: 74, bottom: 54, left: 74 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const [minDate, maxDate] = extent(points.map((point) => dateToMs(point.date)));
  const minGas = 0;
  const visibleEurope = dataset.europeSeries.filter((point) => point.date >= points[0].date && point.date <= points.at(-1)!.date && europePriceForMode(point, priceMode) != null);
  const maxVisiblePrice = Math.max(...points.map((point) => gasPriceForMode(point, priceMode)), ...visibleEurope.map((point) => europePriceForMode(point, priceMode) ?? 0), 10);
  const maxGas = Math.ceil((maxVisiblePrice * 1.08) / 2.5) * 2.5;
  const marketValues = points.map((point) => point.marketNormalized).filter((value): value is number => value != null);
  const [minMarket, maxMarket] = marketValues.length ? extent(marketValues) : [0, 1];

  const x = (date: string) => margin.left + ((dateToMs(date) - minDate) / (maxDate - minDate)) * innerWidth;
  const yGas = (value: number) => margin.top + (1 - (value - minGas) / (maxGas - minGas)) * innerHeight;
  const yMarket = (value: number) => margin.top + (1 - (value - minMarket) / (maxMarket - minMarket)) * innerHeight;
  const gasPath = pathFromPoints(points, (point) => x(point.date), (point) => yGas(gasPriceForMode(point, priceMode)));
  const marketPath = pathFromPoints(points, (point) => x(point.date), (point) => (point.marketNormalized == null ? null : yMarket(point.marketNormalized)));
  const europePath = pathFromPoints(visibleEurope, (point) => x(point.date), (point) => {
    const price = europePriceForMode(point, priceMode);
    return price == null ? null : yGas(price);
  });
  const selected = hover ?? points.at(-1)!;
  const selectedEurope = nearestEuropePoint(visibleEurope, selected.date);
  const visibleEvents = dataset.events.filter((event) => event.date >= points[0].date && event.date <= points.at(-1)!.date);
  const years = buildYearTicks(points[0].date, points.at(-1)!.date);
  const isLongView = points[0].date < "1990-01-01";
  const yTicks = buildMoneyTicks(maxGas);
  const selectedGas = gasPriceForMode(selected, priceMode);
  const selectedEuropePrice = selectedEurope ? europePriceForMode(selectedEurope, priceMode) : null;
  const eventTooltipWidth = hoveredEvent ? Math.min(430, Math.max(190, hoveredEvent.title.length * 7 + 32)) : 0;
  const eventTooltipX = hoveredEvent ? clamp(x(hoveredEvent.date) - eventTooltipWidth / 2, margin.left + 8, width - margin.right - eventTooltipWidth - 8) : 0;

  function handleMove(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = clamp(((event.clientX - rect.left) / rect.width) * width, margin.left, width - margin.right);
    const target = minDate + ((px - margin.left) / innerWidth) * (maxDate - minDate);
    setHover(nearestChartPoint(points, target));
  }

  return (
    <section className="chart-panel" aria-label="Gas prices timeline chart">
      <div className="chart-head">
        <div>
          <h2>Weekly price timeline</h2>
          <p>
            Gasoline is dollars per gallon. {isLongView ? "Pre-1990 U.S. prices are annual context; 1990 onward is weekly detail. " : ""}
            Europe is converted to USD/gallon with ECB exchange rates.
          </p>
        </div>
        <div className="readout">
          <span>{formatDate(selected.date)}</span>
          <strong>{niceMoney(selectedGas)}</strong>
          <small>{selectedEuropePrice ? `EU ${niceMoney(selectedEuropePrice)}` : selected.marketNormalized ? `Market ${selected.marketNormalized.toFixed(1)}` : "Market n/a"}</small>
          <em>{priceMode === "real" ? `U.S. CPI adjusted to ${dataset.metrics.cpiBaseDate.slice(0, 7)} dollars` : "Actual pump prices"}</em>
        </div>
      </div>
      <div className="chart-action-row">
        <button className={`price-mode-button chart-mode ${priceMode === "real" ? "active" : ""}`} onClick={onTogglePriceMode}>
          {priceMode === "real" ? "Adjusted for Inflation" : "Actual Prices"}
        </button>
      </div>
      <div className="chart-viewport">
        <div className="chart-scroll">
        <svg className="timeline-svg" viewBox={`0 0 ${width} ${height}`} role="img" onPointerMove={handleMove} onPointerLeave={() => { setHover(null); setHoveredEvent(null); }}>
        <rect className="plot-bg" x={margin.left} y={margin.top} width={innerWidth} height={innerHeight} rx="8" />

        {years.map((year) => (
          <g key={year}>
            <line className="grid-line" x1={x(`${year}-01-01`)} x2={x(`${year}-01-01`)} y1={margin.top} y2={height - margin.bottom} />
            <text className="axis-label" x={x(`${year}-01-01`)} y={height - 18} textAnchor="middle">
              {year}
            </text>
          </g>
        ))}

        {yTicks.map((value) => (
          <g key={value}>
            <line className="grid-line horizontal" x1={margin.left} x2={width - margin.right} y1={yGas(value)} y2={yGas(value)} />
            <text className="axis-label" x={margin.left - 12} y={yGas(value) + 4} textAnchor="end">
              {niceMoney(value)}
            </text>
          </g>
        ))}

        {activeOverlays.recessions &&
          dataset.recessions
            .filter((span) => span.end >= points[0].date && span.start <= points.at(-1)!.date)
            .map((span) => (
              <rect
                key={`${span.start}-${span.end}`}
                className="recession-span"
                x={x(maxDateString(span.start, points[0].date))}
                y={margin.top}
                width={Math.max(2, x(minDateString(span.end, points.at(-1)!.date)) - x(maxDateString(span.start, points[0].date)))}
                height={innerHeight}
              />
            ))}

        {activeOverlays.presidents &&
          dataset.presidents
            .filter((term) => term.end >= points[0].date && term.start <= points.at(-1)!.date)
            .map((term) => (
              <g key={`${term.name}-${term.start}`}>
                <rect
                  className={`president-span ${term.party.toLowerCase()}`}
                  x={x(maxDateString(term.start, points[0].date))}
                  y={margin.top}
                  width={Math.max(3, x(minDateString(term.end, points.at(-1)!.date)) - x(maxDateString(term.start, points[0].date)))}
                  height={18}
                />
                <text className="president-label" x={x(maxDateString(term.start, points[0].date)) + 6} y={margin.top + 13}>
                  {term.name.split(" ").at(-1)}
                </text>
              </g>
            ))}

        {activeOverlays.market && marketValues.length > 0 && <path className="market-line" d={marketPath} />}
        {activeOverlays.europe && visibleEurope.length > 0 && <path className="europe-line" d={europePath} />}
        <path className="gas-line" d={gasPath} />

        {isLongView && (
          <g className="cadence-boundary">
            <line x1={x("1990-01-01")} x2={x("1990-01-01")} y1={margin.top} y2={height - margin.bottom} />
            <text x={x("1990-01-01") + 8} y={height - margin.bottom - 10}>weekly detail begins</text>
          </g>
        )}

        {activeOverlays.events &&
          visibleEvents.map((event) => (
            <g
              key={event.id}
              className={`event-marker ${event.category}`}
              onPointerEnter={() => setHoveredEvent(event)}
              onPointerLeave={() => setHoveredEvent(null)}
              aria-label={event.title}
            >
              <line x1={x(event.date)} x2={x(event.date)} y1={margin.top + 24} y2={height - margin.bottom} />
              <circle cx={x(event.date)} cy={margin.top + 24} r="6" />
            </g>
          ))}

        {hoveredEvent && (
          <g className="event-tooltip" transform={`translate(${eventTooltipX} ${margin.top + 36})`}>
            <rect width={eventTooltipWidth} height="34" rx="7" />
            <text x="16" y="22">{hoveredEvent.title}</text>
          </g>
        )}

        <g className="hover-marker">
          <line x1={x(selected.date)} x2={x(selected.date)} y1={margin.top} y2={height - margin.bottom} />
          <circle cx={x(selected.date)} cy={yGas(selectedGas)} r="6" />
        </g>
        </svg>
        </div>
      </div>
      <div className="legend-row">
        <span className="legend gas" tabIndex={0} data-tooltip="U.S. retail gasoline price from EIA/FRED. Pre-1990 values are annual EIA context; 1990 onward is weekly.">Gasoline</span>
        <span className="legend europe" tabIndex={0} data-tooltip="EU average Euro-super 95 from the European Commission, converted from EUR/liter to USD/gallon using ECB reference rates. Inflation mode applies U.S. CPI after conversion for dollar comparison.">Europe</span>
        <span className="legend market" tabIndex={0} data-tooltip="NASDAQ Composite via FRED, indexed to 100 at the selected start date. This is broad market context, not a gasoline price.">NASDAQ proxy</span>
        <span className="legend recession" tabIndex={0} data-tooltip="NBER U.S. recession indicator via FRED, shown as shaded periods.">NBER recession</span>
        <span className="legend event" tabIndex={0} data-tooltip="Curated event markers backed by official or institutional source links in the research view.">Verified event</span>
      </div>
    </section>
  );
}

function OilStocksPanel({
  dataset,
  activeStocks,
  setActiveStocks,
  startDate,
}: {
  dataset: AppDataset;
  activeStocks: Record<string, boolean>;
  setActiveStocks: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  startDate: string;
}) {
  const selected = dataset.oilStockSeries
    .filter((series) => activeStocks[series.symbol])
    .map((series) => normalizeStockSeries(series, startDate))
    .filter((series) => series.points.length > 1);

  const width = 1180;
  const height = 320;
  const margin = { top: 22, right: 44, bottom: 46, left: 64 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const allPoints = selected.flatMap((series) => series.points);
  const hasSelectedStocks = allPoints.length > 1;
  const [minDate, maxDate] = hasSelectedStocks ? extent(allPoints.map((point) => dateToMs(point.date))) : [dateToMs("2005-01-01"), dateToMs(dataset.metrics.lastDate)];
  const minDateLabel = new Date(minDate).toISOString().slice(0, 10);
  const maxDateLabel = new Date(maxDate).toISOString().slice(0, 10);
  const [rawMinIndex, rawMaxIndex] = hasSelectedStocks ? extent(allPoints.map((point) => point.index)) : [75, 125];
  const minIndex = Math.max(0, Math.floor((rawMinIndex * 0.94) / 25) * 25);
  const maxIndex = Math.ceil((rawMaxIndex * 1.06) / 25) * 25;
  const x = (date: string) => margin.left + ((dateToMs(date) - minDate) / (maxDate - minDate)) * innerWidth;
  const y = (value: number) => margin.top + (1 - (value - minIndex) / (maxIndex - minIndex)) * innerHeight;
  const years = buildYearTicks(minDateLabel, maxDateLabel);
  const ticks = buildIndexTicks(minIndex, maxIndex);

  return (
    <section className="stock-panel" aria-label="Oil company stock performance chart">
      <div className="chart-head compact">
        <div>
          <h2>Oil company stock performance</h2>
          <p>Monthly Nasdaq close prices indexed to 100 at each selected company&apos;s first visible observation. Price performance only; dividends are not included.</p>
        </div>
        <div className="stock-toggle-row" aria-label="Oil company stock overlays">
          {dataset.oilStockSeries.map((company) => (
            <button
              key={company.symbol}
              className={activeStocks[company.symbol] ? "stock-toggle active" : "stock-toggle"}
              data-tooltip={company.name}
              style={{ "--stock-color": company.color } as React.CSSProperties}
              onClick={() => setActiveStocks((current) => ({ ...current, [company.symbol]: !current[company.symbol] }))}
              aria-label={`${company.name} stock performance`}
            >
              {company.symbol}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-scroll">
        <svg className="stock-svg" viewBox={`0 0 ${width} ${height}`} role="img">
          <rect className="plot-bg" x={margin.left} y={margin.top} width={innerWidth} height={innerHeight} rx="8" />
          {years.map((year) => (
            <g key={year}>
              <line className="grid-line" x1={x(`${year}-01-01`)} x2={x(`${year}-01-01`)} y1={margin.top} y2={height - margin.bottom} />
              <text className="axis-label" x={x(`${year}-01-01`)} y={height - 16} textAnchor="middle">
                {year}
              </text>
            </g>
          ))}
          {ticks.map((value) => (
            <g key={value}>
              <line className="grid-line horizontal" x1={margin.left} x2={width - margin.right} y1={y(value)} y2={y(value)} />
              <text className="axis-label" x={margin.left - 10} y={y(value) + 4} textAnchor="end">
                {value}
              </text>
            </g>
          ))}
          {hasSelectedStocks && selected.map((series) => (
            <path key={series.symbol} className="stock-line" d={pathFromPoints(series.points, (point) => x(point.date), (point) => y(point.index))} style={{ stroke: series.color }} />
          ))}
        </svg>
      </div>
      {hasSelectedStocks && <div className="stock-legend">
        {selected.map((series) => (
          <span key={series.symbol} style={{ "--stock-color": series.color } as React.CSSProperties}>
            <strong>{series.symbol}</strong> {series.name}
          </span>
        ))}
      </div>}
    </section>
  );
}

function EventsView({ events }: { events: EventMarker[] }) {
  return (
    <section className="list-view">
      <div className="section-heading">
        <h2>Event-driven story</h2>
        <p>Events are included only when a trusted source supports the link to oil, gasoline, supply, demand, or market risk.</p>
      </div>
      <div className="event-grid">
        {events.map((event) => (
          <article key={event.id} className={`event-card ${event.category}`}>
            <div className="event-date">{formatDate(event.date)}</div>
            <h3>{event.title}</h3>
            <p>{event.summary}</p>
            <p className="why">{event.whyIncluded}</p>
            <div className="card-footer">
              <span>{event.category}</span>
              <span>{event.confidence} confidence</span>
            </div>
            <SourceLinks urls={event.sources} />
          </article>
        ))}
      </div>
    </section>
  );
}

function AdministrationView({ dataset }: { dataset: AppDataset }) {
  return (
    <section className="list-view">
      <div className="section-heading">
        <h2>Administration comparison</h2>
        <p>Presidential terms are context bands. The table is descriptive and does not assign causality to presidents.</p>
      </div>
      <div className="admin-table">
        <div className="admin-row header">
          <span>Administration</span>
          <span>Start</span>
          <span>End</span>
          <span>Change</span>
          <span>Term high</span>
        </div>
        {dataset.administrations.map((term) => (
          <div key={`${term.name}-${term.start}`} className="admin-row">
            <span>
              <strong>{term.name}</strong>
              <small>{term.party}</small>
            </span>
            <span>{niceMoney(term.startGas)}</span>
            <span>{niceMoney(term.endGas)}</span>
            <span className={term.changePct >= 0 ? "up" : "down"}>{term.changePct >= 0 ? "+" : ""}{term.changePct}%</span>
            <span>{niceMoney(term.highGas)} <small>{formatYear(term.highDate)}</small></span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ResearchCanvas({ dataset }: { dataset: AppDataset }) {
  return (
    <section className="research-layout">
      <div className="section-heading">
        <h2>Research canvas</h2>
        <p>Base notes for the project, including source limits and event curation status.</p>
      </div>
      <div className="research-grid">
        <article className="research-block">
          <h3>Data policy</h3>
          <p>{dataset.policy.sourceTier}. Reddit, Wikipedia, Yahoo Finance, Stooq, and unsourced summaries are blocked by the verification script.</p>
          <p>{dataset.policy.longView}</p>
          <p>{dataset.policy.marketOverlay}</p>
          <p>{dataset.policy.europeOverlay}</p>
          <p>{dataset.policy.inflation}</p>
          <p>{dataset.policy.oilStocks}</p>
        </article>
        <article className="research-block">
          <h3>Dataset status</h3>
          <p>{dataset.metrics.annualObservations.toLocaleString()} annual U.S. observations beginning {formatYear(dataset.metrics.longFirstDate)}.</p>
          <p>{dataset.metrics.weeklyObservations.toLocaleString()} weekly observations from {formatDate(dataset.metrics.firstDate)} through {formatDate(dataset.metrics.lastDate)}.</p>
          <p>{dataset.metrics.europeanObservations.toLocaleString()} European observations from {formatDate(dataset.metrics.europeFirstDate)} through {formatDate(dataset.metrics.europeLastDate)}.</p>
          <p>{dataset.metrics.oilCompanyCount.toLocaleString()} oil-company equity series sampled monthly from Nasdaq.</p>
          <p>Weekly gas/market change correlation: {dataset.metrics.gasMarketWeeklyChangeCorrelation ?? "n/a"}.</p>
        </article>
        <article className="research-block wide">
          <h3>Core sources</h3>
          <div className="source-list">
            {dataset.sources.map((source) => (
              <a key={source.id} href={source.url} target="_blank" rel="noreferrer">
                <span>{source.label}</span>
                <small>{source.publisher}</small>
                <ExternalLink aria-hidden="true" />
              </a>
            ))}
          </div>
        </article>
        <article className="research-block wide">
          <h3>Open research questions</h3>
          <ul className="plain-list">
            <li>Which regional gasoline series should be added after the national view: PADD regions, selected states, or major cities?</li>
            <li>Should oil-company equities be expanded beyond integrated majors into refiners, services, and pipelines?</li>
            <li>Which event threshold should define “major” in later versions: price move size, source consensus, or editorial importance?</li>
          </ul>
        </article>
      </div>
    </section>
  );
}

function SourceNote({ dataset }: { dataset: AppDataset }) {
  return (
    <section className="source-note">
      <CheckCircle2 aria-hidden="true" />
      <p>
        Data generated {formatDate(dataset.generatedAt.slice(0, 10))}. Gasoline: EIA via FRED and EIA MER Table 9.4. Inflation: CPIAUCSL via FRED. Europe: European Commission plus ECB conversion. Market proxy: Nasdaq Composite via FRED. Oil equities: Nasdaq chart data sampled monthly.
        DJIA is cited for context where official licensing allows, but the long raw Dow series is not redistributed.
      </p>
    </section>
  );
}

function SourceLinks({ urls }: { urls: string[] }) {
  return (
    <div className="source-links">
      {urls.map((url, index) => (
        <a key={url} href={url} target="_blank" rel="noreferrer">
          Source {index + 1}
          <ExternalLink aria-hidden="true" />
        </a>
      ))}
    </div>
  );
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <article className="metric">
      <div className="metric-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function ModeButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button className={active ? "active" : ""} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function buildYearTicks(start: string, end: string) {
  const span = formatYear(end) - formatYear(start);
  const interval = span > 45 ? 10 : 5;
  const startYear = Math.ceil(formatYear(start) / interval) * interval;
  const endYear = formatYear(end);
  const years: number[] = [];
  for (let year = startYear; year <= endYear; year += interval) years.push(year);
  return years;
}

function buildMoneyTicks(maxValue: number) {
  const step = maxValue > 10 ? 5 : 2.5;
  const ticks = [];
  for (let value = 0; value <= maxValue + 0.001; value += step) ticks.push(value);
  if (ticks.at(-1) !== maxValue) ticks.push(maxValue);
  return ticks;
}

function buildIndexTicks(minValue: number, maxValue: number) {
  const ticks = [];
  for (let value = minValue; value <= maxValue + 0.001; value += 25) ticks.push(value);
  return ticks;
}

function gasPriceForMode(point: ChartPoint, mode: PriceMode) {
  return mode === "real" ? point.gasPriceReal : point.gasPrice;
}

function europePriceForMode(point: EuropeSeriesPoint, mode: PriceMode) {
  return mode === "real" ? point.euGasUsdPerGallonReal : point.euGasUsdPerGallon;
}

function normalizeStockSeries(series: OilStockSeries, startDate: string) {
  const points = series.points.filter((point) => point.date >= startDate);
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

function nearestChartPoint(points: ChartPoint[], targetMs: number) {
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

function nearestEuropePoint(points: EuropeSeriesPoint[], targetDate: string) {
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

function maxDateString(left: string, right: string) {
  return left > right ? left : right;
}

function minDateString(left: string, right: string) {
  return left < right ? left : right;
}

export default App;
