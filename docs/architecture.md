# PadForward — Architecture

## Overview

```
Next.js UI  →  FastAPI  →  PostgreSQL (+ optional Snowflake event layer)
                 ↓
          Gemini / Google Maps
```

## Service boundaries

| Concern | Owner |
|---|---|
| Station geography, walking routes | Google Maps Platform (frontend deep links; backend haversine fallback) |
| Supply, reports, donations, need score, champions | PadForward DB (source of truth) |
| Natural-language understanding + tool orchestration | `app/ai/agent.py` (Gemini or deterministic) |
| Need scoring | `app/scoring/need_score.py` — isolated, ML-replaceable |
| Analytics | `app/services/impact_service.py` — Snowflake-ready abstraction |

## Backend layout

```
services/api/app/
├── api/routes.py        # REST endpoints (strongly typed)
├── models/models.py     # SQLAlchemy: stations, supply_reports, donations,
│                        # users, champions, requests
├── schemas/schemas.py   # Pydantic contracts
├── services/            # station / donation / report / champion / impact
├── ai/
│   ├── tools.py         # validated tool registry (model never touches DB)
│   └── agent.py         # AIService facade: GeminiAgent + DeterministicAgent
├── maps/geo.py          # haversine, walking time, route-corridor math
├── scoring/need_score.py
└── seed.py              # demo network data
```

## Trust & data quality

- Every supply report carries reporter type (ANONYMOUS/DONOR/CHAMPION) and
  confidence (LOW/MEDIUM/HIGH).
- Community confidence per station: champion or ≥3 agreeing recent reports →
  HIGH; contradictory recent reports downgrade it.
- Supply is presented as Plenty / A few / None / Unknown with timestamps —
  never presented as exact truth.

## Fallback matrix

| Dependency | Detection | Fallback |
|---|---|---|
| Gemini | `GEMINI_API_KEY` unset or SDK/call failure | DeterministicAgent, same tools |
| Google Maps JS | key unset or script fails | Schematic SVG map + list |
| PostgreSQL | `DATABASE_URL` unset | SQLite file |
| Snowflake | credentials unset | PostgreSQL aggregates |
