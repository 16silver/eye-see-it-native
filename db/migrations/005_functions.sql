-- is_exhibition_open: evaluate whether an exhibition is open at a specific instant

CREATE OR REPLACE FUNCTION is_exhibition_open(p_exh UUID, p_ts TIMESTAMPTZ)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE AS $$
DECLARE v_tz TEXT; v_local_ts TIMESTAMPTZ; v_dow INT; v_t TIME; v_open BOOLEAN;
BEGIN
  SELECT v.time_zone INTO v_tz FROM venues v
    JOIN exhibitions e ON e.venue_id = v.id WHERE e.id = p_exh;
  IF v_tz IS NULL THEN
    RETURN FALSE;
  END IF;
  v_local_ts := p_ts AT TIME ZONE v_tz;
  v_dow := EXTRACT(DOW FROM v_local_ts);
  v_t := v_local_ts::time;
  -- exceptions first, fallback to regular hours
  SELECT COALESCE(
    (SELECT NOT ex.closed AND (v_t BETWEEN COALESCE(ex.open_time,'00:00') AND COALESCE(ex.close_time,'23:59'))
       FROM exhibition_exceptions ex WHERE ex.exhibition_id=p_exh AND ex.date::date=(v_local_ts::date)),
    (SELECT EXISTS (
       SELECT 1 FROM exhibition_hours h
        WHERE h.exhibition_id=p_exh AND h.day_of_week=v_dow
          AND (
            (NOT h.overnight AND v_t BETWEEN h.open_time AND h.close_time)
            OR (h.overnight AND (v_t >= h.open_time OR v_t <= h.close_time))
          )
    ))
  , false) INTO v_open;
  RETURN v_open;
END$$;


