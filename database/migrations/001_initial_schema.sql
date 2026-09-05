-- PadForward initial schema (reference DDL).
-- In development the API creates tables automatically via SQLAlchemy;
-- this file documents the canonical PostgreSQL schema.

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    role VARCHAR(16) NOT NULL DEFAULT 'DONOR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stations (
    id SERIAL PRIMARY KEY,
    google_place_id VARCHAR(128),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(32) NOT NULL DEFAULT 'TRAIN_STATION',
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address TEXT NOT NULL DEFAULT '',
    current_supply INTEGER NOT NULL DEFAULT 0,
    supply_status VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN',
    need_score INTEGER NOT NULL DEFAULT 50,
    estimated_demand INTEGER NOT NULL DEFAULT 10,
    last_verified_at TIMESTAMPTZ,
    last_restocked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supply_reports (
    id SERIAL PRIMARY KEY,
    station_id INTEGER NOT NULL REFERENCES stations(id),
    reported_supply INTEGER NOT NULL,
    report_type VARCHAR(16) NOT NULL DEFAULT 'ANONYMOUS',
    confidence VARCHAR(8) NOT NULL DEFAULT 'LOW',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS donations (
    id SERIAL PRIMARY KEY,
    donor_id INTEGER REFERENCES users(id),
    station_id INTEGER NOT NULL REFERENCES stations(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    status VARCHAR(16) NOT NULL DEFAULT 'DELIVERED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    verified_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS champions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    station_id INTEGER NOT NULL REFERENCES stations(id),
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    verified_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS requests (
    id SERIAL PRIMARY KEY,
    station_id INTEGER NOT NULL REFERENCES stations(id),
    request_type VARCHAR(32) NOT NULL DEFAULT 'NEED_SEARCH',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_supply_reports_station ON supply_reports (station_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donations_station ON donations (station_id);
CREATE INDEX IF NOT EXISTS idx_requests_station ON requests (station_id, created_at DESC);
