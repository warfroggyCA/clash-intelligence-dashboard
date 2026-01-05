-- Ensure cwl_attack_results supports unperformed attack slots
-- Safe to re-run

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.cwl_attack_results') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'cwl_attack_results'
        AND column_name = 'attack_performed'
    ) THEN
      ALTER TABLE public.cwl_attack_results
        ADD COLUMN attack_performed BOOLEAN NOT NULL DEFAULT true;
    END IF;

    BEGIN
      ALTER TABLE public.cwl_attack_results ALTER COLUMN defender_tag DROP NOT NULL;
    EXCEPTION WHEN undefined_column THEN
      -- Column not present in older schemas
    END;

    BEGIN
      ALTER TABLE public.cwl_attack_results ALTER COLUMN stars DROP NOT NULL;
    EXCEPTION WHEN undefined_column THEN
      -- Column not present in older schemas
    END;

    BEGIN
      ALTER TABLE public.cwl_attack_results ALTER COLUMN destruction_pct DROP NOT NULL;
    EXCEPTION WHEN undefined_column THEN
      -- Column not present in older schemas
    END;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'cwl_attack_results_performed_check'
    ) THEN
      ALTER TABLE public.cwl_attack_results
        ADD CONSTRAINT cwl_attack_results_performed_check CHECK (
          (attack_performed AND defender_tag IS NOT NULL AND stars IS NOT NULL)
          OR (NOT attack_performed AND defender_tag IS NULL AND stars IS NULL AND destruction_pct IS NULL)
        );
    END IF;
  END IF;
END $$;

COMMIT;
