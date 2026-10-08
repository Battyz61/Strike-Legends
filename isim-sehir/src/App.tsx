import { useMemo, useState } from "react"
import { ArrowRight, Gamepad2, Globe2, Sparkles, Users, Zap } from "lucide-react"
import { Vortex } from "@/components/ui/vortex"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

const avatars = ["Nova", "Pulse", "Vega", "Orbit", "Flux", "Echo", "Lumen", "Astra"]
const categories = ["İsim","Hayvan","Şehir","Eşya","Bitki","Ülke","Ünlü","Meslek","Dizi/Film","Sanatçı","Futbolcu","Yemek malzemesi","3 harfli kelime","8 harfli kelime","Şarkı","Erkek ismi","Renk","Yabancı isim","Makyaj malzemesi","Yiyecek","Tatlı"]
const letters = "ABCÇDEFGĞHİIJKLMNOÖPRSŞTUÜVYZ".split("")

function goToGame(mode: "create" | "join", name: string, code?: string, avatarIndex = 0, settings?: {duration:string;wheel:string;playerLimit:string;roundLimit:string;categories:string;letters:string}) {
  const params = new URLSearchParams({ mode, name: name.trim() || "Oyuncu", avatar: String(avatarIndex) })
  if (mode === "join" && code) params.set("code", code.replace(/\s/g, ""))
  if (mode === "create" && settings) Object.entries(settings).forEach(([key,value]) => params.set(key,value))
  window.location.href = new URL(`legacy.html?${params.toString()}`, window.location.href).href
}

export default function App() {
  const [hostName, setHostName] = useState("")
  const [guestName, setGuestName] = useState("")
  const [joinCode, setJoinCode] = useState("")
  const [avatar, setAvatar] = useState(0)
  const [error, setError] = useState("")
  const [duration, setDuration] = useState("120")
  const [wheel, setWheel] = useState("on")
  const [playerLimit, setPlayerLimit] = useState("4")
  const [roundLimit, setRoundLimit] = useState("5")
  const [selectedCategories, setSelectedCategories] = useState(["İsim","Hayvan","Şehir","Eşya","Bitki","Ülke"])
  const [selectedLetters, setSelectedLetters] = useState([...letters])

  const recentName = useMemo(() => {
    try { return localStorage.getItem("isimSehirName") || "" } catch { return "" }
  }, [])

  const chooseName = (setter: (value: string) => void) => {
    if (recentName) setter(recentName)
  }

  const create = () => {
    setError("")
    goToGame("create", hostName, undefined, avatar, {duration,wheel,playerLimit,roundLimit,categories:selectedCategories.join(","),letters:selectedLetters.join("")})
  }

  const join = () => {
    const code = joinCode.trim()
    if (!/^\d{6}$/.test(code)) {
      setError("6 haneli oda kodunu gir kral.")
      return
    }
    goToGame("join", guestName, code, avatar)
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#03040b] text-white selection:bg-violet-500/30">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(139,92,246,.20),transparent_36%),radial-gradient(circle_at_100%_60%,rgba(34,211,238,.08),transparent_32%)]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />
      <Vortex
        particleCount={280}
        rangeY={520}
        baseHue={245}
        rangeSpeed={1.1}
        backgroundColor="#03040b"
        containerClassName="fixed inset-0 opacity-55"
      />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(124,92,255,.16),transparent_42%)]" />

      <div className="relative z-10 mx-auto min-h-screen max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <header className="mb-10 flex items-center justify-between rounded-2xl border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-2xl md:px-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl border border-violet-400/30 bg-violet-500/10 shadow-[0_0_30px_rgba(124,92,255,.16)]">
              <Zap className="size-5 text-violet-300" />
            </div>
            <div>
              <div className="text-[11px] font-black tracking-[.28em] text-violet-200">İSİM ŞEHİR</div>
              <div className="text-xs text-white/40">Arkadaşlarla oyna</div>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-xs text-white/40 sm:flex">
            <Globe2 className="size-4 text-cyan-300/70" />
            Türkçe · Çok oyunculu
          </div>
        </header>

        <section className="mx-auto mb-10 max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-300/[.06] px-3 py-1.5 text-[10px] font-black tracking-[.16em] text-violet-200">
            <Sparkles className="size-3.5" /> ARKADAŞLARLA OYNA
          </div>
          <h1 className="text-6xl font-black tracking-[-.06em] md:text-8xl">
            İsim <span className="bg-gradient-to-r from-white via-violet-200 to-cyan-300 bg-clip-text text-transparent">Şehir</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/45 md:text-base">
            Harfini seç, cevaplarını doldur, arkadaşlarının cevaplarını değerlendir ve en yüksek puanı topla.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Card className="rounded-[26px] border border-violet-300/10 bg-[#090b15]/85 p-5 shadow-[0_25px_80px_rgba(0,0,0,.45)] backdrop-blur-xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <div className="mb-3 grid size-12 place-items-center rounded-2xl border border-violet-400/20 bg-violet-500/10">
                  <Gamepad2 className="size-6 text-violet-300" />
                </div>
                <h2 className="text-xl font-black">Oda Kur</h2>
                <p className="mt-1 text-xs leading-5 text-white/40">Host ol, ayarları belirle ve arkadaşlarını davet et.</p>
              </div>
              {recentName && (
                <button onClick={() => chooseName(setHostName)} className="text-[10px] text-violet-300 hover:text-white">
                  Son ad: {recentName}
                </button>
              )}
            </div>

            <input
              value={hostName}
              onChange={e => setHostName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && create()}
              maxLength={18}
              placeholder="Oyuncu adın"
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm outline-none transition focus:border-violet-400/60 focus:ring-4 focus:ring-violet-500/10"
            />

            <div className="mt-4 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/35">Avatarını seç</span>
              <span className="text-[10px] text-violet-300">{avatars[avatar]}</span>
            </div>
            <div className="mt-2 grid grid-cols-8 gap-1.5">
              {avatars.map((name, i) => (
                <button key={name} onClick={() => setAvatar(i)} aria-label={name}
                  className={`aspect-square rounded-xl border p-1 text-[10px] font-bold transition ${avatar === i ? "border-violet-300 bg-violet-500/20 shadow-[0_0_18px_rgba(124,92,255,.25)]" : "border-white/8 bg-white/[.025] hover:border-white/20"}`}>
                  <span className="grid size-full place-items-center rounded-lg bg-gradient-to-br from-violet-500/50 to-cyan-400/30">{name[0]}</span>
                </button>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              {[
                ["Tur süresi", duration, setDuration, [["60","60 sn"],["90","90 sn"],["120","120 sn"],["180","180 sn"]]],
                ["Çark", wheel, setWheel, [["on","Açık"],["off","Kapalı"]]],
                ["Oyuncu", playerLimit, setPlayerLimit, [["2","2"],["4","4"],["6","6"],["8","8"],["10","10"]]],
                ["Tur sayısı", roundLimit, setRoundLimit, [["3","3"],["5","5"],["10","10"]]],
              ].map(([label,value,setter,options]) => (
                <label key={label as string} className="rounded-2xl border border-white/8 bg-white/[.025] p-3">
                  <span className="block text-[9px] font-black uppercase tracking-[.16em] text-white/35">{label as string}</span>
                  <select value={value as string} onChange={e => (setter as (v:string)=>void)(e.target.value)}
                    className="mt-2 h-9 w-full rounded-xl border border-white/10 bg-black/30 px-2 text-xs text-white outline-none focus:border-violet-400/60">
                    {(options as string[][]).map(([v,t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                </label>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-white/8 bg-white/[.025] p-3">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-[.16em] text-white/35">Kategoriler</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedCategories([...categories].sort(() => Math.random()-.5).slice(0,6))} className="h-7 rounded-full px-2.5 text-[10px] text-violet-300 hover:bg-violet-500/10 hover:text-violet-200">Karıştır</Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {categories.map(cat => <button type="button" key={cat} onClick={() => setSelectedCategories(x => x.includes(cat) ? (x.length===1 ? x : x.filter(v=>v!==cat)) : [...x,cat])} className={`rounded-full border px-2.5 py-1 text-[10px] transition ${selectedCategories.includes(cat) ? "border-violet-300/60 bg-violet-500/20 text-violet-100" : "border-white/10 bg-black/20 text-white/35"}`}>{cat}</button>)}
              </div>
              <div className="mt-4 flex items-center justify-between"><span className="text-[9px] font-black uppercase tracking-[.16em] text-white/35">Harf havuzu · {selectedLetters.length}</span><Button type="button" variant="ghost" size="sm" onClick={() => setSelectedLetters([...letters])} className="h-7 rounded-full px-2.5 text-[10px] text-cyan-300 hover:bg-cyan-400/10 hover:text-cyan-200">Tümü</Button></div>
              <div className="mt-2 grid grid-cols-10 gap-1">
                {letters.map(letter => <button type="button" key={letter} onClick={() => setSelectedLetters(x => x.includes(letter) ? (x.length===1 ? x : x.filter(v=>v!==letter)) : [...x,letter])} className={`aspect-square rounded-lg border text-[10px] font-black ${selectedLetters.includes(letter) ? "border-cyan-300/50 bg-cyan-400/10 text-cyan-100" : "border-white/8 bg-black/20 text-white/20"}`}>{letter}</button>)}
              </div>
            </div>

            <Button onClick={create} className="mt-5 h-12 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-500 font-black shadow-[0_12px_35px_rgba(124,92,255,.22)] hover:from-violet-500 hover:to-fuchsia-400">
              Oda Oluştur <ArrowRight className="ml-1 size-4" />
            </Button>
          </Card>

          <Card className="rounded-[26px] border border-cyan-300/10 bg-[#090b15]/85 p-5 shadow-[0_25px_80px_rgba(0,0,0,.45)] backdrop-blur-xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <div className="mb-3 grid size-12 place-items-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10">
                  <Users className="size-6 text-cyan-300" />
                </div>
                <h2 className="text-xl font-black">Odaya Katıl</h2>
                <p className="mt-1 text-xs leading-5 text-white/40">Arkadaşından aldığın 6 haneli kodla yarışa gir.</p>
              </div>
              {recentName && (
                <button onClick={() => chooseName(setGuestName)} className="text-[10px] text-cyan-300 hover:text-white">
                  Son ad: {recentName}
                </button>
              )}
            </div>

            <input value={guestName} onChange={e => setGuestName(e.target.value)} maxLength={18} placeholder="Oyuncu adın"
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm outline-none transition focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-500/10" />
            <input value={joinCode} onChange={e => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={e => e.key === "Enter" && join()} inputMode="numeric" placeholder="6 haneli oda kodu"
              className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm tracking-[.25em] outline-none transition focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-500/10" />

            {error && <div className="mt-3 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</div>}

            <Button onClick={join} variant="secondary" className="mt-5 h-12 w-full rounded-2xl border border-cyan-300/15 bg-cyan-500/10 font-black text-cyan-100 hover:bg-cyan-500/15">
              Odaya Katıl <ArrowRight className="ml-1 size-4" />
            </Button>
          </div>          </Card>
, useState } from "react"
import { ArrowRight, Gamepad2, Globe2, Sparkles, Users, Zap } from "lucide-react"
import { Vortex } from "@/components/ui/vortex"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

const avatars = ["Nova", "Pulse", "Vega", "Orbit", "Flux", "Echo", "Lumen", "Astra"]
const categories = ["İsim","Hayvan","Şehir","Eşya","Bitki","Ülke","Ünlü","Meslek","Dizi/Film","Sanatçı","Futbolcu","Yemek malzemesi","3 harfli kelime","8 harfli kelime","Şarkı","Erkek ismi","Renk","Yabancı isim","Makyaj malzemesi","Yiyecek","Tatlı"]
const letters = "ABCÇDEFGĞHİIJKLMNOÖPRSŞTUÜVYZ".split("")

function goToGame(mode: "create" | "join", name: string, code?: string, avatarIndex = 0, settings?: {duration:string;wheel:string;playerLimit:string;roundLimit:string;categories:string;letters:string}) {
  const params = new URLSearchParams({ mode, name: name.trim() || "Oyuncu", avatar: String(avatarIndex) })
  if (mode === "join" && code) params.set("code", code.replace(/\s/g, ""))
  if (mode === "create" && settings) Object.entries(settings).forEach(([key,value]) => params.set(key,value))
  window.location.href = new URL(`legacy.html?${params.toString()}`, window.location.href).href
}

export default function App() {
  const [hostName, setHostName] = useState("")
  const [guestName, setGuestName] = useState("")
  const [joinCode, setJoinCode] = useState("")
  const [avatar, setAvatar] = useState(0)
  const [error, setError] = useState("")
  const [duration, setDuration] = useState("120")
  const [wheel, setWheel] = useState("on")
  const [playerLimit, setPlayerLimit] = useState("4")
  const [roundLimit, setRoundLimit] = useState("5")
  const [selectedCategories, setSelectedCategories] = useState(["İsim","Hayvan","Şehir","Eşya","Bitki","Ülke"])
  const [selectedLetters, setSelectedLetters] = useState([...letters])

  const recentName = useMemo(() => {
    try { return localStorage.getItem("isimSehirName") || "" } catch { return "" }
  }, [])

  const chooseName = (setter: (value: string) => void) => {
    if (recentName) setter(recentName)
  }

  const create = () => {
    setError("")
    goToGame("create", hostName, undefined, avatar, {duration,wheel,playerLimit,roundLimit,categories:selectedCategories.join(","),letters:selectedLetters.join("")})
  }

  const join = () => {
    const code = joinCode.trim()
    if (!/^\d{6}$/.test(code)) {
      setError("6 haneli oda kodunu gir kral.")
      return
    }
    goToGame("join", guestName, code, avatar)
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#03040b] text-white selection:bg-violet-500/30">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(139,92,246,.20),transparent_36%),radial-gradient(circle_at_100%_60%,rgba(34,211,238,.08),transparent_32%)]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />
      <Vortex
        particleCount={280}
        rangeY={520}
        baseHue={245}
        rangeSpeed={1.1}
        backgroundColor="#03040b"
        containerClassName="fixed inset-0 opacity-55"
      />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(124,92,255,.16),transparent_42%)]" />

      <div className="relative z-10 mx-auto min-h-screen max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <header className="mb-10 flex items-center justify-between rounded-2xl border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-2xl md:px-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl border border-violet-400/30 bg-violet-500/10 shadow-[0_0_30px_rgba(124,92,255,.16)]">
              <Zap className="size-5 text-violet-300" />
            </div>
            <div>
              <div className="text-[11px] font-black tracking-[.28em] text-violet-200">İSİM ŞEHİR</div>
              <div className="text-xs text-white/40">Arkadaşlarla oyna</div>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-xs text-white/40 sm:flex">
            <Globe2 className="size-4 text-cyan-300/70" />
            Türkçe · Çok oyunculu
          </div>
        </header>

        <section className="mx-auto mb-10 max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-300/[.06] px-3 py-1.5 text-[10px] font-black tracking-[.16em] text-violet-200">
            <Sparkles className="size-3.5" /> ARKADAŞLARLA OYNA
          </div>
          <h1 className="text-6xl font-black tracking-[-.06em] md:text-8xl">
            İsim <span className="bg-gradient-to-r from-white via-violet-200 to-cyan-300 bg-clip-text text-transparent">Şehir</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/45 md:text-base">
            Harfini seç, cevaplarını doldur, arkadaşlarının cevaplarını değerlendir ve en yüksek puanı topla.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Card className="rounded-[26px] border border-violet-300/10 bg-[#090b15]/85 p-5 shadow-[0_25px_80px_rgba(0,0,0,.45)] backdrop-blur-xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <div className="mb-3 grid size-12 place-items-center rounded-2xl border border-violet-400/20 bg-violet-500/10">
                  <Gamepad2 className="size-6 text-violet-300" />
                </div>
                <h2 className="text-xl font-black">Oda Kur</h2>
                <p className="mt-1 text-xs leading-5 text-white/40">Host ol, ayarları belirle ve arkadaşlarını davet et.</p>
              </div>
              {recentName && (
                <button onClick={() => chooseName(setHostName)} className="text-[10px] text-violet-300 hover:text-white">
                  Son ad: {recentName}
                </button>
              )}
            </div>

            <input
              value={hostName}
              onChange={e => setHostName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && create()}
              maxLength={18}
              placeholder="Oyuncu adın"
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm outline-none transition focus:border-violet-400/60 focus:ring-4 focus:ring-violet-500/10"
            />

            <div className="mt-4 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/35">Avatarını seç</span>
              <span className="text-[10px] text-violet-300">{avatars[avatar]}</span>
            </div>
            <div className="mt-2 grid grid-cols-8 gap-1.5">
              {avatars.map((name, i) => (
                <button key={name} onClick={() => setAvatar(i)} aria-label={name}
                  className={`aspect-square rounded-xl border p-1 text-[10px] font-bold transition ${avatar === i ? "border-violet-300 bg-violet-500/20 shadow-[0_0_18px_rgba(124,92,255,.25)]" : "border-white/8 bg-white/[.025] hover:border-white/20"}`}>
                  <span className="grid size-full place-items-center rounded-lg bg-gradient-to-br from-violet-500/50 to-cyan-400/30">{name[0]}</span>
                </button>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              {[
                ["Tur süresi", duration, setDuration, [["60","60 sn"],["90","90 sn"],["120","120 sn"],["180","180 sn"]]],
                ["Çark", wheel, setWheel, [["on","Açık"],["off","Kapalı"]]],
                ["Oyuncu", playerLimit, setPlayerLimit, [["2","2"],["4","4"],["6","6"],["8","8"],["10","10"]]],
                ["Tur sayısı", roundLimit, setRoundLimit, [["3","3"],["5","5"],["10","10"]]],
              ].map(([label,value,setter,options]) => (
                <label key={label as string} className="rounded-2xl border border-white/8 bg-white/[.025] p-3">
                  <span className="block text-[9px] font-black uppercase tracking-[.16em] text-white/35">{label as string}</span>
                  <select value={value as string} onChange={e => (setter as (v:string)=>void)(e.target.value)}
                    className="mt-2 h-9 w-full rounded-xl border border-white/10 bg-black/30 px-2 text-xs text-white outline-none focus:border-violet-400/60">
                    {(options as string[][]).map(([v,t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                </label>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-white/8 bg-white/[.025] p-3">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-[.16em] text-white/35">Kategoriler</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedCategories([...categories].sort(() => Math.random()-.5).slice(0,6))} className="h-7 rounded-full px-2.5 text-[10px] text-violet-300 hover:bg-violet-500/10 hover:text-violet-200">Karıştır</Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {categories.map(cat => <button type="button" key={cat} onClick={() => setSelectedCategories(x => x.includes(cat) ? (x.length===1 ? x : x.filter(v=>v!==cat)) : [...x,cat])} className={`rounded-full border px-2.5 py-1 text-[10px] transition ${selectedCategories.includes(cat) ? "border-violet-300/60 bg-violet-500/20 text-violet-100" : "border-white/10 bg-black/20 text-white/35"}`}>{cat}</button>)}
              </div>
              <div className="mt-4 flex items-center justify-between"><span className="text-[9px] font-black uppercase tracking-[.16em] text-white/35">Harf havuzu · {selectedLetters.length}</span><Button type="button" variant="ghost" size="sm" onClick={() => setSelectedLetters([...letters])} className="h-7 rounded-full px-2.5 text-[10px] text-cyan-300 hover:bg-cyan-400/10 hover:text-cyan-200">Tümü</Button></div>
              <div className="mt-2 grid grid-cols-10 gap-1">
                {letters.map(letter => <button type="button" key={letter} onClick={() => setSelectedLetters(x => x.includes(letter) ? (x.length===1 ? x : x.filter(v=>v!==letter)) : [...x,letter])} className={`aspect-square rounded-lg border text-[10px] font-black ${selectedLetters.includes(letter) ? "border-cyan-300/50 bg-cyan-400/10 text-cyan-100" : "border-white/8 bg-black/20 text-white/20"}`}>{letter}</button>)}
              </div>
            </div>

            <Button onClick={create} className="mt-5 h-12 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-500 font-black shadow-[0_12px_35px_rgba(124,92,255,.22)] hover:from-violet-500 hover:to-fuchsia-400">
              Oda Oluştur <ArrowRight className="ml-1 size-4" />
            </Button>
          </div>

          <Card className="rounded-[26px] border border-cyan-300/10 bg-[#090b15]/85 p-5 shadow-[0_25px_80px_rgba(0,0,0,.45)] backdrop-blur-xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <div className="mb-3 grid size-12 place-items-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10">
                  <Users className="size-6 text-cyan-300" />
                </div>
                <h2 className="text-xl font-black">Odaya Katıl</h2>
                <p className="mt-1 text-xs leading-5 text-white/40">Arkadaşından aldığın 6 haneli kodla yarışa gir.</p>
              </div>
              {recentName && (
                <button onClick={() => chooseName(setGuestName)} className="text-[10px] text-cyan-300 hover:text-white">
                  Son ad: {recentName}
                </button>
              )}
            </div>

            <input value={guestName} onChange={e => setGuestName(e.target.value)} maxLength={18} placeholder="Oyuncu adın"
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm outline-none transition focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-500/10" />
            <input value={joinCode} onChange={e => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={e => e.key === "Enter" && join()} inputMode="numeric" placeholder="6 haneli oda kodu"
              className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm tracking-[.25em] outline-none transition focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-500/10" />

            {error && <div className="mt-3 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</div>}

            <Button onClick={join} variant="secondary" className="mt-5 h-12 w-full rounded-2xl border border-cyan-300/15 bg-cyan-500/10 font-black text-cyan-100 hover:bg-cyan-500/15">
              Odaya Katıl <ArrowRight className="ml-1 size-4" />
            </Button>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-3 gap-2">
          {[
            ["Puan", "Yeşil oy = +10"],
            ["Harf", "Her tur yeni harf"],
            ["Çoklu", "2–10 oyuncu"],
          ].map(([title, sub]) => (
            <div key={title} className="rounded-2xl border border-white/8 bg-white/[.025] px-3 py-4 text-center backdrop-blur-xl">
              <div className="text-sm font-black">{title}</div>
              <div className="mt-1 text-[10px] text-white/35">{sub}</div>
            </div>
          ))}
        </section>

        <footer className="mt-8 text-center text-[10px] text-white/20">
          Vortex Arena · İsim Şehir
        </footer>
      </div>
    </main>
  )
}
