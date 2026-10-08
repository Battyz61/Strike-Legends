import {defineConfig} from "vite"
import react from "@vitejs/plugin-react"

// Keep the Vite config Cloudflare/Bun compatible without Node-only imports.
export default defineConfig({
  plugins:[react()],
  resolve:{
    alias:{
      "@":new URL("./",import.meta.url).pathname
    }
  }
})
