import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/Layout/AppLayout';
import MemoriesPage from './views/Memories/MemoriesPage';
import DiaryPage from './views/Diary/DiaryPage';
import ConsciousnessPage from './views/Consciousness/ConsciousnessPage';
import RawMessagesPage from './views/RawMessages/RawMessagesPage';
import SummaryPage from './views/Summary/SummaryPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<MemoriesPage />} />
          <Route path="diary" element={<DiaryPage />} />
          <Route path="stream" element={<RawMessagesPage />} />
          <Route path="summary" element={<SummaryPage />} />
          <Route path="consciousness" element={<ConsciousnessPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

