-- =============================================================================
-- Real-Time Flight Tracking Platform — PostgreSQL + TimescaleDB Schema
-- =============================================================================
-- Engine : PostgreSQL 16+
-- Ext    : TimescaleDB (time-series hypertable for flight_positions)
-- Note   : passenger_estimates stores SIMULATED occupancy only (privacy).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "timescaledb"; -- hypertables, compression, retention

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
CREATE TYPE flight_status AS ENUM (
  'scheduled',
  'boarding',
  'departed',
  'in_air',
  'landed',
  'arrived',
  'delayed',
  'cancelled',
  'diverted',
  'unknown'
);

CREATE TYPE subscription_channel AS ENUM (
  'in_app',
  'email',
  'push'
);

-- -----------------------------------------------------------------------------
-- Reference: airlines
-- -----------------------------------------------------------------------------
CREATE TABLE airlines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iata_code     CHAR(2) UNIQUE,                    -- e.g. SV
  icao_code     CHAR(3) UNIQUE,                    -- e.g. SVA
  name          TEXT NOT NULL,
  country_code  CHAR(2),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_airlines_name ON airlines (name);

-- -----------------------------------------------------------------------------
-- Reference: airports
-- -----------------------------------------------------------------------------
CREATE TABLE airports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iata_code     CHAR(3) UNIQUE,                    -- e.g. RUH
  icao_code     CHAR(4) UNIQUE,                    -- e.g. OERK
  name          TEXT NOT NULL,
  city          TEXT,
  country_code  CHAR(2) NOT NULL,
  latitude      DOUBLE PRECISION NOT NULL,
  longitude     DOUBLE PRECISION NOT NULL,
  timezone      TEXT,                              -- IANA, e.g. Asia/Riyadh
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_airports_lat CHECK (latitude  BETWEEN -90  AND 90),
  CONSTRAINT chk_airports_lon CHECK (longitude BETWEEN -180 AND 180)
);

CREATE INDEX idx_airports_country ON airports (country_code);

-- -----------------------------------------------------------------------------
-- Aircraft
-- type, registration, max passenger capacity, operating airline
-- -----------------------------------------------------------------------------
CREATE TABLE aircraft (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration          TEXT NOT NULL,             -- e.g. HZ-AK28 (tail number)
  icao24                CHAR(6) UNIQUE,            -- Mode-S / ADS-B hex
  aircraft_type_icao    TEXT NOT NULL,             -- e.g. B77W, A320
  aircraft_type_name    TEXT,                      -- e.g. Boeing 777-300ER
  max_passenger_capacity INTEGER NOT NULL CHECK (max_passenger_capacity > 0),
  airline_id            UUID NOT NULL REFERENCES airlines (id) ON DELETE RESTRICT,
  manufactured_year     SMALLINT,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_aircraft_registration UNIQUE (registration)
);

CREATE INDEX idx_aircraft_airline ON aircraft (airline_id);
CREATE INDEX idx_aircraft_type ON aircraft (aircraft_type_icao);

-- -----------------------------------------------------------------------------
-- Flights
-- flight number, status, scheduled/actual dep/arr, origin & destination airports
-- -----------------------------------------------------------------------------
CREATE TABLE flights (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_number           TEXT NOT NULL,           -- e.g. SV123
  airline_id              UUID NOT NULL REFERENCES airlines (id) ON DELETE RESTRICT,
  aircraft_id             UUID REFERENCES aircraft (id) ON DELETE SET NULL,

  origin_airport_id       UUID NOT NULL REFERENCES airports (id) ON DELETE RESTRICT,
  destination_airport_id  UUID NOT NULL REFERENCES airports (id) ON DELETE RESTRICT,

  status                  flight_status NOT NULL DEFAULT 'scheduled',

  scheduled_departure_at  TIMESTAMPTZ NOT NULL,
  scheduled_arrival_at    TIMESTAMPTZ NOT NULL,
  estimated_departure_at  TIMESTAMPTZ,
  estimated_arrival_at    TIMESTAMPTZ,
  actual_departure_at     TIMESTAMPTZ,
  actual_arrival_at       TIMESTAMPTZ,

  -- Operational day helps uniqueness when the same flight number repeats daily
  operational_date        DATE NOT NULL,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_flights_airports_differ
    CHECK (origin_airport_id <> destination_airport_id),
  CONSTRAINT chk_flights_sched_order
    CHECK (scheduled_arrival_at > scheduled_departure_at),
  CONSTRAINT uq_flights_number_day_airline
    UNIQUE (airline_id, flight_number, operational_date)
);

CREATE INDEX idx_flights_status ON flights (status);
CREATE INDEX idx_flights_origin ON flights (origin_airport_id);
CREATE INDEX idx_flights_destination ON flights (destination_airport_id);
CREATE INDEX idx_flights_aircraft ON flights (aircraft_id);
CREATE INDEX idx_flights_sched_dep ON flights (scheduled_departure_at);
CREATE INDEX idx_flights_active
  ON flights (status, scheduled_departure_at)
  WHERE status IN ('scheduled', 'boarding', 'departed', 'in_air', 'delayed');

-- -----------------------------------------------------------------------------
-- FlightPositions  (TIME-SERIES — TimescaleDB hypertable)
-- High-frequency writes: lat, lon, altitude, speed, heading, recorded_at
--
-- Design choices for write throughput:
--   1) No FK constraint to flights (app-level integrity) → faster inserts
--   2) Partition by time via create_hypertable
--   3) Composite index (flight_id, recorded_at DESC) for latest-position queries
--   4) Compression + retention policies (see bottom)
-- -----------------------------------------------------------------------------
CREATE TABLE flight_positions (
  recorded_at   TIMESTAMPTZ NOT NULL,
  flight_id     UUID NOT NULL,                     -- logical ref → flights.id (no FK)
  latitude      DOUBLE PRECISION NOT NULL,
  longitude     DOUBLE PRECISION NOT NULL,
  altitude_ft   REAL,                              -- feet MSL
  ground_speed_kts REAL,                           -- knots
  heading_deg   REAL,                              -- 0–360
  vertical_rate_fpm REAL,                          -- feet per minute (optional)
  on_ground     BOOLEAN,
  source        TEXT,                              -- e.g. adsb, provider_x
  ingested_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_pos_lat CHECK (latitude  BETWEEN -90  AND 90),
  CONSTRAINT chk_pos_lon CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT chk_pos_heading CHECK (heading_deg IS NULL OR (heading_deg >= 0 AND heading_deg < 360))
);

-- Convert to TimescaleDB hypertable: chunk by 1 day (tune per volume)
SELECT create_hypertable(
  'flight_positions',
  'recorded_at',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

-- Primary access path: latest / range positions for one flight
CREATE INDEX idx_flight_positions_flight_time
  ON flight_positions (flight_id, recorded_at DESC);

-- Geo bounding-box scans on recent chunks (map viewport)
CREATE INDEX idx_flight_positions_geo_time
  ON flight_positions (recorded_at DESC, latitude, longitude);

-- Optional: space+time partitioning later via add_dimension('flight_id', number_partitions => N)

-- -----------------------------------------------------------------------------
-- PassengerEstimates
-- SIMULATED passenger counts derived from aircraft capacity × default load factor.
-- IMPORTANT: These are NOT real passenger manifests or PII.
--            Generated for demo / analytics UX only (privacy-safe simulation).
-- -----------------------------------------------------------------------------
CREATE TABLE passenger_estimates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id             UUID NOT NULL REFERENCES flights (id) ON DELETE CASCADE,
  aircraft_id           UUID NOT NULL REFERENCES aircraft (id) ON DELETE RESTRICT,

  -- Simulation inputs
  max_capacity          INTEGER NOT NULL CHECK (max_capacity > 0),
  load_factor           NUMERIC(4, 3) NOT NULL
                          CHECK (load_factor > 0 AND load_factor <= 1),  -- e.g. 0.820
  estimated_passengers  INTEGER NOT NULL CHECK (estimated_passengers >= 0),

  -- Provenance: always mark as simulated
  is_simulated          BOOLEAN NOT NULL DEFAULT TRUE
                          CHECK (is_simulated = TRUE),
  simulation_model      TEXT NOT NULL DEFAULT 'capacity_x_default_load_factor',
  simulation_notes      TEXT NOT NULL DEFAULT
    'SIMULATED DATA ONLY — not real passenger counts; generated for privacy-safe demo/analytics.',

  estimated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_pe_estimate_lte_capacity
    CHECK (estimated_passengers <= max_capacity)
);

CREATE INDEX idx_passenger_estimates_flight ON passenger_estimates (flight_id);
CREATE INDEX idx_passenger_estimates_aircraft ON passenger_estimates (aircraft_id);

COMMENT ON TABLE passenger_estimates IS
  'SIMULATED passenger occupancy estimates only. Not real passenger data. Privacy: no PII.';
COMMENT ON COLUMN passenger_estimates.estimated_passengers IS
  'Simulated count = round(max_capacity * load_factor). NOT a real headcount.';
COMMENT ON COLUMN passenger_estimates.is_simulated IS
  'Always TRUE. Enforced by CHECK — this table must never store real manifests.';

-- -----------------------------------------------------------------------------
-- Users
-- -----------------------------------------------------------------------------
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT NOT NULL,
  email_normalized  TEXT GENERATED ALWAYS AS (lower(email)) STORED,
  password_hash     TEXT,                          -- null if social-only auth
  display_name      TEXT,
  locale            TEXT NOT NULL DEFAULT 'ar',
  timezone          TEXT NOT NULL DEFAULT 'UTC',
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  email_verified_at TIMESTAMPTZ,
  last_login_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_users_email_normalized ON users (email_normalized);

-- -----------------------------------------------------------------------------
-- UserFlightSubscriptions — user follows specific flights
-- -----------------------------------------------------------------------------
CREATE TABLE user_flight_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  flight_id       UUID NOT NULL REFERENCES flights (id) ON DELETE CASCADE,
  channel         subscription_channel NOT NULL DEFAULT 'in_app',
  notify_on_delay     BOOLEAN NOT NULL DEFAULT TRUE,
  notify_on_gate_change BOOLEAN NOT NULL DEFAULT TRUE,
  notify_on_departure BOOLEAN NOT NULL DEFAULT TRUE,
  notify_on_arrival   BOOLEAN NOT NULL DEFAULT TRUE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_user_flight_channel UNIQUE (user_id, flight_id, channel)
);

CREATE INDEX idx_ufs_user ON user_flight_subscriptions (user_id)
  WHERE is_active = TRUE;
CREATE INDEX idx_ufs_flight ON user_flight_subscriptions (flight_id)
  WHERE is_active = TRUE;

-- -----------------------------------------------------------------------------
-- TimescaleDB policies — compression & retention for high-volume positions
-- -----------------------------------------------------------------------------

-- Compress chunks older than 7 days (columnstore-like, huge disk savings)
ALTER TABLE flight_positions SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'flight_id',
  timescaledb.compress_orderby = 'recorded_at DESC'
);

SELECT add_compression_policy('flight_positions', INTERVAL '7 days');

-- Drop raw position chunks older than 90 days (tune to compliance needs)
SELECT add_retention_policy('flight_positions', INTERVAL '90 days');

-- Continuous aggregate example: 1-minute rollup for map/history without scanning raw rows
CREATE MATERIALIZED VIEW flight_positions_1m
WITH (timescaledb.continuous) AS
SELECT
  time_bucket(INTERVAL '1 minute', recorded_at) AS bucket,
  flight_id,
  last(latitude, recorded_at)  AS latitude,
  last(longitude, recorded_at) AS longitude,
  last(altitude_ft, recorded_at) AS altitude_ft,
  last(ground_speed_kts, recorded_at) AS ground_speed_kts,
  last(heading_deg, recorded_at) AS heading_deg,
  count(*) AS samples
FROM flight_positions
GROUP BY bucket, flight_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy(
  'flight_positions_1m',
  start_offset => INTERVAL '3 hours',
  end_offset   => INTERVAL '1 minute',
  schedule_interval => INTERVAL '1 minute'
);

-- -----------------------------------------------------------------------------
-- Helpful view: latest known position per flight (from continuous agg or raw)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_latest_flight_positions AS
SELECT DISTINCT ON (flight_id)
  flight_id,
  recorded_at,
  latitude,
  longitude,
  altitude_ft,
  ground_speed_kts,
  heading_deg,
  on_ground,
  source
FROM flight_positions
ORDER BY flight_id, recorded_at DESC;
