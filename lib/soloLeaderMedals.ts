/** Место в одиночном рейтинге (топ‑3) */
export type SoloLeaderRank = 1 | 2 | 3

export function medalEmojiForSoloRank(rank: SoloLeaderRank | undefined | null): string {
    if (rank === 1) return '🥇 '
    if (rank === 2) return '🥈 '
    if (rank === 3) return '🥉 '
    return ''
}

export function medalPrefixForUserId(
    rankByUserId: Readonly<Record<number, SoloLeaderRank>>,
    userId: number | null | undefined
): string {
    if (userId == null) return ''
    const id = Number(userId)
    if (!Number.isFinite(id) || id <= 0) return ''
    return medalEmojiForSoloRank(rankByUserId[id])
}
