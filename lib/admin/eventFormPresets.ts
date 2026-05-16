/** Адреса по умолчанию для формы создания события в админке */
export const ADMIN_EVENT_ADDRESS_PRESETS: readonly { label: string; value: string }[] = [
    {
        label: 'Ресторан «Амадин»',
        value: 'Ресторан «Амадин». Курортный просп., 78В',
    },
    {
        label: 'Пиццерия «Сицилия»',
        value: 'Пиццерия «Сицилия», Учительская ул., 6/2',
    },
] as const

export const ADMIN_EVENT_PRICE_PRESETS = [500, 1000] as const
