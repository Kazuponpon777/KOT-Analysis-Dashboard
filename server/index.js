const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cookieSession = require('cookie-session');
const path = require('path');
const { sendReport } = require('./emailReport');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy (Required for Vercel/Heroku/Render)
app.set('trust proxy', 1);

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Session Configuration (Stateless / Cookie-based)
app.use(cookieSession({
    name: 'kot-session',
    keys: [process.env.SESSION_SECRET || 'secret-key'],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: process.env.NODE_ENV === 'production', // true on Vercel
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' for cross-site (if needed) or 'lax'
    httpOnly: true
}));

// ================================================================
// Auth Routes
// ================================================================
app.get('/api/auth/status', (req, res) => {
    if (req.session && req.session.authenticated) {
        res.json({ authenticated: true });
    } else {
        res.json({ authenticated: false });
    }
});

app.post('/api/auth/login', (req, res) => {
    const { password } = req.body;
    if (password === process.env.DASHBOARD_PASSWORD) {
        req.session.authenticated = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'パスワードが間違っています' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session = null; // Clear cookie-session
    res.json({ success: true });
});

// Auth middleware — protect /api/* routes (except auth routes)
const requireAuth = (req, res, next) => {
    // Skip auth check for auth routes and health check
    if (req.path.startsWith('/auth/') || req.path === '/health') {
        return next();
    }
    // Allow admin API invocation with password in header (for GitHub Actions)
    if (req.path === '/admin/send-report') {
        const authHeader = req.headers.authorization || '';
        if (authHeader === `Bearer ${process.env.DASHBOARD_PASSWORD}`) {
            return next();
        }
    }

    if (!req.session || !req.session.authenticated) {
        return res.status(401).json({ error: '認証が必要です' });
    }
    next();
};

app.use('/api', requireAuth);

// ================================================================
// Admin API (Triggered by GitHub Actions)
// ================================================================
app.post('/api/admin/send-report', async (req, res) => {
    console.log('[Admin] Manual trigger received for email report.');
    try {
        await sendReport();
        res.json({ success: true, message: 'Email report triggered.' });
    } catch (e) {
        console.error('[Admin] Failed to send report:', e);
        res.status(500).json({ error: e.message });
    }
});

// ================================================================
// KING OF TIME API Configuration
// ================================================================
const KOT_API_BASE_URL = 'https://api.kingtime.jp/v1.0';
const KOT_API_KEY = process.env.KOT_API_KEY;

// Log API Key status (do not log the actual key in production)
console.log(`KOT_API_KEY is ${KOT_API_KEY ? 'set' : 'missing'}`);

// API Proxy endpoints
app.get('/api/employees', async (req, res) => {
    try {
        const response = await axios.get(`${KOT_API_BASE_URL}/employees`, {
            headers: {
                'Authorization': `Bearer ${KOT_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching employees:', error.message);
        res.status(error.response?.status || 500).json({ error: 'Failed to fetch employees' });
    }
});

app.get('/api/monthly-workings', async (req, res) => {
    try {
        const response = await axios.get(`${KOT_API_BASE_URL}/monthly-workings`, {
            params: req.query,
            headers: {
                'Authorization': `Bearer ${KOT_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching monthly workings:', error.message);
        res.status(error.response?.status || 500).json({ error: 'Failed to fetch monthly workings' });
    }
});

app.get('/api/daily-schedules', async (req, res) => {
    try {
        const response = await axios.get(`${KOT_API_BASE_URL}/daily-schedules`, {
            params: req.query,
            headers: {
                'Authorization': `Bearer ${KOT_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching daily schedules:', error.message);
        res.status(error.response?.status || 500).json({ error: 'Failed to fetch daily schedules' });
    }
});

app.get('/api/daily-workings', async (req, res) => {
    try {
        const response = await axios.get(`${KOT_API_BASE_URL}/daily-workings`, {
            params: req.query,
            headers: {
                'Authorization': `Bearer ${KOT_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching daily workings:', error.message);
        res.status(error.response?.status || 500).json({ error: 'Failed to fetch daily workings' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend static build files (from client/dist which Vercel puts at root or adjacent)
const clientBuildPath = path.join(__dirname, '../client/dist');

// Fallback: serve index.html for all non-API routes (SPA routing)
if (require.main === module) {
    app.use(express.static(clientBuildPath));
}

app.get('{*splat}', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// Start Server (only if running locally)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}

module.exports = app;
