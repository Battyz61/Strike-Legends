import { useMemo, useState } from "react"
import { ArrowRight, Check, Gamepad2, Sparkles, Users, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"

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

  const shuffleCategories = () => setSelectedCategories([...categories].sort(() => Math.random()-.5).slice(0,6))

  return (
    <main className="lobby-shell">
      <div className="lobby-atmosphere" />
      <div className="lobby-grid" />

      <div className="lobby-container">
        <header className="lobby-nav">
          <div className="brand-lockup">
            <div className="brand-mark"><Zap className="size-5" /></div>
            <div>
              <div className="brand-name">İSİM ŞEHİR</div>
              <div className="brand-sub">Arkadaşlarla oyna</div>
            </div>
          </div>
          <div className="online-pill"><span /> Türkçe · Çok oyunculu</div>
        </header>

        <section className="lobby-hero">
          <div className="hero-kicker"><Sparkles className="size-3.5" /> ARKADAŞLARLA OYNA</div>
          <h1>İsim <span>Şehir</span></h1>
          <p>Harfini seç, cevaplarını doldur, arkadaşlarının cevaplarını değerlendir ve en yüksek puanı topla.</p>
        </section>

        <section className="lobby-grid-layout">
          <div className="lobby-card create-card">
            <div className="card-head">
              <div>
                <div className="card-icon violet"><Gamepad2 className="size-5" /></div>
                <h2>Oda Kur</h2>
                <p>Host ol, ayarları belirle ve arkadaşlarını davet et.</p>
              </div>
              {recentName && <button className="recent-name" onClick={() => chooseName(setHostName)}>Son ad: <b>{recentName}</b></button>}
            </div>

            <label className="field-label">OYUNCU ADI</label>
            <input value={hostName} onChange={e => setHostName(e.target.value)} onKeyDown={e => e.key === "Enter" && create()} maxLength={18} placeholder="Oyuncu adın" className="lobby-input" />

            <div className="avatar-head"><span>AVATARINI SEÇ</span><b>{avatars[avatar]}</b></div>
            <div className="avatar-grid">
              {avatars.map((name, i) => (
                <button key={name} onClick={() => setAvatar(i)} aria-label={name} className={`avatar-choice ${avatar === i ? "selected" : ""}`}>
                  <span>{name[0]}</span>
                </button>
              ))}
            </div>

            <div className="settings-grid">
              {[
                ["Tur süresi", duration, setDuration, [["60","60 sn"],["90","90 sn"],["120","120 sn"],["180","180 sn"]]],
                ["Çark", wheel, setWheel, [["on","Açık"],["off","Kapalı"]]],
                ["Oyuncu", playerLimit, setPlayerLimit, [["2","2"],["4","4"],["6","6"],["8","8"],["10","10"]]],
                ["Tur sayısı", roundLimit, setRoundLimit, [["3","3"],["5","5"],["10","10"]]],
              ].map(([label,value,setter,options]) => (
                <label key={label as string} className="setting-box">
                  <span>{label as string}</span>
                  <select value={value as string} onChange={e => (setter as (v:string)=>void)(e.target.value)}>
                    {(options as string[][]).map(([v,t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                </label>
              ))}
            </div>

            <div className="selection-panel">
              <div className="selection-title"><span>KATEGORİLER</span><button onClick={shuffleCategories}>Karıştır</button></div>
              <div className="chips">
                {categories.map(cat => <button type="button" key={cat} onClick={() => setSelectedCategories(x => x.includes(cat) ? (x.length===1 ? x : x.filter(v=>v!==cat)) : [...x,cat])} className={`selection-chip ${selectedCategories.includes(cat) ? "active" : ""}`}>{cat}</button>)}
              </div>
              <div className="selection-title letters-title"><span>HARF HAVUZU · {selectedLetters.length}</span><button className="cyan" onClick={() => setSelectedLetters([...letters])}>Tümü</button></div>
              <div className="letter-grid">
                {letters.map(letter => <button type="button" key={letter} onClick={() => setSelectedLetters(x => x.includes(letter) ? (x.length===1 ? x : x.filter(v=>v!==letter)) : [...x,letter])} className={`letter-choice ${selectedLetters.includes(letter) ? "active" : ""}`}>{letter}</button>)}
              </div>
            </div>

            <Button onClick={create} className="create-button">Oda Oluştur <ArrowRight className="ml-1 size-5" /></Button>
          </div>

          <div className="lobby-card join-card">
            <div className="card-head">
              <div>
                <div className="card-icon cyan"><Users className="size-5" /></div>
                <h2>Odaya Katıl</h2>
                <p>Arkadaşından aldığın 6 haneli kodla yarışa gir.</p>
              </div>
              {recentName && <button className="recent-name cyan-text" onClick={() => chooseName(setGuestName)}>Son ad: <b>{recentName}</b></button>}
            </div>

            <label className="field-label">OYUNCU ADI</label>
            <input value={guestName} onChange={e => setGuestName(e.target.value)} maxLength={18} placeholder="Oyuncu adın" className="lobby-input" />
            <label className="field-label code-label">ODA KODU</label>
            <input value={joinCode} onChange={e => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={e => e.key === "Enter" && join()} inputMode="numeric" placeholder="6 haneli oda kodu" className="lobby-input code-input" />

            {error && <div className="lobby-error">{error}</div>}

            <Button onClick={join} variant="secondary" className="join-button"><Users className="size-5" /> Odaya Katıl <ArrowRight className="ml-auto size-5" /></Button>

            <div className="join-note"><Check className="size-4" /> Kod 6 haneli olmalı</div>
          </div>
        </section>

        <section className="feature-strip">
          {[["Puan","Yeşil oy = +10"],["Harf","Her tur yeni harf"],["Çoklu","2–10 oyuncu"]].map(([title,sub]) => (
            <div key={title}><b>{title}</b><span>{sub}</span></div>
          ))}
        </section>

        <footer>İSİM ŞEHİR · OYNA · PUANLA · KAZAN</footer>
      </div>
    </main>
  )
}
