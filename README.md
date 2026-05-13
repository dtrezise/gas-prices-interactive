# Gas Prices Interactive

Interactive GitHub Pages site exploring U.S. gasoline prices from 1949 onward, with verified overlays for European petrol, market context, oil-company equities, recessions, presidential terms, and major energy events.

The long view uses annual EIA historical gasoline data before 1990 and weekly EIA/FRED gasoline data from 1990 onward. European petrol uses the European Commission Weekly Oil Bulletin's EU average Euro-super 95 history from 2005 onward, converted to USD/gallon using European Central Bank reference rates. The price chart can switch between actual pump prices and U.S. CPI-adjusted dollars.

## Source Policy

This project uses strict official sources only. Data and event links are verified against an allowlist covering EIA, FRED/St. Louis Fed, NBER, DOE, FTC, Federal Reserve, S&P Dow Jones Indices, Nasdaq, IEA, OPEC, and related official domains. Reddit, Wikipedia, Yahoo Finance, Stooq, and unsourced material are blocked by `npm run data:verify`.

## Commands

```bash
npm install
npm run data:update
npm run data:verify
npm run test
npm run build
npm run dev
```

GitHub Actions also runs a scheduled Tuesday refresh that fetches official data, verifies it, builds the static artifact, and republishes GitHub Pages.

## Notes

- Gasoline data: EIA `GASREGW` via FRED.
- Long-view annual gasoline data: EIA Monthly Energy Review Table 9.4.
- European petrol data: European Commission Weekly Oil Bulletin, parsed from the official price-history workbook in EUR/liter and converted with ECB USD/EUR reference rates.
- Inflation adjustment: FRED `CPIAUCSL`, expressed in the latest available CPI month. Europe is converted to USD/gallon first and then adjusted with U.S. CPI for dollar comparison.
- Market proxy: Nasdaq Composite via FRED for 1990-present coverage.
- Oil-company stock performance: Nasdaq chart data sampled monthly and indexed to 100 at the first visible observation. This is price-only performance, not dividend-adjusted total return.
- DJIA is cited as official context, but the raw long DJIA series is not redistributed because of source copyright restrictions.
- Static data is generated into `public/data/` so GitHub Pages does not require API secrets.
