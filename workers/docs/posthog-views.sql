-- PostHog HogQL saved views for the Maildrill messaging project.
-- Infobip → PostHog Hog (no Maildrill fan-out). Forward-only from cutover.

-- View name: message_lifecycle
SELECT
    timestamp AS reported_at,
    event AS report_event,
    properties.channel AS channel,
    properties.message_id AS provider_message_id,
    properties.status_group AS status_group,
    properties.status_name AS status_name,
    properties.to AS to
FROM events
WHERE event IN (
    'message_delivery_report',
    'message_seen_report',
    'message_voice_report'
);

-- View name: delivery_funnel_daily
SELECT
    toDate(timestamp) AS day,
    properties.channel AS channel,
    properties.status_group AS status_group,
    count() AS events
FROM events
WHERE event = 'message_delivery_report'
GROUP BY day, channel, status_group
ORDER BY day DESC;

-- View name: template_approval_events
SELECT
    timestamp,
    properties.provider_template_id AS provider_template_id,
    properties.template_name AS template_name,
    properties.status AS status,
    properties.rejection_reason AS rejection_reason
FROM events
WHERE event = 'whatsapp_template_status';
