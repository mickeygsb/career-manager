'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const nav = [
  { href: '/jobs', label: 'Jobs', icon: '💼' },
  { href: '/employers', label: 'Employers', icon: '🏢' },
  { href: '/contacts', label: 'Contacts', icon: '👥' },
  { href: '/resumes', label: 'Resumes', icon: '📄', iconStyle: { filter: 'sepia(1) saturate(8) hue-rotate(320deg) brightness(0.9)' } },
  { href: '/career-highlights', label: 'Career', icon: '🌟' },
  { href: '/achievements', label: 'Positions', icon: '⭐' },
  { href: '/keywords', label: 'Keywords', icon: '🏷️' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try { setCollapsed(localStorage.getItem('sidebarCollapsed') === 'true') } catch {}
  }, [])

  function toggle() {
    setCollapsed(c => {
      const next = !c
      try { localStorage.setItem('sidebarCollapsed', String(next)) } catch {}
      return next
    })
  }

  return (
    <aside className={`${collapsed ? 'w-12' : 'w-[168px]'} shrink-0 bg-white border-r border-gray-200 flex flex-col transition-[width] duration-200`}>
      <div className={`py-5 border-b border-gray-200 flex items-center ${collapsed ? 'justify-center px-2' : 'px-4'}`}>
        {!collapsed && <h1 className="text-base font-semibold text-gray-900 truncate flex-1">Career Manager</h1>}
        <button
          onClick={toggle}
          className="text-gray-400 hover:text-gray-700 w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 shrink-0"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1">
        {nav.map(({ href, label, icon, iconStyle }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`flex items-center py-2 rounded-lg text-sm font-medium transition-colors ${collapsed ? 'justify-center px-2' : 'gap-3 px-3'} ${
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <span style={iconStyle}>{icon}</span>
              {!collapsed && label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
