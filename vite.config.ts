import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/gas-prices-interactive/",
  plugins: [react()],
});
