// Hjälpfunktioner för att känna av plattform och om appen körs från hemskärmen.

export function isIos(): boolean {
  const ua = navigator.userAgent
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return /iPhone|iPad|iPod/i.test(ua) || iPadOs
}

export function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent)
}

export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
}

const ONBOARDED_KEY = 'tvattstugan.onboarded'

export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === '1'
  } catch {
    return true
  }
}

export function markOnboardingSeen() {
  try {
    localStorage.setItem(ONBOARDED_KEY, '1')
  } catch {
    // ignorera
  }
}
