import { useParams } from 'react-router-dom'

// Read-only view of another member — Phase 5 will fill this out
export default function MemberDashboard() {
  const { uid } = useParams<{ uid: string }>()
  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <h1 className="text-2xl font-bold">Member Dashboard</h1>
      <p className="text-gray-400 mt-2">Read-only view for user {uid}</p>
    </div>
  )
}
