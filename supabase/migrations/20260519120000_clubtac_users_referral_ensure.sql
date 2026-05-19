-- Реферальный код: только после первого входа в Mini App (когда появляется userpic).
-- Пользователи только из бота могут оставаться без referral_code до открытия приложения.

-- До первого userpic в приложении код может быть NULL (бот не выдаёт рефералку).
ALTER TABLE public.clubtac_users
  ALTER COLUMN referral_code DROP NOT NULL;

-- Кто уже заходил в приложение (есть userpic), но без кода — догенерировать.
UPDATE public.clubtac_users
SET referral_code = lower(substring(md5(id::text || 'clubtac_ref_salt') from 1 for 10))
WHERE (referral_code IS NULL OR btrim(referral_code) = '')
  AND userpic IS NOT NULL
  AND btrim(userpic) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS clubtac_users_referral_code_key
  ON public.clubtac_users (referral_code);
