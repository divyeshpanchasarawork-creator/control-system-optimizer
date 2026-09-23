import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme.css'
import './app.css'
import './landing.css'
import App from './App.tsx'
import { WorkspaceProvider } from './state/WorkspaceContext.tsx'

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<WorkspaceProvider>
			<App />
		</WorkspaceProvider>
	</StrictMode>,
)
