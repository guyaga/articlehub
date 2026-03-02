-- Enable extensions for scheduled function invocation
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant usage
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT USAGE ON SCHEMA net TO postgres;

-- NOTE: The cron jobs below use hardcoded project URL and service role key
-- because Supabase hosted does not support ALTER DATABASE for app.settings.
-- Replace the placeholder values with your actual credentials.

-- Morning scan (08:00 Israel time = 06:00 UTC in winter, 05:00 UTC in summer)
SELECT cron.schedule(
  'morning-scan',
  '0 6 * * *',  -- 06:00 UTC daily
  $$SELECT net.http_post(
    url := '<SUPABASE_URL>/functions/v1/scan-trigger',
    headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
    body := '{"trigger": "scheduled"}'::jsonb
  );$$
);

-- Afternoon scan (14:30 Israel time = 12:30 UTC in winter, 11:30 UTC in summer)
SELECT cron.schedule(
  'afternoon-scan',
  '30 12 * * *',  -- 12:30 UTC daily
  $$SELECT net.http_post(
    url := '<SUPABASE_URL>/functions/v1/scan-trigger',
    headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
    body := '{"trigger": "scheduled"}'::jsonb
  );$$
);

-- Staleness protection: mark scans stuck in "running" for >15 min as "failed"
SELECT cron.schedule(
  'scan-staleness-check',
  '*/5 * * * *',  -- every 5 minutes
  $$UPDATE scans
    SET status = 'failed',
        error_log = '{"error": "Timed out after 15 minutes"}'::jsonb,
        completed_at = NOW()
    WHERE status = 'running'
      AND started_at < NOW() - INTERVAL '15 minutes';$$
);
