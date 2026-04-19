/**
 * Склонение существительных после числа (1 игра, 2 игры, 5 игр, 11 игр…).
 * @see https://unicode.org/cldr/charts/supplemental/language_plural_rules.html#ru
 */
function formatWithNoun(n: number, one: string, few: string, many: string): string {
    const k = Math.floor(Math.abs(Number(n)) || 0)
    const abs = k % 100
    const d10 = abs % 10
    if (d10 === 1 && abs !== 11) {
        return `${k} ${one}`
    }
    if (d10 >= 2 && d10 <= 4 && (abs < 10 || abs > 20)) {
        return `${k} ${few}`
    }
    return `${k} ${many}`
}

/** «7 игр», «1 игра», «3 игры» */
export function formatGamesRu(n: number): string {
    return formatWithNoun(n, 'игра', 'игры', 'игр')
}

/** «7 побед», «1 победа», «3 победы» */
export function formatWinsRu(n: number): string {
    return formatWithNoun(n, 'победа', 'победы', 'побед')
}

/** «13115 очков», «1 очко», «3 очка» */
export function formatPointsRu(n: number): string {
    return formatWithNoun(n, 'очко', 'очка', 'очков')
}

/** «7 игр • 7 побед» — для строк под парами в рейтингах */
export function formatGamesWinsLine(games: number, wins: number): string {
    return `${formatGamesRu(games)} • ${formatWinsRu(wins)}`
}

/** «7 побед • 7 игр» — рейтинг команд (сначала победы) */
export function formatWinsGamesLine(wins: number, games: number): string {
    return `${formatWinsRu(wins)} • ${formatGamesRu(games)}`
}
