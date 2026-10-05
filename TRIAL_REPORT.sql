-- テスター別の基本集計
SELECT
  tester_id,
  COUNT(DISTINCT CASE WHEN event_type='lunch_started' THEN session_id END) AS lunch_starts,
  COUNT(DISTINCT CASE WHEN event_type='lunch_finished' THEN session_id END) AS lunch_finishes,
  SUM(CASE WHEN event_type='lunch_finished' AND reached_15min=1 THEN 1 ELSE 0 END) AS reached_15min_count,
  SUM(CASE WHEN event_type='lunch_finished' AND memo_present=1 THEN 1 ELSE 0 END) AS memo_count,
  SUM(CASE WHEN event_type='road_opened' THEN 1 ELSE 0 END) AS road_opens,
  SUM(CASE WHEN event_type='menu_choice_used' THEN 1 ELSE 0 END) AS menu_choice_uses,
  ROUND(AVG(CASE WHEN event_type='lunch_finished' THEN meal_duration_sec END)/60.0, 1) AS avg_minutes
FROM trial_events
GROUP BY tester_id
ORDER BY tester_id;

-- セッション別
SELECT
  tester_id,
  session_id,
  MIN(event_timestamp) AS started_at,
  MAX(CASE WHEN event_type='lunch_finished' THEN event_timestamp END) AS finished_at,
  MAX(CASE WHEN event_type='lunch_finished' THEN meal_duration_sec END) AS meal_duration_sec,
  MAX(reached_15min) AS reached_15min,
  MAX(memo_present) AS memo_present,
  MAX(chew_done) AS chew_done,
  MAX(detour_done) AS detour_done,
  MAX(resumed_after_background) AS resumed_after_background
FROM trial_events
WHERE session_id <> ''
GROUP BY tester_id, session_id
ORDER BY started_at DESC;
