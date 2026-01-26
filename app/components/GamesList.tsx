'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '../contexts/UserContext'

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
    const { user } = useUser()
    const [activeTab, setActiveTab] = useState<GamesTab>('announcements')
    const [games, setGames] = useState<Game[]>([])
    const [events, setEvents] = useState<Event[]>([])
    const [playerIdMap, setPlayerIdMap] = useState<Record<string, number>>({})
    const [loading, setLoading] = useState(true)
    const [eventsLoading, setEventsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [eventsError, setEventsError] = useState<string | null>(null)
    const [eventRegistrationStatus, setEventRegistrationStatus] = useState<Record<string, {
        loading: boolean
        success: boolean
        error: string | null
        response: any
    }>>({})

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

                console.log('Loading events from clubtac_events, current time:', now)

                // Сначала загрузим все события для отладки
                const { data: allEvents, error: allEventsError } = await supabase
                    .from('clubtac_events')
                    .select('id, title, starts_at, club_id, price, address, status, type, duration_minutes, template_id, created_at')
                    .order('starts_at', { ascending: true })

                console.log('All events from DB:', allEvents)
                console.log('All events error:', allEventsError)

                if (allEventsError) {
                    console.error('Supabase events error:', allEventsError)
                    setEventsError(allEventsError.message)
                    setEventsLoading(false)
                    return
                }

                // Фильтруем события с датой позже текущей и статусом scheduled
                const filteredEvents = (allEvents || []).filter(event => {
                    const eventDate = new Date(event.starts_at)
                    const nowDate = new Date(now)
                    const isFuture = eventDate > nowDate
                    const isScheduled = event.status === 'scheduled'
                    console.log(`Event ${event.title}: date=${event.starts_at}, isFuture=${isFuture}, status=${event.status}, isScheduled=${isScheduled}`)
                    return isScheduled && isFuture
                })

                console.log('Filtered events (scheduled and future):', filteredEvents)
                setEvents(filteredEvents)
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

    // Функция для записи на событие
    const handleRegisterForEvent = async (eventId: string) => {
        if (!user) {
            alert('Необходимо войти в систему')
            return
        }

        // Устанавливаем состояние загрузки
        setEventRegistrationStatus(prev => ({
            ...prev,
            [eventId]: {
                loading: true,
                success: false,
                error: null,
                response: null
            }
        }))

        try {
            const webhookUrl = 'https://hook.eu2.make.com/gt8ewzdg7dmpqr1qst4mnotgwpcqfc0m'
            
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    event_id: eventId,
                    user_id: user.id || null,
                    telegram_id: user.telegram_id || null,
                }),
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            const responseData = await response.json()

            // Устанавливаем успешное состояние с ответом
            setEventRegistrationStatus(prev => ({
                ...prev,
                [eventId]: {
                    loading: false,
                    success: true,
                    error: null,
                    response: responseData
                }
            }))
        } catch (err) {
            console.error('Error registering for event:', err)
            const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка'
            
            // Устанавливаем состояние ошибки
            setEventRegistrationStatus(prev => ({
                ...prev,
                [eventId]: {
                    loading: false,
                    success: false,
                    error: errorMessage,
                    response: null
                }
            }))
        }
    }

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
                <div style={{ padding: '12px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                        <p>Нет предстоящих событий</p>
                        <p style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                            Проверьте консоль браузера для отладочной информации
                        </p>
                    </div>
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
                            {event.title && (
                                <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
                                    {event.title}
                                </div>
                            )}
                            <div style={{ fontSize: '12px', color: '#999', marginBottom: '8px' }}>
                                {getEventTypeName(event.type)}
                            </div>
                            {event.address && (
                                <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
                                    📍 {event.address}
                                </div>
                            )}
                            {event.club_id && (
                                <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
                                    🏢 Клуб ID: {event.club_id}
                                </div>
                            )}
                            {event.duration_minutes && (
                                <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
                                    ⏱️ Длительность: {event.duration_minutes} мин.
                                </div>
                            )}
                            {event.price !== null && (
                                <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                                    💰 {event.price === 0 ? 'Бесплатно' : `Цена: ${event.price} ₽`}
                                </div>
                            )}
                        </div>
                        {(() => {
                            const status = eventRegistrationStatus[event.id]
                            const isLoading = status?.loading
                            const isSuccess = status?.success
                            const hasError = status?.error

                            if (isLoading) {
                                return (
                                    <div
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            backgroundColor: '#e0e0e0',
                                            color: '#666',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontSize: '14px',
                                            fontWeight: '500',
                                            textAlign: 'center',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: '16px',
                                                height: '16px',
                                                border: '2px solid #666',
                                                borderTop: '2px solid transparent',
                                                borderRadius: '50%',
                                                animation: 'spin 1s linear infinite',
                                            }}
                                        />
                                        Отправка...
                                    </div>
                                )
                            }

                            if (isSuccess) {
                                return (
                                    <div
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            backgroundColor: '#d4edda',
                                            color: '#155724',
                                            border: '1px solid #c3e6cb',
                                            borderRadius: '6px',
                                            fontSize: '14px',
                                            textAlign: 'center',
                                        }}
                                    >
                                        {status.response && typeof status.response === 'object' 
                                            ? JSON.stringify(status.response, null, 2)
                                            : status.response || 'Вы успешно записались на событие!'}
                                    </div>
                                )
                            }

                            if (hasError) {
                                return (
                                    <div
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            backgroundColor: '#f8d7da',
                                            color: '#721c24',
                                            border: '1px solid #f5c6cb',
                                            borderRadius: '6px',
                                            fontSize: '14px',
                                            textAlign: 'center',
                                        }}
                                    >
                                        Ошибка: {status.error}
                                    </div>
                                )
                            }

                            return (
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
                                    onClick={() => handleRegisterForEvent(event.id)}
                                >
                                    Записаться
                                </button>
                            )
                        })()}
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
