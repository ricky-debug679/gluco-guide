import { NavLink } from "react-router-dom"
import { useTranslation } from "react-i18next"

const items = [
  {
    to: "/",
    labelKey: "nav.home",
    path: "M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z",
  },
  {
    to: "/log-history",
    labelKey: "nav.history",
    path: "M5 4h14M5 10h14M5 16h9",
  },
  {
    to: "/trends",
    labelKey: "nav.trends",
    path: "M4 15l5-6 4 4 7-9",
  },
  {
    to: "/profile",
    labelKey: "nav.profile",
    path: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c1.5-4 5-6 8-6s6.5 2 8 6",
  },
] as const

export function BottomNav() {
  const { t } = useTranslation()
  return (
    <div className="flex shrink-0 gap-1 border-t border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-2 pb-[18px] pt-2.5">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-1 rounded-[10px] py-1.5 text-[0.64rem] font-bold ${
              isActive ? "text-[color:var(--color-sage)]" : "text-[color:var(--color-ink-faint)]"
            }`
          }
        >
          <svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={item.path} />
          </svg>
          {t(item.labelKey)}
        </NavLink>
      ))}
    </div>
  )
}
