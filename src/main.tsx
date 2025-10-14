import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import { pdfjs } from "react-pdf"; // Importar pdfjs

// Definir o workerSrc para o arquivo local do pdfjs-dist na pasta public
// Certifique-se de ter copiado 'node_modules/pdfjs-dist/build/pdf.worker.min.js' para 'public/pdf.worker.min.js'
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

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