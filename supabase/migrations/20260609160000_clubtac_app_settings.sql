-- Глобальные настройки приложения (root).

CREATE TABLE IF NOT EXISTS public.clubtac_app_settings (
    key text PRIMARY KEY,
    value jsonb NOT NULL DEFAULT 'false'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.clubtac_app_settings IS 'Key-value настройки приложения (управляет root).';

INSERT INTO public.clubtac_app_settings (key, value)
VALUES ('broadcasts_for_admins', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;
