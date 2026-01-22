'use client'

import { useUser } from '../contexts/UserContext'

/**
 * Компонент для отображения приветствия пользователя
 */
export default function UserGreeting() {
    const { user, loading } = useUser()

    if (loading) {
        return (
            <div style={{ padding: '12px', textAlign: 'center' }}>
                <p>Loading...</p>
            </div>
        )
    }

    if (!user) {
        return null
    }

    const displayName = user.username || user.first_name || 'Пользователь'

    return (
        <div style={{ padding: '12px', marginBottom: '12px', borderBottom: '1px solid #e0e0e0' }}>
            <p style={{ margin: 0, fontSize: '16px', fontWeight: 500 }}>
                Привет, {displayName}!
            </p>
        </div>
    )
}

