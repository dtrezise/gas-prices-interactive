export function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines.shift());
  return lines
    .map((line) => {
      const values = parseCsvLine(line);
      return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
    })
    .filter((row) => Object.values(row).some(Boolean));
}

export function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += char;
    }
  }
  values.push(value);
  return values;
}

export function toNumber(value) {
  if (value === "." || value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function nearestPriorValue(records, targetDate) {
  const target = new Date(`${targetDate}T00:00:00Z`).getTime();
  let best = null;
  for (const record of records) {
    const time = new Date(`${record.date}T00:00:00Z`).getTime();
    if (time <= target) best = record;
    if (time > target) break;
  }
  return best;
}

export function pearsonCorrelation(points, leftKey, rightKey) {
  const pairs = points
    .map((point) => [point[leftKey], point[rightKey]])
    .filter(([left, right]) => Number.isFinite(left) && Number.isFinite(right));
  if (pairs.length < 3) return null;

  const meanLeft = pairs.reduce((sum, [left]) => sum + left, 0) / pairs.length;
  const meanRight = pairs.reduce((sum, [, right]) => sum + right, 0) / pairs.length;
  let numerator = 0;
  let leftVariance = 0;
  let rightVariance = 0;

  for (const [left, right] of pairs) {
    const dl = left - meanLeft;
    const dr = right - meanRight;
    numerator += dl * dr;
    leftVariance += dl * dl;
    rightVariance += dr * dr;
  }

  const denominator = Math.sqrt(leftVariance * rightVariance);
  return denominator === 0 ? null : numerator / denominator;
}

export function pctChange(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function buildRecessionSpans(monthlyRecords) {
  const spans = [];
  let current = null;

  for (const record of monthlyRecords) {
    if (record.value === 1 && !current) {
      current = { start: record.date, end: record.date };
    } else if (record.value === 1 && current) {
      current.end = record.date;
    } else if (record.value === 0 && current) {
      spans.push({ ...current, end: endOfMonth(current.end) });
      current = null;
    }
  }

  if (current) spans.push({ ...current, end: endOfMonth(current.end) });
  return spans;
}

export function endOfMonth(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);
}

export function domainOf(url) {
  return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
}
