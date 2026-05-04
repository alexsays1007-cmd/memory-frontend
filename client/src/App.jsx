import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/Layout/AppLayout';
import MemoriesPage from './views/Memories/MemoriesPage';
import DiaryPage from './views/Diary/DiaryPage';
import ConsciousnessPage from './views/Consciousness/ConsciousnessPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<MemoriesPage />} />
          <Route path="diary" element={<DiaryPage />} />
          <Route path="consciousness" element={<ConsciousnessPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
