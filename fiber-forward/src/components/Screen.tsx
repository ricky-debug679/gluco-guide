import type { ReactNode } from "react"
import { BottomNav } from "./BottomNav"
import { VoiceCommandButton } from "./VoiceCommandButton"

interface ScreenProps {
  children: ReactNode
  withNav?: boolean
}

export function Screen({ children, withNav = true }: ScreenProps) {
  return (
    <div className="flex h-screen w-full justify-center bg-[color:var(--color-bg)]">
      <div className="relative flex h-screen w-full max-w-md flex-col">
        <div className={`flex flex-1 flex-col gap-4 overflow-y-auto px-5 pt-6 ${withNav ? "pb-24" : "pb-8"}`}>
          {children}
        </div>
        {withNav && <VoiceCommandButton />}
        {withNav && <BottomNav />}
      </div>
    </div>
  )
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4 shadow-[0_1px_2px_rgba(43,38,32,0.06),0_10px_24px_-14px_rgba(43,38,32,0.28)] ${className}`}
    >
      {children}
    </div>
  )
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[color:var(--color-ink-faint)]">
      {children}
    </div>
  )
}
