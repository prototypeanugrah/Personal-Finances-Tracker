import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConvexProvider } from 'convex/react'
import { convex, isConvexConfigured } from './lib/convex'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isConvexConfigured && convex ? (
      <ConvexProvider client={convex}>
        <App />
      </ConvexProvider>
    ) : (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Convex Not Configured</h1>
        <p>Please run <code>npx convex dev</code> to set up your Convex backend.</p>
      </div>
    )}
  </StrictMode>,
)
