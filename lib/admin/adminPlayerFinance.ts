/** Сумма списаний игрока (положительное число, ₽). Учитываются только amount < 0. */
export function computePlayerTotalSpent(transactions: { amount: unknown }[]): number {
    return transactions.reduce((sum, tx) => {
        const n = Number(tx.amount)
        if (!Number.isFinite(n) || n >= 0) return sum
        return sum + Math.abs(n)
    }, 0)
}

export function formatAdminPlayerMoney(n: number): string {
    if (!Number.isFinite(n)) return '—'
    return `${Math.round(n).toLocaleString('ru-RU')} ₽`
}

export type AdminPlayersSpendFilter = 'all' | 'spent' | 'none'

export function matchesAdminPlayersSpendFilter(
    totalSpent: number | null | undefined,
    filter: AdminPlayersSpendFilter
): boolean {
    const spent = totalSpent ?? 0
    if (filter === 'spent') return spent > 0
    if (filter === 'none') return spent <= 0
    return true
}
