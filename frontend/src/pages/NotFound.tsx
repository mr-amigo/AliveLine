import { Link } from 'react-router-dom'
import SiteLayout, { TextPage } from '../components/SiteLayout'
import { Button } from '../components/ui'
import { usePageMeta } from '../hooks/usePageMeta'

export default function NotFound() {
  usePageMeta('Page not found')
  return (
    <SiteLayout>
      <TextPage title="Page not found">
        <p className="text-text-2">This page doesn’t exist or has moved. Check the address, or go back to the start.</p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Link to="/"><Button>Go home</Button></Link>
          <Link to="/app"><Button variant="secondary">Open planner</Button></Link>
        </div>
      </TextPage>
    </SiteLayout>
  )
}
