import React, { useState, useEffect } from 'react'
import Dashboard from './components/Dashboard'
import Login from './components/Login'
import './App.css'

function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('kot-theme') || 'light';
  });
  const [authenticated, setAuthenticated] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check auth status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/status', {
          // Important: Send credentials to check session cookie
          credentials: 'include'
        });
        const data = await res.json();
        if (data.authenticated) {
          setAuthenticated(true);
        } else {
          setAuthenticated(false);
        }
      } catch (e) {
        setAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
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
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      setAuthenticated(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Loading check
  if (loading) {
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
