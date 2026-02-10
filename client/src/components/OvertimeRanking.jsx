import React from 'react';

const OvertimeRanking = ({ monthlyData, employees }) => {
    // Group by employeeKey and take the maximum totalMinutes
    const groupedMap = new Map();

    monthlyData.forEach(work => {
        const key = work.employeeKey;
        const employee = employees.find(e => e.key === key) || {};
        const totalMinutes = (work.overtime || 0) + (work.holidayWork?.overtime || 0);

        const name = `${employee.lastName || ''} ${employee.firstName || ''}`.trim() || '不明';
        const division = employee.divisionName || '所属なし';

        // Detect potential "errors" (missed stamps, interval shortage, etc.)
        // KOT doesn't always show "incomplete" in monthly workings directly, 
        // but high interval shortage or mismatch in working days can be a sign.
        const hasError = work.intervalShortageCount > 0 || (work.lateCount + work.earlyLeaveCount > 5);

        if (!groupedMap.has(key) || totalMinutes > groupedMap.get(key).totalMinutes) {
            groupedMap.set(key, {
                ...work,
                name,
                division,
                totalMinutes,
                hasError
            });
        }
    });

    const joinedData = Array.from(groupedMap.values());
    const sortedData = joinedData.sort((a, b) => b.totalMinutes - a.totalMinutes);

    const formatMinutes = (minutes) => {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h}h ${m}m`;
    };

    const getAlertStyle = (minutes) => {
        const hours = minutes / 60;
        if (hours >= 60) return { color: '#e11d48', fontWeight: '900' };
        if (hours >= 40) return { color: '#ef4444', fontWeight: '700' };
        if (hours >= 30) return { color: '#f97316', fontWeight: '700' };
        return { color: '#374151' };
    };

    return (
        <div className="ranking-container" style={{ padding: '20px', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, color: '#111827' }}>残業時間超過ランキング</h2>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                    <span style={{ marginRight: '10px' }}>30h+: 🟠</span>
                    <span style={{ marginRight: '10px' }}>40h+: 🔴</span>
                    <span>60h+: 💣</span>
                </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb', color: '#6b7280' }}>
                        <th style={{ padding: '12px' }}>順位</th>
                        <th style={{ padding: '12px' }}>所属 / 氏名</th>
                        <th style={{ padding: '12px' }}>総残業時間</th>
                        <th style={{ padding: '12px' }}>状況 / アラート</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedData.map((emp, index) => {
                        const isOver40 = emp.totalMinutes >= 40 * 60;
                        const showsThresholdLine = index > 0 &&
                            sortedData[index - 1].totalMinutes >= 40 * 60 &&
                            emp.totalMinutes < 40 * 60;

                        return (
                            <React.Fragment key={`${emp.employeeKey}-${index}`}>
                                {showsThresholdLine && (
                                    <tr>
                                        <td colSpan="4" style={{ padding: '0' }}>
                                            <div style={{ borderBottom: '3px dashed #ef4444', height: '1px', margin: '10px 0', position: 'relative' }}>
                                                <span style={{ position: 'absolute', right: '0', top: '-12px', backgroundColor: '#ef4444', color: '#fff', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px' }}>
                                                    40H ライン
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                <tr style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: isOver40 ? '#fff8f8' : 'transparent' }}>
                                    <td style={{ padding: '12px', fontWeight: '500' }}>{index + 1}</td>
                                    <td style={{ padding: '12px' }}>
                                        <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{emp.division}</div>
                                        <div style={{ fontWeight: '500', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {emp.name}
                                            {emp.hasError && <span title="打刻不足・未申請の可能性あり" style={{ cursor: 'help' }}>⚠️</span>}
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        <span style={getAlertStyle(emp.totalMinutes)}>
                                            {formatMinutes(emp.totalMinutes)}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px', fontSize: '1.2rem' }}>
                                        {emp.totalMinutes >= 60 * 60 ? '💣' : (isOver40 ? '🔴' : (emp.totalMinutes >= 30 * 60 ? '🟠' : ''))}
                                    </td>
                                </tr>
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default OvertimeRanking;
