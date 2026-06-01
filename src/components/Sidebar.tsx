'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const nav = [
  { href: '/employers', label: 'Employers', icon: '🏢' },
  { href: '/contacts', label: 'Contacts', icon: '👥' },
  { href: '/jobs', label: 'Jobs', icon: '💼' },
  { href: '/resumes', label: 'Resumes', icon: '📄' },
  { href: '/achievements', label: 'Positions', icon: '⭐' },
  { href: '/career-highlights', label: 'Career Highlights', icon: '🌟' },
  { href: '/keywords', label: 'Keywords', icon: '🏷️' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 shrink-0 bg-white border-r border-gray-200 flex flex-col">
      <div className="px-6 py-5 border-b border-gray-200">
        <h1 className="text-lg font-semibold text-gray-900">Career Manager</h1>
        <p className="text-xs text-gray-500 mt-0.5">Your career hub</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <span>{icon}</span>
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
