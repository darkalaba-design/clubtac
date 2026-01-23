'use client'

import { useUser } from '../contexts/UserContext'
import { useEffect, useState } from 'react'

type Tab = 'players' | 'teams' | 'games' | 'profile'

export default function Tabs({
    active,
    onChange,
}: {
    active: Tab
    onChange: (tab: Tab) => void
}) {
    const { user } = useUser()
    const [photoUrl, setPhotoUrl] = useState<string | null>(null)

    // Получаем фото из Telegram
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const tg = (window as any).Telegram?.WebApp
            const telegramUser = tg?.initDataUnsafe?.user
            if (telegramUser?.photo_url) {
                setPhotoUrl(telegramUser.photo_url)
            }
        }
    }, [])

    return (
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <button
                onClick={() => onChange('players')}
                style={{
                    fontWeight: active === 'players' ? 'bold' : 'normal',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '8px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                }}
            >
                <span style={{ fontSize: '20px' }}>🏆</span>
                <span style={{ fontSize: '12px' }}>Рейтинг</span>
            </button>

            <button
                onClick={() => onChange('teams')}
                style={{
                    fontWeight: active === 'teams' ? 'bold' : 'normal',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '8px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                }}
            >
                <span style={{ fontSize: '20px' }}>👥</span>
                <span style={{ fontSize: '12px' }}>Команды</span>
            </button>

            <button
                onClick={() => onChange('games')}
                style={{
                    fontWeight: active === 'games' ? 'bold' : 'normal',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '8px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                }}
            >
                <span style={{ fontSize: '20px' }}>🎮</span>
                <span style={{ fontSize: '12px' }}>Игры</span>
            </button>

            <button
                onClick={() => onChange('profile')}
                style={{
                    fontWeight: active === 'profile' ? 'bold' : 'normal',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '8px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                }}
            >
                {user && photoUrl ? (
                    <img
                        src={photoUrl}
                        alt="Profile"
                        style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                        }}
                    />
                ) : (
                    <span style={{ fontSize: '20px' }}>👤</span>
                )}
                <span style={{ fontSize: '12px' }}>Профиль</span>
            </button>
        </div>
    )
}
