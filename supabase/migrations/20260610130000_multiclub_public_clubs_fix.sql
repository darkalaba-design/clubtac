-- Fix: clubtac_clubs_public показывал только клубы с slug + is_head (часто только Серпухов).
-- Пересоздаёт view и добивает is_head / backfill по имени города.

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

INSERT INTO public.clubtac_clubs (id, name, city_id, slug, is_head)
SELECT gen_random_uuid(), ci.name, ci.id, mapped.slug, true
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
  AND NOT EXISTS (SELECT 1 FROM public.clubtac_clubs cl WHERE cl.city_id = ci.id);

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
