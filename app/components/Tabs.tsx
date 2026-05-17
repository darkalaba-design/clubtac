'use client'

import { useUser } from '../contexts/UserContext'
import { useEffect, useState } from 'react'
import GamesTabIcon from './GamesTabIcon'
import RatingTabIcon from './RatingTabIcon'
import TeamsTabIcon from './TeamsTabIcon'
import ProfileTabIcon from './ProfileTabIcon'

type Tab = 'players' | 'teams' | 'games' | 'profile'

function tabButtonStyle(isActive: boolean): React.CSSProperties {
    return {
        flex: 1,
        fontWeight: isActive ? 'bold' : 'normal',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        padding: '8px',
        border: 'none',
        borderRadius: isActive ? '8px' : 0,
        background: isActive ? '#FFDF00' : 'transparent',
        cursor: 'pointer',
        color: isActive ? '#1D1D1B' : '#6B6B69',
    }
}

export default function Tabs({
    active,
    onChange,
}: {
    active: Tab
    onChange: (tab: Tab) => void
}) {
    const { user } = useUser()
    const [photoUrl, setPhotoUrl] = useState<string | null>(null)

    // Получаем фото из базы данных или Telegram
    useEffect(() => {
        // Сначала пробуем получить из user.userpic (из базы данных)
        if (user?.userpic) {
            setPhotoUrl(user.userpic)
        } else if (typeof window !== 'undefined') {
            // Если в базе нет, используем из Telegram WebApp
            const tg = (window as any).Telegram?.WebApp
            const telegramUser = tg?.initDataUnsafe?.user
            if (telegramUser?.photo_url) {
                setPhotoUrl(telegramUser.photo_url)
            }
        }
    }, [user])

    return (
        <div
            style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: '#FFFFFF',
                borderTop: '1px solid #EBE8E0',
                boxShadow: '0 -2px 12px rgba(29,29,27,0.06)',
                zIndex: 1000,
                padding: '8px 0',
            }}
        >
            <div
                style={{
                    maxWidth: 'var(--app-max-width, 850px)',
                    width: '100%',
                    marginLeft: 'auto',
                    marginRight: 'auto',
                    display: 'flex',
                    gap: '4px',
                    minWidth: 0,
                    padding: '0 8px',
                }}
            >
            <button onClick={() => onChange('games')} style={tabButtonStyle(active === 'games')}>
                <div style={{ height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <GamesTabIcon active={active === 'games'} size={24} />
                </div>
                <span style={{ fontSize: '10px' }}>Игры</span>
            </button>

            <button onClick={() => onChange('players')} style={tabButtonStyle(active === 'players')}>
                <div style={{ height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <RatingTabIcon active={active === 'players'} size={24} />
                </div>
                <span style={{ fontSize: '10px' }}>Рейтинг</span>
            </button>

            <button onClick={() => onChange('teams')} style={tabButtonStyle(active === 'teams')}>
                <div style={{ height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TeamsTabIcon active={active === 'teams'} size={24} />
                </div>
                <span style={{ fontSize: '10px' }}>Команды</span>
            </button>

            <button
                onClick={() => onChange('profile')}
                style={{ ...tabButtonStyle(active === 'profile'), position: 'relative', zIndex: 1 }}
            >
                <div style={{ height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    {user && photoUrl ? (
                        <img
                            src={photoUrl}
                            alt="Профиль"
                            style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                pointerEvents: 'none',
                            }}
                        />
                    ) : (
                        <ProfileTabIcon active={active === 'profile'} size={24} />
                    )}
                </div>
                <span style={{ fontSize: '10px', pointerEvents: 'none' }}>Профиль</span>
            </button>
            </div>
        </div>
    )
}
