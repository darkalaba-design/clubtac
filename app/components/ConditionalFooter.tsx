'use client'

import { usePathname } from 'next/navigation'
import Footer from './Footer'

/** На экране админки свой нижний бар — сайтовый футер не показываем. */
export default function ConditionalFooter() {
    const pathname = usePathname()
    if (pathname?.startsWith('/admin')) return null
    return <Footer />
}
