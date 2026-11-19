import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useStore } from './lib/store';
import { sectionsFor, type Section } from './lib/roles';
import Dashboard from './pages/Dashboard';
import Stories from './pages/Stories';
import StoryEditor from './pages/StoryEditor';
import Moderation from './pages/Moderation';
import Editorial from './pages/Editorial';
import Reporters from './pages/Reporters';
import Reels from './pages/Reels';
import Intake from './pages/Intake';
import StatusCards from './pages/StatusCards';
import AssignmentsAdmin from './pages/AssignmentsAdmin';
import Recognition from './pages/Recognition';
import Finance from './pages/Finance';
import Analytics from './pages/Analytics';
import Ads from './pages/Ads';
import Polls from './pages/Polls';
import Users from './pages/Users';

const HOME: [Section, string][] = [['dashboard', '/'], ['stories', '/stories'], ['finance', '/finance']];

function Guard({ section, children }: { section: Section; children: React.ReactNode }) {
  const { session } = useStore();
  const allowed = sectionsFor(session);
  if (allowed.includes(section)) return <>{children}</>;
  const fallback = HOME.find(([s]) => allowed.includes(s))?.[1] ?? '/stories';
  return <Navigate to={fallback === '/' && section === 'dashboard' ? '/stories' : fallback} replace />;
}

export default function App() {
  const { live } = useStore();
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Guard section="dashboard"><Dashboard /></Guard>} />
        <Route path="stories" element={<Guard section="stories"><Stories /></Guard>} />
        <Route path="stories/new" element={<Guard section="stories"><StoryEditor /></Guard>} />
        <Route path="stories/:id" element={<Guard section="stories"><StoryEditor /></Guard>} />
        {/* Live data uses the full editorial workflow; the simple queue remains for demo mode. */}
        <Route path="moderation" element={live ? <Navigate to="/editorial" replace /> : <Guard section="moderation"><Moderation /></Guard>} />
        <Route path="editorial" element={<Guard section="editorial"><Editorial /></Guard>} />
        <Route path="reels" element={<Guard section="reels"><Reels /></Guard>} />
        <Route path="intake" element={<Guard section="intake"><Intake /></Guard>} />
        <Route path="status" element={<Guard section="status"><StatusCards /></Guard>} />
        <Route path="reporters" element={<Guard section="reporters"><Reporters /></Guard>} />
        <Route path="assignments" element={<Guard section="assignments"><AssignmentsAdmin /></Guard>} />
        <Route path="recognition" element={<Guard section="recognition"><Recognition /></Guard>} />
        <Route path="finance" element={<Guard section="finance"><Finance /></Guard>} />
        <Route path="analytics" element={<Guard section="analytics"><Analytics /></Guard>} />
        <Route path="ads" element={<Guard section="ads"><Ads /></Guard>} />
        <Route path="polls" element={<Guard section="polls"><Polls /></Guard>} />
        <Route path="users" element={<Guard section="users"><Users /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
