import React, { useState, useEffect } from 'react'
import Dashboard from './components/Dashboard'
import Login from './components/Login'
import './App.css'

function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('kot-theme') || 'light';
  });
  const [authenticated, setAuthenticated] = useState(null); // null = checking

  // Check auth status on mount
  useEffect(() => {
    fetch('/api/auth/status', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setAuthenticated(data.authenticated))
      .catch(() => setAuthenticated(false));
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('kot-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setAuthenticated(false);
  };

  // Loading check
  if (authenticated === null) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a',
        color: '#94a3b8',
        fontSize: '1.1rem',
      }}>
        読み込み中...
      </div>
    );
  }

  // Show login if not authenticated
  if (!authenticated) {
    return <Login onLogin={() => setAuthenticated(true)} />;
  }

  return (
    <div className="app-container">
      <button className="logout-button" onClick={handleLogout} title="ログアウト">
        🔓
      </button>
      <button className="print-button" onClick={handlePrint}>
        🖨️ 印刷
      </button>
      <button className="theme-toggle" onClick={toggleTheme} title={theme === 'light' ? 'ダークモード' : 'ライトモード'}>
        {theme === 'light' ? '🌙' : '☀️'}
      </button>
      <Dashboard />
    </div>
  )
}

export default App
