import React from 'react';

const Article36Check = ({ monthlyData, employees, currentPeriod, onSelectEmployee }) => {
    // ================================================================
    // 36協定チェック（特別条項あり）
    // - 月45h超過: 特別条項発動（年6回まで）
    // - 月100h未満: 特別条項の絶対上限
    // - 年720h: 特別条項の年間上限
    // - 2〜6ヶ月平均80h未満: 複数月平均の上限
    // ================================================================

    let fiscalYearStartYear = currentPeriod.year;
    if (currentPeriod.month < 4) {
        fiscalYearStartYear -= 1;
    }

    // Deduplicate
    const dedupedMap = new Map();
    monthlyData.forEach(work => {
        const uniqueKey = `${work.employeeKey}_${work.year}_${work.month}`;
        if (!dedupedMap.has(uniqueKey) || (work.workingdayCount || 0) > (dedupedMap.get(uniqueKey).workingdayCount || 0)) {
            dedupedMap.set(uniqueKey, work);
        }
    });

    // Build per-employee, per-month overtime data
    const employeeOvertimeMap = {};

    dedupedMap.forEach(work => {
        const key = work.employeeKey;
        const employee = employees.find(e => e.key === key);
        if (!employee) return;

        const isCurrentFY = (
            (work.year === fiscalYearStartYear && work.month >= 4) ||
            (work.year > fiscalYearStartYear && (work.year < currentPeriod.year || (work.year === currentPeriod.year && work.month <= currentPeriod.month)))
        );
        if (!isCurrentFY) return;

        if (!employeeOvertimeMap[key]) {
            employeeOvertimeMap[key] = {
                name: `${employee.lastName || ''} ${employee.firstName || ''}`.trim(),
                monthlyMinutes: {},
                totalMinutes: 0,
            };
        }

        const overtimeMinutes = (work.overtime || 0) + (work.holidayWork?.overtime || 0);
        const monthKey = `${work.year}-${String(work.month).padStart(2, '0')}`;
        employeeOvertimeMap[key].monthlyMinutes[monthKey] = overtimeMinutes;
        employeeOvertimeMap[key].totalMinutes += overtimeMinutes;
    });

    // Analyze each employee
    const analysisResults = Object.entries(employeeOvertimeMap).map(([key, data]) => {
        const sortedMonths = Object.keys(data.monthlyMinutes).sort();
        const monthlyValues = sortedMonths.map(m => ({
            month: m,
            minutes: data.monthlyMinutes[m],
            hours: data.monthlyMinutes[m] / 60,
        }));

        // Count months exceeding 45h
        const over45hMonths = monthlyValues.filter(m => m.hours > 45);
        const specialProvisionCount = over45hMonths.length;

        // Check if any month exceeds 100h
        const over100hMonths = monthlyValues.filter(m => m.hours >= 100);

        // Check 2-6 month averages (rolling)
        const rollingAvgViolations = [];
        for (let window = 2; window <= 6; window++) {
            if (monthlyValues.length >= window) {
                // Check the most recent 'window' months
                const recentMonths = monthlyValues.slice(-window);
                const avgHours = recentMonths.reduce((sum, m) => sum + m.hours, 0) / window;
                if (avgHours >= 80) {
                    rollingAvgViolations.push({
                        window,
                        avgHours: avgHours.toFixed(1),
                        months: recentMonths.map(m => m.month).join('〜'),
                    });
                }
            }
        }

        // Annual total
        const annualHours = data.totalMinutes / 60;
        const annualProgress = (annualHours / 720) * 100;

        // Prediction: pace to year end
        const monthsElapsed = monthlyValues.length || 1;
        const monthsInYear = 12;
        const predictedAnnualHours = (annualHours / monthsElapsed) * monthsInYear;

        // Current month overtime
        const currentMonthKey = `${currentPeriod.year}-${String(currentPeriod.month).padStart(2, '0')}`;
        const currentMonthHours = (data.monthlyMinutes[currentMonthKey] || 0) / 60;

        // Alert level
        let alertLevel = 'safe'; // safe, caution, warning, danger
        if (over100hMonths.length > 0 || rollingAvgViolations.length > 0) {
            alertLevel = 'danger';
        } else if (specialProvisionCount > 6 || annualProgress > 90) {
            alertLevel = 'danger';
        } else if (specialProvisionCount > 4 || annualProgress > 75 || predictedAnnualHours > 720) {
            alertLevel = 'warning';
        } else if (specialProvisionCount > 0 || annualProgress > 50) {
            alertLevel = 'caution';
        }

        return {
            key,
            name: data.name,
            monthlyValues,
            annualHours,
            annualProgress,
            predictedAnnualHours,
            specialProvisionCount,
            over100hMonths,
            rollingAvgViolations,
            currentMonthHours,
            alertLevel,
        };
    });

    // Sort: danger first, then by annual hours descending
    const alertOrder = { danger: 0, warning: 1, caution: 2, safe: 3 };
    const sortedResults = analysisResults
        .filter(r => r.alertLevel !== 'safe')
        .sort((a, b) => alertOrder[a.alertLevel] - alertOrder[b.alertLevel] || b.annualHours - a.annualHours);

    const safeCount = analysisResults.filter(r => r.alertLevel === 'safe').length;

    const alertColors = {
        danger: { bg: '#fef2f2', border: '#dc2626', text: '#991b1b', badge: '#dc2626' },
        warning: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e', badge: '#f59e0b' },
        caution: { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af', badge: '#3b82f6' },
    };

    const formatHours = (h) => {
        const hours = Math.floor(h);
        const mins = Math.round((h - hours) * 60);
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    };

    return (
        <div style={{ padding: '25px', backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                    <h3 style={{ margin: 0, color: '#111827', fontSize: '1.25rem' }}>
                        36協定 コンプライアンスチェック
                    </h3>
                    <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '6px' }}>
                        特別条項: 月45h / 月100h上限 / 年720h / 2-6ヶ月平均80h未満
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>要注意</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '900', color: sortedResults.length > 0 ? '#dc2626' : '#10b981' }}>
                            {sortedResults.length}<span style={{ fontSize: '0.8rem', fontWeight: '600' }}>名</span>
                        </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>正常</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#10b981' }}>
                            {safeCount}<span style={{ fontSize: '0.8rem', fontWeight: '600' }}>名</span>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {sortedResults.length === 0 ? (
                    <div style={{ padding: '60px 40px', textAlign: 'center', color: '#10b981' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '15px' }}>✅</div>
                        <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>全社員が36協定の範囲内です</div>
                        <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '8px' }}>引き続きモニタリングを継続します</div>
                    </div>
                ) : (
                    sortedResults.map(r => {
                        const colors = alertColors[r.alertLevel];
                        return (
                            <div key={r.key} style={{
                                padding: '18px',
                                backgroundColor: colors.bg,
                                borderRadius: '12px',
                                marginBottom: '14px',
                                borderLeft: `5px solid ${colors.border}`,
                            }}>
                                {/* Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span
                                            className="employee-name-link"
                                            style={{ fontWeight: '700', fontSize: '1.1rem', color: '#374151' }}
                                            onClick={() => onSelectEmployee && onSelectEmployee(r.key)}
                                        >{r.name}</span>
                                        {r.alertLevel === 'danger' && (
                                            <span style={{ fontSize: '0.65rem', backgroundColor: '#dc2626', color: '#fff', padding: '2px 10px', borderRadius: '4px', fontWeight: '800' }}>
                                                🚨 違反リスク
                                            </span>
                                        )}
                                        {r.alertLevel === 'warning' && (
                                            <span style={{ fontSize: '0.65rem', backgroundColor: '#f59e0b', color: '#fff', padding: '2px 10px', borderRadius: '4px', fontWeight: '800' }}>
                                                ⚠️ 要注意
                                            </span>
                                        )}
                                        {r.alertLevel === 'caution' && (
                                            <span style={{ fontSize: '0.65rem', backgroundColor: '#3b82f6', color: '#fff', padding: '2px 10px', borderRadius: '4px', fontWeight: '800' }}>
                                                📋 経過観察
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>年間累計</div>
                                        <div style={{ fontWeight: '900', fontSize: '1.4rem', color: colors.text }}>
                                            {formatHours(r.annualHours)}
                                        </div>
                                    </div>
                                </div>

                                {/* Annual Progress Bar (720h) */}
                                <div style={{ marginBottom: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#6b7280', marginBottom: '4px' }}>
                                        <span>年間720h上限</span>
                                        <span>{r.annualProgress.toFixed(1)}%</span>
                                    </div>
                                    <div style={{ height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${Math.min(r.annualProgress, 100)}%`,
                                            backgroundColor: r.annualProgress > 90 ? '#dc2626' : (r.annualProgress > 75 ? '#f59e0b' : '#3b82f6'),
                                            borderRadius: '4px',
                                            transition: 'width 0.5s ease',
                                        }} />
                                    </div>
                                </div>

                                {/* Detail Metrics */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '0.8rem' }}>
                                    <div style={{ padding: '8px', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: '8px' }}>
                                        <div style={{ color: '#6b7280', marginBottom: '2px' }}>特別条項発動</div>
                                        <div style={{ fontWeight: '700', color: r.specialProvisionCount > 6 ? '#dc2626' : (r.specialProvisionCount > 4 ? '#f59e0b' : '#374151') }}>
                                            {r.specialProvisionCount}<span style={{ fontWeight: '400' }}> / 6回</span>
                                        </div>
                                    </div>
                                    <div style={{ padding: '8px', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: '8px' }}>
                                        <div style={{ color: '#6b7280', marginBottom: '2px' }}>当月</div>
                                        <div style={{ fontWeight: '700', color: r.currentMonthHours > 45 ? '#f59e0b' : '#374151' }}>
                                            {formatHours(r.currentMonthHours)}
                                        </div>
                                    </div>
                                    <div style={{ padding: '8px', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: '8px' }}>
                                        <div style={{ color: '#6b7280', marginBottom: '2px' }}>年末予測</div>
                                        <div style={{ fontWeight: '700', color: r.predictedAnnualHours > 720 ? '#dc2626' : '#374151' }}>
                                            {formatHours(r.predictedAnnualHours)}
                                        </div>
                                    </div>
                                </div>

                                {/* Violation alerts */}
                                {r.over100hMonths.length > 0 && (
                                    <div style={{ marginTop: '10px', padding: '8px 12px', backgroundColor: '#fecaca', borderRadius: '6px', fontSize: '0.8rem', color: '#991b1b', fontWeight: '600' }}>
                                        🚨 月100h超過: {r.over100hMonths.map(m => `${m.month}(${m.hours.toFixed(1)}h)`).join(', ')}
                                    </div>
                                )}
                                {r.rollingAvgViolations.length > 0 && (
                                    <div style={{ marginTop: '8px', padding: '8px 12px', backgroundColor: '#fecaca', borderRadius: '6px', fontSize: '0.8rem', color: '#991b1b', fontWeight: '600' }}>
                                        🚨 複数月平均80h超過: {r.rollingAvgViolations.map(v => `${v.window}ヶ月平均 ${v.avgHours}h`).join(', ')}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            <div style={{ marginTop: '16px', fontSize: '0.78rem', color: '#9ca3af', borderTop: '1px solid #f3f4f6', paddingTop: '12px', lineHeight: '1.6' }}>
                <div>• 月45h超過 → 特別条項発動（年6回以内）</div>
                <div>• 月100h以上 / 2-6ヶ月平均80h以上 → <strong style={{ color: '#dc2626' }}>法令違反</strong></div>
                <div>• 年間720h超過 → <strong style={{ color: '#dc2626' }}>法令違反</strong></div>
            </div>
        </div>
    );
};

export default Article36Check;
