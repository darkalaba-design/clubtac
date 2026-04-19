/** Публичное имя для пользователей с включённой приватностью (поле clubtac_users.takoff). */
export const TAKOFF_PUBLIC_NAME = 'Такофф'

export function displayPublicNickname(
    nickname: string | null | undefined,
    takoff?: boolean | null
): string {
    if (takoff) return TAKOFF_PUBLIC_NAME
    const n = nickname?.trim()
    return n || '—'
}
