import type { AppRole } from '@/lib/admin/appRole'

// Типы для пользователя в Supabase
export interface User {
    id?: number
    telegram_id: number
    /** Права в админке; если колонки ещё нет в ответе — считать user. */
    app_role?: AppRole | null
    username?: string | null
    nickname?: string | null
    first_name: string
    last_name?: string | null
    userpic?: string | null
    /** Приватность в списках: в рейтинге/командах показываем «Такофф», на странице игрока без фото и ника */
    takoff?: boolean | null
    /** Публичный код для ссылки t.me/bot?startapp=<code> */
    referral_code?: string | null
    /** id пользователя-пригласителя (clubtac_users.id) */
    referred_by_user_id?: number | null
    /** Статус в клубе: standard | vip | partner */
    status?: string | null
    created_at?: string
    updated_at?: string
}

export interface TelegramAuthRequest {
    telegram_id: number
    username?: string
    first_name: string
    last_name?: string
    photo_url?: string
    /** Из Telegram WebApp initDataUnsafe.start_param (после startapp=) */
    referral_code?: string
}

