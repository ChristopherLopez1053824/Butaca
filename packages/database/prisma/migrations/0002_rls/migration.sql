ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emotion_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meme_history ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.profiles,
                     public.emotion_records,
                     public.recommendations,
                     public.favorites,
                     public.meme_history
FROM anon;

REVOKE ALL ON TABLE public.profiles,
                     public.emotion_records,
                     public.recommendations,
                     public.favorites,
                     public.meme_history
FROM authenticated;

REVOKE ALL ON TABLE public.profiles,
                     public.emotion_records,
                     public.recommendations,
                     public.favorites,
                     public.meme_history
FROM PUBLIC;

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.profiles,
         public.emotion_records,
         public.recommendations,
         public.favorites,
         public.meme_history
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.profiles,
         public.emotion_records,
         public.recommendations,
         public.favorites,
         public.meme_history
TO service_role;

CREATE POLICY profiles_select_own
ON public.profiles
FOR SELECT
TO authenticated
USING (id = (SELECT auth.uid()));

CREATE POLICY profiles_insert_own
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY profiles_update_own
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = (SELECT auth.uid()))
WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY profiles_delete_own
ON public.profiles
FOR DELETE
TO authenticated
USING (id = (SELECT auth.uid()));

CREATE POLICY emotion_records_select_own
ON public.emotion_records
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY emotion_records_insert_own
ON public.emotion_records
FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY emotion_records_update_own
ON public.emotion_records
FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY emotion_records_delete_own
ON public.emotion_records
FOR DELETE
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY recommendations_select_own
ON public.recommendations
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY recommendations_insert_own
ON public.recommendations
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.emotion_records er
    WHERE er.id = recommendations.emotion_record_id
      AND er.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY recommendations_update_own
ON public.recommendations
FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.emotion_records er
    WHERE er.id = recommendations.emotion_record_id
      AND er.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY recommendations_delete_own
ON public.recommendations
FOR DELETE
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY favorites_select_own
ON public.favorites
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY favorites_insert_own
ON public.favorites
FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY favorites_update_own
ON public.favorites
FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY favorites_delete_own
ON public.favorites
FOR DELETE
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY meme_history_select_own
ON public.meme_history
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY meme_history_insert_own
ON public.meme_history
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND (
    meme_history.emotion_record_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.emotion_records er
      WHERE er.id = meme_history.emotion_record_id
        AND er.user_id = (SELECT auth.uid())
    )
  )
);

CREATE POLICY meme_history_update_own
ON public.meme_history
FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND (
    meme_history.emotion_record_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.emotion_records er
      WHERE er.id = meme_history.emotion_record_id
        AND er.user_id = (SELECT auth.uid())
    )
  )
);

CREATE POLICY meme_history_delete_own
ON public.meme_history
FOR DELETE
TO authenticated
USING (user_id = (SELECT auth.uid()));

-- La función es exclusivamente de trigger y no se expone como RPC.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  metadata jsonb;
  display_name text;
  avatar_url text;
BEGIN
  metadata := COALESCE(new.raw_user_meta_data, '{}'::jsonb);

  display_name := LEFT(COALESCE(
    NULLIF(metadata ->> 'display_name', ''),
    NULLIF(metadata ->> 'full_name', ''),
    NULLIF(metadata ->> 'name', '')
  ), 120);

  avatar_url := COALESCE(
    NULLIF(metadata ->> 'avatar_url', ''),
    NULLIF(metadata ->> 'picture', '')
  );

  INSERT INTO public.profiles (
    id,
    display_name,
    avatar_url,
    created_at,
    updated_at
  )
  VALUES (
    new.id,
    display_name,
    avatar_url,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();
