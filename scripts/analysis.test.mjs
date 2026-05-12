import test from "node:test";
import assert from "node:assert/strict";
import { buildRecessionSpans, nearestPriorValue, pctChange, pearsonCorrelation } from "./lib/analysis.mjs";

test("nearestPriorValue returns the latest record at or before a date", () => {
  const records = [
    { date: "2020-01-01", value: 1 },
    { date: "2020-01-03", value: 3 },
    { date: "2020-01-05", value: 5 },
  ];
  assert.deepEqual(nearestPriorValue(records, "2020-01-04"), { date: "2020-01-03", value: 3 });
});

test("pctChange handles normal and invalid input", () => {
  assert.equal(pctChange(110, 100), 10);
  assert.equal(pctChange(110, 0), null);
});

test("pearsonCorrelation calculates a perfect positive relationship", () => {
  const result = pearsonCorrelation(
    [
      { a: 1, b: 2 },
      { a: 2, b: 4 },
      { a: 3, b: 6 },
    ],
    "a",
    "b",
  );
  assert.equal(Math.round(result * 1000) / 1000, 1);
});

test("buildRecessionSpans groups contiguous monthly flags", () => {
  assert.deepEqual(
    buildRecessionSpans([
      { date: "2020-01-01", value: 0 },
      { date: "2020-02-01", value: 1 },
      { date: "2020-03-01", value: 1 },
      { date: "2020-04-01", value: 0 },
    ]),
    [{ start: "2020-02-01", end: "2020-03-31" }],
  );
});
