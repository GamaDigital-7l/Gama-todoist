import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import { pdfjs } from "react-pdf"; // Importar pdfjs

// Importar o worker do pdfjs-dist como uma URL estática.
// Usando a versão ES Module (pdf.worker.mjs) que é mais robusta para esta abordagem com Vite.
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Definir o workerSrc para a URL fornecida pelo Vite.
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

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