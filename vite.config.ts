import base44 from "@base44/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// A single-page app: Base44 serves dist/ and its plugin wires the SDK to the app's backend
// (run it through the Base44 CLI: `base44 dev`, `base44 build`). The router plugin regenerates
// src/routeTree.gen.ts from src/routes on every dev start and build.
export default defineConfig({
  plugins: [
    base44({
      legacySDKImports: process.env["BASE44_LEGACY_SDK_IMPORTS"] === "true",
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true,
    }),
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
});
