import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Project site: https://omer-dayan.github.io/wedding-planner/
// Hash routes (#/guests) avoid GitHub Pages rewrite rules.
export default defineConfig({
  base: '/wedding-planner/',
  plugins: [react()],
})
