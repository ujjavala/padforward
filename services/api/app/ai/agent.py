"""AI service abstraction.

AIService is provider-agnostic: it uses Gemini function-calling when
GEMINI_API_KEY is set, and a deterministic intent engine otherwise, so the
product always works. Both paths call the exact same validated tools —
the model can never invent availability or write to the DB directly.
"""
import json
import logging
import re
from typing import Any

from sqlalchemy.orm import Session

from app.ai.tools import TOOL_REGISTRY, execute_tool
from app.config import get_settings
from app.schemas.schemas import AIQueryOut, AIToolCall

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the PadForward assistant, part of a community network that helps people
find and give emergency menstrual products at public locations — privately, with no need to ask anyone.

Rules:
- Be concise, calm, non-judgmental, and action-oriented. A few short sentences at most.
- For urgent needs, lead with the nearest AVAILABLE location, its walking time, then directions.
- ONLY state supply/availability that comes from tool results. Never invent stations, supplies or donations.
- If a tool returns no data, say: "I don't have a recent supply report for that location."
- Never ask for or reveal personal or menstrual health information. No medical advice.
- Only call create_donation when the user has clearly confirmed a quantity and a station.
- All data in this demo is clearly-labelled demo community data.
"""


class DeterministicAgent:
    """Rule-based fallback when Gemini is unavailable. Same tools, same data."""

    def process(self, db: Session, message: str, lat: float | None, lng: float | None) -> AIQueryOut:
        text = message.lower()
        calls: list[AIToolCall] = []

        def run(tool: str, **args: Any) -> dict:
            calls.append(AIToolCall(tool=tool, args=args))
            return execute_tool(db, tool, args)

        qty_match = re.search(r"(\d+)\s*(?:pads?|boxes?)?", text)
        quantity = int(qty_match.group(1)) if qty_match else None
        station_name = self._extract_station(db, text)

        # Route search (string-based parsing avoids regex backtracking)
        route = self._parse_route(text)
        if route and any(w in text for w in ("route", "way", "travelling", "traveling", "detour", "along")):
            result = run("find_locations_along_route",
                         origin_name=route[0], dest_name=route[1], max_detour_km=2.0)
            return self._route_reply(result, calls)

        # Empty / supply report
        if any(w in text for w in ("empty", "none left", "no pads", "ran out", "out of pads")) and station_name:
            result = run("report_supply_status", station_name=station_name, reported_supply=0)
            if "error" in result:
                return AIQueryOut(reply=result["error"], intent="SUPPLY_REPORT", tool_calls=calls)
            return AIQueryOut(
                reply=(f"Thanks — I've recorded that {result['station']} has no community supply. "
                       f"Its need score is now {result['need_score']}, so donors will see it as a priority."),
                intent="SUPPLY_REPORT", tool_calls=calls,
            )

        # Donation
        if any(w in text for w in ("donate", "donation", "give", "spare")):
            result = run("get_highest_need_locations", latitude=lat, longitude=lng, limit=3)
            stations = result.get("stations", [])
            if not stations:
                return AIQueryOut(reply="I don't have a recent supply report for any nearby location.",
                                  intent="DONATE", tool_calls=calls)
            top = stations[0]
            qty_part = f"Your {quantity} pads" if quantity else "Your donation"
            reply = (f"{top['name']} is currently the highest-priority location "
                     f"(need score {top['need_score']}, {top['need_level'].lower()} need, "
                     f"supply: {top['supply_status'].replace('_', ' ').lower()}). "
                     f"{qty_part} would help most there. Open the Donate flow to confirm.")
            return AIQueryOut(reply=reply, intent="DONATE", tool_calls=calls)

        # Find a pad
        if any(w in text for w in ("need a pad", "need pad", "period", "pad near", "find a pad", "pad nearby", "something for my period", "tampon")):
            if station_name:
                status = run("get_station_status", station_name=station_name)
                if "station" in status:
                    s = status["station"]
                    lat, lng = s["latitude"], s["longitude"]
            if lat is None or lng is None:
                return AIQueryOut(
                    reply=("I can help. Share your location or tell me the nearest station "
                           "(for example: 'I'm at Central') and I'll find the closest community supply."),
                    intent="FIND_PAD", tool_calls=calls,
                )
            result = run("find_nearby_stations", latitude=lat, longitude=lng, radius_km=5.0)
            return self._find_pad_reply(result, calls)

        if any(w in text for w in ("impact", "stats", "how many")):
            result = run("get_user_impact")
            return AIQueryOut(
                reply=(f"The demo network currently has {result['stations']} stations, "
                       f"{result['pads_donated']} pads donated and {result['champions']} Pad Champions."),
                intent="IMPACT", tool_calls=calls,
            )

        if any(w in text for w in ("adopt", "champion")) and station_name:
            result = run("adopt_station", station_name=station_name)
            if "error" in result:
                return AIQueryOut(reply=result["error"], intent="ADOPT", tool_calls=calls)
            return AIQueryOut(
                reply=(f"You're now a Pad Champion for {result['station']} — it has "
                       f"{result['champion_count']} champions. Thank you for keeping it stocked."),
                intent="ADOPT", tool_calls=calls,
            )

        return AIQueryOut(
            reply=("I can help you find a pad nearby, recommend where to donate, record a supply "
                   "report, or find a location along your route. What do you need?"),
            intent="UNKNOWN", tool_calls=calls,
        )

    @staticmethod
    def _parse_route(text: str) -> tuple[str, str] | None:
        """Parse 'from X to Y' / 'between X and Y' without regex backtracking."""
        for start_kw, mid_kw in (("from ", " to "), ("between ", " and ")):
            start = text.find(start_kw)
            if start == -1:
                continue
            rest = text[start + len(start_kw):]
            mid = rest.find(mid_kw)
            if mid == -1:
                continue
            origin = rest[:mid].strip()
            dest_part = rest[mid + len(mid_kw):]
            for stop_char in ".?,!":
                cut = dest_part.find(stop_char)
                if cut != -1:
                    dest_part = dest_part[:cut]
            dest = dest_part.strip()
            if origin and dest:
                return origin, dest
        return None

    def _extract_station(self, db: Session, text: str) -> str | None:
        from sqlalchemy import select

        from app.models import Station

        for s in db.scalars(select(Station)).all():
            name = s.name.lower()
            short = name.replace(" station", "").replace(" bus interchange", "")
            if name in text or (len(short) > 3 and short in text):
                return s.name
        return None

    def _find_pad_reply(self, result: dict, calls: list[AIToolCall]) -> AIQueryOut:
        stations = result.get("stations", [])
        available = [s for s in stations if s["supply_status"] in ("PLENTY", "A_FEW")]
        if available:
            top = available[0]
            alt = available[1] if len(available) > 1 else None
            reply = (f"{top['name']} has community supply "
                     f"({top['current_supply']} pads reported), about {top['walking_minutes']} min walk. ")
            if alt:
                reply += f"If it's out, {alt['name']} is {alt['walking_minutes']} min away."
            return AIQueryOut(reply=reply, intent="FIND_PAD", tool_calls=calls)
        if stations:
            return AIQueryOut(
                reply=("No community supply is currently reported nearby. The closest point is "
                       f"{stations[0]['name']} ({stations[0]['walking_minutes']} min walk) — you can "
                       "report the shortage there so donors are alerted."),
                intent="FIND_PAD", tool_calls=calls,
            )
        return AIQueryOut(reply="I don't have a recent supply report for any nearby location.",
                          intent="FIND_PAD", tool_calls=calls)

    def _route_reply(self, result: dict, calls: list[AIToolCall]) -> AIQueryOut:
        if "error" in result:
            return AIQueryOut(reply=result["error"], intent="ROUTE_SEARCH", tool_calls=calls)
        stations = [s for s in result.get("stations", []) if s["supply_status"] in ("PLENTY", "A_FEW")]
        if not stations:
            return AIQueryOut(
                reply="No location along that route currently has reported community supply.",
                intent="ROUTE_SEARCH", tool_calls=calls,
            )
        top = stations[0]
        return AIQueryOut(
            reply=(f"{top['name']} is roughly a {top['walking_minutes']}-minute detour from your route "
                   f"and has {top['current_supply']} pads reported."),
            intent="ROUTE_SEARCH", tool_calls=calls,
        )


class GeminiAgent:
    """Gemini function-calling agent using the google-genai SDK."""

    MODEL = "gemini-2.0-flash"
    MAX_TOOL_ROUNDS = 4

    def __init__(self, api_key: str):
        from google import genai  # imported lazily; optional dependency

        self._genai = genai
        self._client = genai.Client(api_key=api_key)

    def _declarations(self):
        from google.genai import types

        return [
            types.Tool(
                function_declarations=[
                    types.FunctionDeclaration(
                        name=name,
                        description=entry["description"],
                        parameters=entry["parameters"],
                    )
                    for name, entry in TOOL_REGISTRY.items()
                ]
            )
        ]

    def process(self, db: Session, message: str, lat: float | None, lng: float | None) -> AIQueryOut:
        from google.genai import types

        context = ""
        if lat is not None and lng is not None:
            context = f"\n(User's approximate location: latitude {lat}, longitude {lng}.)"

        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            tools=self._declarations(),
            temperature=0.2,
        )
        contents: list = [
            types.Content(role="user", parts=[types.Part(text=message + context)])
        ]
        calls: list[AIToolCall] = []

        for _ in range(self.MAX_TOOL_ROUNDS):
            response = self._client.models.generate_content(
                model=self.MODEL, contents=contents, config=config
            )
            candidate = response.candidates[0]
            fn_parts = [p for p in candidate.content.parts if p.function_call]
            if not fn_parts:
                text = "".join(p.text or "" for p in candidate.content.parts).strip()
                return AIQueryOut(reply=text or "I'm not sure how to help with that.",
                                  tool_calls=calls, provider="gemini")
            contents.append(candidate.content)
            response_parts = []
            for part in fn_parts:
                name = part.function_call.name
                args = dict(part.function_call.args or {})
                result = execute_tool(db, name, args)
                calls.append(AIToolCall(tool=name, args=args))
                response_parts.append(
                    types.Part.from_function_response(name=name, response={"result": result})
                )
            contents.append(types.Content(role="tool", parts=response_parts))

        return AIQueryOut(
            reply="I gathered the data but couldn't finish the answer — please try again.",
            tool_calls=calls, provider="gemini",
        )


class AIService:
    """Facade used by the API. Provider is replaceable."""

    def __init__(self):
        self._gemini: GeminiAgent | None = None
        self._fallback = DeterministicAgent()
        settings = get_settings()
        if settings.gemini_enabled:
            try:
                self._gemini = GeminiAgent(settings.gemini_api_key)
            except Exception:  # SDK missing or invalid key — degrade gracefully
                logger.warning("Gemini unavailable, using deterministic engine", exc_info=True)

    def process_user_request(
        self, db: Session, message: str, lat: float | None = None, lng: float | None = None
    ) -> AIQueryOut:
        if self._gemini is not None:
            try:
                return self._gemini.process(db, message, lat, lng)
            except Exception:
                logger.warning("Gemini call failed, falling back", exc_info=True)
        return self._fallback.process(db, message, lat, lng)


_service: AIService | None = None


def get_ai_service() -> AIService:
    global _service
    if _service is None:
        _service = AIService()
    return _service
