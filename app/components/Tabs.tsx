type Tab = 'players' | 'teams' | 'games' | 'profile'

export default function Tabs({
    active,
    onChange,
}: {
    active: Tab
    onChange: (tab: Tab) => void
}) {
    return (
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <button
                onClick={() => onChange('players')}
                style={{
                    fontWeight: active === 'players' ? 'bold' : 'normal',
                }}
            >
                🏆 Hall of Fame
            </button>

            <button
                onClick={() => onChange('teams')}
                style={{
                    fontWeight: active === 'teams' ? 'bold' : 'normal',
                }}
            >
                👥 Teams
            </button>

            <button
                onClick={() => onChange('games')}
                style={{
                    fontWeight: active === 'games' ? 'bold' : 'normal',
                }}
            >
                🎮 Games
            </button>

            <button
                onClick={() => onChange('profile')}
                style={{
                    fontWeight: active === 'profile' ? 'bold' : 'normal',
                }}
            >
                👤 Profile
            </button>
        </div>
    )
}
