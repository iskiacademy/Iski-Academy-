import { renderToString } from 'react-dom/server'
import App from './App'

export function renderPage(initialUrl: string) {
  return renderToString(<App initialUrl={initialUrl} />)
}
