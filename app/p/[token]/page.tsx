import PublicDevelopmentMapPage from './PublicDevelopmentMapPage'

type Props = {
  params: Promise<{ token: string }>
}

export default async function Page({ params }: Props) {
  const { token } = await params
  return <PublicDevelopmentMapPage token={token} />
}
