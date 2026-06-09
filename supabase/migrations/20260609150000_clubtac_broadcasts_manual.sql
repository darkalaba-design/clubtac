-- Ручной выбор получателей рассылки.

ALTER TABLE public.clubtac_broadcasts
    DROP CONSTRAINT IF EXISTS clubtac_broadcasts_audience_check;

ALTER TABLE public.clubtac_broadcasts
    ADD CONSTRAINT clubtac_broadcasts_audience_check
    CHECK (audience IN ('all', 'admins', 'vip', 'standard', 'manual'));

ALTER TABLE public.clubtac_broadcasts
    ADD COLUMN IF NOT EXISTS selected_user_ids jsonb;

COMMENT ON COLUMN public.clubtac_broadcasts.selected_user_ids IS 'Массив clubtac_users.id при audience = manual.';
