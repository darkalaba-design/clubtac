'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Tabs from './components/Tabs'
import HallOfFame from './components/HallOfFame'
import TeamsRanking from './components/TeamsRanking'
import GamesList from './components/GamesList'
import UserProfile from './components/UserProfile'

function HomePageContent() {
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get('tab') as 'players' | 'teams' | 'games' | 'profile' | null
  const [tab, setTab] = useState<'players' | 'teams' | 'games' | 'profile'>(
    tabFromUrl && ['players', 'teams', 'games', 'profile'].includes(tabFromUrl) 
      ? tabFromUrl 
      : 'profile'
  )

  useEffect(() => {
    if (tabFromUrl && ['players', 'teams', 'games', 'profile'].includes(tabFromUrl)) {
      setTab(tabFromUrl)
    }
  }, [tabFromUrl])

  return (
    <>
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        paddingTop: tab === 'profile' ? '0' : '12px',
        paddingRight: '0',
        paddingBottom: '81px',
        paddingLeft: '0'
      }}>
        {tab === 'profile' && <UserProfile />}
        {tab === 'players' && <HallOfFame />}
        {tab === 'teams' && <TeamsRanking />}
        {tab === 'games' && <GamesList />}
      </main>
      <Tabs active={tab} onChange={setTab} />
    </>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div style={{ padding: '12px', textAlign: 'center' }}>
        <p>Загрузка...</p>
      </div>
    }>
      <HomePageContent />
    </Suspense>
  )
}