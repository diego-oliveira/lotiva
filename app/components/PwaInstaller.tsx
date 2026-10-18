'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PwaInstaller() {
  const pathname = usePathname()
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [showIosHelp, setShowIosHelp] = useState(false)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js').catch(() => undefined)

    const standalone = window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
    const dismissedAt = Number(window.localStorage.getItem('lotiva.pwa.dismissedAt'))
    const previouslyDismissed = Number.isFinite(dismissedAt) && Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000
    setDismissed(standalone || previouslyDismissed)
    if (!standalone && /iphone|ipad|ipod/i.test(navigator.userAgent)) setShowIosHelp(true)

    const capturePrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', capturePrompt)
    return () => window.removeEventListener('beforeinstallprompt', capturePrompt)
  }, [])

  if (dismissed || pathname.startsWith('/signin') || pathname.startsWith('/auth') || pathname.startsWith('/p/')) return null
  if (!installPrompt && !showIosHelp) return null

  function dismiss() {
    window.localStorage.setItem('lotiva.pwa.dismissedAt', String(Date.now()))
    setDismissed(true)
  }

  async function install() {
    if (!installPrompt) return
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') dismiss()
    setInstallPrompt(null)
  }

  return (
    <aside className='fixed inset-x-3 bottom-20 z-[70] mx-auto max-w-md rounded-2xl border border-border bg-surface p-4 shadow-2xl lg:bottom-6'>
      <div className='flex items-start gap-3'>
        <img src='/icons/lotiva.svg' alt='' className='h-11 w-11 rounded-xl' />
        <div className='min-w-0 flex-1'>
          <p className='text-sm font-bold text-foreground'>Instale o Lotiva</p>
          <p className='mt-1 text-xs leading-5 text-muted'>
            {installPrompt ? 'Abra pela tela inicial, como um aplicativo.' : 'No Safari, toque em Compartilhar e depois em Adicionar a Tela de Inicio.'}
          </p>
        </div>
        <button type='button' onClick={dismiss} aria-label='Fechar sugestao de instalacao' className='text-xl leading-none text-muted'>×</button>
      </div>
      {installPrompt && <button type='button' onClick={() => void install()} className='mt-3 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white'>Instalar no celular</button>}
    </aside>
  )
}
