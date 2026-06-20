-- Clean up corridor display names on existing databases: the original seed used
-- an ASCII "<->" which leaked into the UI. Replace with a proper bidirectional
-- arrow. Idempotent (no-op once already clean).
BEGIN;

UPDATE corridors
   SET display_name = replace(display_name, ' <-> ', ' ↔ ')
 WHERE display_name LIKE '% <-> %';

COMMIT;
