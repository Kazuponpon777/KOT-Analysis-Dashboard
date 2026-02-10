import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

const DepartmentSummary = ({ monthlyData, employees, currentPeriod }) => {
    // Build per-department statistics
    let fiscalYearStartYear = currentPeriod.year;
    if (currentPeriod.month < 4) {
        fiscalYearStartYear -= 1;
    }

    // Map employee to division
    const empDivision = {};
    employees.forEach(e => {
        empDivision[e.key] = e.divisionName || '所属なし';
    });

    // Deduplicate
    const dedupedMap = new Map();
    monthlyData.forEach(work => {
        const key = `${work.employeeKey}_${work.year}_${work.month}`;
        if (!dedupedMap.has(key) || (work.workingdayCount || 0) > (dedupedMap.get(key).workingdayCount || 0)) {
            dedupedMap.set(key, work);
        }
    });

    // Build per-division stats
    const divStats = {};

    dedupedMap.forEach(work => {
        const empKey = work.employeeKey;
        const division = empDivision[empKey];
        if (!division) return;

        const isCurrentFY = (
            (work.year === fiscalYearStartYear && work.month >= 4) ||
            (work.year > fiscalYearStartYear && (work.year < currentPeriod.year || (work.year === currentPeriod.year && work.month <= currentPeriod.month)))
        );
        if (!isCurrentFY) return;

        if (!divStats[division]) {
            divStats[division] = {
                name: division,
                employeeSet: new Set(),
                totalOvertimeMinutes: 0,
                totalPaidLeave: 0,
                dataPoints: 0,
            };
        }

        divStats[division].employeeSet.add(empKey);
        divStats[division].totalOvertimeMinutes += (work.overtime || 0) + (work.holidayWork?.overtime || 0);
        divStats[division].dataPoints += 1;

        // Paid leave
        if (work.holidaysObtained) {
            work.holidaysObtained.forEach(h => {
                if (h.code === 1 || h.name === '有休') {
                    divStats[division].totalPaidLeave += h.dayCount || 0;
                }
            });
        }
    });

    // Calculate averages
    const divArray = Object.values(divStats)
        .map(d => ({
            name: d.name.length > 8 ? d.name.substring(0, 8) + '…' : d.name,
            fullName: d.name,
            headcount: d.employeeSet.size,
            avgOvertimeHours: d.dataPoints > 0 ? (d.totalOvertimeMinutes / 60 / d.employeeSet.size) : 0,
            avgPaidLeave: d.employeeSet.size > 0 ? (d.totalPaidLeave / d.employeeSet.size) : 0,
        }))
        .filter(d => d.headcount > 0)
        .sort((a, b) => b.avgOvertimeHours - a.avgOvertimeHours);

    const getBarColor = (hours) => {
        if (hours > 45) return '#dc2626';
        if (hours > 30) return '#f59e0b';
        return '#3b82f6';
    };

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div style={{ padding: '12px 16px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', fontSize: '0.85rem' }}>
                    <div style={{ fontWeight: '700', marginBottom: '6px', color: '#111827' }}>{data.fullName}</div>
                    <div>人数: {data.headcount}名</div>
                    <div>平均残業: {data.avgOvertimeHours.toFixed(1)}h</div>
                    <div>平均有給取得: {data.avgPaidLeave.toFixed(1)}日</div>
                </div>
            );
        }
        return null;
    };

    return (
        <div style={{ padding: '25px', backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#111827', fontSize: '1.25rem' }}>
                部署別 残業・有給比較
            </h3>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={divArray} margin={{ top: 5, right: 30, left: 0, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} angle={-30} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '0.85rem' }} />
                    <Bar dataKey="avgOvertimeHours" name="平均残業(h)" radius={[4, 4, 0, 0]}>
                        {divArray.map((entry, i) => (
                            <Cell key={i} fill={getBarColor(entry.avgOvertimeHours)} />
                        ))}
                    </Bar>
                    <Bar dataKey="avgPaidLeave" name="平均有給(日)" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>

            {/* Table view */}
            <div style={{ marginTop: '16px', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                            <th style={{ padding: '10px 12px', textAlign: 'left', color: '#6b7280', fontWeight: '600' }}>部署</th>
                            <th style={{ padding: '10px 12px', textAlign: 'center', color: '#6b7280', fontWeight: '600' }}>人数</th>
                            <th style={{ padding: '10px 12px', textAlign: 'right', color: '#6b7280', fontWeight: '600' }}>平均残業</th>
                            <th style={{ padding: '10px 12px', textAlign: 'right', color: '#6b7280', fontWeight: '600' }}>平均有給</th>
                        </tr>
                    </thead>
                    <tbody>
                        {divArray.map((d, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '10px 12px', fontWeight: '600', color: '#374151' }}>{d.fullName}</td>
                                <td style={{ padding: '10px 12px', textAlign: 'center', color: '#6b7280' }}>{d.headcount}名</td>
                                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: d.avgOvertimeHours > 45 ? '#dc2626' : (d.avgOvertimeHours > 30 ? '#f59e0b' : '#374151') }}>
                                    {d.avgOvertimeHours.toFixed(1)}h
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: d.avgPaidLeave >= 5 ? '#059669' : '#f59e0b' }}>
                                    {d.avgPaidLeave.toFixed(1)}日
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DepartmentSummary;
