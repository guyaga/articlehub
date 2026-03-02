"""FastAPI application entry-point for the Reem-AI Sentinel worker.

Exposes a health-check endpoint, a manual scan trigger, and runs
scheduled scans at configured times in the Asia/Jerusalem timezone
via APScheduler.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import BackgroundTasks, FastAPI, HTTPException
from pydantic import BaseModel

from src.config import get_settings
from src.services.scan_orchestrator import run_scan

logger = logging.getLogger("sentinel.worker")

# ---------------------------------------------------------------------------
# Scheduler setup
# ---------------------------------------------------------------------------

scheduler = AsyncIOScheduler()


def _register_scan_jobs() -> None:
    """Register cron jobs for each configured scan time.

    Parses each ``HH:MM`` entry from ``settings.scan_times`` and adds
    a corresponding APScheduler cron trigger in the Asia/Jerusalem
    timezone.
    """
    settings = get_settings()

    for scan_time in settings.scan_times:
        hour, minute = scan_time.split(":")
        trigger = CronTrigger(
            hour=int(hour),
            minute=int(minute),
            timezone="Asia/Jerusalem",
        )
        job_id = f"scheduled_scan_{hour}_{minute}"
        scheduler.add_job(
            run_scan,
            trigger=trigger,
            id=job_id,
            replace_existing=True,
            name=f"Scheduled scan at {scan_time} IST",
        )
        logger.info("Registered scheduled scan job '%s' at %s Asia/Jerusalem", job_id, scan_time)


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Manage application startup and shutdown.

    On startup the APScheduler is configured and started.  On shutdown
    it is gracefully stopped.
    """
    # Startup
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    )
    logger.info("Starting Sentinel worker...")
    _register_scan_jobs()
    scheduler.start()
    logger.info("Scheduler started with %d job(s).", len(scheduler.get_jobs()))

    yield

    # Shutdown
    logger.info("Shutting down scheduler...")
    scheduler.shutdown(wait=False)
    logger.info("Sentinel worker stopped.")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Reem-AI Sentinel Worker",
    description="Media monitoring and analysis worker service",
    version="0.1.0",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class HealthResponse(BaseModel):
    """Response payload for the health endpoint."""

    status: str
    environment: str
    scheduled_jobs: int


class ScanTriggerResponse(BaseModel):
    """Response payload for the manual scan trigger."""

    message: str
    scan_id: str | None = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Health-check endpoint.

    Returns the current service status, environment name, and the number
    of active scheduled jobs.
    """
    settings = get_settings()
    return HealthResponse(
        status="ok",
        environment=settings.environment,
        scheduled_jobs=len(scheduler.get_jobs()),
    )


@app.post("/api/scan/trigger", response_model=ScanTriggerResponse)
async def trigger_scan(background_tasks: BackgroundTasks) -> ScanTriggerResponse:
    """Manually trigger a media scan.

    The scan runs as a background task so the HTTP response is returned
    immediately.  The ``scan_id`` will be ``None`` until the background
    task creates the scan row in the database.
    """
    try:
        background_tasks.add_task(run_scan)
        logger.info("Manual scan triggered via API.")
        return ScanTriggerResponse(
            message="Scan triggered successfully. Running in background.",
        )
    except Exception as exc:
        logger.exception("Failed to trigger scan.")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# CLI entry-point
# ---------------------------------------------------------------------------


def start() -> None:
    """Start the worker via uvicorn (used by the ``worker`` console script)."""
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8000,
        reload=not settings.is_production,
    )


if __name__ == "__main__":
    start()
