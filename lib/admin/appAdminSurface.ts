import type { AdminActorRow } from '@/lib/admin/requireActor'
import { canManageEvents } from '@/lib/admin/appRole'
import { isTelegramAllowedForAppAdminSurface } from '@/lib/admin/allowlist'

/** Может ли пользователь видеть UI и вызывать API новой админки (роль + этаповый allowlist). */
export function actorMayUseAppAdminContent(actor: AdminActorRow): boolean {
    return canManageEvents(actor.app_role) && isTelegramAllowedForAppAdminSurface(actor.telegram_id)
}
