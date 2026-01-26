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
        <div
            style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                display: 'flex',
                gap: 0,
                backgroundColor: '#ffffff',
                borderTop: '1px solid #e0e0e0',
                boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
                zIndex: 1000,
                padding: '8px 0',
            }}
        >
            <button
                onClick={() => onChange('profile')}
                style={{
                    flex: 1,
                    fontWeight: active === 'profile' ? 'bold' : 'normal',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '8px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: active === 'profile' ? '#007bff' : '#666',
                }}
            >
                <div style={{ height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {user && photoUrl ? (
                        <img
                            src={photoUrl}
                            alt="Profile"
                            style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                            }}
                        />
                    ) : (
                        <span style={{ fontSize: '26px' }}>👤</span>
                    )}
                </div>
                <span style={{ fontSize: '10px' }}>Профиль</span>
            </button>

            <button
                onClick={() => onChange('players')}
                style={{
                    flex: 1,
                    fontWeight: active === 'players' ? 'bold' : 'normal',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '8px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: active === 'players' ? '#007bff' : '#666',
                }}
            >
                <div style={{ height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '26px' }}>🏆</span>
                </div>
                <span style={{ fontSize: '10px' }}>Рейтинг</span>
            </button>

            <button
                onClick={() => onChange('teams')}
                style={{
                    flex: 1,
                    fontWeight: active === 'teams' ? 'bold' : 'normal',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '8px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: active === 'teams' ? '#007bff' : '#666',
                }}
            >
                <div style={{ height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '26px' }}>👥</span>
                </div>
                <span style={{ fontSize: '10px' }}>Команды</span>
            </button>

            <button
                onClick={() => onChange('games')}
                style={{
                    flex: 1,
                    fontWeight: active === 'games' ? 'bold' : 'normal',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '8px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: active === 'games' ? '#007bff' : '#666',
                }}
            >
                <div style={{ height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '26px' }}>🎮</span>
                </div>
                <span style={{ fontSize: '10px' }}>Игры</span>
            </button>
        </div>
    )
}
