export type ParsedEventGameBody = {
    team1Player1: number
    team1Player2: number
    team2Player1: number
    team2Player2: number
    score1: number
    score2: number
    userIds: [number, number, number, number]
}

export type EventGamePlayerInsert = {
    game_id: number
    user_id: number
    team_number: number
    score: number
}

export type EventGamePlayerSnapshot = {
    user_id: number
    team_number: number
    score: number
}

function parseUserId(body: Record<string, unknown>, key: string): number | null {
    const raw = body[key]
    const n = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isFinite(n) || n < 1) return null
    return Math.floor(n)
}

function parseScore(body: Record<string, unknown>, key: string): number | null {
    const raw = body[key]
    const n = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isFinite(n) || n < 0 || n > 8) return null
    return Math.floor(n)
}

export function parseEventGameBody(
    body: Record<string, unknown>
): { ok: true; data: ParsedEventGameBody } | { ok: false; error: string } {
    const team1Player1 = parseUserId(body, 'team1_player1_id')
    const team1Player2 = parseUserId(body, 'team1_player2_id')
    const team2Player1 = parseUserId(body, 'team2_player1_id')
    const team2Player2 = parseUserId(body, 'team2_player2_id')
    const score1 = parseScore(body, 'team1_score')
    const score2 = parseScore(body, 'team2_score')

    if (!team1Player1 || !team1Player2 || !team2Player1 || !team2Player2) {
        return { ok: false, error: 'Нужны id всех четырёх игроков' }
    }
    if (score1 == null || score2 == null) {
        return { ok: false, error: 'Счёт команд: целое от 0 до 8' }
    }

    const userIds = [team1Player1, team1Player2, team2Player1, team2Player2] as [
        number,
        number,
        number,
        number,
    ]
    if (new Set(userIds).size !== 4) {
        return { ok: false, error: 'Игроки должны быть разными' }
    }

    return {
        ok: true,
        data: {
            team1Player1,
            team1Player2,
            team2Player1,
            team2Player2,
            score1,
            score2,
            userIds,
        },
    }
}

export function buildPlayerInserts(gameId: number, parsed: ParsedEventGameBody): EventGamePlayerInsert[] {
    const { team1Player1, team1Player2, team2Player1, team2Player2, score1, score2 } = parsed
    return [
        { game_id: gameId, user_id: team1Player1, team_number: 1, score: score1 },
        { game_id: gameId, user_id: team1Player2, team_number: 1, score: score1 },
        { game_id: gameId, user_id: team2Player1, team_number: 2, score: score2 },
        { game_id: gameId, user_id: team2Player2, team_number: 2, score: score2 },
    ]
}

export function parseGameIdParam(raw: string): number | null {
    const gameId = Number.parseInt(raw, 10)
    if (!Number.isFinite(gameId) || gameId < 1) return null
    return gameId
}
