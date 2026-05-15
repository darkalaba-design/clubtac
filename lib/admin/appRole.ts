export type AppRole = 'user' | 'admin' | 'root'

export function parseAppRole(value: unknown): AppRole | null {
    if (value === 'user' || value === 'admin' || value === 'root') return value
    return null
}

export function canManageEvents(role: AppRole): boolean {
    return role === 'admin' || role === 'root'
}

export function canManageAdmins(role: AppRole): boolean {
    return role === 'root'
}
