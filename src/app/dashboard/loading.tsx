export default function DashboardLoading() {
  return (
    <div className="flex-1 p-6 lg:p-8 space-y-6 animate-pulse">
      {/* Hero skeleton */}
      <div className="h-48 rounded-2xl bg-white/5" />

      {/* Quick links skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-white/5" />
        ))}
      </div>

      {/* Main content grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="h-64 rounded-2xl bg-white/5" />
          <div className="h-48 rounded-2xl bg-white/5" />
        </div>
        {/* Right column */}
        <div className="space-y-6">
          <div className="h-40 rounded-2xl bg-white/5" />
          <div className="h-56 rounded-2xl bg-white/5" />
          <div className="h-32 rounded-2xl bg-white/5" />
        </div>
      </div>
    </div>
  )
}
