import type { User } from '@/types/user'

export type TelegramProfileInput = {
    username?: string | null
    first_name: string
    last_name?: string | null
    photo_url?: string | null
}

export function normalizeOptionalString(v: string | undefined | null): string | null {
    if (v == null) return null
    const t = String(v).trim()
    return t || null
}

/** Имя из Telegram: first_name + last_name. */
export function telegramDisplayName(firstName: string, lastName?: string | null): string {
    return [firstName.trim(), normalizeOptionalString(lastName)].filter(Boolean).join(' ')
}

type ExistingProfile = Pick<User, 'username' | 'first_name' | 'last_name' | 'nickname' | 'userpic'>

/**
 * PATCH для clubtac_users, если в Telegram изменились username, имя, ник (синхрон с TG) или userpic (photo_url).
 * nickname обновляем только если он пустой или совпадал с прежним отображаемым именем из TG.
 */
export function buildTelegramProfilePatch(
    existing: ExistingProfile,
    incoming: TelegramProfileInput
): Record<string, string | null> | null {
    const incomingFirst = incoming.first_name.trim()
    const incomingLast = normalizeOptionalString(incoming.last_name)
    const incomingUsername = normalizeOptionalString(incoming.username)
    const incomingDisplay = telegramDisplayName(incomingFirst, incomingLast)

    const patch: Record<string, string | null> = {}

    if ((existing.username ?? null) !== incomingUsername) {
        patch.username = incomingUsername
    }

    const existingFirst = (existing.first_name ?? '').trim()
    if (existingFirst !== incomingFirst) {
        patch.first_name = incomingFirst
    }

    if ((existing.last_name ?? null) !== incomingLast) {
        patch.last_name = incomingLast
    }

    const oldDisplay = telegramDisplayName(existingFirst, existing.last_name)
    const existingNick = existing.nickname?.trim() || null
    const canSyncNickname =
        !existingNick || existingNick === oldDisplay || existingNick === existingFirst

    if (canSyncNickname && existingNick !== incomingDisplay) {
        patch.nickname = incomingDisplay || null
    }

    const incomingPhoto = normalizeOptionalString(incoming.photo_url)
    if (incomingPhoto && (existing.userpic ?? null) !== incomingPhoto) {
        patch.userpic = incomingPhoto
    }

    return Object.keys(patch).length > 0 ? patch : null
}
