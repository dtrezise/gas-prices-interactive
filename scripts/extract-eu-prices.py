#!/usr/bin/env python3
"""Extract EU Euro-super 95 weekly prices from the European Commission workbook.

The workbook is an .xlsx file, which is a zip archive of XML files. This script
uses only Python's standard library so the data pipeline does not need a Python
package install just to refresh the European Commission series.
"""

from __future__ import annotations

import json
import sys
import zipfile
from datetime import datetime, timedelta
from xml.etree import ElementTree

NS = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
EXCEL_EPOCH = datetime(1899, 12, 30)


def col_letters(cell_ref: str) -> str:
    return "".join(char for char in cell_ref if char.isalpha())


def excel_date(serial: str) -> str:
    date = EXCEL_EPOCH + timedelta(days=float(serial))
    return date.strftime("%Y-%m-%d")


def cell_value(cell: ElementTree.Element) -> str | None:
    value = cell.find("x:v", NS)
    return value.text if value is not None else None


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: extract-eu-prices.py <oil-bulletin-price-history.xlsx>", file=sys.stderr)
        return 2

    workbook_path = sys.argv[1]
    rows: list[dict[str, float | str]] = []

    with zipfile.ZipFile(workbook_path) as workbook:
        sheet_xml = workbook.read("xl/worksheets/sheet1.xml")

    root = ElementTree.fromstring(sheet_xml)
    for row in root.findall(".//x:sheetData/x:row", NS):
        row_number = int(row.attrib["r"])
        if row_number < 4:
            continue

        values: dict[str, str] = {}
        for cell in row.findall("x:c", NS):
            value = cell_value(cell)
            if value is not None:
                values[col_letters(cell.attrib["r"])] = value

        if "A" not in values or "C" not in values:
            continue

        rows.append(
            {
                "date": excel_date(values["A"]),
                "euGasEurPerLiter": round(float(values["C"]) / 1000, 4),
            }
        )

    rows.sort(key=lambda item: item["date"])
    print(json.dumps(rows, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
