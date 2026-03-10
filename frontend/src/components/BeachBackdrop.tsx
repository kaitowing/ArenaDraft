import type { PropsWithChildren } from 'react'

export function BeachBackdrop({ children }: PropsWithChildren) {
  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 right-[-10%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,_rgba(255,222,148,0.65)_0%,_rgba(255,222,148,0)_70%)] blur-3xl" />
        <div className="absolute top-[20%] left-[-15%] h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,_rgba(255,146,92,0.45)_0%,_rgba(255,146,92,0)_75%)] blur-3xl" />
        <div className="absolute bottom-[-20%] left-1/2 -translate-x-1/2 w-[140%] max-w-none">
          <div className="wave-fade h-32 w-full opacity-60" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'1440\' height=\'120\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 60 Q180 10 360 60 T720 60 T1080 60 T1440 60 V120 H0Z\' fill=\'%23f6e6c7\' fill-opacity=\'0.35\'/%3E%3C/svg%3E")', backgroundRepeat: 'repeat-x', backgroundSize: 'contain' }} />
        </div>
        <div className="absolute top-16 left-[12%] h-16 w-28 rounded-full bg-[var(--card-sand)] opacity-70 blur-xl" />
      </div>
      {children}
    </div>
  )
}
