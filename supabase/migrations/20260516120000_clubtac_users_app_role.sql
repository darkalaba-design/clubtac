-- Уровни доступа в приложении: user (по умолчанию), admin, root.
-- root назначается вручную в SQL (один раз для владельца), например:
--   UPDATE public.clubtac_users SET app_role = 'root' WHERE telegram_id = <ваш_telegram_id>;
-- Администраторов с ролью admin может добавлять и снимать только root через API /api/admin/users/.../role

ALTER TABLE public.clubtac_users
  ADD COLUMN IF NOT EXISTS app_role text NOT NULL DEFAULT 'user';

ALTER TABLE public.clubtac_users DROP CONSTRAINT IF EXISTS clubtac_users_app_role_check;

ALTER TABLE public.clubtac_users
  ADD CONSTRAINT clubtac_users_app_role_check
  CHECK (app_role IN ('user', 'admin', 'root'));

COMMENT ON COLUMN public.clubtac_users.app_role IS 'user — обычный; admin — события и сыгранные партии; root — то же + управление admin';
