import React from 'react';

const AnnualOvertime = ({ monthlyData, employees }) => {
    // Process data to get cumulative for each employee
    const workerStats = {};

    monthlyData.forEach(work => {
        const key = work.employeeKey;
        if (!workerStats[key]) {
            const employee = employees.find(e => e.key === key) || {};
            workerStats[key] = {
                name: `${employee.lastName || ''} ${employee.firstName || ''}`.trim() || '不明',
                division: employee.divisionName || '所属なし',
                totalMinutes: 0,
                monthCount: 0
            };
        }
        workerStats[key].totalMinutes += (work.overtime || 0) + (work.holidayWork?.overtime || 0);
        workerStats[key].monthCount += 1;
    });

    const statsArray = Object.values(workerStats).sort((a, b) => b.totalMinutes - a.totalMinutes);

    const formatMinutes = (minutes) => {
        const h = Math.floor(minutes / 60);
        return `${h}時間`;
    };

    return (
        <div style={{ padding: '20px', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
            <h2 style={{ marginBottom: '20px', color: '#111827' }}>年度累計残業時間 (直近6ヶ月)</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
                {statsArray.slice(0, 8).map(stat => (
                    <div key={stat.name} style={{ padding: '15px', backgroundColor: '#f9fafb', borderRadius: '8px', borderLeft: '4px solid #6366f1' }}>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{stat.division}</div>
                        <div style={{ fontWeight: '600', color: '#374151', margin: '4px 0' }}>{stat.name}</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#4f46e5' }}>
                            {formatMinutes(stat.totalMinutes)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AnnualOvertime;
