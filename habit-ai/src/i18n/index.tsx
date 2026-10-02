import { createContext, useContext, useEffect, type ReactNode } from 'react'
import en from './en.json'
import he from './he.json'
import { useStore, update } from '../store'

export type Lang = 'en' | 'he'
const dict: Record<Lang, Record<string, string>> = { en, he }

type Ctx = { t: (k: string, v?: Record<string, string | number>) => string; lang: Lang }
const I18n = createContext<Ctx>({ t: k => k, lang: 'en' })

export function I18nProvider({ children }: { children: ReactNode }) {
  const lang = useStore(s => s.lang)
  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr'
  }, [lang])
  const t: Ctx['t'] = (k, v) =>
    (dict[lang][k] ?? dict.en[k] ?? k).replace(/\{(\w+)\}/g, (_, n) => String(v?.[n] ?? ''))
  return <I18n.Provider value={{ t, lang }}>{children}</I18n.Provider>
}
export const useT = () => useContext(I18n)
export const setLang = (lang: Lang) => update(s => ({ ...s, lang }))
