import React, { useState, useEffect } from 'react';
import OvertimeRanking from './OvertimeRanking';
import AnnualOvertime from './AnnualOvertime';
import ComplianceAlerts from './ComplianceAlerts';
import Article36Check from './Article36Check';
import OvertimeTrend from './OvertimeTrend';
import DepartmentSummary from './DepartmentSummary';
import EmployeeDetail from './EmployeeDetail';

const Dashboard = () => {
    const [employees, setEmployees] = useState([]);
    const [monthlyData, setMonthlyData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedMonthOffset, setSelectedMonthOffset] = useState(0);
    const [selectedEmployee, setSelectedEmployee] = useState(null);

    const handleSelectEmployee = (empKey) => {
        const emp = employees.find(e => e.key === empKey);
        if (emp) setSelectedEmployee(emp);
    };

    const getMonthInfo = (offset) => {
        const now = new Date();
        const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        return { year, month };
    };

    const currentPeriod = getMonthInfo(selectedMonthOffset);

    // Fetch with retry and exponential backoff
    const fetchWithRetry = async (url, retries = 3, delay = 1000) => {
        for (let i = 0; i < retries; i++) {
            try {
                const res = await fetch(url, { credentials: 'include' });
                if (res.ok) return res;
                if (res.status === 401) throw new Error('認証が必要です');
                if (res.status === 429 || res.status >= 500) {
                    await new Promise(r => setTimeout(r, delay * Math.pow(2, i)));
                    continue;
                }
                throw new Error(`HTTP ${res.status}`);
            } catch (err) {
                if (i === retries - 1) throw err;
                await new Promise(r => setTimeout(r, delay * Math.pow(2, i)));
            }
        }
    };

    // Cache helpers
    const CACHE_KEY = 'kot-dashboard-cache';
    const saveToCache = (empData, workData, period) => {
        try {
            const cacheData = { employees: empData, monthlyData: workData, period, timestamp: Date.now() };
            localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        } catch (e) { /* ignore quota errors */ }
    };
    const loadFromCache = () => {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) return JSON.parse(cached);
        } catch (e) { /* ignore */ }
        return null;
    };

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            // Fiscal Year starts April (4)
            let fiscalYearStartYear = currentPeriod.year;
            if (currentPeriod.month < 4) {
                fiscalYearStartYear -= 1;
            }

            const monthsToFetch = [];
            const start = new Date(fiscalYearStartYear, 3, 1); // April 1st
            const target = new Date(currentPeriod.year, currentPeriod.month - 1, 1);

            // Fetch from the start of the current fiscal year up to the selected month
            let runner = new Date(start);
            while (runner <= target) {
                monthsToFetch.push({
                    year: runner.getFullYear(),
                    month: runner.getMonth() + 1
                });
                runner.setMonth(runner.getMonth() + 1);
                if (monthsToFetch.length > 24) break;
            }

            // Also ensure we have the last 6 months for the AnnualOvertime/Ranking trends
            // regardless of the fiscal year boundary
            const trendStart = new Date(target);
            trendStart.setMonth(trendStart.getMonth() - 5);
            let trendRunner = new Date(trendStart);
            while (trendRunner < start) {
                if (!monthsToFetch.some(m => m.year === trendRunner.getFullYear() && m.month === trendRunner.getMonth() + 1)) {
                    monthsToFetch.unshift({
                        year: trendRunner.getFullYear(),
                        month: trendRunner.getMonth() + 1
                    });
                }
                trendRunner.setMonth(trendRunner.getMonth() + 1);
            }

            const [empRes, ...workResponses] = await Promise.all([
                fetchWithRetry('/api/employees'),
                ...monthsToFetch.map(d =>
                    fetchWithRetry(`/api/monthly-workings?year=${d.year}&month=${d.month}`)
                )
            ]);

            if (!empRes.ok) throw new Error('Employees API failed');
            const empData = await empRes.json();
            const allWorkings = [];
            for (const res of workResponses) {
                if (res.ok) {
                    const data = await res.json();
                    allWorkings.push(...data);
                }
            }
            setEmployees(empData);
            setMonthlyData(allWorkings);
            saveToCache(empData, allWorkings, currentPeriod);
        } catch (err) {
            console.error('Fetch error:', err);
            // Try loading from cache as fallback
            const cached = loadFromCache();
            if (cached && cached.employees.length > 0) {
                setEmployees(cached.employees);
                setMonthlyData(cached.monthlyData);
                setError(`⚠️ キャッシュデータを表示中（${new Date(cached.timestamp).toLocaleString('ja-JP')}時点）`);
            } else {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedMonthOffset]);

    // Auto-refresh every 5 minutes
    useEffect(() => {
        const interval = setInterval(() => {
            fetchData();
        }, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [selectedMonthOffset]);

    if (loading) return <div style={{ padding: '60px', textAlign: 'center', fontSize: '1.2rem', color: '#6b7280' }}>データを取得中...</div>;
    if (error) return <div style={{ padding: '40px', color: '#e11d48', textAlign: 'center' }}>エラー: {error}</div>;

    // Filter for the specific month's ranking (>= 20h)
    const rankingData = monthlyData.filter(d =>
        d.year === currentPeriod.year &&
        d.month === currentPeriod.month &&
        ((d.overtime || 0) + (d.holidayWork?.overtime || 0)) >= 1200
    );

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px' }}>
            <header style={{ marginBottom: '40px', textAlign: 'center', position: 'relative' }}>
                <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '10px' }}>
                    <button
                        onClick={() => setSelectedMonthOffset(prev => prev - 1)}
                        style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#fff', cursor: 'pointer' }}
                    >
                        ◀ 前月
                    </button>
                    <button
                        onClick={() => setSelectedMonthOffset(prev => prev + 1)}
                        style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#fff', cursor: 'pointer' }}
                    >
                        次月 ▶
                    </button>
                    {selectedMonthOffset !== 0 && (
                        <button
                            onClick={() => setSelectedMonthOffset(0)}
                            style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#6366f1', color: '#fff', cursor: 'pointer' }}
                        >
                            今月に戻る
                        </button>
                    )}
                </div>

                <div style={{ fontSize: '1.2rem', color: '#6b7280', fontWeight: '500' }}>勤怠分析レポート</div>
                <h1 style={{ fontSize: '3.5rem', color: '#111827', margin: '10px 0', fontWeight: '900' }}>
                    {currentPeriod.month}月度
                </h1>
                <div style={{ color: '#9ca3af', fontSize: '1rem' }}>
                    集計期間: {currentPeriod.month === 1 ? 12 : currentPeriod.month - 1}月26日 〜 {currentPeriod.month}月25日
                </div>
            </header>

            <div style={{ display: 'grid', gap: '50px' }}>
                <section>
                    <AnnualOvertime monthlyData={monthlyData} employees={employees} />
                </section>

                <section>
                    <OvertimeRanking
                        monthlyData={rankingData}
                        employees={employees}
                    />
                </section>

                <section>
                    <OvertimeTrend
                        monthlyData={monthlyData}
                        employees={employees}
                        currentPeriod={currentPeriod}
                    />
                </section>

                <section>
                    <Article36Check
                        monthlyData={monthlyData}
                        employees={employees}
                        currentPeriod={currentPeriod}
                        onSelectEmployee={handleSelectEmployee}
                    />
                </section>

                <section>
                    <DepartmentSummary
                        monthlyData={monthlyData}
                        employees={employees}
                        currentPeriod={currentPeriod}
                    />
                </section>

                <section>
                    <ComplianceAlerts
                        monthlyData={monthlyData}
                        employees={employees}
                        currentPeriod={currentPeriod}
                        onSelectEmployee={handleSelectEmployee}
                    />
                </section>
            </div>

            {selectedEmployee && (
                <EmployeeDetail
                    employee={selectedEmployee}
                    monthlyData={monthlyData}
                    onClose={() => setSelectedEmployee(null)}
                />
            )}
        </div>
    );
};

export default Dashboard;
