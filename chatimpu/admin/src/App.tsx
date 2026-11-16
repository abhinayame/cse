import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useStore } from './lib/store';
import { CAN, type Section } from './lib/roles';
import Dashboard from './pages/Dashboard';
import Stories from './pages/Stories';
import StoryEditor from './pages/StoryEditor';
import Moderation from './pages/Moderation';
import Analytics from './pages/Analytics';
import Ads from './pages/Ads';
import Polls from './pages/Polls';
import Users from './pages/Users';

function Guard({ section, children }: { section: Section; children: React.ReactNode }) {
  const { session } = useStore();
  return CAN[session.role].includes(section) ? <>{children}</> : <Navigate to="/stories" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Guard section="dashboard"><Dashboard /></Guard>} />
        <Route path="stories" element={<Stories />} />
        <Route path="stories/new" element={<StoryEditor />} />
        <Route path="stories/:id" element={<StoryEditor />} />
        <Route path="moderation" element={<Guard section="moderation"><Moderation /></Guard>} />
        <Route path="analytics" element={<Guard section="analytics"><Analytics /></Guard>} />
        <Route path="ads" element={<Guard section="ads"><Ads /></Guard>} />
        <Route path="polls" element={<Guard section="polls"><Polls /></Guard>} />
        <Route path="users" element={<Guard section="users"><Users /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
