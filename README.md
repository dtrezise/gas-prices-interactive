# Gas Prices Interactive

Interactive GitHub Pages site exploring U.S. weekly gasoline prices from 1990 onward, with verified overlays for market context, recessions, presidential terms, and major energy events.

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

## Notes

- Gasoline data: EIA `GASREGW` via FRED.
- Market proxy: Nasdaq Composite via FRED for 1990-present coverage.
- DJIA is cited as official context, but the raw long DJIA series is not redistributed because of source copyright restrictions.
- Static data is generated into `public/data/` so GitHub Pages does not require API secrets.
