import React from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import App from './App'
import { initializeAnalytics } from './analytics'
import './styles.css'

if (!window.location.pathname.startsWith('/admin')) initializeAnalytics()
const mount = document.getElementById('root')!
const app = <React.StrictMode><App initialUrl={window.location.pathname} /></React.StrictMode>

if (mount.hasChildNodes()) hydrateRoot(mount, app)
else createRoot(mount).render(app)
