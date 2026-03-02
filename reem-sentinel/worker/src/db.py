"""Supabase client singleton.

Provides a single, reusable Supabase client instance configured from
application settings.  The client uses the service-role key so it can
bypass Row Level Security when running server-side operations.
"""

from __future__ import annotations

from functools import lru_cache

from supabase import Client, create_client

from src.config import get_settings


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    """Return a cached Supabase client configured with service-role credentials.

    The client is created once and reused for the lifetime of the process.
    It uses the service-role key which has full access to all tables,
    bypassing RLS policies.

    Returns:
        A configured ``supabase.Client`` instance.
    """
    settings = get_settings()
    client: Client = create_client(
        supabase_url=settings.supabase_url,
        supabase_key=settings.supabase_service_role_key,
    )
    return client
