import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer } from 'recharts';

const OvertimeTrend = ({ monthlyData, employees, currentPeriod }) => {
    // Build monthly averages and top employees for the last 6 months
    const months = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(currentPeriod.year, currentPeriod.month - 1 - i, 1);
        months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }

    // Deduplicate
    const dedupedMap = new Map();
    monthlyData.forEach(work => {
        const uniqueKey = `${work.employeeKey}_${work.year}_${work.month}`;
        if (!dedupedMap.has(uniqueKey) || (work.workingdayCount || 0) > (dedupedMap.get(uniqueKey).workingdayCount || 0)) {
            dedupedMap.set(uniqueKey, work);
        }
    });

    // Calculate per-employee per-month overtime
    const employeeMonthly = {};
    dedupedMap.forEach(work => {
        const key = work.employeeKey;
        const employee = employees.find(e => e.key === key);
        if (!employee) return;

        const name = `${employee.lastName || ''} ${employee.firstName || ''}`.trim();
        if (!employeeMonthly[key]) {
            employeeMonthly[key] = { name, months: {} };
        }
        const overtimeHours = ((work.overtime || 0) + (work.holidayWork?.overtime || 0)) / 60;
        employeeMonthly[key].months[`${work.year}-${String(work.month).padStart(2, '0')}`] = overtimeHours;
    });

    // Find top 3 by total overtime in the 6-month window
    const monthKeys = months.map(m => `${m.year}-${String(m.month).padStart(2, '0')}`);
    const ranked = Object.entries(employeeMonthly).map(([key, data]) => {
        const total = monthKeys.reduce((sum, mk) => sum + (data.months[mk] || 0), 0);
        return { key, name: data.name, total, months: data.months };
    }).sort((a, b) => b.total - a.total);

    const top3 = ranked.slice(0, 3);

    // Build chart data
    const chartData = months.map(m => {
        const mk = `${m.year}-${String(m.month).padStart(2, '0')}`;
        const label = `${m.month}月`;

        // Average across all employees
        const allValues = Object.values(employeeMonthly)
            .map(e => e.months[mk] || 0)
            .filter(v => v > 0);
        const avg = allValues.length > 0 ? allValues.reduce((s, v) => s + v, 0) / allValues.length : 0;

        const entry = { name: label, 全社平均: parseFloat(avg.toFixed(1)) };
        top3.forEach((emp, i) => {
            entry[emp.name] = parseFloat((emp.months[mk] || 0).toFixed(1));
        });
        return entry;
    });

    const lineColors = ['#ef4444', '#f59e0b', '#8b5cf6'];

    return (
        <div style={{ padding: '25px', backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#111827', fontSize: '1.25rem' }}>
                残業時間トレンド（直近6ヶ月）
            </h3>
            <ResponsiveContainer width="100%" height={320}>
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{ fontSize: 13, fill: '#6b7280' }} />
                    <YAxis
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        label={{ value: '時間', position: 'insideTopLeft', offset: -5, style: { fontSize: 12, fill: '#9ca3af' } }}
                    />
                    <Tooltip
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.85rem' }}
                        formatter={(value) => [`${value}h`, undefined]}
                    />
                    <Legend wrapperStyle={{ fontSize: '0.85rem' }} />
                    <ReferenceLine y={45} stroke="#dc2626" strokeDasharray="8 4" strokeWidth={2} label={{ value: '45h上限', position: 'right', fill: '#dc2626', fontSize: 11 }} />
                    <ReferenceLine y={80} stroke="#991b1b" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: '80h複数月平均上限', position: 'right', fill: '#991b1b', fontSize: 10 }} />

                    <Line
                        type="monotone"
                        dataKey="全社平均"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        dot={{ r: 5, fill: '#3b82f6' }}
                        activeDot={{ r: 7 }}
                    />
                    {top3.map((emp, i) => (
                        <Line
                            key={emp.key}
                            type="monotone"
                            dataKey={emp.name}
                            stroke={lineColors[i]}
                            strokeWidth={2}
                            dot={{ r: 4 }}
                            strokeDasharray={i > 0 ? '5 5' : undefined}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
            <div style={{ marginTop: '12px', fontSize: '0.78rem', color: '#9ca3af', lineHeight: '1.5' }}>
                • 赤線: 月45h上限（通常）/ 暗赤線: 2-6ヶ月平均80h上限
            </div>
        </div>
    );
};

export default OvertimeTrend;
