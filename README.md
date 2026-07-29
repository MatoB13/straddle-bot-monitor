# Straddle Bot — Monitor

Read-only mobilne responzivny monitoring dashboard pre [Straddle_bot](https://github.com/MatoB13/straddle-bot).
Cita priamo z tej istej Railway Postgres DB, do ktorej bot zapisuje - ziadne
duplicitne ukladanie, vzdy aktualne.

Staticka stranka (`index.html`) + jedna serverless funkcia (`api/status.js`),
hostovane na Vercel. Rovnaky pattern ako `nas100-monitor-web`.

## Setup

1. Push tento priecinok do vlastneho GitHub repa.
2. Vercel → **Add New Project** → Import z GitHub repa.
3. V **Settings → Environment Variables** nastav:

   | Premenna | Hodnota |
   |---|---|
   | `DATABASE_URL` | **Verejny** Postgres connection string zo straddle-bot Railway projektu (Postgres sluzba → tab **Connect** → "Public Network" URL, nie interny) |
   | `DASHBOARD_TOKEN` | tajny token na ochranu pred nahodnym pristupom |

4. Po deployi pridaj **custom domain** (`straddle-bot.matotam.io`) v Vercel → Settings → Domains.
5. Otvor `https://straddle-bot.matotam.io/?token=<DASHBOARD_TOKEN>`.

## Bezpecnost

Token v URL nie je sifrovanie - je to len ochrana proti nahodnemu narazeniu na
stranku. Nezdielaj link s tokenom verejne.
