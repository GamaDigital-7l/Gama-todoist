import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import { pdfjs } from "react-pdf"; // Importar pdfjs
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url'; // Importar o worker usando a sintaxe ?url do Vite

// Definir o workerSrc para o arquivo local do pdfjs-dist
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

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