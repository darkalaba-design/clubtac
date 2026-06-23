-- Мультиклубность: Сочи, Серпухов, Москва.
--
-- Фактическая схема prod:
--   clubtac_cities  (id int8, name)
--   clubtac_clubs   (id uuid, name, slug, city_id int8 → cities, is_head bool)
--   clubtac_events.club_id → clubtac_clubs.id (uuid)
--   clubtac_users.club_id / admin_club_id → clubtac_clubs.id (uuid)

-- ─── Города (int8 id) ─────────────────────────────────────────────────────
INSERT INTO public.clubtac_cities (name)
SELECT 'Сочи'
WHERE NOT EXISTS (
    SELECT 1 FROM public.clubtac_cities WHERE lower(trim(name)) IN ('сочи', 'sochi')
);

INSERT INTO public.clubtac_cities (name)
SELECT 'Серпухов'
WHERE NOT EXISTS (
    SELECT 1 FROM public.clubtac_cities WHERE lower(trim(name)) IN ('серпухов', 'serpukhov')
);

INSERT INTO public.clubtac_cities (name)
SELECT 'Москва'
WHERE NOT EXISTS (
    SELECT 1 FROM public.clubtac_cities WHERE lower(trim(name)) IN ('москва', 'moscow')
);

-- ─── Клубы: slug по городу, если ещё не задан ───────────────────────────
UPDATE public.clubtac_clubs cl
SET slug = mapped.slug
FROM public.clubtac_cities ci
CROSS JOIN LATERAL (
    SELECT CASE
        WHEN lower(trim(ci.name)) IN ('сочи', 'sochi') THEN 'sochi'
        WHEN lower(trim(ci.name)) IN ('серпухов', 'serpukhov') THEN 'serpukhov'
        WHEN lower(trim(ci.name)) IN ('москва', 'moscow') THEN 'moscow'
        ELSE NULL
    END AS slug
) mapped
WHERE cl.city_id = ci.id
  AND mapped.slug IS NOT NULL
  AND (cl.slug IS NULL OR trim(cl.slug) = '');

-- Главный клуб на город (is_head), если в городе ещё нет ни одного клуба.
INSERT INTO public.clubtac_clubs (id, name, city_id, slug, is_head)
SELECT
    gen_random_uuid(),
    ci.name,
    ci.id,
    mapped.slug,
    true
FROM public.clubtac_cities ci
CROSS JOIN LATERAL (
    SELECT CASE
        WHEN lower(trim(ci.name)) IN ('сочи', 'sochi') THEN 'sochi'
        WHEN lower(trim(ci.name)) IN ('серпухов', 'serpukhov') THEN 'serpukhov'
        WHEN lower(trim(ci.name)) IN ('москва', 'moscow') THEN 'moscow'
        ELSE NULL
    END AS slug
) mapped
WHERE mapped.slug IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.clubtac_clubs cl WHERE cl.city_id = ci.id
  );

-- Если в городе есть клубы, но нет главного — пометить самый старый в этом городе.
WITH needs_head AS (
    SELECT ci.id AS city_id
    FROM public.clubtac_cities ci
    WHERE lower(trim(ci.name)) IN ('сочи', 'sochi', 'серпухов', 'serpukhov', 'москва', 'moscow')
      AND NOT EXISTS (
          SELECT 1 FROM public.clubtac_clubs c
          WHERE c.city_id = ci.id AND c.is_head IS true
      )
),
pick AS (
    SELECT DISTINCT ON (c.city_id) c.id
    FROM public.clubtac_clubs c
    INNER JOIN needs_head nh ON nh.city_id = c.city_id
    ORDER BY c.city_id, c.created_at ASC NULLS LAST
)
UPDATE public.clubtac_clubs cl
SET is_head = true
FROM pick
WHERE cl.id = pick.id;

-- ─── Пользователи (club_id → uuid клуба) ────────────────────────────────
ALTER TABLE public.clubtac_users
    ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES public.clubtac_clubs (id);

ALTER TABLE public.clubtac_users
    ADD COLUMN IF NOT EXISTS admin_club_id uuid REFERENCES public.clubtac_clubs (id);

UPDATE public.clubtac_users u
SET club_id = pick.id
FROM (
    SELECT c.id
    FROM public.clubtac_clubs c
    INNER JOIN public.clubtac_cities ci ON ci.id = c.city_id
    WHERE lower(trim(ci.name)) IN ('сочи', 'sochi')
    ORDER BY c.is_head DESC NULLS LAST, c.created_at ASC NULLS LAST
    LIMIT 1
) pick
WHERE u.club_id IS NULL
  AND pick.id IS NOT NULL;

CREATE INDEX IF NOT EXISTS clubtac_users_club_id_idx
    ON public.clubtac_users (club_id);

CREATE INDEX IF NOT EXISTS clubtac_users_admin_club_id_idx
    ON public.clubtac_users (admin_club_id)
    WHERE admin_club_id IS NOT NULL;

COMMENT ON COLUMN public.clubtac_users.club_id IS 'Домашний клуб игрока (clubtac_clubs.id uuid).';
COMMENT ON COLUMN public.clubtac_users.admin_club_id IS 'Клуб управления admin; назначает root.';

-- ─── Рейтинг по клубу ────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.clubtac_elo_leaderboard_by_club AS
SELECT
    el.user_id,
    el.nickname,
    el.rating,
    el.games_played,
    el.place AS global_place,
    u.club_id,
    ROW_NUMBER() OVER (
        PARTITION BY u.club_id
        ORDER BY el.rating DESC NULLS LAST, el.user_id ASC
    )::int AS club_place
FROM public.clubtac_elo_leaderboard el
INNER JOIN public.clubtac_users u ON u.id = el.user_id
WHERE el.games_played IS NOT NULL
  AND el.games_played > 0
  AND u.club_id IS NOT NULL;

COMMENT ON VIEW public.clubtac_elo_leaderboard_by_club IS 'Elo leaderboard с местом внутри домашнего клуба игрока.';

-- Публичный picker: один клуб на город (приоритет is_head), без жёсткого slug.
CREATE OR REPLACE VIEW public.clubtac_clubs_public AS
SELECT DISTINCT ON (ci.id)
    cl.id,
    cl.name,
    ci.name AS city,
    cl.slug,
    cl.city_id,
    cl.is_head
FROM public.clubtac_clubs cl
INNER JOIN public.clubtac_cities ci ON ci.id = cl.city_id
WHERE lower(trim(ci.name)) IN ('сочи', 'sochi', 'серпухов', 'serpukhov', 'москва', 'moscow')
ORDER BY
    ci.id,
    cl.is_head DESC NULLS LAST,
    cl.created_at ASC NULLS LAST;
