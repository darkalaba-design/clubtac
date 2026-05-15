/**
 * Запись/удаление партий через `/api/admin/games` будет подключена к `clubtac_games` + `clubtac_players`.
 * Пока не реализовано — POST/DELETE отвечают 501.
 */
export function isAppAdminGamesWriteImplemented(): boolean {
    return process.env.CLUBTAC_APP_ADMIN_GAMES_WRITE === '1' || process.env.CLUBTAC_APP_ADMIN_GAMES_WRITE === 'true'
}
