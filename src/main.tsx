import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'
import { basePath } from '@/config/site'

createRoot(document.getElementById('root')!).render(
  <BrowserRouter basename={basePath}>
    <App />
  </BrowserRouter>,
)
