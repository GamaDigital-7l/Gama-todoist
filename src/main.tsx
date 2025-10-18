import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import { pdfjs } from "react-pdf"; // Importar pdfjs

// Definir o workerSrc para o caminho do CDN, usando a versão do pdfjs que react-pdf está usando.
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Registrar o Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('Service Worker registrado com sucesso:', registration);
        // Enviar mensagem para o SW para limpar o badge ao iniciar o app
        if ('setAppBadge' in navigator) {
          registration.active?.postMessage({ action: 'clearBadge' });
        }
      })
      .catch(error => {
        console.error('Falha no registro do Service Worker:', error);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);