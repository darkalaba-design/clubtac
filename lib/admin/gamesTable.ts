/**
 * Таблица, в которую пишутся / из которой удаляются сыгранные партии (не view games_summary).
 * Задайте в .env, если базовая таблица называется иначе, чем `games`.
 */
export function getPlayedGamesBaseTable(): string {
    return process.env.CLUBTAC_PLAYED_GAMES_TABLE?.trim() || 'games'
}
