'use client'

import { useEffect, useState, useCallback } from 'react'
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
    status: 'scheduled' | 'finished' | 'cancelled' | 'canceled'
    created_at: string
    description?: string | null
}

type GamesTab = 'announcements' | 'past'

export default function GamesList() {
    const { user } = useUser()
    const [activeTab, setActiveTab] = useState<GamesTab>('announcements')
    const [games, setGames] = useState<Game[]>([])
    const [events, setEvents] = useState<Event[]>([])
    const [pastEvents, setPastEvents] = useState<Event[]>([])
    const [playerIdMap, setPlayerIdMap] = useState<Record<string, number>>({})
    const [loading, setLoading] = useState(true)
    const [eventsLoading, setEventsLoading] = useState(true)
    const [pastEventsLoading, setPastEventsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [eventsError, setEventsError] = useState<string | null>(null)
    const [eventRegistrationStatus, setEventRegistrationStatus] = useState<Record<string, {
        loading: boolean
        success: boolean
        error: string | null
        response: any
    }>>({})
    const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
    const [expandedDescriptionIds, setExpandedDescriptionIds] = useState<Set<string>>(new Set())
    const [eventParticipants, setEventParticipants] = useState<Record<string, { payment_status: string }>>({})
    const [eventParticipantsCount, setEventParticipantsCount] = useState<Record<string, number>>({})
    const [clubNames, setClubNames] = useState<Record<string, string>>({})
    const [realtimeNotification, setRealtimeNotification] = useState<{
        show: boolean
        message: string
        data?: any
    } | null>(null)

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
                    .from('clubtac_players_hall_of_fame_ranked_v2')
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
                    .select('id, title, starts_at, club_id, price, address, status, type, duration_minutes, template_id, created_at, description')
                    .order('starts_at', { ascending: true })

                console.log('All events from DB:', allEvents)
                console.log('All events error:', allEventsError)

                if (allEventsError) {
                    console.error('Supabase events error:', allEventsError)
                    setEventsError(allEventsError.message)
                    setEventsLoading(false)
                    return
                }

                // Фильтруем события с датой позже текущей (все статусы, включая cancelled)
                const filteredEvents = (allEvents || []).filter(event => {
                    const eventDate = new Date(event.starts_at)
                    const nowDate = new Date(now)
                    const isFuture = eventDate > nowDate
                    return isFuture
                })

                console.log('Filtered events (future):', filteredEvents)
                setEvents(filteredEvents)

                // Загружаем статусы регистрации пользователя на события и количество участников
                const eventIds = filteredEvents.map(e => e.id)
                if (eventIds.length > 0) {
                    // Загружаем количество участников с оплатой (payment_status = paid) для каждого события
                    const { data: participantsCount, error: countError } = await supabase
                        .from('clubtac_event_participants')
                        .select('event_id, payment_status')
                        .in('event_id', eventIds)
                        .eq('payment_status', 'paid')

                    if (!countError && participantsCount) {
                        const countMap: Record<string, number> = {}
                        participantsCount.forEach((p: any) => {
                            countMap[p.event_id] = (countMap[p.event_id] || 0) + 1
                        })
                        setEventParticipantsCount(countMap)
                        console.log('Loaded event participants count (paid only):', countMap)
                    }

                    // Загружаем статусы регистрации текущего пользователя
                    if (user?.id) {
                        const { data: participants, error: participantsError } = await supabase
                            .from('clubtac_event_participants')
                            .select('event_id, payment_status')
                            .eq('user_id', user.id)
                            .in('event_id', eventIds)

                        if (!participantsError && participants) {
                            const participantsMap: Record<string, { payment_status: string }> = {}
                            participants.forEach((p: any) => {
                                participantsMap[p.event_id] = { payment_status: p.payment_status }
                            })
                            setEventParticipants(participantsMap)
                            console.log('Loaded event participants:', participantsMap)
                        }
                    }
                }

                // Загружаем названия клубов
                const uniqueClubIds = [...new Set(filteredEvents.map(e => e.club_id).filter(Boolean))]
                if (uniqueClubIds.length > 0) {
                    const { data: clubs, error: clubsError } = await supabase
                        .from('clubtac_clubs')
                        .select('id, name')
                        .in('id', uniqueClubIds)

                    if (!clubsError && clubs) {
                        const clubsMap: Record<string, string> = {}
                        clubs.forEach((club: any) => {
                            clubsMap[club.id] = club.name
                        })
                        setClubNames(clubsMap)
                        console.log('Loaded club names:', clubsMap)
                    }
                }
            } catch (err) {
                console.error('Error loading events:', err)
                setEventsError(err instanceof Error ? err.message : 'Unknown error')
            } finally {
                setEventsLoading(false)
            }
        }

        loadEvents()
    }, [user])

    // Функция для обновления количества участников
    const refreshParticipantCounts = useCallback(async () => {
        if (events.length === 0) return

        try {
            const supabase = createClient()
            const eventIds = events.map(e => e.id)

            const { data: participantsCount, error: countError } = await supabase
                .from('clubtac_event_participants')
                .select('event_id, payment_status')
                .in('event_id', eventIds)
                .eq('payment_status', 'paid')

            if (!countError && participantsCount) {
                const countMap: Record<string, number> = {}
                participantsCount.forEach((p: any) => {
                    countMap[p.event_id] = (countMap[p.event_id] || 0) + 1
                })
                setEventParticipantsCount(countMap)
            }
        } catch (err) {
            console.error('Error refreshing participant counts:', err)
        }
    }, [events])

    // Функция для обновления статусов участников
    const refreshParticipantStatuses = useCallback(async () => {
        if (!user?.id || events.length === 0) return

        try {
            const supabase = createClient()
            const eventIds = events.map(e => e.id)

            const { data: participants, error: participantsError } = await supabase
                .from('clubtac_event_participants')
                .select('event_id, payment_status')
                .eq('user_id', user.id)
                .in('event_id', eventIds)

            if (!participantsError && participants) {
                setEventParticipants(prev => {
                    const updated = { ...prev }
                    participants.forEach((p: any) => {
                        updated[p.event_id] = { payment_status: p.payment_status }
                    })
                    return updated
                })
            }

            // Также обновляем количество участников
            refreshParticipantCounts()
        } catch (err) {
            console.error('Error refreshing participant statuses:', err)
        }
    }, [user?.id, events, refreshParticipantCounts])

    // Подписка на изменения статусов участников через Supabase Realtime
    useEffect(() => {
        if (!user?.id || events.length === 0) return

        const supabase = createClient()

        // Создаем уникальное имя канала для каждого пользователя
        const channelName = `event_participants_changes_${user.id}_${Date.now()}`

        console.log('Setting up Realtime subscription for user:', user.id)

        // Подписываемся на изменения в таблице clubtac_event_participants
        // Пробуем два варианта: с фильтром и без (с фильтрацией на клиенте)
        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'clubtac_event_participants',
                },
                (payload) => {
                    console.log('Participant status changed via Realtime (all updates):', payload)

                    // Показываем уведомление о получении данных через Realtime
                    setRealtimeNotification({
                        show: true,
                        message: `Realtime получил обновление!`,
                        data: payload
                    })

                    // Автоматически скрываем уведомление через 5 секунд
                    setTimeout(() => {
                        setRealtimeNotification(null)
                    }, 5000)

                    // Фильтруем на клиенте - проверяем, что это изменение для текущего пользователя
                    const changedUserId = payload.new.user_id
                    if (changedUserId !== user.id) {
                        console.log('Update is for different user, ignoring')
                        return
                    }

                    const eventId = payload.new.event_id as string
                    const paymentStatus = payload.new.payment_status as string

                    console.log('Updating participant status:', { eventId, paymentStatus })

                    // Обновляем статус участника
                    setEventParticipants(prev => ({
                        ...prev,
                        [eventId]: { payment_status: paymentStatus }
                    }))

                    // Обновляем количество участников (перезагружаем для актуальности)
                    refreshParticipantCounts()
                }
            )
            .subscribe((status) => {
                console.log('Realtime subscription status:', status)
                if (status === 'SUBSCRIBED') {
                    console.log('Successfully subscribed to Realtime changes for clubtac_event_participants')
                    // Показываем уведомление о успешной подписке
                    setRealtimeNotification({
                        show: true,
                        message: `Realtime подписка активна! Статус: ${status}`,
                        data: { status }
                    })
                    setTimeout(() => {
                        setRealtimeNotification(null)
                    }, 3000)
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('Realtime channel error - check Supabase Realtime settings')
                    setRealtimeNotification({
                        show: true,
                        message: `Ошибка Realtime: ${status}`,
                        data: { status }
                    })
                    setTimeout(() => {
                        setRealtimeNotification(null)
                    }, 5000)
                } else if (status === 'TIMED_OUT') {
                    console.error('Realtime subscription timed out')
                    setRealtimeNotification({
                        show: true,
                        message: `Realtime таймаут: ${status}`,
                        data: { status }
                    })
                    setTimeout(() => {
                        setRealtimeNotification(null)
                    }, 5000)
                } else if (status === 'CLOSED') {
                    console.log('Realtime channel closed')
                    setRealtimeNotification({
                        show: true,
                        message: `Realtime канал закрыт: ${status}`,
                        data: { status }
                    })
                    setTimeout(() => {
                        setRealtimeNotification(null)
                    }, 3000)
                }
            })

        // Периодическая проверка статусов (каждые 10 секунд) как fallback
        const intervalId = setInterval(() => {
            refreshParticipantStatuses()
        }, 10000)

        // Проверка при возврате на страницу
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                refreshParticipantStatuses()
            }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)

        // Очистка при размонтировании
        return () => {
            console.log('Cleaning up Realtime subscription')
            supabase.removeChannel(channel)
            clearInterval(intervalId)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [user?.id, events, refreshParticipantStatuses, refreshParticipantCounts])

    // Загружаем завершенные события для прошедших игр
    useEffect(() => {
        const loadPastEvents = async () => {
            try {
                const supabase = createClient()
                const now = new Date().toISOString()

                // Загружаем завершенные события
                const { data: finishedEvents, error: eventsError } = await supabase
                    .from('clubtac_events')
                    .select('id, title, starts_at, club_id, price, address, status, type, duration_minutes, template_id, created_at')
                    .eq('status', 'finished')
                    .lt('starts_at', now)
                    .order('starts_at', { ascending: false })

                if (eventsError) {
                    console.error('Supabase past events error:', eventsError)
                    setPastEventsLoading(false)
                    return
                }

                console.log('Loaded past events:', finishedEvents)
                setPastEvents(finishedEvents || [])
            } catch (err) {
                console.error('Error loading past events:', err)
            } finally {
                setPastEventsLoading(false)
            }
        }

        loadPastEvents()
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

    // Функция для поиска события по дате игры
    const findEventByGameDate = (gameDate: string): Event | null => {
        const gameDateObj = new Date(gameDate)
        const gameDateOnly = new Date(gameDateObj.getFullYear(), gameDateObj.getMonth(), gameDateObj.getDate())

        return pastEvents.find(event => {
            const eventDateObj = new Date(event.starts_at)
            const eventDateOnly = new Date(eventDateObj.getFullYear(), eventDateObj.getMonth(), eventDateObj.getDate())
            return eventDateOnly.getTime() === gameDateOnly.getTime()
        }) || null
    }

    // Группировка игр по датам с информацией о событиях
    const gamesByDate = games.reduce((acc, game) => {
        const date = formatDate(game.created_at)
        if (!acc[date]) {
            acc[date] = {
                games: [],
                event: null
            }
        }
        acc[date].games.push(game)
        // Находим событие для этой даты (берем первое найденное)
        if (!acc[date].event) {
            acc[date].event = findEventByGameDate(game.created_at)
        }
        return acc
    }, {} as Record<string, { games: Game[], event: Event | null }>)

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

            // Создаем AbortController для таймаута
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 секунд таймаут

            try {
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
                    signal: controller.signal,
                })

                clearTimeout(timeoutId)

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`)
                }

                // Пытаемся распарсить ответ как JSON
                let responseData
                try {
                    const text = await response.text()
                    if (text) {
                        try {
                            responseData = JSON.parse(text)
                        } catch (jsonError) {
                            // Если не удалось распарсить JSON, считаем текстовый ответ успехом
                            console.warn('Failed to parse JSON, got text:', text)
                            responseData = { message: text || 'Запрос принят' }
                        }
                    } else {
                        // Пустой ответ считаем успехом
                        responseData = { message: 'Запрос принят' }
                    }
                } catch (textError) {
                    // Если не удалось прочитать ответ, считаем это успехом
                    console.warn('Failed to read response:', textError)
                    responseData = { message: 'Запрос принят' }
                }

                // Обновляем статус участника в локальном состоянии
                // Если есть paylink, значит регистрация прошла, но оплата pending
                if (responseData.paylink) {
                    setEventParticipants(prev => ({
                        ...prev,
                        [eventId]: { payment_status: 'pending' }
                    }))

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
                } else {
                    // Если нет paylink, проверяем статус участника в базе данных
                    if (user?.id) {
                        const supabase = createClient()
                        const { data: participant, error: participantError } = await supabase
                            .from('clubtac_event_participants')
                            .select('payment_status')
                            .eq('event_id', eventId)
                            .eq('user_id', user.id)
                            .single()

                        if (participant) {
                            setEventParticipants(prev => ({
                                ...prev,
                                [eventId]: { payment_status: participant.payment_status }
                            }))

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
                        } else {
                            // Если участник не найден, это может быть ошибка - webhook сработал, но ссылка не сгенерировалась
                            // Проверяем, является ли ответ просто "Accepted" или подобным текстом
                            const isSimpleAccept = responseData?.message === 'Accepted' ||
                                responseData?.message === 'Запрос принят' ||
                                (typeof responseData === 'object' && Object.keys(responseData).length === 1 && 'message' in responseData)

                            if (isSimpleAccept) {
                                // Это ошибка - webhook сработал, но регистрация не завершена
                                // Устанавливаем состояние ошибки
                                setEventRegistrationStatus(prev => ({
                                    ...prev,
                                    [eventId]: {
                                        loading: false,
                                        success: false,
                                        error: 'Что-то пошло не так. попробуйте еще раз',
                                        response: null
                                    }
                                }))
                                return // Выходим из функции, не обновляя статус участника
                            } else {
                                // Если это не простой "Accepted", устанавливаем статус 'pending'
                                setEventParticipants(prev => ({
                                    ...prev,
                                    [eventId]: { payment_status: 'pending' }
                                }))

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
                            }
                        }
                    } else {
                        // Если нет user.id, устанавливаем успешное состояние
                        setEventRegistrationStatus(prev => ({
                            ...prev,
                            [eventId]: {
                                loading: false,
                                success: true,
                                error: null,
                                response: responseData
                            }
                        }))
                    }
                }
            } catch (fetchError) {
                clearTimeout(timeoutId)
                throw fetchError
            }
        } catch (err) {
            console.error('Error registering for event:', err)

            // Устанавливаем состояние ошибки с универсальным сообщением
            setEventRegistrationStatus(prev => ({
                ...prev,
                [eventId]: {
                    loading: false,
                    success: false,
                    error: 'Что-то пошло не так. попробуйте еще раз',
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
                            backgroundColor: '#FFF9E6',
                            borderRadius: '8px',
                            padding: '16px',
                            border: '1px solid #FFE950',
                        }}
                    >
                        <p style={{ margin: 0, color: '#1D1D1B' }}>Ошибка: {eventsError}</p>
                    </div>
                </div>
            )
        }

        if (events.length === 0) {
            return (
                <div style={{ padding: '12px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                        <p>Нет предстоящих событий</p>
                        <p style={{ fontSize: '12px', color: '#6B6B69', marginTop: '8px' }}>
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
                            backgroundColor: '#FFFFFF',
                            borderRadius: '8px',
                            padding: '16px',
                            boxShadow: '0 2px 16px rgba(29,29,27,0.06)',
                            border: (event.status === 'cancelled' || event.status === 'canceled') ? '2px solid #B71C1C' : undefined,
                        }}
                    >
                        <div style={{ marginBottom: '12px' }}>
                            <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {formatEventDate(event.starts_at)}
                                {(event.status === 'cancelled' || event.status === 'canceled') && (
                                    <span style={{ fontSize: '11px', color: '#B71C1C', fontWeight: '600' }}>Отменено</span>
                                )}
                            </div>
                            {event.title && (
                                <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
                                    {event.title}
                                </div>
                            )}
                            <div style={{ fontSize: '12px', color: '#6B6B69', marginBottom: '8px' }}>
                                {getEventTypeName(event.type)}
                            </div>
                            {event.address && (
                                <div style={{ fontSize: '14px', color: '#6B6B69', marginBottom: '4px' }}>
                                    📍 {event.address}
                                </div>
                            )}
                            {event.club_id && (
                                <div style={{ fontSize: '14px', color: '#6B6B69', marginBottom: '4px' }}>
                                    🏢 {clubNames[event.club_id] || `Клуб ID: ${event.club_id}`}
                                </div>
                            )}
                            {event.duration_minutes && (
                                <div style={{ fontSize: '14px', color: '#6B6B69', marginBottom: '4px' }}>
                                    ⏱️ Длительность: {event.duration_minutes} мин.
                                </div>
                            )}
                            {event.price !== null && (
                                <div style={{ fontSize: '14px', color: '#6B6B69', marginBottom: '4px' }}>
                                    💰 {event.price === 0 ? 'Бесплатно' : `Цена: ${event.price} ₽`}
                                </div>
                            )}
                            <div style={{ fontSize: '14px', color: '#6B6B69', marginBottom: '8px' }}>
                                👥 Зарегистрировано: {eventParticipantsCount[event.id] || 0} {eventParticipantsCount[event.id] === 1 ? 'участник' : eventParticipantsCount[event.id] && eventParticipantsCount[event.id] < 5 ? 'участника' : 'участников'}
                            </div>
                            {event.description && event.description.trim() !== '' && (
                                <div style={{ marginTop: '8px' }}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setExpandedDescriptionIds(prev => {
                                                const next = new Set(prev)
                                                if (next.has(event.id)) next.delete(event.id)
                                                else next.add(event.id)
                                                return next
                                            })
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            background: 'transparent',
                                            border: '1px solid #EBE8E0',
                                            borderRadius: '6px',
                                            color: '#1D1D1B',
                                            cursor: 'pointer',
                                            fontSize: '14px',
                                            fontWeight: '500',
                                        }}
                                    >
                                        {expandedDescriptionIds.has(event.id) ? 'Свернуть' : 'Подробнее'}
                                    </button>
                                    {expandedDescriptionIds.has(event.id) && (
                                        <div style={{ marginTop: '8px', padding: '12px', backgroundColor: '#FFFEF7', borderRadius: '8px', fontSize: '14px', color: '#6B6B69', whiteSpace: 'pre-wrap' }}>
                                            {event.description}
                                        </div>
                                    )}
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
                                            backgroundColor: '#EBE8E0',
                                            color: '#6B6B69',
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
                                                border: '2px solid #6B6B69',
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
                                // Сначала проверяем статус участника в базе данных (приоритет над ответом webhook)
                                const participant = eventParticipants[event.id]
                                const paymentStatus = participant?.payment_status

                                // Если статус оплачен, показываем "Вы зарегистрированы" независимо от наличия paylink
                                if (paymentStatus === 'paid') {
                                    return (
                                        <div
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                backgroundColor: '#d4edda',
                                                color: '#155724',
                                                border: '1px solid #C8E6C9',
                                                borderRadius: '6px',
                                                fontSize: '14px',
                                                textAlign: 'center',
                                                fontWeight: '500',
                                            }}
                                        >
                                            Вы зарегистрированы
                                        </div>
                                    )
                                }

                                // Проверяем, есть ли в ответе ссылка на оплату
                                const paylink = status.response?.paylink ||
                                    (status.response && typeof status.response === 'object' && 'paylink' in status.response
                                        ? status.response.paylink
                                        : null)

                                // Если есть paylink и статус не paid, показываем кнопку "Оплатить"
                                if (paylink) {
                                    return (
                                        <a
                                            href={paylink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                display: 'block',
                                                width: '100%',
                                                padding: '10px',
                                                backgroundColor: '#1B5E20',
                                                color: '#ffffff',
                                                border: 'none',
                                                borderRadius: '6px',
                                                fontSize: '14px',
                                                fontWeight: '500',
                                                textAlign: 'center',
                                                textDecoration: 'none',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            Оплатить
                                        </a>
                                    )
                                }

                                // Если нет ссылки на оплату, но статус pending, показываем кнопку для генерации ссылки
                                if (paymentStatus === 'pending') {
                                    return (
                                        <button
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                backgroundColor: '#FFDF00',
                                                color: '#1D1D1B',
                                                border: 'none',
                                                borderRadius: '6px',
                                                fontSize: '14px',
                                                fontWeight: '500',
                                                cursor: 'pointer',
                                            }}
                                            onClick={() => handleRegisterForEvent(event.id)}
                                        >
                                            Сгенерировать ссылку на оплату
                                        </button>
                                    )
                                }

                                // Если статуса участника нет, показываем успешное сообщение
                                return (
                                    <div
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            backgroundColor: '#E8F5E9',
                                            color: '#1B5E20',
                                            border: '1px solid #C8E6C9',
                                            borderRadius: '6px',
                                            fontSize: '14px',
                                            textAlign: 'center',
                                        }}
                                    >
                                        Вы успешно записались на событие!
                                    </div>
                                )
                            }

                            if (hasError) {
                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                backgroundColor: '#f8d7da',
                                                color: '#721c24',
                                                border: '1px solid #FFCDD2',
                                                borderRadius: '6px',
                                                fontSize: '14px',
                                                textAlign: 'center',
                                            }}
                                        >
                                            {status.error}
                                        </div>
                                        <button
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                backgroundColor: '#FFDF00',
                                                color: '#1D1D1B',
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
                                    </div>
                                )
                            }

                            // Проверяем статус регистрации пользователя
                            const participant = eventParticipants[event.id]
                            const paymentStatus = participant?.payment_status

                            if (paymentStatus === 'paid') {
                                return (
                                    <div
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            backgroundColor: '#E8F5E9',
                                            color: '#1B5E20',
                                            border: '1px solid #C8E6C9',
                                            borderRadius: '6px',
                                            fontSize: '14px',
                                            textAlign: 'center',
                                            fontWeight: '500',
                                        }}
                                    >
                                        Вы зарегистрированы
                                    </div>
                                )
                            }

                            if (paymentStatus === 'pending') {
                                return (
                                    <button
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            backgroundColor: '#FFE950',
                                            color: '#1D1D1B',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontSize: '14px',
                                            fontWeight: '500',
                                            cursor: 'pointer',
                                        }}
                                        onClick={() => handleRegisterForEvent(event.id)}
                                    >
                                        Сгенерировать ссылку на оплату
                                    </button>
                                )
                            }

                            return (
                                <button
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        backgroundColor: '#FFDF00',
                                        color: '#1D1D1B',
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
                            backgroundColor: '#FFF9E6',
                            borderRadius: '8px',
                            padding: '16px',
                            border: '1px solid #FFE950',
                        }}
                    >
                        <p style={{ margin: 0, color: '#1D1D1B' }}>Ошибка: {error}</p>
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

        const toggleDate = (date: string) => {
            setExpandedDates(prev => {
                const newSet = new Set(prev)
                if (newSet.has(date)) {
                    newSet.delete(date)
                } else {
                    newSet.add(date)
                }
                return newSet
            })
        }

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '0 12px' }}>
                {Object.entries(gamesByDate).map(([date, dateData]) => {
                    const isExpanded = expandedDates.has(date)
                    const event = dateData.event
                    const dateGames = dateData.games
                    return (
                        <div
                            key={date}
                            style={{
                                backgroundColor: '#FFFFFF',
                                borderRadius: '8px',
                                boxShadow: '0 2px 16px rgba(29,29,27,0.06)',
                                overflow: 'hidden',
                            }}
                        >
                            {/* Заголовок карточки (кликабельный) */}
                            <div
                                onClick={() => toggleDate(date)}
                                style={{
                                    padding: '16px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    backgroundColor: isExpanded ? '#FFFEF7' : '#FFFFFF',
                                    transition: 'background-color 0.2s',
                                }}
                            >
                                <div style={{ flex: 1 }}>
                                    {event && event.starts_at ? (
                                        <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>
                                            {formatEventDate(event.starts_at)}
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>
                                            {date}
                                        </div>
                                    )}
                                    {event && event.title && (
                                        <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
                                            {event.title}
                                        </div>
                                    )}
                                    {event && event.type && (
                                        <div style={{ fontSize: '12px', color: '#6B6B69', marginBottom: '8px' }}>
                                            {getEventTypeName(event.type)}
                                        </div>
                                    )}
                                    {event && event.address && (
                                        <div style={{ fontSize: '14px', color: '#6B6B69', marginBottom: '4px' }}>
                                            📍 {event.address}
                                        </div>
                                    )}
                                    {event && event.club_id && (
                                        <div style={{ fontSize: '14px', color: '#6B6B69', marginBottom: '4px' }}>
                                            🏢 Клуб ID: {event.club_id}
                                        </div>
                                    )}
                                    <div style={{ fontSize: '12px', color: '#6B6B69', marginTop: '8px' }}>
                                        Игр: {dateGames.length}
                                    </div>
                                </div>
                                <div
                                    style={{
                                        fontSize: '20px',
                                        color: '#6B6B69',
                                        transition: 'transform 0.3s',
                                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                        marginLeft: '12px',
                                        flexShrink: 0,
                                    }}
                                >
                                    ▼
                                </div>
                            </div>

                            {/* Раскрывающийся контент с играми */}
                            {isExpanded && (
                                <div style={{ borderTop: '1px solid #EBE8E0' }}>
                                    {dateGames.map((game, index) => {
                                        const team1Won = game.score_1 > game.score_2
                                        return (
                                            <div key={game.game_id}>
                                                {index > 0 && (
                                                    <div style={{ height: '1px', backgroundColor: '#EBE8E0' }} />
                                                )}
                                                <div
                                                    style={{
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
                                                                    className="link-player"
                                                                    style={{
                                                                        color: '#1D1D1B',
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
                                                                    className="link-player"
                                                                    style={{
                                                                        color: '#1D1D1B',
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
                                                                color: team1Won ? '#1B5E20' : '#6B6B69',
                                                                backgroundColor: team1Won ? '#E8F5E9' : '#FFFEF7',
                                                                padding: '4px 8px',
                                                                borderRadius: '6px',
                                                                minWidth: '32px',
                                                            }}
                                                        >
                                                            {game.score_1}
                                                        </span>
                                                        <span style={{ color: '#6B6B69', fontSize: '24px' }}>:</span>
                                                        <span
                                                            style={{
                                                                color: !team1Won ? '#1B5E20' : '#6B6B69',
                                                                backgroundColor: !team1Won ? '#E8F5E9' : '#FFFEF7',
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
                                                                    className="link-player"
                                                                    style={{
                                                                        color: '#1D1D1B',
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
                                                                    className="link-player"
                                                                    style={{
                                                                        color: '#1D1D1B',
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
                            )}
                        </div>
                    )
                })}
            </div>
        )
    }

    return (
        <div>
            {/* Уведомление о Realtime обновлениях */}
            {realtimeNotification && realtimeNotification.show && (
                <div
                    style={{
                        position: 'fixed',
                        top: '20px',
                        right: '20px',
                        backgroundColor: '#1B5E20',
                        color: '#ffffff',
                        padding: '16px 20px',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        zIndex: 10000,
                        maxWidth: '400px',
                        animation: 'slideIn 0.3s ease-out',
                    }}
                >
                    <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '16px' }}>
                        🔔 {realtimeNotification.message}
                    </div>
                    {realtimeNotification.data && (
                        <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '8px', wordBreak: 'break-word' }}>
                            <details>
                                <summary style={{ cursor: 'pointer', marginBottom: '4px' }}>Данные</summary>
                                <pre style={{
                                    fontSize: '10px',
                                    backgroundColor: 'rgba(0,0,0,0.2)',
                                    padding: '8px',
                                    borderRadius: '4px',
                                    overflow: 'auto',
                                    maxHeight: '200px'
                                }}>
                                    {JSON.stringify(realtimeNotification.data, null, 2)}
                                </pre>
                            </details>
                        </div>
                    )}
                    <button
                        onClick={() => setRealtimeNotification(null)}
                        style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            background: 'rgba(255,255,255,0.2)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '24px',
                            height: '24px',
                            color: '#ffffff',
                            cursor: 'pointer',
                            fontSize: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        ×
                    </button>
                </div>
            )}

            <h3 style={{ margin: '0 12px 12px', fontSize: '18px', fontWeight: 'bold' }}>
                🎮 Игры
            </h3>

            {/* Табы */}
            <div
                style={{
                    display: 'flex',
                    borderBottom: '2px solid #EBE8E0',
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
                        color: activeTab === 'announcements' ? '#1D1D1B' : '#6B6B69',
                        borderBottom: activeTab === 'announcements' ? '2px solid #FFDF00' : '2px solid transparent',
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
                        color: activeTab === 'past' ? '#1D1D1B' : '#6B6B69',
                        borderBottom: activeTab === 'past' ? '2px solid #FFDF00' : '2px solid transparent',
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
