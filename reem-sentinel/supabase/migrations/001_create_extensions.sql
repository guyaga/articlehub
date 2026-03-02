-- 001: Enable required PostgreSQL extensions
-- pgvector for RAG embeddings, pg_trgm for fuzzy text search

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
