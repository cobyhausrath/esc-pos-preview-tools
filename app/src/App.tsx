import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Dashboard from '@/pages/Dashboard';
import Editor from '@/pages/Editor';
import '@/styles/app.css';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <nav className="app-nav">
          <Link to="/" className="nav-link">
            Editor
          </Link>
          <Link to="/dashboard" className="nav-link">
            Dashboard
          </Link>
        </nav>

        <Routes>
          <Route path="/" element={<Editor />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
