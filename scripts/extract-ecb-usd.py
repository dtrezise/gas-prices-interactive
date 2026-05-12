#!/usr/bin/env python3
"""Extract historical USD per EUR reference rates from the ECB zip CSV."""

from __future__ import annotations

import csv
import json
import sys
import zipfile


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: extract-ecb-usd.py <eurofxref-hist.zip>", file=sys.stderr)
        return 2

    with zipfile.ZipFile(sys.argv[1]) as archive:
        csv_name = archive.namelist()[0]
        with archive.open(csv_name) as handle:
            text = handle.read().decode("utf-8-sig").splitlines()

    rows = []
    for row in csv.DictReader(text):
        usd = row.get("USD")
        if usd and usd != "N/A":
            rows.append({"date": row["Date"], "usdPerEur": float(usd)})

    rows.sort(key=lambda item: item["date"])
    print(json.dumps(rows, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
