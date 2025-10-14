import { defineConfig } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { viteStaticCopy } from 'vite-plugin-static-copy'; // Importar o plugin

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    dyadComponentTagger(), 
    react(),
    viteStaticCopy({ // Configurar o plugin para copiar o worker do pdfjs-dist
      targets: [
        {
          src: 'node_modules/pdfjs-dist/build/pdf.worker.mjs',
          dest: './', // Copia para a raiz da pasta de saída (public durante o dev)
        },
      ],
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));