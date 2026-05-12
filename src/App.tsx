import { AlertCircle, BarChart3, BookOpen, CalendarRange, CheckCircle2, ExternalLink, Filter, Fuel, Globe2, Landmark, LineChart, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { clamp, dateToMs, extent, formatDate, formatYear, nearestPoint, niceMoney, pathFromPoints } from "./lib/chart";
import { loadDataset } from "./lib/data";
import type { AppDataset, EuropeSeriesPoint, EventMarker, OverlayKey, SeriesPoint, ViewMode } from "./types";

const overlays: Array<{ key: OverlayKey; label: string }> = [
  { key: "market", label: "Market" },
  { key: "presidents", label: "Presidents" },
  { key: "events", label: "Events" },
  { key: "recessions", label: "Recessions" },
];

const ranges = [
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
  const [activeOverlays, setActiveOverlays] = useState<Record<OverlayKey, boolean>>({
    market: true,
    presidents: true,
    events: true,
    recessions: true,
  });

  useEffect(() => {
    loadDataset().then(setDataset).catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, []);

  const points = useMemo(() => dataset?.series.filter((point) => point.date >= startDate) ?? [], [dataset, startDate]);

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
  const change = first && last ? ((last.gasPrice - first.gasPrice) / first.gasPrice) * 100 : 0;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">U.S. gasoline prices, market context, and verified events</p>
          <h1>Gas Prices Interactive</h1>
        </div>
        <div className="trust-pill">
          <ShieldCheck aria-hidden="true" />
          <span>Official sources only</span>
        </div>
      </header>

      <section className="metric-strip" aria-label="Dataset summary">
        <Metric icon={<Fuel />} label="Latest gas price" value={last ? niceMoney(last.gasPrice) : "n/a"} detail={last ? formatDate(last.date) : ""} />
        <Metric icon={<LineChart />} label="Range change" value={`${change >= 0 ? "+" : ""}${change.toFixed(1)}%`} detail={`Since ${formatYear(startDate)}`} />
        <Metric icon={<BarChart3 />} label="Market proxy" value="NASDAQ" detail="Official FRED series" />
        <Metric
          icon={<Globe2 />}
          label="EU petrol"
          value={dataset.europeSeries.at(-1) ? `€${dataset.europeSeries.at(-1)!.euGasEurPerLiter.toFixed(2)}/L` : "n/a"}
          detail={dataset.europeSeries.at(-1) ? formatDate(dataset.europeSeries.at(-1)!.date) : ""}
        />
      </section>

      <nav className="mode-tabs" aria-label="Views">
        <ModeButton active={mode === "timeline"} icon={<LineChart />} label="Timeline" onClick={() => setMode("timeline")} />
        <ModeButton active={mode === "europe"} icon={<Globe2 />} label="Europe" onClick={() => setMode("europe")} />
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

          <TimelineChart dataset={dataset} points={points} overlays={activeOverlays} />
          <SourceNote dataset={dataset} />
        </>
      )}

      {mode === "events" && <EventsView events={dataset.events} />}
      {mode === "europe" && <EuropeView dataset={dataset} />}
      {mode === "administrations" && <AdministrationView dataset={dataset} />}
      {mode === "research" && <ResearchCanvas dataset={dataset} />}
    </main>
  );
}

function TimelineChart({ dataset, points, overlays: activeOverlays }: { dataset: AppDataset; points: SeriesPoint[]; overlays: Record<OverlayKey, boolean> }) {
  const [hover, setHover] = useState<SeriesPoint | null>(null);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const width = 1180;
  const height = 560;
  const margin = { top: 26, right: 74, bottom: 54, left: 74 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const [minDate, maxDate] = extent(points.map((point) => dateToMs(point.date)));
  const minGas = 0;
  const maxGas = 10;
  const marketValues = points.map((point) => point.marketNormalized).filter((value): value is number => value != null);
  const [minMarket, maxMarket] = extent(marketValues);

  const x = (date: string) => margin.left + ((dateToMs(date) - minDate) / (maxDate - minDate)) * innerWidth;
  const yGas = (value: number) => margin.top + (1 - (value - minGas) / (maxGas - minGas)) * innerHeight;
  const yMarket = (value: number) => margin.top + (1 - (value - minMarket) / (maxMarket - minMarket)) * innerHeight;
  const gasPath = pathFromPoints(points, (point) => x(point.date), (point) => yGas(point.gasPrice));
  const marketPath = pathFromPoints(points, (point) => x(point.date), (point) => (point.marketNormalized == null ? null : yMarket(point.marketNormalized)));
  const selected = hover ?? points.at(-1)!;
  const visibleEvents = dataset.events.filter((event) => event.date >= points[0].date && event.date <= points.at(-1)!.date);
  const years = buildYearTicks(points[0].date, points.at(-1)!.date);

  function handleMove(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = clamp(((event.clientX - rect.left) / rect.width) * width, margin.left, width - margin.right);
    const target = minDate + ((px - margin.left) / innerWidth) * (maxDate - minDate);
    setHover(nearestPoint(points, target));
  }

  return (
    <section className="chart-panel" aria-label="Gas prices timeline chart">
      <div className="chart-head">
        <div>
          <h2>Weekly price timeline</h2>
          <p>Gasoline is dollars per gallon with a fixed $10 ceiling. The market line is indexed to 100 at the selected start date.</p>
        </div>
        <div className="readout">
          <span>{formatDate(selected.date)}</span>
          <strong>{niceMoney(selected.gasPrice)}</strong>
          <small>{selected.marketNormalized ? `Market ${selected.marketNormalized.toFixed(1)}` : "Market n/a"}</small>
        </div>
      </div>
      <div className="chart-scroll">
      <svg className="timeline-svg" viewBox={`0 0 ${width} ${height}`} role="img" onPointerMove={handleMove} onPointerLeave={() => setHover(null)}>
        <rect className="plot-bg" x={margin.left} y={margin.top} width={innerWidth} height={innerHeight} rx="8" />

        {years.map((year) => (
          <g key={year}>
            <line className="grid-line" x1={x(`${year}-01-01`)} x2={x(`${year}-01-01`)} y1={margin.top} y2={height - margin.bottom} />
            <text className="axis-label" x={x(`${year}-01-01`)} y={height - 18} textAnchor="middle">
              {year}
            </text>
          </g>
        ))}

        {[0, 2.5, 5, 7.5, 10].map((value) => (
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

        {activeOverlays.market && <path className="market-line" d={marketPath} />}
        <path className="gas-line" d={gasPath} />

        {activeOverlays.events &&
          visibleEvents.map((event) => (
            <g
              key={event.id}
              className={`event-marker ${event.category}`}
              onPointerEnter={() => setHoveredEventId(event.id)}
              onPointerLeave={() => setHoveredEventId(null)}
            >
              <line x1={x(event.date)} x2={x(event.date)} y1={margin.top + 24} y2={height - margin.bottom} />
              <circle cx={x(event.date)} cy={margin.top + 24} r="6" />
              <title>{event.title}</title>
              {hoveredEventId === event.id && (
                <g className="event-title-tooltip" transform={`translate(${clamp(x(event.date), margin.left + 120, width - margin.right - 120)}, ${margin.top + 54})`}>
                  <rect x="-118" y="-24" width="236" height="32" rx="8" />
                  <text textAnchor="middle">{event.title}</text>
                </g>
              )}
            </g>
          ))}

        <g className="hover-marker">
          <line x1={x(selected.date)} x2={x(selected.date)} y1={margin.top} y2={height - margin.bottom} />
          <circle cx={x(selected.date)} cy={yGas(selected.gasPrice)} r="6" />
        </g>
      </svg>
      </div>
      <div className="legend-row">
        <span className="legend gas">Gasoline</span>
        <span className="legend market">NASDAQ proxy</span>
        <span className="legend recession">NBER recession</span>
        <span className="legend event">Verified event</span>
      </div>
    </section>
  );
}

function EuropeView({ dataset }: { dataset: AppDataset }) {
  const [startDate, setStartDate] = useState("2005-01-01");
  const points = dataset.europeSeries.filter((point) => point.date >= startDate);
  const first = points[0];
  const last = points.at(-1);
  const change = first && last ? ((last.euGasEurPerLiter - first.euGasEurPerLiter) / first.euGasEurPerLiter) * 100 : 0;

  return (
    <>
      <section className="controls-band" aria-label="Europe timeline controls">
        <div className="segmented" aria-label="Europe start year">
          {[
            { label: "2005", start: "2005-01-01" },
            { label: "2010", start: "2010-01-01" },
            { label: "2015", start: "2015-01-01" },
            { label: "2020", start: "2020-01-01" },
          ].map((range) => (
            <button key={range.start} className={startDate === range.start ? "active" : ""} onClick={() => setStartDate(range.start)}>
              {range.label}
            </button>
          ))}
        </div>
        <div className="europe-summary">
          <span>{last ? `Latest: €${last.euGasEurPerLiter.toFixed(2)}/L` : "Latest: n/a"}</span>
          <strong>{change >= 0 ? "+" : ""}{change.toFixed(1)}%</strong>
        </div>
      </section>
      <EuropeChart points={points} />
      <section className="source-note">
        <CheckCircle2 aria-hidden="true" />
        <p>
          European prices are EU average Euro-super 95 consumer prices including taxes, reported by the European Commission Weekly Oil Bulletin in EUR/liter.
        </p>
      </section>
    </>
  );
}

function EuropeChart({ points }: { points: EuropeSeriesPoint[] }) {
  const [hover, setHover] = useState<EuropeSeriesPoint | null>(null);
  const width = 1180;
  const height = 500;
  const margin = { top: 26, right: 74, bottom: 54, left: 74 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const [minDate, maxDate] = extent(points.map((point) => dateToMs(point.date)));
  const minPrice = 0;
  const maxPrice = 3;
  const x = (date: string) => margin.left + ((dateToMs(date) - minDate) / (maxDate - minDate)) * innerWidth;
  const y = (value: number) => margin.top + (1 - (value - minPrice) / (maxPrice - minPrice)) * innerHeight;
  const chartPath = pathFromPoints(points, (point) => x(point.date), (point) => y(point.euGasEurPerLiter));
  const selected = hover ?? points.at(-1)!;
  const years = buildYearTicks(points[0].date, points.at(-1)!.date);

  function handleMove(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = clamp(((event.clientX - rect.left) / rect.width) * width, margin.left, width - margin.right);
    const target = minDate + ((px - margin.left) / innerWidth) * (maxDate - minDate);
    let best = points[0];
    let bestDistance = Math.abs(dateToMs(best.date) - target);
    for (const point of points) {
      const distance = Math.abs(dateToMs(point.date) - target);
      if (distance < bestDistance) {
        best = point;
        bestDistance = distance;
      }
    }
    setHover(best);
  }

  return (
    <section className="chart-panel europe-panel" aria-label="European gasoline price chart">
      <div className="chart-head">
        <div>
          <h2>European petrol timeline</h2>
          <p>EU average Euro-super 95 consumer price, including duties and taxes.</p>
        </div>
        <div className="readout">
          <span>{formatDate(selected.date)}</span>
          <strong>€{selected.euGasEurPerLiter.toFixed(2)}/L</strong>
          <small>{selected.euGasWeeklyChangePct == null ? "Weekly change n/a" : `${selected.euGasWeeklyChangePct >= 0 ? "+" : ""}${selected.euGasWeeklyChangePct.toFixed(2)}% weekly`}</small>
        </div>
      </div>
      <div className="chart-scroll">
        <svg className="timeline-svg" viewBox={`0 0 ${width} ${height}`} role="img" onPointerMove={handleMove} onPointerLeave={() => setHover(null)}>
          <rect className="plot-bg" x={margin.left} y={margin.top} width={innerWidth} height={innerHeight} rx="8" />
          {years.map((year) => (
            <g key={year}>
              <line className="grid-line" x1={x(`${year}-01-01`)} x2={x(`${year}-01-01`)} y1={margin.top} y2={height - margin.bottom} />
              <text className="axis-label" x={x(`${year}-01-01`)} y={height - 18} textAnchor="middle">
                {year}
              </text>
            </g>
          ))}
          {[0, 0.75, 1.5, 2.25, 3].map((value) => (
            <g key={value}>
              <line className="grid-line horizontal" x1={margin.left} x2={width - margin.right} y1={y(value)} y2={y(value)} />
              <text className="axis-label" x={margin.left - 12} y={y(value) + 4} textAnchor="end">
                €{value.toFixed(2)}
              </text>
            </g>
          ))}
          <path className="europe-line" d={chartPath} />
          <g className="hover-marker europe-hover">
            <line x1={x(selected.date)} x2={x(selected.date)} y1={margin.top} y2={height - margin.bottom} />
            <circle cx={x(selected.date)} cy={y(selected.euGasEurPerLiter)} r="6" />
          </g>
        </svg>
      </div>
      <div className="legend-row">
        <span className="legend europe">EU Euro-super 95</span>
      </div>
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
          <p>{dataset.policy.marketOverlay}</p>
          <p>{dataset.policy.europeOverlay}</p>
        </article>
        <article className="research-block">
          <h3>Dataset status</h3>
          <p>{dataset.metrics.weeklyObservations.toLocaleString()} weekly observations from {formatDate(dataset.metrics.firstDate)} through {formatDate(dataset.metrics.lastDate)}.</p>
          <p>{dataset.metrics.europeanObservations.toLocaleString()} European observations from {formatDate(dataset.metrics.europeFirstDate)} through {formatDate(dataset.metrics.europeLastDate)}.</p>
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
            <li>Should real inflation-adjusted gasoline be added as a second price mode using official CPI data?</li>
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
        Data generated {formatDate(dataset.generatedAt.slice(0, 10))}. Gasoline: EIA via FRED. Europe: European Commission Weekly Oil Bulletin. Market proxy: Nasdaq Composite via FRED.
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
  const startYear = Math.ceil(formatYear(start) / 5) * 5;
  const endYear = formatYear(end);
  const years: number[] = [];
  for (let year = startYear; year <= endYear; year += 5) years.push(year);
  return years;
}

function maxDateString(left: string, right: string) {
  return left > right ? left : right;
}

function minDateString(left: string, right: string) {
  return left < right ? left : right;
}

export default App;
