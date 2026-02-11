import React, { useState } from 'react';

const Login = ({ onLogin }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ password }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                onLogin();
            } else {
                setError(data.error || 'ログインに失敗しました');
            }
        } catch (err) {
            setError('サーバーに接続できません');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
            padding: '20px',
        }}>
            <div style={{
                width: '100%',
                maxWidth: '400px',
                backgroundColor: '#fff',
                borderRadius: '16px',
                padding: '48px 40px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
            }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '64px',
                        height: '64px',
                        borderRadius: '16px',
                        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                        marginBottom: '16px',
                        fontSize: '1.8rem',
                    }}>
                        📊
                    </div>
                    <h1 style={{
                        fontSize: '1.5rem',
                        fontWeight: '800',
                        color: '#111827',
                        margin: '0 0 8px',
                    }}>
                        KOT 勤怠分析
                    </h1>
                    <p style={{
                        fontSize: '0.85rem',
                        color: '#6b7280',
                        margin: 0,
                    }}>
                        ダッシュボードにアクセスするには<br />パスワードを入力してください
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            color: '#374151',
                            marginBottom: '6px',
                        }}>
                            パスワード
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="パスワードを入力"
                            autoFocus
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                border: `2px solid ${error ? '#ef4444' : '#e5e7eb'}`,
                                borderRadius: '10px',
                                fontSize: '1rem',
                                outline: 'none',
                                transition: 'border-color 0.2s',
                                boxSizing: 'border-box',
                            }}
                            onFocus={(e) => {
                                if (!error) e.target.style.borderColor = '#3b82f6';
                            }}
                            onBlur={(e) => {
                                if (!error) e.target.style.borderColor = '#e5e7eb';
                            }}
                        />
                    </div>

                    {error && (
                        <div style={{
                            padding: '10px 14px',
                            backgroundColor: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: '8px',
                            color: '#dc2626',
                            fontSize: '0.85rem',
                            marginBottom: '16px',
                            textAlign: 'center',
                        }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !password}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: loading || !password
                                ? '#d1d5db'
                                : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '10px',
                            fontSize: '1rem',
                            fontWeight: '700',
                            cursor: loading || !password ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        {loading ? 'ログイン中...' : 'ログイン'}
                    </button>
                </form>

                <p style={{
                    fontSize: '0.7rem',
                    color: '#9ca3af',
                    textAlign: 'center',
                    marginTop: '24px',
                    marginBottom: 0,
                }}>
                    🔒 このシステムは権限のある方のみ利用できます
                </p>

                {/* Debug Button */}
                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <button
                        type="button"
                        onClick={async () => {
                            try {
                                const res = await fetch('/api/auth/debug', { credentials: 'include' });
                                const data = await res.json();
                                alert(JSON.stringify(data, null, 2));
                            } catch (e) {
                                alert('Debug fetch failed: ' + e.message);
                            }
                        }}
                        style={{
                            background: 'transparent',
                            border: '1px solid #e5e7eb',
                            color: '#6b7280',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            cursor: 'pointer'
                        }}
                    >
                        🛠️ 接続診断
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;
