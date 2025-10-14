import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import { pdfjs } from "react-pdf"; // Importar pdfjs

// Definir o workerSrc para o caminho estático do arquivo copiado.
// O vite-plugin-static-copy garante que 'pdf.worker.mjs' estará na raiz da pasta de saída.
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';

// Registrar o Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('Service Worker registrado com sucesso:', registration);
      })
      .catch(error => {
        console.error('Falha no registro do Service Worker:', error);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);