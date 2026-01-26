'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Game {
    game_id: number
    created_at: string
    player_1_1: string
    player_1_2: string
    player_2_1: string
    player_2_2: string
    score_1: number
    score_2: number
}

interface Event {
    id: string
    club_id: string
    template_id: string | null
    type: 'game' | 'workshop' | 'party'
    title: string
    duration_minutes: number | null
    address: string
    starts_at: string
    price: number | null
    status: 'scheduled' | 'finished' | 'cancelled'
    created_at: string
}

type GamesTab = 'announcements' | 'past'

export default function GamesList() {
    const [activeTab, setActiveTab] = useState<GamesTab>('announcements')
    const [games, setGames] = useState<Game[]>([])
    const [events, setEvents] = useState<Event[]>([])
    const [playerIdMap, setPlayerIdMap] = useState<Record<string, number>>({})
    const [loading, setLoading] = useState(true)
    const [eventsLoading, setEventsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [eventsError, setEventsError] = useState<string | null>(null)

    // Загружаем прошедшие игры
    useEffect(() => {
        const load = async () => {
            try {
                const supabase = createClient()

                // Загружаем игры
                const { data: gamesData, error: gamesError } = await supabase
                    .from('games_summary')
                    .select('*')
                    .order('created_at', { ascending: false })

                if (gamesError) {
                    console.error('Supabase error:', gamesError)
                    setError(gamesError.message)
                    setLoading(false)
                    return
                }

                // Загружаем маппинг имен на ID
                const { data: playersData, error: playersError } = await supabase
                    .from('players_hall_of_fame_ranked')
                    .select('user_id, username')

                if (!playersError && playersData) {
                    const idMap: Record<string, number> = {}
                    playersData.forEach((player: any) => {
                        idMap[player.username] = player.user_id
                    })
                    setPlayerIdMap(idMap)
                }

                console.log('Loaded games:', gamesData)
                setGames(gamesData || [])
            } catch (err) {
                console.error('Error loading games:', err)
                setError(err instanceof Error ? err.message : 'Unknown error')
            } finally {
                setLoading(false)
            }
        }

        load()
    }, [])

    // Загружаем анонсы
    useEffect(() => {
        const loadEvents = async () => {
            try {
                const supabase = createClient()
                const now = new Date().toISOString()

                // Загружаем события с датой позже текущей и статусом scheduled
                const { data: eventsData, error: eventsError } = await supabase
                    .from('clubtac_events')
                    .select('*')
                    .eq('status', 'scheduled')
                    .gt('starts_at', now)
                    .order('starts_at', { ascending: true })

                if (eventsError) {
                    console.error('Supabase events error:', eventsError)
                    setEventsError(eventsError.message)
                    setEventsLoading(false)
                    return
                }

                console.log('Loaded events:', eventsData)
                setEvents(eventsData || [])
            } catch (err) {
                console.error('Error loading events:', err)
                setEventsError(err instanceof Error ? err.message : 'Unknown error')
            } finally {
                setEventsLoading(false)
            }
        }

        loadEvents()
    }, [])

    // Форматирование даты для прошедших игр
    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString)
            return date.toLocaleDateString('ru-RU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            })
        } catch {
            return dateString
        }
    }

    // Форматирование даты для анонсов (27 января, ВТ. 16.00)
    const formatEventDate = (dateString: string) => {
        try {
            const date = new Date(dateString)
            const day = date.getDate()
            const month = date.toLocaleDateString('ru-RU', { month: 'long' })
            const weekday = date.toLocaleDateString('ru-RU', { weekday: 'short' }).toUpperCase()
            const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', hour12: false })
            return `${day} ${month}, ${weekday}. ${time}`
        } catch {
            return dateString
        }
    }

    // Получить название типа события
    const getEventTypeName = (type: string) => {
        switch (type) {
            case 'game':
                return 'Игра'
            case 'workshop':
                return 'Мастер-класс'
            case 'party':
                return 'Вечеринка'
            default:
                return type
        }
    }

    // Группировка игр по датам
    const gamesByDate = games.reduce((acc, game) => {
        const date = formatDate(game.created_at)
        if (!acc[date]) {
            acc[date] = []
        }
        acc[date].push(game)
        return acc
    }, {} as Record<string, Game[]>)

    // Рендер анонсов
    const renderAnnouncements = () => {
        if (eventsLoading) {
            return (
                <div style={{ padding: '12px', textAlign: 'center' }}>
                    <p>Загрузка...</p>
                </div>
            )
        }

        if (eventsError) {
            return (
                <div style={{ padding: '12px' }}>
                    <div
                        style={{
                            backgroundColor: '#fff3cd',
                            borderRadius: '8px',
                            padding: '16px',
                            border: '1px solid #ffc107',
                        }}
                    >
                        <p style={{ margin: 0, color: '#856404' }}>Ошибка: {eventsError}</p>
                    </div>
                </div>
            )
        }

        if (events.length === 0) {
            return (
                <div style={{ padding: '12px', textAlign: 'center' }}>
                    <p>Нет предстоящих событий</p>
                </div>
            )
        }

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '0 12px' }}>
                {events.map((event) => (
                    <div
                        key={event.id}
                        style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '8px',
                            padding: '16px',
                            border: '1px solid #e0e0e0',
                        }}
                    >
                        <div style={{ marginBottom: '12px' }}>
                            <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>
                                {formatEventDate(event.starts_at)}
                            </div>
                            {event.address && (
                                <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
                                    {event.address}
                                </div>
                            )}
                            <div style={{ fontSize: '12px', color: '#999', marginBottom: '8px' }}>
                                {getEventTypeName(event.type)}
                            </div>
                            {event.title && (
                                <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
                                    {event.title}
                                </div>
                            )}
                            {event.duration_minutes && (
                                <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
                                    Длительность: {event.duration_minutes} мин.
                                </div>
                            )}
                            {event.price !== null && (
                                <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                                    {event.price === 0 ? 'Бесплатно' : `Цена: ${event.price} ₽`}
                                </div>
                            )}
                        </div>
                        <button
                            style={{
                                width: '100%',
                                padding: '10px',
                                backgroundColor: '#007bff',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontWeight: '500',
                                cursor: 'pointer',
                            }}
                            onClick={() => {
                                // TODO: Реализовать запись на событие
                                alert('Функция записи будет реализована позже')
                            }}
                        >
                            Записаться
                        </button>
                    </div>
                ))}
            </div>
        )
    }

    // Рендер прошедших игр
    const renderPastGames = () => {
        if (loading) {
            return (
                <div style={{ padding: '12px', textAlign: 'center' }}>
                    <p>Загрузка...</p>
                </div>
            )
        }

        if (error) {
            return (
                <div style={{ padding: '12px' }}>
                    <div
                        style={{
                            backgroundColor: '#fff3cd',
                            borderRadius: '8px',
                            padding: '16px',
                            border: '1px solid #ffc107',
                        }}
                    >
                        <p style={{ margin: 0, color: '#856404' }}>Ошибка: {error}</p>
                    </div>
                </div>
            )
        }

        if (games.length === 0) {
            return (
                <div style={{ padding: '12px', textAlign: 'center' }}>
                    <p>Нет данных</p>
                </div>
            )
        }

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {Object.entries(gamesByDate).map(([date, dateGames]) => (
                    <div key={date}>
                        <h4
                            style={{
                                margin: '0 12px 12px',
                                fontSize: '16px',
                                fontWeight: 'bold',
                                color: '#666',
                            }}
                        >
                            {date}
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {dateGames.map((game, index) => {
                                const team1Won = game.score_1 > game.score_2
                                return (
                                    <div key={game.game_id}>
                                        {index > 0 && (
                                            <div style={{ height: '2px', backgroundColor: '#e0e0e0' }} />
                                        )}
                                        <div
                                            style={{
                                                backgroundColor: '#ffffff',
                                                padding: '10px 12px',
                                                display: 'grid',
                                                gridTemplateColumns: '1fr auto 1fr',
                                                alignItems: 'center',
                                                gap: '12px',
                                            }}
                                        >
                                            {/* Левая команда */}
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ marginBottom: '4px', lineHeight: '14px' }}>
                                                    {playerIdMap[game.player_1_1] ? (
                                                        <Link
                                                            href={`/player/${playerIdMap[game.player_1_1]}`}
                                                            style={{
                                                                color: '#007bff',
                                                                textDecoration: 'none',
                                                                fontWeight: '500',
                                                                fontSize: '14px',
                                                                verticalAlign: 'top',
                                                                lineHeight: '14px',
                                                            }}
                                                        >
                                                            {game.player_1_1}
                                                        </Link>
                                                    ) : (
                                                        <span style={{ fontWeight: '500', fontSize: '14px', lineHeight: '14px' }}>{game.player_1_1}</span>
                                                    )}
                                                </div>
                                                <div style={{ lineHeight: '14px', verticalAlign: 'bottom' }}>
                                                    {playerIdMap[game.player_1_2] ? (
                                                        <Link
                                                            href={`/player/${playerIdMap[game.player_1_2]}`}
                                                            style={{
                                                                color: '#007bff',
                                                                textDecoration: 'none',
                                                                fontWeight: '500',
                                                                fontSize: '14px',
                                                                verticalAlign: 'top',
                                                                lineHeight: '14px',
                                                            }}
                                                        >
                                                            {game.player_1_2}
                                                        </Link>
                                                    ) : (
                                                        <span style={{ fontWeight: '500', fontSize: '14px', lineHeight: '14px' }}>{game.player_1_2}</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Счет по центру */}
                                            <div
                                                style={{
                                                    textAlign: 'center',
                                                    fontSize: '32px',
                                                    fontWeight: 'bold',
                                                    lineHeight: '1',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '2px',
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        color: team1Won ? '#28a745' : '#666',
                                                        backgroundColor: team1Won ? '#e8f5e9' : '#f5f5f5',
                                                        padding: '4px 8px',
                                                        borderRadius: '6px',
                                                        minWidth: '32px',
                                                    }}
                                                >
                                                    {game.score_1}
                                                </span>
                                                <span style={{ color: '#999', fontSize: '24px' }}>:</span>
                                                <span
                                                    style={{
                                                        color: !team1Won ? '#28a745' : '#666',
                                                        backgroundColor: !team1Won ? '#e8f5e9' : '#f5f5f5',
                                                        padding: '4px 8px',
                                                        borderRadius: '6px',
                                                        minWidth: '32px',
                                                    }}
                                                >
                                                    {game.score_2}
                                                </span>
                                            </div>

                                            {/* Правая команда */}
                                            <div style={{ textAlign: 'left' }}>
                                                <div style={{ marginBottom: '4px', lineHeight: '14px' }}>
                                                    {playerIdMap[game.player_2_1] ? (
                                                        <Link
                                                            href={`/player/${playerIdMap[game.player_2_1]}`}
                                                            style={{
                                                                color: '#007bff',
                                                                textDecoration: 'none',
                                                                fontWeight: '500',
                                                                fontSize: '14px',
                                                                verticalAlign: 'top',
                                                                lineHeight: '14px',
                                                            }}
                                                        >
                                                            {game.player_2_1}
                                                        </Link>
                                                    ) : (
                                                        <span style={{ fontWeight: '500', fontSize: '14px', lineHeight: '14px' }}>{game.player_2_1}</span>
                                                    )}
                                                </div>
                                                <div style={{ lineHeight: '14px', verticalAlign: 'bottom' }}>
                                                    {playerIdMap[game.player_2_2] ? (
                                                        <Link
                                                            href={`/player/${playerIdMap[game.player_2_2]}`}
                                                            style={{
                                                                color: '#007bff',
                                                                textDecoration: 'none',
                                                                fontWeight: '500',
                                                                fontSize: '14px',
                                                                verticalAlign: 'top',
                                                                lineHeight: '14px',
                                                            }}
                                                        >
                                                            {game.player_2_2}
                                                        </Link>
                                                    ) : (
                                                        <span style={{ fontWeight: '500', fontSize: '14px', lineHeight: '14px' }}>{game.player_2_2}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div>
            <h3 style={{ margin: '0 12px 12px', fontSize: '18px', fontWeight: 'bold' }}>
                🎮 Игры
            </h3>

            {/* Табы */}
            <div
                style={{
                    display: 'flex',
                    borderBottom: '2px solid #e0e0e0',
                    margin: '0 12px',
                    marginBottom: '16px',
                }}
            >
                <button
                    onClick={() => setActiveTab('announcements')}
                    style={{
                        flex: 1,
                        padding: '12px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: activeTab === 'announcements' ? 'bold' : 'normal',
                        color: activeTab === 'announcements' ? '#007bff' : '#666',
                        borderBottom: activeTab === 'announcements' ? '2px solid #007bff' : '2px solid transparent',
                        marginBottom: '-2px',
                    }}
                >
                    Анонсы
                </button>
                <button
                    onClick={() => setActiveTab('past')}
                    style={{
                        flex: 1,
                        padding: '12px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: activeTab === 'past' ? 'bold' : 'normal',
                        color: activeTab === 'past' ? '#007bff' : '#666',
                        borderBottom: activeTab === 'past' ? '2px solid #007bff' : '2px solid transparent',
                        marginBottom: '-2px',
                    }}
                >
                    Прошедшие игры
                </button>
            </div>

            {/* Контент табов */}
            {activeTab === 'announcements' && renderAnnouncements()}
            {activeTab === 'past' && renderPastGames()}
        </div>
    )
}
