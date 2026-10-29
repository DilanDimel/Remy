-- Shared job catalog (idea from Julio's shared job discovery): what one employer career site returned for a
-- search, saved so every student searching the same site within a few hours reuses it instead of fetching again.
-- Public postings only; nothing about any student is stored here.
CREATE TABLE IF NOT EXISTS board_cache (
  key        text PRIMARY KEY,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  raws       jsonb NOT NULL
);
