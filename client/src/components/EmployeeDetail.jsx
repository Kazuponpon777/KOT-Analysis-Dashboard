import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const EmployeeDetail = ({ employee, monthlyData, onClose }) => {
    if (!employee) return null;

    const empKey = employee.key;
    const name = `${employee.lastName || ''} ${employee.firstName || ''}`.trim();

    // Deduplicate
    const dedupedMap = new Map();
    monthlyData.forEach(work => {
        if (work.employeeKey !== empKey) return;
        const uKey = `${work.year}_${work.month}`;
        if (!dedupedMap.has(uKey)) dedupedMap.set(uKey, work);
    });

    // Build monthly data sorted by date
    const monthlyEntries = [...dedupedMap.values()].sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
    });

    const chartData = monthlyEntries.map(work => {
        const overtimeHours = ((work.overtime || 0) + (work.holidayWork?.overtime || 0)) / 60;
        const paidLeave = work.holidaysObtained
            ?.filter(h => h.code === 1 || h.name === '有休')
            .reduce((sum, h) => sum + (h.dayCount || 0), 0) || 0;

        return {
            name: `${work.month}月`,
            残業時間: parseFloat(overtimeHours.toFixed(1)),
            有給取得: paidLeave,
        };
    });

    const totalOvertime = chartData.reduce((sum, d) => sum + d.残業時間, 0);
    const totalPaidLeave = chartData.reduce((sum, d) => sum + d.有給取得, 0);
    const avgMonthlyOvertime = chartData.length > 0 ? totalOvertime / chartData.length : 0;
    const over45Count = chartData.filter(d => d.残業時間 > 45).length;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
                <button className="modal-close" onClick={onClose}>✕</button>

                {/* Header */}
                <div style={{ marginBottom: '24px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{employee.divisionName || '所属なし'}</div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '4px 0 0', color: 'var(--text-primary)' }}>{name}</h2>
                </div>

                {/* Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
                    <div style={{ padding: '14px', backgroundColor: 'var(--bg-card-alt)', borderRadius: '10px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>年間残業</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: '800', color: totalOvertime > 600 ? '#dc2626' : (totalOvertime > 400 ? '#f59e0b' : '#3b82f6') }}>
                            {totalOvertime.toFixed(0)}h
                        </div>
                    </div>
                    <div style={{ padding: '14px', backgroundColor: 'var(--bg-card-alt)', borderRadius: '10px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>月平均</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: '800', color: avgMonthlyOvertime > 45 ? '#f59e0b' : '#374151' }}>
                            {avgMonthlyOvertime.toFixed(1)}h
                        </div>
                    </div>
                    <div style={{ padding: '14px', backgroundColor: 'var(--bg-card-alt)', borderRadius: '10px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>45h超過回数</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: '800', color: over45Count > 6 ? '#dc2626' : (over45Count > 0 ? '#f59e0b' : '#10b981') }}>
                            {over45Count}回
                        </div>
                    </div>
                    <div style={{ padding: '14px', backgroundColor: 'var(--bg-card-alt)', borderRadius: '10px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>有給取得</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: '800', color: totalPaidLeave >= 5 ? '#10b981' : '#f59e0b' }}>
                            {totalPaidLeave.toFixed(1)}日
                        </div>
                    </div>
                </div>

                {/* Chart */}
                <div style={{ marginBottom: '24px' }}>
                    <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>月別残業推移</h4>
                    <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--border-medium)', fontSize: '0.85rem' }} />
                            <ReferenceLine y={45} stroke="#dc2626" strokeDasharray="6 3" strokeWidth={1.5} />
                            <Line type="monotone" dataKey="残業時間" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4, fill: '#3b82f6' }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Monthly Details Table */}
                <div>
                    <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>月別詳細</h4>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border-medium)' }}>
                                <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted)' }}>月</th>
                                <th style={{ padding: '8px', textAlign: 'right', color: 'var(--text-muted)' }}>残業</th>
                                <th style={{ padding: '8px', textAlign: 'right', color: 'var(--text-muted)' }}>有給</th>
                                <th style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)' }}>状態</th>
                            </tr>
                        </thead>
                        <tbody>
                            {chartData.map((d, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                    <td style={{ padding: '8px', fontWeight: '600' }}>{d.name}</td>
                                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700', color: d.残業時間 > 45 ? '#dc2626' : 'inherit' }}>
                                        {d.残業時間}h
                                    </td>
                                    <td style={{ padding: '8px', textAlign: 'right' }}>{d.有給取得}日</td>
                                    <td style={{ padding: '8px', textAlign: 'center' }}>
                                        {d.残業時間 >= 100 ? '🚨' : (d.残業時間 > 45 ? '⚠️' : '✅')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default EmployeeDetail;
