import { Vortex } from "@/components/ui/vortex"
import { Button } from "@/components/ui/button"
import { Play, Users, ArrowRight } from "lucide-react"

export default function App() {
  return <main className="min-h-screen bg-[#03040b] text-white">
    <Vortex particleCount={260} rangeY={520} baseHue={245} rangeSpeed={1.2} backgroundColor="#03040b" containerClassName="fixed inset-0 pointer-events-none opacity-70" />
    <section className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col p-4 md:p-8">
      <header className="mb-5 flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-5 py-4 backdrop-blur-xl">
        <div><div className="text-xs font-black tracking-[.25em] text-violet-300">İSİM ŞEHİR</div><div className="text-sm text-white/50">Arkadaşlarla oyna</div></div>
        <Button variant="outline" size="icon"><ArrowRight className="h-4 w-4" /></Button>
      </header>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4 backdrop-blur-xl"><Play className="mb-2 h-5 w-5 text-violet-300" /><b>Yeni arayüz</b><p className="mt-1 text-xs text-white/50">Shadcn altyapısı ve Vortex atmosferi.</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4 backdrop-blur-xl"><Users className="mb-2 h-5 w-5 text-cyan-300" /><b>Oyun sistemi korunuyor</b><p className="mt-1 text-xs text-white/50">Mevcut oyun akışını bozmadan yeni arayüz.</p></div>
      </div>
      <div className="flex-1 rounded-3xl border border-white/10 bg-black/40 p-8 text-center shadow-2xl backdrop-blur-sm">
        <h1 className="text-5xl font-black tracking-tight md:text-7xl">İsim Şehir</h1>
        <p className="mx-auto mt-4 max-w-xl text-white/50">Yeni React arayüz altyapısı hazır. Mevcut oyun ekranını bir sonraki adımda gerçek komponentlere taşıyoruz.</p>
      </div>
    </section>
  </main>
}