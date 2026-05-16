export type ParticipantDisplayInput = {
    user_id: number
    first_name?: string | null
    last_name?: string | null
    username?: string | null
    nickname?: string | null
}

export function formatParticipantDisplay(p: ParticipantDisplayInput): string {
    if (p.nickname?.trim()) return p.nickname.trim()
    const namePart = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
    if (namePart) return namePart
    return `Участник #${p.user_id}`
}
