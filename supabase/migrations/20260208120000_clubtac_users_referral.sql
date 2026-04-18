-- Referral MVP: unique code per user + optional inviter
-- Run in Supabase SQL editor or via supabase db push

ALTER TABLE public.clubtac_users
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by_user_id bigint REFERENCES public.clubtac_users (id);

-- Backfill referral_code for existing rows (deterministic unique: hash of id)
UPDATE public.clubtac_users
SET referral_code = lower(substring(md5(id::text || 'clubtac_ref_salt') from 1 for 10))
WHERE referral_code IS NULL;

ALTER TABLE public.clubtac_users
  ALTER COLUMN referral_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS clubtac_users_referral_code_key
  ON public.clubtac_users (referral_code);

COMMENT ON COLUMN public.clubtac_users.referral_code IS 'Public code for t.me/bot?startapp=<code>';
COMMENT ON COLUMN public.clubtac_users.referred_by_user_id IS 'Inviter user id (set only on first registration)';
