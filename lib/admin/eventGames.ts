import { formatParticipantDisplay, type ParticipantDisplayInput } from '@/lib/admin/formatParticipantDisplay'

export type EventGameSummaryRow = {
    game_id: number
    created_at: string
    player_1_1: string
    player_1_2: string
    player_2_1: string
    player_2_2: string
    score_1: number
    score_2: number
    player_user_ids: {
        player_1_1: number
        player_1_2: number
        player_2_1: number
        player_2_2: number
    }
}

type PlayerRow = {
    game_id: number | string
    user_id: number
    team_number: number
    score: number | null
}

type UserRow = ParticipantDisplayInput

export function displayNameForUser(u: UserRow): string {
    return formatParticipantDisplay(u)
}

export function buildEventGameSummaries(
    games: { id: number; created_at: string | null }[],
    playerRows: PlayerRow[],
    usersById: Map<number, UserRow>
): EventGameSummaryRow[] {
    const playersByGame = new Map<number, PlayerRow[]>()
    for (const p of playerRows) {
        const gid = Number(p.game_id)
        if (!Number.isFinite(gid)) continue
        const list = playersByGame.get(gid) ?? []
        list.push(p)
        playersByGame.set(gid, list)
    }

    const summaries: EventGameSummaryRow[] = []

    for (const game of games) {
        const gid = Number(game.id)
        const rows = playersByGame.get(gid) ?? []
        const team1 = rows.filter((r) => r.team_number === 1).sort((a, b) => a.user_id - b.user_id)
        const team2 = rows.filter((r) => r.team_number === 2).sort((a, b) => a.user_id - b.user_id)

        if (team1.length < 2 || team2.length < 2) continue

        const u11 = usersById.get(team1[0].user_id)
        const u12 = usersById.get(team1[1].user_id)
        const u21 = usersById.get(team2[0].user_id)
        const u22 = usersById.get(team2[1].user_id)
        if (!u11 || !u12 || !u21 || !u22) continue

        const score1 = Number(team1[0].score ?? team1[1].score ?? 0)
        const score2 = Number(team2[0].score ?? team2[1].score ?? 0)

        summaries.push({
            game_id: gid,
            created_at: game.created_at ?? new Date().toISOString(),
            player_1_1: displayNameForUser(u11),
            player_1_2: displayNameForUser(u12),
            player_2_1: displayNameForUser(u21),
            player_2_2: displayNameForUser(u22),
            score_1: score1,
            score_2: score2,
            player_user_ids: {
                player_1_1: team1[0].user_id,
                player_1_2: team1[1].user_id,
                player_2_1: team2[0].user_id,
                player_2_2: team2[1].user_id,
            },
        })
    }

    return summaries
}
