import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/auth'
import { hasAnyDevelopmentPermission } from '@/lib/permissions'
import Distributions from './Distributions'

export default async function DistributionsPage() {
  const session = await getCurrentSession()
  if (!session?.user?.id) redirect('/signin')
  if (!(await hasAnyDevelopmentPermission(session.user.id, 'finance'))) redirect('/')
  return <Distributions />
}
