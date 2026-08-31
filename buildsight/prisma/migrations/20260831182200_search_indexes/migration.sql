-- Full-text search over the denormalised Product.searchText haystack.
CREATE INDEX "Product_searchText_fts_idx"
  ON "Product" USING GIN (to_tsvector('english', "searchText"));

-- Trigram index powers substring/typo-tolerant fallback matching. pg_trgm is
-- not a trusted extension, so installing it may require elevated privileges;
-- the search layer degrades to ILIKE matching when it is unavailable.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'pg_trgm not installed (insufficient privilege); using ILIKE fallback';
  WHEN undefined_file THEN
    RAISE NOTICE 'pg_trgm not available on this server; using ILIKE fallback';
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "Product_searchText_trgm_idx" ON "Product" USING GIN ("searchText" gin_trgm_ops)';
  END IF;
END
$$;
