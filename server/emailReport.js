/**
 * KOT 勤怠分析 — 週次メールレポート
 * 毎週金曜日にコンプライアンスアラートをメールで送信
 */
const nodemailer = require('nodemailer');
const axios = require('axios');
require('dotenv').config({ path: __dirname + '/.env' });

// ================================================================
// メール送信設定
// ================================================================
const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
        tls: {
            rejectUnauthorized: false,
        },
    });
};

const KOT_API_BASE_URL = 'https://api.kingtime.jp/v1.0';
const KOT_API_KEY = process.env.KOT_API_KEY;

// Helper for KOT API calls
const callKotApi = async (endpoint, params = {}) => {
    if (!KOT_API_KEY) throw new Error('KOT_API_KEY is not set');
    return axios.get(`${KOT_API_BASE_URL}${endpoint}`, {
        params,
        headers: {
            'Authorization': `Bearer ${KOT_API_KEY}`,
            'Content-Type': 'application/json'
        }
    });
};

// ================================================================
// データ取得
// ================================================================
const getCurrentPeriod = () => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
};

const fetchData = async () => {
    const period = getCurrentPeriod();
    let fiscalYearStartYear = period.year;
    if (period.month < 4) fiscalYearStartYear -= 1;

    // Fetch employees from KOT API
    const empRes = await callKotApi('/employees');
    const employees = empRes.data;

    // Fetch monthly workings for the fiscal year
    const monthsToFetch = [];
    const start = new Date(fiscalYearStartYear, 3, 1);
    const target = new Date(period.year, period.month - 1, 1);
    let runner = new Date(start);
    while (runner <= target) {
        monthsToFetch.push({ year: runner.getFullYear(), month: runner.getMonth() + 1 });
        runner.setMonth(runner.getMonth() + 1);
        if (monthsToFetch.length > 24) break;
    }

    const workPromises = monthsToFetch.map(d =>
        callKotApi('/monthly-workings', { date: `${d.year}-${String(d.month).padStart(2, '0')}` })
            .catch(err => {
                console.warn(`Failed to fetch data for ${d.year}-${d.month}:`, err.message);
                return { data: [] };
            })
    );
    const workResults = await Promise.all(workPromises);
    const monthlyData = workResults.flatMap(r => r.data || []);

    return { employees, monthlyData, period };
};

// ================================================================
// コンプライアンス分析
// ================================================================
const analyzeCompliance = (employees, monthlyData, period) => {
    let fiscalYearStartYear = period.year;
    if (period.month < 4) fiscalYearStartYear -= 1;

    // Deduplicate
    const dedupedMap = new Map();
    monthlyData.forEach(work => {
        const key = `${work.employeeKey}_${work.year}_${work.month}`;
        if (!dedupedMap.has(key)) dedupedMap.set(key, work);
    });

    // ============================================
    // 当月残業データ（全社員）
    // ============================================
    const currentMonthData = [];
    employees.forEach(emp => {
        const key = `${emp.key}_${period.year}_${period.month}`;
        const work = dedupedMap.get(key);
        const name = `${emp.lastName || ''} ${emp.firstName || ''}`.trim();
        const division = emp.divisionName || '不明';
        const overtimeMin = work ? ((work.overtime || 0) + (work.holidayWork?.overtime || 0)) : 0;
        const overtimeHours = overtimeMin / 60;
        currentMonthData.push({ name, division, overtimeHours, overtimeMin });
    });
    // Sort by overtime descending
    currentMonthData.sort((a, b) => b.overtimeHours - a.overtimeHours);

    // Calculate company average for current month
    const totalOvertimeHours = currentMonthData.reduce((s, e) => s + e.overtimeHours, 0);
    const companyAvgHours = currentMonthData.length > 0 ? totalOvertimeHours / currentMonthData.length : 0;
    const over45Count_currentMonth = currentMonthData.filter(e => e.overtimeHours > 45).length;
    const over80Count_currentMonth = currentMonthData.filter(e => e.overtimeHours > 80).length;

    // ============================================
    // 年度累計分析（Per-employee）
    // ============================================
    const empOvertime = {};
    dedupedMap.forEach(work => {
        const emp = employees.find(e => e.key === work.employeeKey);
        if (!emp) return;
        const isCurrentFY = (work.year === fiscalYearStartYear && work.month >= 4) ||
            (work.year > fiscalYearStartYear && (work.year < period.year || (work.year === period.year && work.month <= period.month)));
        if (!isCurrentFY) return;

        const key = work.employeeKey;
        if (!empOvertime[key]) {
            empOvertime[key] = {
                name: `${emp.lastName || ''} ${emp.firstName || ''}`.trim(),
                division: emp.divisionName || '不明',
                totalMinutes: 0,
                monthlyHours: [],
            };
        }
        const hours = ((work.overtime || 0) + (work.holidayWork?.overtime || 0)) / 60;
        empOvertime[key].totalMinutes += (work.overtime || 0) + (work.holidayWork?.overtime || 0);
        empOvertime[key].monthlyHours.push(hours);
    });

    // Build alerts
    const alerts = { danger: [], warning: [], caution: [] };

    Object.entries(empOvertime).forEach(([key, data]) => {
        const annualHours = data.totalMinutes / 60;
        const over45Count = data.monthlyHours.filter(h => h > 45).length;
        const over100 = data.monthlyHours.some(h => h >= 100);
        const annualProgress = (annualHours / 720) * 100;

        if (over100 || over45Count > 6 || annualProgress > 90) {
            alerts.danger.push({ ...data, annualHours, over45Count, annualProgress });
        } else if (over45Count > 4 || annualProgress > 75) {
            alerts.warning.push({ ...data, annualHours, over45Count, annualProgress });
        } else if (over45Count > 0 || annualProgress > 50) {
            alerts.caution.push({ ...data, annualHours, over45Count, annualProgress });
        }
    });

    // Paid leave check
    const paidLeaveAlerts = [];
    const fyEndMonth = 3;
    const fyEndYear = fiscalYearStartYear + 1;
    const monthsRemaining = (fyEndYear - period.year) * 12 + (fyEndMonth - period.month);

    employees.forEach(emp => {
        const empWorks = [...dedupedMap.values()].filter(w => w.employeeKey === emp.key);
        let totalPaidLeave = 0;
        empWorks.forEach(w => {
            if (w.holidaysObtained) {
                w.holidaysObtained.forEach(h => {
                    if (h.code === 1 || h.name === '有休') totalPaidLeave += h.dayCount || 0;
                });
            }
        });
        if (totalPaidLeave < 5) {
            paidLeaveAlerts.push({
                name: `${emp.lastName || ''} ${emp.firstName || ''}`.trim(),
                division: emp.divisionName || '不明',
                used: totalPaidLeave,
                remaining: 5 - totalPaidLeave,
            });
        }
    });

    return {
        currentMonthData,
        companyAvgHours,
        over45Count_currentMonth,
        over80Count_currentMonth,
        alerts,
        paidLeaveAlerts,
        period,
        monthsRemaining,
    };
};

// ================================================================
// HTMLメール生成
// ================================================================
const generateEmailHTML = (analysis) => {
    const {
        currentMonthData, companyAvgHours, over45Count_currentMonth, over80Count_currentMonth,
        alerts, paidLeaveAlerts, period, monthsRemaining
    } = analysis;
    const totalAlerts = alerts.danger.length + alerts.warning.length + alerts.caution.length;

    // ============================================
    // 当月残業テーブル行の生成
    // ============================================
    const getBarColor = (hours) => {
        if (hours >= 80) return '#dc2626';
        if (hours >= 45) return '#f59e0b';
        if (hours >= 30) return '#3b82f6';
        return '#10b981';
    };
    const getBarWidth = (hours) => Math.min(Math.round((hours / 100) * 100), 100);

    const currentMonthRows = currentMonthData.map((emp, i) => {
        const color = getBarColor(emp.overtimeHours);
        const barW = getBarWidth(emp.overtimeHours);
        const bg = i % 2 === 0 ? '#ffffff' : '#f9fafb';
        const statusIcon = emp.overtimeHours >= 80 ? '🔴' : emp.overtimeHours >= 45 ? '🟡' : emp.overtimeHours >= 30 ? '🔵' : '🟢';
        return `
            <tr style="background-color: ${bg};">
                <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0; font-size: 13px; white-space: nowrap;">${emp.name}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0; font-size: 12px; color: #6b7280; white-space: nowrap;">${emp.division}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0; width: 40%;">
                    <div style="background-color: #f3f4f6; border-radius: 4px; height: 20px; position: relative; overflow: hidden;">
                        <div style="background-color: ${color}; height: 100%; width: ${barW}%; border-radius: 4px; transition: width 0.3s;"></div>
                    </div>
                </td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0; text-align: right; font-weight: 700; font-size: 14px; color: ${color}; white-space: nowrap;">${emp.overtimeHours.toFixed(1)}h</td>
                <td style="padding: 8px 4px; border-bottom: 1px solid #f0f0f0; text-align: center; font-size: 14px;">${statusIcon}</td>
            </tr>`;
    }).join('');

    // ============================================
    // 36協定アラート行の生成
    // ============================================
    const alertRow = (emp, level) => {
        const colors = {
            danger: { bg: '#fef2f2', badge: '#dc2626', label: '🚨 違反リスク' },
            warning: { bg: '#fffbeb', badge: '#f59e0b', label: '⚠️ 要注意' },
            caution: { bg: '#eff6ff', badge: '#3b82f6', label: '📋 経過観察' },
        };
        const c = colors[level];
        return `
            <tr style="background-color: ${c.bg};">
                <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">
                    <span style="background-color: ${c.badge}; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700;">${c.label}</span>
                </td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${emp.name}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${emp.division}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 700; color: ${emp.annualHours > 600 ? '#dc2626' : '#374151'};">${emp.annualHours.toFixed(1)}h</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${emp.over45Count}回</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${emp.annualProgress.toFixed(0)}%</td>
            </tr>`;
    };

    const allAlertRows = [
        ...alerts.danger.map(e => alertRow(e, 'danger')),
        ...alerts.warning.map(e => alertRow(e, 'warning')),
        ...alerts.caution.map(e => alertRow(e, 'caution')),
    ].join('');

    const paidLeaveRows = paidLeaveAlerts.map(e => `
        <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${e.name}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${e.division}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 700; color: ${e.used < 3 ? '#dc2626' : '#f59e0b'};">${e.used}日</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 700;">${e.remaining}日</td>
        </tr>
    `).join('');

    // ============================================
    // HTMLメール組み立て
    // ============================================
    return `
    <!DOCTYPE html>
    <html lang="ja">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="font-family: -apple-system, 'Segoe UI', 'Hiragino Sans', sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px;">
        <div style="max-width: 700px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">

            <!-- ========== Header ========== -->
            <div style="background: linear-gradient(135deg, #1e40af, #7c3aed); padding: 28px 30px; color: #fff;">
                <h1 style="margin: 0; font-size: 1.4rem; font-weight: 800;">📊 KOT 勤怠分析レポート</h1>
                <p style="margin: 8px 0 0; opacity: 0.85; font-size: 0.85rem;">${period.year}年${period.month}月度 | 年度残り${monthsRemaining}ヶ月</p>
            </div>

            <!-- ========== 当月サマリーカード ========== -->
            <div style="padding: 20px 30px; background-color: #f8fafc; border-bottom: 1px solid #e5e7eb;">
                <table style="width: 100%; border-collapse: collapse;" cellpadding="0" cellspacing="0">
                    <tr>
                        <td style="text-align: center; padding: 12px 8px; width: 25%;">
                            <div style="font-size: 1.8rem; font-weight: 900; color: #1e40af;">${companyAvgHours.toFixed(1)}<span style="font-size: 0.8rem;">h</span></div>
                            <div style="font-size: 0.7rem; color: #6b7280; margin-top: 4px;">全社平均</div>
                        </td>
                        <td style="text-align: center; padding: 12px 8px; width: 25%;">
                            <div style="font-size: 1.8rem; font-weight: 900; color: #374151;">${currentMonthData.length}</div>
                            <div style="font-size: 0.7rem; color: #6b7280; margin-top: 4px;">対象社員</div>
                        </td>
                        <td style="text-align: center; padding: 12px 8px; width: 25%;">
                            <div style="font-size: 1.8rem; font-weight: 900; color: ${over45Count_currentMonth > 0 ? '#f59e0b' : '#10b981'};">${over45Count_currentMonth}</div>
                            <div style="font-size: 0.7rem; color: #6b7280; margin-top: 4px;">45h超過</div>
                        </td>
                        <td style="text-align: center; padding: 12px 8px; width: 25%;">
                            <div style="font-size: 1.8rem; font-weight: 900; color: ${over80Count_currentMonth > 0 ? '#dc2626' : '#10b981'};">${over80Count_currentMonth}</div>
                            <div style="font-size: 0.7rem; color: #6b7280; margin-top: 4px;">80h超過</div>
                        </td>
                    </tr>
                </table>
            </div>

            <!-- ========== 当月 残業一覧（メイン） ========== -->
            <div style="padding: 25px 30px;">
                <h2 style="margin: 0 0 4px; font-size: 1.15rem; color: #111827; font-weight: 800;">📋 ${period.month}月度 残業時間一覧</h2>
                <p style="margin: 0 0 16px; font-size: 0.75rem; color: #9ca3af;">残業時間の多い順 ｜ 🔴80h超過 🟡45h超過 🔵30h超過 🟢正常</p>
                <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                    <thead>
                        <tr style="background-color: #f1f5f9;">
                            <th style="padding: 8px 12px; text-align: left; color: #475569; border-bottom: 2px solid #e2e8f0; font-size: 12px;">氏名</th>
                            <th style="padding: 8px 12px; text-align: left; color: #475569; border-bottom: 2px solid #e2e8f0; font-size: 12px;">部署</th>
                            <th style="padding: 8px 12px; text-align: left; color: #475569; border-bottom: 2px solid #e2e8f0; font-size: 12px;">残業</th>
                            <th style="padding: 8px 12px; text-align: right; color: #475569; border-bottom: 2px solid #e2e8f0; font-size: 12px;">時間</th>
                            <th style="padding: 8px 4px; text-align: center; color: #475569; border-bottom: 2px solid #e2e8f0; font-size: 12px;"></th>
                        </tr>
                    </thead>
                    <tbody>${currentMonthRows}</tbody>
                </table>
            </div>

            <!-- ========== 区切り線 ========== -->
            <div style="padding: 0 30px;"><hr style="border: none; border-top: 2px solid #e5e7eb; margin: 0;"></div>

            <!-- ========== 36協定アラート ========== -->
            <div style="padding: 25px 30px;">
                <h2 style="margin: 0 0 4px; font-size: 1.05rem; color: #111827; font-weight: 800;">⚖️ 36協定 年間コンプライアンス</h2>
                <p style="margin: 0 0 16px; font-size: 0.75rem; color: #9ca3af;">年間720h上限 ｜ 特別条項は年6回まで</p>
                ${totalAlerts === 0 ? '<p style="color: #10b981; text-align: center; padding: 16px; font-weight: 600;">✅ 全社員が36協定の範囲内です</p>' : `
                <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem;">
                    <thead>
                        <tr style="background-color: #f1f5f9;">
                            <th style="padding: 8px 12px; text-align: left; color: #475569; border-bottom: 2px solid #e2e8f0; font-size: 11px;">レベル</th>
                            <th style="padding: 8px 12px; text-align: left; color: #475569; border-bottom: 2px solid #e2e8f0; font-size: 11px;">氏名</th>
                            <th style="padding: 8px 12px; text-align: left; color: #475569; border-bottom: 2px solid #e2e8f0; font-size: 11px;">部署</th>
                            <th style="padding: 8px 12px; text-align: right; color: #475569; border-bottom: 2px solid #e2e8f0; font-size: 11px;">年間残業</th>
                            <th style="padding: 8px 12px; text-align: center; color: #475569; border-bottom: 2px solid #e2e8f0; font-size: 11px;">45h超</th>
                            <th style="padding: 8px 12px; text-align: right; color: #475569; border-bottom: 2px solid #e2e8f0; font-size: 11px;">720h進捗</th>
                        </tr>
                    </thead>
                    <tbody>${allAlertRows}</tbody>
                </table>`}
            </div>

            <!-- ========== 有給5日取得義務 ========== -->
            ${paidLeaveAlerts.length > 0 ? `
            <div style="padding: 0 30px;"><hr style="border: none; border-top: 2px solid #e5e7eb; margin: 0;"></div>
            <div style="padding: 25px 30px;">
                <h2 style="margin: 0 0 4px; font-size: 1.05rem; color: #111827; font-weight: 800;">🌴 有給5日取得義務 — 未達者</h2>
                <p style="margin: 0 0 16px; font-size: 0.75rem; color: #9ca3af;">年度末（3月）までに5日取得が必要</p>
                <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem;">
                    <thead>
                        <tr style="background-color: #f1f5f9;">
                            <th style="padding: 8px 12px; text-align: left; color: #475569; border-bottom: 2px solid #e2e8f0; font-size: 11px;">氏名</th>
                            <th style="padding: 8px 12px; text-align: left; color: #475569; border-bottom: 2px solid #e2e8f0; font-size: 11px;">部署</th>
                            <th style="padding: 8px 12px; text-align: center; color: #475569; border-bottom: 2px solid #e2e8f0; font-size: 11px;">取得済</th>
                            <th style="padding: 8px 12px; text-align: center; color: #475569; border-bottom: 2px solid #e2e8f0; font-size: 11px;">残り必要</th>
                        </tr>
                    </thead>
                    <tbody>${paidLeaveRows}</tbody>
                </table>
            </div>` : ''}

            <!-- ========== Footer ========== -->
            <div style="padding: 15px 30px; background-color: #f8fafc; border-top: 1px solid #e5e7eb; font-size: 0.72rem; color: #9ca3af; text-align: center;">
                KOT勤怠分析システム — 自動配信 | ${new Date().toLocaleString('ja-JP')}
            </div>
        </div>
    </body>
    </html>`;
};

// ================================================================
// メール送信
// ================================================================
const sendReport = async () => {
    console.log('[EmailReport] Generating weekly report...');

    try {
        const { employees, monthlyData, period } = await fetchData();
        const analysis = analyzeCompliance(employees, monthlyData, period);
        const html = generateEmailHTML(analysis);

        const totalAlerts = analysis.alerts.danger.length + analysis.alerts.warning.length + analysis.alerts.caution.length;
        const subject = totalAlerts > 0
            ? `[重要] KOT勤怠アラート: ${analysis.alerts.danger.length}件の違反リスク — ${period.year}年${period.month}月`
            : `✅ KOT勤怠レポート — ${period.year}年${period.month}月（問題なし）`;

        const transporter = createTransporter();
        const recipients = (process.env.MAIL_TO || '').split(',').filter(Boolean);

        if (recipients.length === 0) {
            console.log('[EmailReport] No recipients configured. Skipping send.');
            console.log('[EmailReport] Set MAIL_TO in .env to enable email delivery.');
            return;
        }

        await transporter.sendMail({
            from: process.env.MAIL_FROM || 'KOT Analysis <noreply@example.com>',
            to: recipients.join(', '),
            subject,
            html,
        });

        console.log(`[EmailReport] Report sent to: ${recipients.join(', ')}`);
    } catch (err) {
        console.error('[EmailReport] Failed:', err.message);
    }
};

module.exports = { sendReport, generateEmailHTML, analyzeCompliance, fetchData };
