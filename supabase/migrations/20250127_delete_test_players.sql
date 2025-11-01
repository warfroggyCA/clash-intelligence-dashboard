-- Delete TEST entries from player database tables
-- This removes all player records with tags containing "TEST" (case-insensitive)

BEGIN;

-- Count what will be deleted (for verification)
DO $$
DECLARE
  notes_count INTEGER;
  warnings_count INTEGER;
  tenure_actions_count INTEGER;
  departure_actions_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO notes_count FROM player_notes WHERE UPPER(player_tag) LIKE '%TEST%';
  SELECT COUNT(*) INTO warnings_count FROM player_warnings WHERE UPPER(player_tag) LIKE '%TEST%';
  SELECT COUNT(*) INTO tenure_actions_count FROM player_tenure_actions WHERE UPPER(player_tag) LIKE '%TEST%';
  SELECT COUNT(*) INTO departure_actions_count FROM player_departure_actions WHERE UPPER(player_tag) LIKE '%TEST%';
  
  RAISE NOTICE 'About to delete:';
  RAISE NOTICE '  - % notes', notes_count;
  RAISE NOTICE '  - % warnings', warnings_count;
  RAISE NOTICE '  - % tenure actions', tenure_actions_count;
  RAISE NOTICE '  - % departure actions', departure_actions_count;
END $$;

-- Delete from player_notes
DELETE FROM player_notes 
WHERE UPPER(player_tag) LIKE '%TEST%';

-- Delete from player_warnings
DELETE FROM player_warnings 
WHERE UPPER(player_tag) LIKE '%TEST%';

-- Delete from player_tenure_actions
DELETE FROM player_tenure_actions 
WHERE UPPER(player_tag) LIKE '%TEST%';

-- Delete from player_departure_actions
DELETE FROM player_departure_actions 
WHERE UPPER(player_tag) LIKE '%TEST%';

-- Show final counts
DO $$
DECLARE
  notes_remaining INTEGER;
  warnings_remaining INTEGER;
  tenure_actions_remaining INTEGER;
  departure_actions_remaining INTEGER;
BEGIN
  SELECT COUNT(*) INTO notes_remaining FROM player_notes WHERE UPPER(player_tag) LIKE '%TEST%';
  SELECT COUNT(*) INTO warnings_remaining FROM player_warnings WHERE UPPER(player_tag) LIKE '%TEST%';
  SELECT COUNT(*) INTO tenure_actions_remaining FROM player_tenure_actions WHERE UPPER(player_tag) LIKE '%TEST%';
  SELECT COUNT(*) INTO departure_actions_remaining FROM player_departure_actions WHERE UPPER(player_tag) LIKE '%TEST%';
  
  RAISE NOTICE 'Remaining TEST entries:';
  RAISE NOTICE '  - % notes', notes_remaining;
  RAISE NOTICE '  - % warnings', warnings_remaining;
  RAISE NOTICE '  - % tenure actions', tenure_actions_remaining;
  RAISE NOTICE '  - % departure actions', departure_actions_remaining;
  
  IF notes_remaining = 0 AND warnings_remaining = 0 AND tenure_actions_remaining = 0 AND departure_actions_remaining = 0 THEN
    RAISE NOTICE '✅ All TEST entries deleted successfully!';
  ELSE
    RAISE WARNING '⚠️ Some TEST entries may remain. Check manually.';
  END IF;
END $$;

COMMIT;

