-- Режим приватности в списках: без фото и ника на странице игрока, в рейтинге/командах — «Такофф»
ALTER TABLE public.clubtac_users
  ADD COLUMN IF NOT EXISTS takoff boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clubtac_users.takoff IS 'При true: публично «Такофф», без фото на странице игрока; в рейтинге и командах подмена ника';
