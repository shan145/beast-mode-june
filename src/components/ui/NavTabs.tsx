export interface TabDef<T extends string = string> {
  id: T
  label: string
  icon: React.ReactNode
}

interface Props<T extends string> {
  tabs: TabDef<T>[]
  active: T
  onChange: (id: T) => void
}

export default function NavTabs<T extends string>({ tabs, active, onChange }: Props<T>) {
  return (
    <>
      {/* Desktop: top border tab bar */}
      <div className="hidden md:block border-b border-gray-200 dark:border-gray-800 px-6">
        <div className="flex gap-1 max-w-2xl mx-auto justify-center">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                active === tab.id
                  ? 'border-orange-500 text-orange-500'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile: fixed bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-t border-gray-200 dark:border-gray-800 z-40"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2 transition-colors ${
                active === tab.id ? 'text-orange-500' : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              <div className="w-5 h-5">{tab.icon}</div>
              <span className="text-[10px] font-medium leading-none">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </>
  )
}
