// Типы для Telegram Mini App WebApp API
export interface TelegramUser {
    id: number
    first_name: string
    last_name?: string
    username?: string
    language_code?: string
    is_premium?: boolean
    photo_url?: string
}

export interface TelegramWebApp {
    initDataUnsafe: {
        user?: TelegramUser
    }
    ready: () => void
    expand: () => void
}

declare global {
    interface Window {
        Telegram?: {
            WebApp: TelegramWebApp
        }
    }
}

