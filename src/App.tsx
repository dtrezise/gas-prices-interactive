import { AlertCircle, BarChart3, BookOpen, CalendarRange, CheckCircle2, Download, ExternalLink, Filter, Fuel, Globe2, Landmark, LineChart, RefreshCw, RotateCcw, Share2, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { clamp, dateToMs, extent, formatDate, formatYear, niceMoney, pathFromPoints } from "./lib/chart";
import { loadDataset } from "./lib/data";
import { downloadCsv, visibleSeriesCsv } from "./lib/export";
import { clampDateRange, europePriceForMode, gasPriceForMode, maxDateString, minDateString, nearestChartPoint, nearestEuropePoint, normalizeStockSeries, visibleChartPoints } from "./lib/series";
import { defaultOverlays, readViewState, writeViewState } from "./lib/viewState";
import type { AppDataset, ChartPoint, Confidence, EventCategory, EventMarker, OilStockSeries, OverlayKey, PriceMode, ViewMode } from "./types";

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

const eventCategories: EventCategory[] = ["war", "opec", "macro", "supply", "policy"];
const confidenceLevels: Confidence[] = ["high", "medium", "low"];

function App() {
  const [dataset, setDataset] = useState<AppDataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>("timeline");
  const [startDate, setStartDate] = useState("1990-01-01");
  const [endDate, setEndDate] = useState("");
  const [priceMode, setPriceMode] = useState<PriceMode>("actual");
  const [shareStatus, setShareStatus] = useState("");
  const [activeStocks, setActiveStocks] = useState<Record<string, boolean>>({});
  const [activeOverlays, setActiveOverlays] = useState<Record<OverlayKey, boolean>>(defaultOverlays);

  useEffect(() => {
    loadDataset()
      .then((loadedDataset) => {
        const viewState = readViewState(loadedDataset);
        setDataset(loadedDataset);
        setMode(viewState.mode);
        setStartDate(viewState.startDate);
        setEndDate(viewState.endDate);
        setPriceMode(viewState.priceMode);
        setActiveOverlays(viewState.overlays);
        setActiveStocks(Object.fromEntries(loadedDataset.oilStockSeries.map((series) => [series.symbol, viewState.activeStockSymbols ? viewState.activeStockSymbols.includes(series.symbol) : true])));
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, []);

  useEffect(() => {
    if (!dataset || !Object.keys(activeStocks).length) return;
    writeViewState({
      mode,
      startDate,
      endDate: endDate || dataset.metrics.lastDate,
      priceMode,
      overlays: activeOverlays,
      activeStockSymbols: dataset.oilStockSeries.filter((series) => activeStocks[series.symbol]).map((series) => series.symbol),
    });
  }, [activeOverlays, activeStocks, dataset, endDate, mode, priceMode, startDate]);

  const points = useMemo(() => {
    if (!dataset) return [];
    return visibleChartPoints(dataset, startDate, endDate || dataset.metrics.lastDate);
  }, [dataset, endDate, startDate]);

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
  const rangeEndDate = endDate || dataset.metrics.lastDate;
  const activeRangeLabel = formatYear(startDate) === formatYear(rangeEndDate) ? `${formatYear(startDate)}` : `${formatYear(startDate)}-${formatYear(rangeEndDate)}`;

  function applyRange(nextStartDate: string, nextEndDate: string) {
    const range = clampDateRange(dataset!, nextStartDate, nextEndDate);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  }

  function handleDownloadCsv() {
    if (!points.length) return;
    downloadCsv(`gas-prices-${startDate}-to-${rangeEndDate}.csv`, visibleSeriesCsv(dataset!, points, priceMode));
  }

  async function handleShareLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareStatus("Copied");
    } catch {
      setShareStatus("Link ready");
    }
    window.setTimeout(() => setShareStatus(""), 1600);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">U.S. gasoline prices, market context, and verified events</p>
          <h1>Gas Prices Interactive</h1>
          <p className="subtitle">Live public dashboard with official-source weekly refreshes</p>
        </div>
        <div className="status-cluster" aria-label="Data status">
          <DataStatusPill icon={<ShieldCheck />} label="Sources" value="Official only" />
          <DataStatusPill icon={<RefreshCw />} label="Refresh" value="Tuesdays 11:30 UTC" />
          <DataStatusPill icon={<CalendarRange />} label="Latest data" value={formatDate(dataset.metrics.lastDate)} />
        </div>
      </header>

      <section className="metric-strip" aria-label="Dataset summary">
        <Metric icon={<Fuel />} label={priceMode === "real" ? "Latest real gas price" : "Latest gas price"} value={last ? niceMoney(lastGas) : "n/a"} detail={last ? formatDate(last.date) : ""} />
        <Metric icon={<LineChart />} label="Range change" value={`${change >= 0 ? "+" : ""}${change.toFixed(1)}%`} detail={activeRangeLabel} />
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
        <ModeButton active={mode === "methodology"} icon={<ShieldCheck />} label="Methodology" onClick={() => setMode("methodology")} />
        <ModeButton active={mode === "research"} icon={<BookOpen />} label="Research" onClick={() => setMode("research")} />
      </nav>

      {mode === "timeline" && (
        <>
          <section className="controls-band" aria-label="Timeline controls">
            <div className="segmented" aria-label="Start year">
              {ranges.map((range) => (
                <button key={range.start} className={startDate === range.start && rangeEndDate === dataset.metrics.lastDate ? "active" : ""} onClick={() => applyRange(range.start, dataset.metrics.lastDate)}>
                  {range.label}
                </button>
              ))}
            </div>
            <div className="range-fields" aria-label="Date range">
              <label>
                <span>Start</span>
                <input type="date" value={startDate} min={dataset.metrics.longFirstDate} max={rangeEndDate} onChange={(event) => applyRange(event.target.value, rangeEndDate)} />
              </label>
              <label>
                <span>End</span>
                <input type="date" value={rangeEndDate} min={startDate} max={dataset.metrics.lastDate} onChange={(event) => applyRange(startDate, event.target.value)} />
              </label>
              <button className="icon-command" onClick={() => applyRange("1990-01-01", dataset.metrics.lastDate)} aria-label="Reset date range">
                <RotateCcw aria-hidden="true" />
              </button>
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

          <TimelineChart
            dataset={dataset}
            points={points}
            overlays={activeOverlays}
            priceMode={priceMode}
            rangeLabel={activeRangeLabel}
            onRangeSelect={applyRange}
            onTogglePriceMode={() => setPriceMode((current) => (current === "actual" ? "real" : "actual"))}
            onDownloadCsv={handleDownloadCsv}
            onShareLink={handleShareLink}
            shareStatus={shareStatus}
          />
          <OilStocksPanel dataset={dataset} activeStocks={activeStocks} setActiveStocks={setActiveStocks} startDate={startDate} endDate={rangeEndDate} />
          <SourceNote dataset={dataset} />
        </>
      )}

      {mode === "events" && <EventsView events={dataset.events} />}
      {mode === "administrations" && <AdministrationView dataset={dataset} />}
      {mode === "methodology" && <MethodologyView dataset={dataset} />}
      {mode === "research" && <ResearchCanvas dataset={dataset} />}
    </main>
  );
}

function TimelineChart({
  dataset,
  points,
  overlays: activeOverlays,
  priceMode,
  rangeLabel,
  onRangeSelect,
  onTogglePriceMode,
  onDownloadCsv,
  onShareLink,
  shareStatus,
}: {
  dataset: AppDataset;
  points: ChartPoint[];
  overlays: Record<OverlayKey, boolean>;
  priceMode: PriceMode;
  rangeLabel: string;
  onRangeSelect: (startDate: string, endDate: string) => void;
  onTogglePriceMode: () => void;
  onDownloadCsv: () => void;
  onShareLink: () => void;
  shareStatus: string;
}) {
  const [hover, setHover] = useState<ChartPoint | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<EventMarker | null>(null);
  const [brush, setBrush] = useState<{ startPx: number; currentPx: number } | null>(null);
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
  const hoverTooltipWidth = 184;
  const hoverTooltipX = hover ? clamp(x(selected.date) + 12, margin.left + 8, width - margin.right - hoverTooltipWidth - 8) : 0;
  const hoverTooltipY = hover ? clamp(yGas(selectedGas) - 74, margin.top + 8, height - margin.bottom - 82) : 0;
  const brushLeft = brush ? Math.min(brush.startPx, brush.currentPx) : 0;
  const brushWidth = brush ? Math.abs(brush.currentPx - brush.startPx) : 0;

  function pointerX(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return clamp(((event.clientX - rect.left) / rect.width) * width, margin.left, width - margin.right);
  }

  function dateFromPointer(px: number) {
    const target = minDate + ((px - margin.left) / innerWidth) * (maxDate - minDate);
    return new Date(target).toISOString().slice(0, 10);
  }

  function handleMove(event: React.PointerEvent<SVGSVGElement>) {
    const px = pointerX(event);
    const target = minDate + ((px - margin.left) / innerWidth) * (maxDate - minDate);
    setHover(nearestChartPoint(points, target));
    if (brush) setBrush((current) => current && { ...current, currentPx: px });
  }

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    const px = pointerX(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    setBrush({ startPx: px, currentPx: px });
  }

  function handlePointerUp(event: React.PointerEvent<SVGSVGElement>) {
    if (!brush) return;
    const px = pointerX(event);
    event.currentTarget.releasePointerCapture(event.pointerId);
    const left = Math.min(brush.startPx, px);
    const right = Math.max(brush.startPx, px);
    setBrush(null);
    if (right - left < 18) return;
    onRangeSelect(dateFromPointer(left), dateFromPointer(right));
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
        <button className="icon-command text-command" onClick={onDownloadCsv}>
          <Download aria-hidden="true" />
          <span>CSV</span>
        </button>
        <button className="icon-command text-command" onClick={onShareLink}>
          <Share2 aria-hidden="true" />
          <span>{shareStatus || "Share"}</span>
        </button>
        <span className="range-badge">{rangeLabel}</span>
      </div>
      <div className="chart-viewport">
        <div className="chart-scroll">
        <svg
          className="timeline-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Interactive gasoline price timeline"
          onPointerDown={handlePointerDown}
          onPointerMove={handleMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => setBrush(null)}
          onPointerLeave={() => { if (!brush) { setHover(null); setHoveredEvent(null); } }}
        >
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

        {brush && brushWidth > 2 && (
          <rect className="brush-window" x={brushLeft} y={margin.top} width={brushWidth} height={innerHeight} />
        )}

        <g className="hover-marker">
          <line x1={x(selected.date)} x2={x(selected.date)} y1={margin.top} y2={height - margin.bottom} />
          <circle cx={x(selected.date)} cy={yGas(selectedGas)} r="6" />
        </g>
        {hover && (
          <g className="point-tooltip" transform={`translate(${hoverTooltipX} ${hoverTooltipY})`}>
            <rect width={hoverTooltipWidth} height="72" rx="7" />
            <text x="12" y="20">{formatDate(selected.date)}</text>
            <text x="12" y="42">{niceMoney(selectedGas)} U.S.</text>
            <text x="12" y="61">{selectedEuropePrice ? `${niceMoney(selectedEuropePrice)} EU` : selected.marketNormalized ? `NASDAQ ${selected.marketNormalized.toFixed(1)}` : "No comparison point"}</text>
          </g>
        )}
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
  endDate,
}: {
  dataset: AppDataset;
  activeStocks: Record<string, boolean>;
  setActiveStocks: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  startDate: string;
  endDate: string;
}) {
  const selected = dataset.oilStockSeries
    .filter((series) => activeStocks[series.symbol])
    .map((series) => normalizeStockSeries(series, startDate, endDate))
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
  const [activeCategories, setActiveCategories] = useState<Record<EventCategory, boolean>>({
    war: true,
    opec: true,
    macro: true,
    supply: true,
    policy: true,
  });
  const [activeConfidence, setActiveConfidence] = useState<Record<Confidence, boolean>>({
    high: true,
    medium: true,
    low: true,
  });
  const filteredEvents = events.filter((event) => activeCategories[event.category] && activeConfidence[event.confidence]);

  return (
    <section className="list-view">
      <div className="section-heading">
        <h2>Event-driven story</h2>
        <p>Events are included only when a trusted source supports the link to oil, gasoline, supply, demand, or market risk. Filters change the view, not the underlying source list.</p>
      </div>
      <div className="filter-panel" aria-label="Event filters">
        <div>
          <span>Category</span>
          <div className="chip-row">
            {eventCategories.map((category) => (
              <ToggleChip
                key={category}
                active={activeCategories[category]}
                label={category}
                onClick={() => setActiveCategories((current) => ({ ...current, [category]: !current[category] }))}
              />
            ))}
          </div>
        </div>
        <div>
          <span>Confidence</span>
          <div className="chip-row">
            {confidenceLevels.map((confidence) => (
              <ToggleChip
                key={confidence}
                active={activeConfidence[confidence]}
                label={confidence}
                onClick={() => setActiveConfidence((current) => ({ ...current, [confidence]: !current[confidence] }))}
              />
            ))}
          </div>
        </div>
        <strong>{filteredEvents.length} of {events.length} shown</strong>
      </div>
      <div className="event-grid">
        {filteredEvents.map((event) => (
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
      {!filteredEvents.length && <p className="empty-note">No events match the current filters.</p>}
    </section>
  );
}

function AdministrationView({ dataset }: { dataset: AppDataset }) {
  const [selectedTermId, setSelectedTermId] = useState(() => `${dataset.administrations.at(-1)?.name}-${dataset.administrations.at(-1)?.start}`);
  const selectedTerm = dataset.administrations.find((term) => `${term.name}-${term.start}` === selectedTermId) ?? dataset.administrations.at(-1)!;
  const nearbyEvents = dataset.events.filter((event) => event.date >= selectedTerm.start && event.date < selectedTerm.end);
  const termYears = selectedTerm.weeks / 52.1775;

  return (
    <section className="list-view">
      <div className="section-heading">
        <h2>Administration comparison</h2>
        <p>Presidential terms are context bands. The table is descriptive and does not assign causality to presidents.</p>
      </div>
      <div className="admin-layout">
        <div className="admin-table" role="list" aria-label="Administration comparison table">
          <div className="admin-row header">
            <span>Administration</span>
            <span>Start</span>
            <span>End</span>
            <span>Change</span>
            <span>Term high</span>
          </div>
          {dataset.administrations.map((term) => {
            const termId = `${term.name}-${term.start}`;
            return (
              <button key={termId} className={selectedTermId === termId ? "admin-row selected" : "admin-row"} onClick={() => setSelectedTermId(termId)} role="listitem">
                <span>
                  <strong>{term.name}</strong>
                  <small>{term.party}</small>
                </span>
                <span>{niceMoney(term.startGas)}</span>
                <span>{niceMoney(term.endGas)}</span>
                <span className={term.changePct >= 0 ? "up" : "down"}>{term.changePct >= 0 ? "+" : ""}{term.changePct}%</span>
                <span>{niceMoney(term.highGas)} <small>{formatYear(term.highDate)}</small></span>
              </button>
            );
          })}
        </div>
        <aside className="admin-detail" aria-label={`${selectedTerm.name} term details`}>
          <div>
            <span className="detail-kicker">Selected term</span>
            <h3>{selectedTerm.name}</h3>
            <p>{formatDate(selectedTerm.start)} to {formatDate(selectedTerm.end)}. About {termYears.toFixed(1)} years of weekly observations where available.</p>
          </div>
          <div className="detail-metrics">
            <MetricMini label="Start" value={niceMoney(selectedTerm.startGas)} detail={String(formatYear(selectedTerm.start))} />
            <MetricMini label="End" value={niceMoney(selectedTerm.endGas)} detail={String(formatYear(selectedTerm.end))} />
            <MetricMini label="Low" value={niceMoney(selectedTerm.lowGas)} detail={formatDate(selectedTerm.lowDate)} />
            <MetricMini label="High" value={niceMoney(selectedTerm.highGas)} detail={formatDate(selectedTerm.highDate)} />
          </div>
          <div className="detail-callout">
            <strong className={selectedTerm.changePct >= 0 ? "up" : "down"}>{selectedTerm.changePct >= 0 ? "+" : ""}{selectedTerm.changePct}%</strong>
            <span>Term change in nominal gasoline price. This is descriptive context, not causal attribution.</span>
          </div>
          <div>
            <h3>Events during term</h3>
            {nearbyEvents.length ? (
              <ul className="mini-event-list">
                {nearbyEvents.map((event) => (
                  <li key={event.id}>
                    <span>{formatDate(event.date)}</span>
                    <strong>{event.title}</strong>
                    <small>{event.category} / {event.confidence}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-note">No curated events fall within this term.</p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function MethodologyView({ dataset }: { dataset: AppDataset }) {
  return (
    <section className="research-layout">
      <div className="section-heading">
        <h2>Methodology</h2>
        <p>This project compares price history, administrations, market context, and events. It does not treat a presidency as a single-cause explanation for gasoline prices.</p>
      </div>
      <div className="method-grid">
        <article className="research-block">
          <h3>Product spine</h3>
          <ol className="plain-list numbered">
            <li>Start with the U.S. gasoline price line.</li>
            <li>Add administrations as context bands.</li>
            <li>Layer events, recessions, Europe, and market data only when they clarify the comparison.</li>
            <li>Keep exports and shared links tied to the visible range.</li>
          </ol>
        </article>
        <article className="research-block">
          <h3>Source hierarchy</h3>
          <p>{dataset.policy.sourceTier}. Gasoline, CPI, market, recession, European petrol, and oil-company data come from official or institutional sources allowed by the verification script.</p>
          <p>Generated data is rebuilt by script and checked before release. The public JSON is an artifact, not the editing source.</p>
        </article>
        <article className="research-block">
          <h3>Causality boundary</h3>
          <p>Administration bands answer "what happened during this term?" They do not answer "who caused it?" Events and source notes are included to show mechanisms such as supply disruption, demand shocks, recession, policy changes, and producer coordination.</p>
        </article>
        <article className="research-block">
          <h3>Adjusted dollars</h3>
          <p>Inflation mode uses FRED CPIAUCSL and expresses values in {dataset.metrics.cpiBaseDate.slice(0, 7)} dollars. Europe is converted to USD per gallon before the U.S. CPI adjustment, so it is a dollar-comparison view rather than a local European cost-of-living adjustment.</p>
        </article>
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
          <h3>Expansion roadmap</h3>
          <ul className="plain-list">
            <li>Near term: stabilize range brushing, CSV export, shared links, and mobile chart review.</li>
            <li>Data expansion: add regional U.S. gasoline series, crude benchmarks, taxes, refinery capacity, and SPR release context.</li>
            <li>Research expansion: define a repeatable event threshold based on price movement, source consensus, and editorial importance.</li>
            <li>Market expansion: decide whether to include refiners, services, pipelines, and dividend-adjusted total return if a licensed official source is available.</li>
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

function DataStatusPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="data-status-pill">
      <div className="status-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
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

function ToggleChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button className={active ? "toggle-chip active" : "toggle-chip"} onClick={onClick}>
      {label}
    </button>
  );
}

function MetricMini({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="metric-mini">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
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

export default App;
