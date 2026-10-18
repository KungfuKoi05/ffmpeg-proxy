import { AppProvider, useApp } from './state'
import { Layout } from './components/Layout'
import { CleanPage } from './pages/CleanPage'
import { HistoryPage } from './pages/HistoryPage'
import { RecipesPage } from './pages/RecipesPage'
import { HelpPage } from './pages/HelpPage'

function Routes() {
  const { route } = useApp()
  if (route === 'history') return <HistoryPage />
  if (route === 'recipes') return <RecipesPage />
  if (route === 'help') return <HelpPage />
  return <CleanPage />
}

export default function App() {
  return (
    <AppProvider>
      <Layout>
        <Routes />
      </Layout>
    </AppProvider>
  )
}
