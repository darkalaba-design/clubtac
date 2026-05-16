-- Один статус отмены: canceled → cancelled; дальше в приложении используется hidden вместо второго варианта отмены.
UPDATE public.clubtac_events
SET status = 'cancelled'
WHERE status = 'canceled';

-- Если на колонке status есть CHECK, добавьте в него значение hidden и уберите canceled, например:
-- ALTER TABLE public.clubtac_events DROP CONSTRAINT IF EXISTS clubtac_events_status_check;
-- ALTER TABLE public.clubtac_events
--   ADD CONSTRAINT clubtac_events_status_check
--   CHECK (status IN ('scheduled', 'finished', 'cancelled', 'hidden'));
