"""API tests: station search, donation flow, supply reporting, champions, impact."""
CENTRAL = {"latitude": -33.8832, "longitude": 151.2070}


def test_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert "features" in body


def test_nearby_stations_sorted_by_distance(client):
    res = client.get("/stations/nearby", params={**CENTRAL, "radius_km": 5})
    assert res.status_code == 200
    stations = res.json()
    assert len(stations) >= 5
    distances = [s["distance_km"] for s in stations]
    assert distances == sorted(distances)
    assert stations[0]["name"] == "Central Station"
    assert stations[0]["walking_minutes"] >= 1


def test_nearby_discovers_stations_outside_seed_area(client, monkeypatch):
    # Melbourne CBD — no seeded stations; discovery should create some.
    # Force the offline simulation path (no network in tests).
    from app.services import discovery_service

    monkeypatch.setattr(discovery_service, "_osm_candidates", lambda *a, **k: None)
    monkeypatch.setattr(discovery_service, "_gemini_candidates", lambda *a, **k: None)
    res = client.get(
        "/stations/nearby",
        params={"latitude": -37.8136, "longitude": 144.9631, "radius_km": 5},
    )
    assert res.status_code == 200
    stations = res.json()
    assert len(stations) >= 3
    assert all(s["distance_km"] <= 5 for s in stations)
    assert any("Demo Community Point" in s["address"] for s in stations)
    # Deterministic per location: repeat call must not duplicate stations
    res2 = client.get(
        "/stations/nearby",
        params={"latitude": -37.8136, "longitude": 144.9631, "radius_km": 5},
    )
    assert len(res2.json()) == len(stations)


def test_priority_returns_highest_need_first(client):
    res = client.get("/stations/priority")
    assert res.status_code == 200
    stations = res.json()
    scores = [s["need_score"] for s in stations]
    assert scores == sorted(scores, reverse=True)
    # Museum (empty, stale, high demand) should be top priority in seed data
    assert stations[0]["name"] == "Museum Station"


def test_donation_updates_station_state(client):
    priority = client.get("/stations/priority").json()
    museum = next(s for s in priority if s["name"] == "Museum Station")
    assert museum["supply_status"] == "NONE"
    before_score = museum["need_score"]

    res = client.post("/donations", json={"station_id": museum["id"], "quantity": 20})
    assert res.status_code == 201
    result = res.json()
    assert result["station_after"]["current_supply"] == 20
    assert result["station_after"]["supply_status"] == "PLENTY"
    assert result["station_after"]["need_score"] < before_score
    assert result["station_before"]["supply_status"] == "NONE"
    assert "pay" in result["message"].lower() or "forward" in result["message"].lower()


def test_donation_invalid_station_404(client):
    res = client.post("/donations", json={"station_id": 9999, "quantity": 5})
    assert res.status_code == 404


def test_donation_invalid_quantity_422(client):
    res = client.post("/donations", json={"station_id": 1, "quantity": 0})
    assert res.status_code == 422


def test_sol_quote(client):
    res = client.get("/donations/sol-quote", params={"quantity": 10})
    assert res.status_code == 200
    body = res.json()
    assert body["quantity"] == 10
    assert body["sol_amount"] > 0
    assert body["demo"] is True


def test_sol_donation_records_payment(client):
    priority = client.get("/stations/priority").json()
    station = priority[0]
    res = client.post(
        "/donations",
        json={"station_id": station["id"], "quantity": 10, "payment_method": "SOL"},
    )
    assert res.status_code == 201
    result = res.json()
    assert result["donation"]["payment_method"] == "SOL"
    assert result["donation"]["sol_amount"] > 0
    assert len(result["donation"]["tx_signature"]) == 88
    assert "SOL" in result["message"]


def test_supply_report_updates_station(client):
    res = client.post("/stations/1/supply-report",
                      json={"reported_supply": 0, "report_type": "ANONYMOUS"})
    assert res.status_code == 201
    assert res.json()["confidence"] == "LOW"
    station = client.get("/stations/1").json()
    assert station["supply_status"] == "NONE"
    assert station["current_supply"] == 0


def test_champion_verify_high_confidence(client):
    res = client.post("/stations/2/verify",
                      json={"reported_supply": 15, "report_type": "CHAMPION"})
    assert res.status_code == 200
    station = res.json()
    assert station["current_supply"] == 15
    assert station["community_confidence"] == "HIGH"


def test_adopt_station_increments_champions(client):
    before = client.get("/stations/4").json()["champion_count"]
    res = client.post("/stations/4/adopt", json={})
    assert res.status_code == 201
    assert res.json()["champion_count"] == before + 1


def test_claim_pad_is_anonymous_and_decrements(client):
    station = client.get("/stations/1").json()
    res = client.post(f"/stations/{station['id']}/claim", json={})
    assert res.status_code == 200
    assert res.json()["current_supply"] == station["current_supply"] - 1


def test_claim_with_remaining_report(client):
    res = client.post("/stations/1/claim", json={"remaining_supply": 4})
    assert res.status_code == 200
    body = res.json()
    assert body["current_supply"] == 4
    assert body["supply_status"] == "A_FEW"


def test_impact_dashboard(client):
    res = client.get("/impact")
    assert res.status_code == 200
    body = res.json()
    assert body["stations"] == 6
    assert body["pads_donated"] > 0
    assert body["demo_network"] is True
    assert isinstance(body["urgent_stations"], list)


def test_along_route_finds_town_hall(client):
    # Redfern -> Wynyard corridor should include Town Hall
    res = client.get("/stations/along-route", params={
        "origin_lat": -33.8932, "origin_lng": 151.1985,
        "dest_lat": -33.8656, "dest_lng": 151.2058,
        "max_detour_km": 2.0,
    })
    assert res.status_code == 200
    names = [s["name"] for s in res.json()]
    assert "Town Hall Station" in names
