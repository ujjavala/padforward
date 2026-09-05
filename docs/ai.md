# PadForward — AI

## Design: an agent, not a chatbot

`POST /ai/query` routes natural language through `AIService`:

1. **GeminiAgent** (when `GEMINI_API_KEY` is set) — Gemini 2.0 Flash with
   function declarations for the full tool registry; multi-round tool calling
   (max 4 rounds), temperature 0.2.
2. **DeterministicAgent** (always available) — regex/keyword intent engine that
   calls the *same tools*, guaranteeing a working demo without any key.

## Tools

All tools live in `app/ai/tools.py` and delegate to the validated service layer.
The model **cannot** write to the database directly.

| Tool | Effect |
|---|---|
| `find_nearby_stations` | read |
| `get_station_status` / `get_station_facilities` | read |
| `get_walking_route` | read (haversine + Google directions URL) |
| `calculate_station_need` / `get_highest_need_locations` | read/recompute |
| `create_donation` | **write** — only on explicit user confirmation |
| `report_supply_status` | **write** — validated 0–500 |
| `adopt_station` | **write** |
| `get_user_impact` | read |
| `find_locations_along_route` | read (route-corridor search) |

## Safety rules (system prompt + code)

- Only state availability that comes from tool results — never invent stations,
  supplies, or donations.
- No data ⇒ *"I don't have a recent supply report for that location."*
- Never request or reveal personal/menstrual health information; no medical advice.
- Concise, calm, non-judgmental, action-oriented replies. For urgent needs:
  nearest available → walking time → directions → alternative.
- Tool inputs validated in code (quantity bounds, station resolution, unknown
  tools rejected) — belt and braces beyond the prompt.

## Example intents (covered by tests)

- "I need a pad" / "I need something for my period" → FIND_PAD
- "I suddenly got my period and I'm at Central" → FIND_PAD @ named station
- "I have 20 pads to donate. Where should I donate?" → DONATE (highest need)
- "The donation box at Town Hall is empty" → SUPPLY_REPORT (recorded, supply=0)
- "…from Redfern to Wynyard, is there a pad along my route?" → ROUTE_SEARCH
