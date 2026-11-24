import { cn } from "@/lib/utils"
import React, { useEffect, useRef } from "react"
import { createNoise3D } from "simplex-noise"
import { motion } from "framer-motion"

interface VortexProps {
  children?: React.ReactNode
  className?: string
  containerClassName?: string
  particleCount?: number
  rangeY?: number
  baseHue?: number
  baseSpeed?: number
  rangeSpeed?: number
  baseRadius?: number
  rangeRadius?: number
  backgroundColor?: string
}

export const Vortex = React.memo(({
  children,
  className,
  containerClassName,
  particleCount = 80,
  rangeY = 520,
  baseHue = 245,
  baseSpeed = 0,
  rangeSpeed = 1.1,
  baseRadius = 1,
  rangeRadius = 2,
  backgroundColor = "#03040b"
}: VortexProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    if (prefersReducedMotion) return

    const ctx = canvas.getContext("2d", { alpha: backgroundColor === "transparent" })
    if (!ctx) return

    const isMobile = window.innerWidth < 768
    const count = isMobile ? Math.min(particleCount, 42) : particleCount
    const noise = createNoise3D()
    const props = new Float32Array(count * 9)

    let tick = 0
    let cy = 0
    let raf = 0
    let resizeTimer = 0
    let isVisible = document.visibilityState === "visible"

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      cy = canvas.height * 0.5
    }

    const onResize = () => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(resize, 120)
    }

    const init = (i: number) => {
      props[i] = Math.random() * canvas.width
      props[i + 1] = cy + (Math.random() - 0.5) * 2 * rangeY
      props[i + 2] = 0
      props[i + 3] = 0
      props[i + 4] = 0
      props[i + 5] = 50 + Math.random() * 150
      props[i + 6] = baseSpeed + Math.random() * rangeSpeed
      props[i + 7] = baseRadius + Math.random() * rangeRadius
      props[i + 8] = (baseHue + Math.random() * 100) | 0
    }

    const setup = () => {
      resize()
      for (let i = 0; i < props.length; i += 9) init(i)
    }

    const draw = () => {
      if (!isVisible) {
        raf = 0
        return
      }
      tick++
      ctx.globalCompositeOperation = "source-over"
      ctx.fillStyle = backgroundColor
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.globalCompositeOperation = "lighter"

      const width = canvas.width
      const height = canvas.height
      const zOff = tick * 0.0005

      for (let i = 0; i < props.length; i += 9) {
        const x = props[i]
        const y = props[i + 1]
        const n = noise(x * 0.00125, y * 0.00125, zOff) * (Math.PI * 6)
        const vx = props[i + 2] + (Math.cos(n) - props[i + 2]) * 0.5
        const vy = props[i + 3] + (Math.sin(n) - props[i + 3]) * 0.5
        const s = props[i + 6]
        const x2 = x + vx * s
        const y2 = y + vy * s
        const life = ++props[i + 4]
        const ttl = props[i + 5]
        const alpha = Math.min(1, life / 15, (ttl - life) / 20) * 0.22

        ctx.strokeStyle = `hsla(${props[i + 8]},100%,65%,${alpha.toFixed(3)})`
        ctx.lineWidth = props[i + 7]
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x2, y2)
        ctx.stroke()

        props[i] = x2
        props[i + 1] = y2
        props[i + 2] = vx
        props[i + 3] = vy

        if (x2 < 0 || x2 > width || y2 < 0 || y2 > height || life > ttl) {
          init(i)
        }
      }

      raf = requestAnimationFrame(draw)
    }

    const onVisibilityChange = () => {
      isVisible = document.visibilityState === "visible"
      if (isVisible && !raf) {
        raf = requestAnimationFrame(draw)
      }
    }

    setup()
    window.addEventListener("resize", onResize, { passive: true })
    document.addEventListener("visibilitychange", onVisibilityChange)
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(resizeTimer)
      window.removeEventListener("resize", onResize)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [particleCount, rangeY, baseHue, baseSpeed, rangeSpeed, baseRadius, rangeRadius, backgroundColor])

  return (
    <div ref={containerRef} className={cn("relative h-full w-full", containerClassName)}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-0 overflow-hidden">
        <canvas ref={canvasRef} />
      </motion.div>
      {children ? <div className={cn("relative z-10 h-full", className)}>{children}</div> : null}
    </div>
  )
})

Vortex.displayName = "Vortex"
import {motion} from "framer-motion"
interface VortexProps{children?:React.ReactNode;className?:string;containerClassName?:string;particleCount?:number;rangeY?:number;baseHue?:number;baseSpeed?:number;rangeSpeed?:number;baseRadius?:number;rangeRadius?:number;backgroundColor?:string}
export const Vortex=(p:VortexProps)=>{const canvasRef=useRef<HTMLCanvasElement>(null);const containerRef=useRef<HTMLDivElement>(null);useEffect(()=>{const canvas=canvasRef.current,container=containerRef.current;if(!canvas||!container)return;const ctx=canvas.getContext("2d");if(!ctx)return;const noise=createNoise3D(),count=p.particleCount??420,props=new Float32Array(count*9);let tick=0,cx=0,cy=0,raf=0;const resize=()=>{canvas.width=innerWidth;canvas.height=innerHeight;cx=canvas.width*.5;cy=canvas.height*.5};const init=(i:number)=>{props.set([Math.random()*canvas.width,cy+(Math.random()-.5)*2*(p.rangeY??100),0,0,0,50+Math.random()*150,(p.baseSpeed??0)+(Math.random()*(p.rangeSpeed??1.5)),(p.baseRadius??1)+Math.random()*(p.rangeRadius??2),(p.baseHue??220)+Math.random()*100],i)};const setup=()=>{resize();for(let i=0;i<props.length;i+=9)init(i)};const draw=()=>{tick++;ctx.fillStyle=p.backgroundColor??"transparent";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.globalCompositeOperation="lighter";for(let i=0;i<props.length;i+=9){let x=props[i],y=props[i+1],n=noise(x*.00125,y*.00125,tick*.0005)*3*Math.PI*2,vx=props[i+2]+(Math.cos(n)-props[i+2])*.5,vy=props[i+3]+(Math.sin(n)-props[i+3])*.5,s=props[i+6],x2=x+vx*s,y2=y+vy*s,life=++props[i+4],ttl=props[i+5];ctx.strokeStyle=`hsla(${props[i+8]},100%,65%,${Math.min(1,life/15,(ttl-life)/20)*.22})`;ctx.lineWidth=props[i+7];ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();props[i]=x2;props[i+1]=y2;props[i+2]=vx;props[i+3]=vy;if(x2<0||x2>canvas.width||y2<0||y2>canvas.height||life>ttl)init(i)}raf=requestAnimationFrame(draw)};setup();addEventListener("resize",resize);draw();return()=>{cancelAnimationFrame(raf);removeEventListener("resize",resize)}},[p]);return <div ref={containerRef} className={cn("relative h-full w-full",p.containerClassName)}><motion.div initial={{opacity:0}} animate={{opacity:1}} className="absolute inset-0 z-0 overflow-hidden"><canvas ref={canvasRef}/></motion.div><div className={cn("relative z-10 h-full",p.className)}>{p.children}</div></div>}
