/** Счёт для профиля: сначала команда игрока, затем соперника. */
export function scoresForPlayerTeam(
    score1: number,
    score2: number,
    isPlayerOnTeam1: boolean
): { playerScore: number; opponentScore: number } {
    return isPlayerOnTeam1
        ? { playerScore: score1, opponentScore: score2 }
        : { playerScore: score2, opponentScore: score1 }
}
