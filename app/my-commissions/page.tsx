import { notFound } from 'next/navigation'
import { requireAuthenticatedUser } from '@/lib/auth'
import { hasAnyDevelopmentPermission } from '@/lib/permissions'
import MyCommissionsContent from './MyCommissionsContent'

export default async function MyCommissionsPage() {
  const auth = await requireAuthenticatedUser()
  // Keep the broker view available only to finance while it is being reviewed.
  if (auth.response || !(await hasAnyDevelopmentPermission(auth.session.user.id, 'finance'))) {
    notFound()
  }
  return <MyCommissionsContent />
}
