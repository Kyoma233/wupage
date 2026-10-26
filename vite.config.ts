import { resolve } from "node:path";
import { mkdir, copyFile } from "node:fs/promises";
import { build as bundle } from "esbuild";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [{
    name: "bundle-local-ocr-runtime",
    async closeBundle() {
      // Manifest content scripts are classic scripts. Bundle them independently
      // so shared helpers cannot introduce Rollup's module imports into content.js.
      await bundle({ entryPoints: ["src/content/index.ts"], outfile: resolve(__dirname, "dist/content.js"),
        bundle: true, minify: true, sourcemap: true, format: "iife", platform: "browser", target: "chrome120" });
      const output = resolve(__dirname, "dist/ocr-runtime");
      await mkdir(output, { recursive: true });
      await bundle({ entryPoints: ["src/ocr/sandbox.ts"], outfile: resolve(output, "engine.js"), bundle: true, minify: true, format: "iife", platform: "browser", target: "chrome120", external: ["fs", "path"],
        plugins: [{ name: "ocr-ort-adapter", setup(build) {
          build.onResolve({ filter: /^onnxruntime-web$/ }, () => ({ path: resolve(__dirname, "src/ocr/ort-runtime.ts") }));
        } }], define: { "process.env.NODE_ENV": '"production"' } });
      for (const file of ["ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"]) {
        await copyFile(resolve(__dirname, "node_modules/onnxruntime-web/dist", file), resolve(output, file));
      }
      const bergamotOutput = resolve(__dirname, "dist/bergamot-runtime");
      await mkdir(bergamotOutput, { recursive: true });
      for (const file of ["translator-worker.js", "bergamot-translator-worker.js", "bergamot-translator-worker.wasm"]) {
        await copyFile(resolve(__dirname, "node_modules/@browsermt/bergamot-translator/worker", file), resolve(bergamotOutput, file));
      }
    }
  }],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    modulePreload: false,
    rollupOptions: {
      input: {
        background: resolve(__dirname, "src/background/index.ts"),
        popup: resolve(__dirname, "popup.html"),
        options: resolve(__dirname, "options.html"),
        pdf: resolve(__dirname, "pdf.html"),
        ocrOffscreen: resolve(__dirname, "ocr-offscreen.html")
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  }
});
