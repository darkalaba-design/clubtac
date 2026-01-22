// Типы для пользователя в Supabase
export interface User {
    id?: number
    telegram_id: number
    username?: string | null
    first_name: string
    last_name?: string | null
    created_at?: string
    updated_at?: string
}

export interface TelegramAuthRequest {
    telegram_id: number
    username?: string
    first_name: string
    last_name?: string
}

