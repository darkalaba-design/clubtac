/**
 * Склонение существительных после числа (1 игра, 2 игры, 5 игр, 11 игр…).
 * @see https://unicode.org/cldr/charts/supplemental/language_plural_rules.html#ru
 */
export function countRu(n: number): number {
    return Math.floor(Math.abs(Number(n)) || 0)
}

/** Склонение существительного по уже целому неотрицательному числу k */
function pluralRuNoun(k: number, one: string, few: string, many: string): string {
    const abs = k % 100
    const d10 = abs % 10
    if (d10 === 1 && abs !== 11) {
        return one
    }
    if (d10 >= 2 && d10 <= 4 && (abs < 10 || abs > 20)) {
        return few
    }
    return many
}

function formatWithNoun(n: number, one: string, few: string, many: string): string {
    const k = countRu(n)
    return `${k} ${pluralRuNoun(k, one, few, many)}`
}

/** «7 игр», «1 игра», «3 игры» */
export function formatGamesRu(n: number): string {
    return formatWithNoun(n, 'игра', 'игры', 'игр')
}

/** «7 побед», «1 победа», «3 победы» */
export function formatWinsRu(n: number): string {
    return formatWithNoun(n, 'победа', 'победы', 'побед')
}

/** «7 игр • 7 побед» — для строк под парами в рейтингах */
export function formatGamesWinsLine(games: number, wins: number): string {
    return `${formatGamesRu(games)} • ${formatWinsRu(wins)}`
}

/** Только существительное: «игра» / «игры» / «игр» */
export function gamesNounRu(n: number): string {
    return pluralRuNoun(countRu(n), 'игра', 'игры', 'игр')
}

/** Только существительное: «победа» / «победы» / «побед» */
export function winsNounRu(n: number): string {
    return pluralRuNoun(countRu(n), 'победа', 'победы', 'побед')
}
