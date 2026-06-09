-- Массовые рассылки админов игрокам через Make.com / Telegram.

CREATE TABLE IF NOT EXISTS public.clubtac_broadcasts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by_user_id bigint NOT NULL REFERENCES public.clubtac_users (id),
    message text NOT NULL,
    audience text NOT NULL
        CHECK (audience IN ('all', 'admins', 'vip', 'standard')),
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sending', 'completed', 'partial_error', 'error', 'cancelled')),
    total_recipients int NOT NULL DEFAULT 0,
    sent_count int NOT NULL DEFAULT 0,
    error_count int NOT NULL DEFAULT 0,
    make_triggered_at timestamptz,
    completed_at timestamptz
);

COMMENT ON TABLE public.clubtac_broadcasts IS 'Массовые рассылки сообщений игрокам (root → Make/Telegram).';
COMMENT ON COLUMN public.clubtac_broadcasts.audience IS 'all | admins | vip | standard — фильтр получателей.';

CREATE INDEX IF NOT EXISTS clubtac_broadcasts_created_at_idx
    ON public.clubtac_broadcasts (created_at DESC);

CREATE TABLE IF NOT EXISTS public.clubtac_broadcast_recipients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    broadcast_id uuid NOT NULL REFERENCES public.clubtac_broadcasts (id) ON DELETE CASCADE,
    user_id bigint NOT NULL REFERENCES public.clubtac_users (id),
    telegram_id bigint NOT NULL,
    message_id uuid REFERENCES public.clubtac_messages (id),
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'error')),
    error_text text,
    created_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz,
    UNIQUE (broadcast_id, user_id)
);

COMMENT ON TABLE public.clubtac_broadcast_recipients IS 'Получатели рассылки и статус доставки каждому.';

CREATE INDEX IF NOT EXISTS clubtac_broadcast_recipients_broadcast_id_idx
    ON public.clubtac_broadcast_recipients (broadcast_id);

CREATE INDEX IF NOT EXISTS clubtac_broadcast_recipients_broadcast_status_idx
    ON public.clubtac_broadcast_recipients (broadcast_id, status);
