
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const session = require('express-session');
const path = require('path');
const { sendReport } = require('./emailReport');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'kot-analysis-secret-key-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production' && process.env.RENDER === 'true',
        httpOnly: true,
        maxAge: 8 * 60 * 60 * 1000, // 8 hours
        sameSite: 'lax',
    },
}));

// ================================================================
// Authentication
// ================================================================
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'admin';

// Login endpoint
app.post('/api/auth/login', (req, res) => {
    const { password } = req.body;
    if (password === DASHBOARD_PASSWORD) {
        req.session.authenticated = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'パスワードが正しくありません' });
    }
});

// Check auth status
app.get('/api/auth/status', (req, res) => {
    res.json({ authenticated: !!req.session.authenticated });
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Auth middleware — protect /api/* routes (except auth routes)
const requireAuth = (req, res, next) => {
    // Skip auth check for auth routes and health check
    // Since mounted on /api, req.path will be relative (e.g. '/health')
    if (req.path.startsWith('/auth/') || req.path === '/health') {
        return next();
    }
    // Allow admin API invocation with password in header (for GitHub Actions)
    if (req.path === '/admin/send-report' && req.headers.authorization === `Bearer ${DASHBOARD_PASSWORD}`) {
        return next();
    }
    if (!req.session.authenticated) {
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

console.log(`KOT_API_KEY is ${KOT_API_KEY ? 'set' : 'missing'}`);

// Health Check Endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'KOT Analysis Server is running' });
});

// Proxy Endpoint to get Employees
app.get('/api/employees', async (req, res) => {
    if (!KOT_API_KEY) {
        return res.status(500).json({ error: 'API Key is missing in server configuration' });
    }

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
        res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed to connect' });
    }
});

// Proxy Endpoint to get Monthly Workings
app.get('/api/monthly-workings', async (req, res) => {
    const { date, year, month } = req.query;

    let dateParam = date;
    if (!dateParam && year && month) {
        dateParam = `${year}-${String(month).padStart(2, '0')}`;
    }

    if (!dateParam) {
        return res.status(400).json({ error: 'date (YYYY-MM) parameter is required' });
    }

    try {
        const response = await axios.get(`${KOT_API_BASE_URL}/monthly-workings`, {
            params: { date: dateParam },
            headers: {
                'Authorization': `Bearer ${KOT_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error(`Error fetching monthly workings for ${dateParam}:`, error.message);
        res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed to connect' });
    }
});

// Proxy Endpoint to get Leave Managements
app.get('/api/leave-managements', async (req, res) => {
    const { leaveCode } = req.query;
    const url = leaveCode
        ? `${KOT_API_BASE_URL}/leave-managements/${leaveCode}`
        : `${KOT_API_BASE_URL}/leave-managements`;

    try {
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${KOT_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching leave details:', error.message);
        res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed to connect' });
    }
});

// ================================================================
// Serve React Frontend (Production)
// ================================================================
const clientBuildPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientBuildPath));

// Fallback: serve index.html for all non-API routes (SPA routing)
app.get('{*splat}', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
