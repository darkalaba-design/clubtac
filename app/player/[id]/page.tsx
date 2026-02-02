import PlayerPageClient from './PlayerPageClient'

export default async function PlayerPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    return <PlayerPageClient playerId={id} />
}
