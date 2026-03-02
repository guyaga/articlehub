"""Embedding service for knowledge-base RAG.

Generates vector embeddings for text chunks and manages the storage
of embeddings in Supabase (pgvector).  Used to power the RAG context
retrieval in the content generation pipeline.
"""

from __future__ import annotations

import logging
from typing import Any

import anthropic

from src.config import Settings, get_settings
from src.db import get_supabase

logger = logging.getLogger("sentinel.embeddings")

# Maximum characters per chunk before embedding
_DEFAULT_CHUNK_SIZE = 1500
_DEFAULT_CHUNK_OVERLAP = 200


class EmbeddingService:
    """Generate and store text embeddings for knowledge-base content.

    Parameters:
        settings: Application settings.
        client:   An optional pre-configured ``anthropic.AsyncAnthropic`` client.
    """

    def __init__(
        self,
        settings: Settings | None = None,
        client: anthropic.AsyncAnthropic | None = None,
    ) -> None:
        self._settings = settings or get_settings()
        self._client = client or anthropic.AsyncAnthropic(
            api_key=self._settings.anthropic_api_key,
        )

    # ------------------------------------------------------------------
    # Single text embedding
    # ------------------------------------------------------------------

    async def embed_text(self, text: str) -> list[float]:
        """Generate an embedding vector for a single piece of text.

        Uses the Anthropic / Voyager embedding model (or a configurable
        alternative).

        Parameters:
            text: The text to embed.

        Returns:
            A list of floats representing the embedding vector.
        """
        if not text.strip():
            logger.warning("Empty text passed to embed_text, returning empty vector.")
            return []

        # TODO: Replace with actual embedding API call.
        # Anthropic does not currently expose a public embedding endpoint,
        # so in production you would use either:
        #   - OpenAI text-embedding-3-small
        #   - Voyage AI (voyage-2)
        #   - Cohere embed-v3
        #   - A self-hosted model
        #
        # Example with a hypothetical client:
        #   response = await self._embedding_client.embed(
        #       model="voyage-2",
        #       input=[text],
        #   )
        #   return response.embeddings[0]

        logger.info("embed_text called (placeholder) for %d chars.", len(text))
        return [0.0] * 1024  # Placeholder 1024-dim zero vector

    # ------------------------------------------------------------------
    # Chunk and embed a knowledge-base document
    # ------------------------------------------------------------------

    async def chunk_and_embed(
        self,
        kb_id: str,
        content: str,
        chunk_size: int = _DEFAULT_CHUNK_SIZE,
        chunk_overlap: int = _DEFAULT_CHUNK_OVERLAP,
    ) -> list[dict[str, Any]]:
        """Split a document into chunks, embed each, and store in Supabase.

        Parameters:
            kb_id:         The knowledge-base entry ID this content belongs to.
            content:       The full text content to chunk and embed.
            chunk_size:    Maximum characters per chunk.
            chunk_overlap: Overlap between consecutive chunks (for context).

        Returns:
            A list of dicts with ``chunk_index``, ``text``, and
            ``embedding_stored`` (bool).
        """
        if not content.strip():
            logger.warning("Empty content for kb_id=%s, skipping.", kb_id)
            return []

        chunks = self._split_into_chunks(content, chunk_size, chunk_overlap)
        logger.info("Split kb_id=%s into %d chunks.", kb_id, len(chunks))

        db = get_supabase()
        results: list[dict[str, Any]] = []

        for i, chunk_text in enumerate(chunks):
            try:
                embedding = await self.embed_text(chunk_text)

                # Store the chunk and its embedding in Supabase
                record = {
                    "kb_id": kb_id,
                    "chunk_index": i,
                    "content": chunk_text,
                    "embedding": embedding,
                }

                db.table("kb_embeddings").insert(record).execute()

                results.append({
                    "chunk_index": i,
                    "text": chunk_text[:80] + "..." if len(chunk_text) > 80 else chunk_text,
                    "embedding_stored": True,
                })

            except Exception as exc:
                logger.error("Failed to embed chunk %d for kb_id=%s: %s", i, kb_id, exc)
                results.append({
                    "chunk_index": i,
                    "text": chunk_text[:80] + "...",
                    "embedding_stored": False,
                })

        logger.info(
            "Finished embedding kb_id=%s: %d/%d chunks stored.",
            kb_id,
            sum(1 for r in results if r["embedding_stored"]),
            len(results),
        )
        return results

    # ------------------------------------------------------------------
    # Similarity search
    # ------------------------------------------------------------------

    async def search_similar(
        self,
        query: str,
        limit: int = 5,
        threshold: float = 0.7,
    ) -> list[dict[str, Any]]:
        """Find knowledge-base chunks most similar to a query.

        Parameters:
            query:     The search query text.
            limit:     Maximum number of results.
            threshold: Minimum cosine similarity threshold.

        Returns:
            A list of matching chunk dicts ordered by similarity.
        """
        query_embedding = await self.embed_text(query)

        if not query_embedding or all(v == 0.0 for v in query_embedding):
            logger.warning("Empty or zero query embedding, returning no results.")
            return []

        db = get_supabase()

        try:
            # TODO: Use Supabase RPC call to pgvector similarity search
            # Example:
            #   result = db.rpc("match_kb_embeddings", {
            #       "query_embedding": query_embedding,
            #       "match_threshold": threshold,
            #       "match_count": limit,
            #   }).execute()
            #   return result.data or []

            logger.info("search_similar called (placeholder) for query: '%s'", query[:60])
            return []

        except Exception as exc:
            logger.error("Similarity search failed: %s", exc)
            return []

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _split_into_chunks(
        text: str,
        chunk_size: int,
        overlap: int,
    ) -> list[str]:
        """Split text into overlapping chunks at sentence boundaries.

        Tries to break on sentence endings (``". "``, ``"! "``, ``"? "``)
        within the chunk window to avoid splitting mid-sentence.
        """
        if len(text) <= chunk_size:
            return [text]

        chunks: list[str] = []
        start = 0

        while start < len(text):
            end = start + chunk_size

            if end < len(text):
                # Try to find a sentence boundary near the end
                search_zone = text[max(start, end - 200):end]
                last_period = search_zone.rfind(". ")
                last_excl = search_zone.rfind("! ")
                last_ques = search_zone.rfind("? ")
                best_break = max(last_period, last_excl, last_ques)

                if best_break > 0:
                    end = max(start, end - 200) + best_break + 2

            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)

            start = end - overlap if end < len(text) else len(text)

        return chunks
