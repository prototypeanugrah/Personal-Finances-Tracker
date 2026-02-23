import { StrictMode, Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConvexProvider } from 'convex/react'
import { convex, isConvexConfigured } from './lib/convex'
import './index.css'
import App from './App.tsx'

// #region agent log
fetch('http://127.0.0.1:7359/ingest/3e5490cf-2a9d-4bad-820c-1c742bca7b01',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fd1bb4'},body:JSON.stringify({sessionId:'fd1bb4',location:'main.tsx:init',message:'App initialization',data:{isConvexConfigured,hasConvexClient:!!convex,convexUrl:import.meta.env.VITE_CONVEX_URL||'NOT SET'},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
// #endregion

class ErrorBoundary extends Component<{children:ReactNode},{error:Error|null}> {
  state: {error: Error|null} = {error: null};
  static getDerivedStateFromError(error: Error) { return {error}; }
  componentDidCatch(error: Error) {
    // #region agent log
    fetch('http://127.0.0.1:7359/ingest/3e5490cf-2a9d-4bad-820c-1c742bca7b01',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fd1bb4'},body:JSON.stringify({sessionId:'fd1bb4',location:'main.tsx:ErrorBoundary',message:'React error boundary caught error',data:{errorMessage:error.message,errorStack:error.stack?.substring(0,500)},timestamp:Date.now(),hypothesisId:'H5'})}).catch(()=>{});
    // #endregion
  }
  render() {
    if (this.state.error) return <div style={{padding:'2rem',color:'red'}}><h1>App Error</h1><pre>{this.state.error.message}</pre></div>;
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
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
    </ErrorBoundary>
  </StrictMode>,
)
