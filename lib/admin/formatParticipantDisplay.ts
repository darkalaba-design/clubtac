import { TAKOFF_PUBLIC_NAME } from '@/lib/takoff'

export type ParticipantDisplayInput = {
    user_id: number
    first_name?: string | null
    last_name?: string | null
    username?: string | null
    nickname?: string | null
    takoff?: boolean | null
}

export function formatParticipantDisplay(p: ParticipantDisplayInput): string {
    if (p.takoff) return TAKOFF_PUBLIC_NAME
    if (p.nickname?.trim()) return p.nickname.trim()
    const namePart = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
    if (namePart) return namePart
    return `Участник #${p.user_id}`
}

/** Первая буква для плейсхолдера аватара. */
export function participantAvatarInitial(p: ParticipantDisplayInput): string {
    const label = formatParticipantDisplay(p)
    const ch = label.trim().charAt(0)
    return ch ? ch.toUpperCase() : '?'
}
