-- Additive only: existing profile permissions and registration trigger stay intact.
BEGIN;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS study_details jsonb;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_study_details_object' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_study_details_object
      CHECK (study_details IS NULL OR (jsonb_typeof(study_details) = 'object' AND octet_length(study_details::text) <= 4096));
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.populate_study_details()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.study_details IS NULL THEN
    SELECT raw_user_meta_data -> 'study_details' INTO NEW.study_details
    FROM auth.users WHERE id = NEW.user_id
    AND jsonb_typeof(raw_user_meta_data -> 'study_details') = 'object'
    AND octet_length((raw_user_meta_data -> 'study_details')::text) <= 4096;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.populate_study_details() FROM PUBLIC;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'populate_new_profile_studies' AND tgrelid = 'public.profiles'::regclass) THEN
    CREATE TRIGGER populate_new_profile_studies BEFORE INSERT ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.populate_study_details();
  END IF;
END $$;
UPDATE public.profiles p SET study_details = u.raw_user_meta_data -> 'study_details'
FROM auth.users u WHERE p.user_id = u.id AND p.study_details IS NULL
AND jsonb_typeof(u.raw_user_meta_data -> 'study_details') = 'object'
AND octet_length((u.raw_user_meta_data -> 'study_details')::text) <= 4096;
COMMIT;
