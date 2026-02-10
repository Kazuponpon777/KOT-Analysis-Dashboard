import React from 'react';

const ComplianceAlerts = ({ monthlyData, employees, currentPeriod }) => {
    const workerStats = {};

    // ================================================================
    // CONFIRMED: KOT API の holidaysObtained.dayCount は
    // 「その月に何日取得したか」の月別取得日数（増分値）です。
    // 年度内（4/1〜currentPeriod）の全月を合算して年間取得日数を算出します。
    // ================================================================

    // Fiscal year starts April
    let fiscalYearStartYear = currentPeriod.year;
    if (currentPeriod.month < 4) {
        fiscalYearStartYear -= 1;
    }

    // Deduplicate: (employeeKey, year, month) ごとに1レコードのみ採用
    const dedupedMap = new Map();
    monthlyData.forEach(work => {
        const uniqueKey = `${work.employeeKey}_${work.year}_${work.month}`;
        if (!dedupedMap.has(uniqueKey) || (work.workingdayCount || 0) > (dedupedMap.get(uniqueKey).workingdayCount || 0)) {
            dedupedMap.set(uniqueKey, work);
        }
    });

    // Process deduped data within the fiscal year
    dedupedMap.forEach((work) => {
        const isCurrentFY = (
            (work.year === fiscalYearStartYear && work.month >= 4) ||
            (work.year > fiscalYearStartYear && (work.year < currentPeriod.year || (work.year === currentPeriod.year && work.month <= currentPeriod.month)))
        );

        if (isCurrentFY) {
            const key = work.employeeKey;
            const employee = employees.find(e => e.key === key);

            // Skip employees not in the master list (e.g. retired/removed)
            if (!employee) return;

            if (!workerStats[key]) {
                workerStats[key] = {
                    name: `${employee.lastName || ''} ${employee.firstName || ''}`.trim(),
                    paidLeaveUsage: 0,
                    otherLeaveUsage: 0,
                    legalHolidayWorkDays: 0,
                };
            }

            work.holidaysObtained?.forEach(h => {
                if (h.code === 1 || h.name === '有休') {
                    workerStats[key].paidLeaveUsage += h.dayCount || 0;
                } else if (h.code !== 10 && h.name !== '公休') {
                    workerStats[key].otherLeaveUsage += h.dayCount || 0;
                }
            });

            workerStats[key].legalHolidayWorkDays += work.legalHolidayWork?.dayCount || 0;
        }
    });

    const statsArray = Object.values(workerStats);

    // Metrics
    const totalUsage = statsArray.reduce((acc, s) => acc + s.paidLeaveUsage, 0);
    const averageUsageDays = statsArray.length > 0 ? (totalUsage / statsArray.length) : 0;

    // Utilization Rate: Based on 20 days annual grant
    const utilizationRate = (averageUsageDays / 20) * 100;

    // 5-day obligation: months remaining in fiscal year (ends March)
    const fyEndMonth = 3;
    const fyEndYear = currentPeriod.month >= 4 ? currentPeriod.year + 1 : currentPeriod.year;
    const monthsRemaining = (fyEndYear - currentPeriod.year) * 12 + (fyEndMonth - currentPeriod.month);
    const under5Count = statsArray.filter(s => s.paidLeaveUsage < 5).length;

    const holidayAlerts = statsArray.filter(s => s.legalHolidayWorkDays > 0);

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Paid Leave Usage Section */}
            <div style={{ padding: '25px', backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '25px' }}>
                    <div>
                        <h3 style={{ margin: 0, color: '#111827', fontSize: '1.25rem' }}>有給休暇 取得状況 (4/1〜)</h3>
                        <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '6px' }}>
                            ※計画付与（3日）を含む今年度の累計消化日数
                        </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', gap: '24px' }}>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '4px' }}>平均取得日数</div>
                            <div style={{ fontSize: '1.75rem', fontWeight: '900', color: '#1e40af' }}>
                                {averageUsageDays.toFixed(1)}<span style={{ fontSize: '0.9rem', fontWeight: '600', marginLeft: '2px' }}>日</span>
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '4px' }}>平均取得率</div>
                            <div style={{ fontSize: '1.75rem', fontWeight: '900', color: '#059669' }}>
                                {utilizationRate.toFixed(1)}<span style={{ fontSize: '0.9rem', fontWeight: '600', marginLeft: '2px' }}>%</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 5-day obligation summary */}
                {under5Count > 0 && (
                    <div style={{ marginBottom: '16px', padding: '12px 16px', backgroundColor: '#fef2f2', borderRadius: '10px', border: '1px solid #fecaca', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#991b1b' }}>
                                ⚠️ 年5日取得義務 未達: {under5Count}名
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#b91c1c', marginTop: '2px' }}>
                                残り{monthsRemaining}ヶ月で5日以上の取得が必要です
                            </div>
                        </div>
                    </div>
                )}

                <div style={{ maxHeight: '480px', overflowY: 'auto', paddingRight: '10px' }}>
                    {statsArray.sort((a, b) => b.paidLeaveUsage - a.paidLeaveUsage).map(s => {
                        const needsMore = 5 - s.paidLeaveUsage;
                        const pacePerMonth = monthsRemaining > 0 ? (needsMore / monthsRemaining) : needsMore;
                        const isUnder5 = s.paidLeaveUsage < 5;
                        const isDanger = isUnder5 && monthsRemaining <= 2;

                        return (
                            <div key={s.name} style={{ padding: '14px 0', borderBottom: '1px solid #f3f4f6' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span style={{ fontWeight: '600', color: s.paidLeaveUsage === 0 ? '#ef4444' : '#374151', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                            {s.name}
                                            {s.paidLeaveUsage === 0 && (
                                                <span style={{ fontSize: '0.7rem', backgroundColor: '#fee2e2', color: '#b91c1c', padding: '3px 10px', borderRadius: '6px', fontWeight: '900', border: '1px solid #fecaca' }}>
                                                    ⚠️ データ未反映
                                                </span>
                                            )}
                                            {isUnder5 && s.paidLeaveUsage > 0 && isDanger && (
                                                <span style={{ fontSize: '0.65rem', backgroundColor: '#dc2626', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontWeight: '800' }}>
                                                    🚨 法令違反リスク
                                                </span>
                                            )}
                                            {isUnder5 && s.paidLeaveUsage > 0 && !isDanger && (
                                                <span style={{ fontSize: '0.65rem', backgroundColor: '#f59e0b', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontWeight: '800' }}>
                                                    ⚠️ 5日未満
                                                </span>
                                            )}
                                        </span>
                                        {s.paidLeaveUsage === 0 && (
                                            <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: '500' }}>
                                                計画付与漏れ、または全消化済みの可能性
                                            </div>
                                        )}
                                        {isUnder5 && s.paidLeaveUsage > 0 && (
                                            <div style={{ fontSize: '0.75rem', color: isDanger ? '#dc2626' : '#b45309', fontWeight: '500' }}>
                                                残り{needsMore.toFixed(1)}日必要（月{pacePerMonth.toFixed(1)}日ペース）
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: '900', fontSize: '1.4rem', color: s.paidLeaveUsage >= 5 ? '#059669' : (s.paidLeaveUsage === 0 ? '#ef4444' : '#f59e0b') }}>
                                            {s.paidLeaveUsage.toFixed(1)}<span style={{ fontSize: '0.8rem', fontWeight: '600', marginLeft: '2px' }}>日</span>
                                        </div>
                                        {s.otherLeaveUsage > 0 && (
                                            <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '2px' }}>
                                                他休暇: {s.otherLeaveUsage}日
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div style={{ marginTop: '20px', fontSize: '0.8rem', color: '#9ca3af', borderTop: '1px solid #f3f4f6', paddingTop: '12px', lineHeight: '1.5' }}>
                    <div style={{ marginBottom: '4px' }}>• 有給休暇の保有上限は40日（当年度20日＋前年度繰越20日）です。</div>
                    <div style={{ marginBottom: '4px' }}>• 取得率は年間20日付与をベースとした概算値です。</div>
                    <div>• <strong style={{ color: '#dc2626' }}>年5日以上の取得は法的義務</strong>です（労働基準法第39条）。</div>
                </div>
            </div>

            {/* Legal Holiday — Unconsumed Compensatory Leave Section */}
            <div style={{ padding: '25px', backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}>
                <h3 style={{ marginTop: 0, color: '#111827', fontSize: '1.25rem', marginBottom: '6px' }}>法定休日 代休未消化管理</h3>
                <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '20px' }}>
                    ※法定休日出勤に対する振替休日の消化状況（有効期限: 出勤月末日+1年）
                </div>
                <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
                    {(() => {
                        // Build per-employee legal holiday tracking with monthly granularity
                        const legalHolidayTracking = {};
                        const today = new Date(currentPeriod.year, currentPeriod.month - 1, 15);

                        dedupedMap.forEach((work) => {
                            const key = work.employeeKey;
                            const employee = employees.find(e => e.key === key);
                            if (!employee) return;

                            const legalWorkDays = work.legalHolidayWork?.dayCount || 0;
                            // code:19 = 振替休日（法定）日
                            const compLeaveUsed = work.holidaysObtained
                                ?.filter(h => h.code === 19)
                                .reduce((sum, h) => sum + (h.dayCount || 0), 0) || 0;

                            if (legalWorkDays === 0 && compLeaveUsed === 0) return;

                            if (!legalHolidayTracking[key]) {
                                legalHolidayTracking[key] = {
                                    name: `${employee.lastName || ''} ${employee.firstName || ''}`.trim(),
                                    totalWorkDays: 0,
                                    totalCompUsed: 0,
                                    monthlyEntries: [],
                                };
                            }

                            legalHolidayTracking[key].totalWorkDays += legalWorkDays;
                            legalHolidayTracking[key].totalCompUsed += compLeaveUsed;

                            if (legalWorkDays > 0) {
                                // Expiration = end of the work month + 1 year
                                const endDate = work.endDate ? new Date(work.endDate) : new Date(work.year, work.month - 1, 25);
                                const expiration = new Date(endDate);
                                expiration.setFullYear(expiration.getFullYear() + 1);

                                legalHolidayTracking[key].monthlyEntries.push({
                                    month: work.month,
                                    year: work.year,
                                    workDays: legalWorkDays,
                                    expiration,
                                });
                            }
                        });

                        // Calculate unconsumed and sort
                        const trackingArray = Object.values(legalHolidayTracking)
                            .map(t => ({
                                ...t,
                                unconsumed: t.totalWorkDays - t.totalCompUsed,
                                earliestExpiration: t.monthlyEntries.length > 0
                                    ? t.monthlyEntries.reduce((min, e) => e.expiration < min ? e.expiration : min, t.monthlyEntries[0].expiration)
                                    : null,
                            }))
                            .filter(t => t.unconsumed > 0)
                            .sort((a, b) => {
                                // Sort by earliest expiration first
                                if (a.earliestExpiration && b.earliestExpiration) {
                                    return a.earliestExpiration - b.earliestExpiration;
                                }
                                return b.unconsumed - a.unconsumed;
                            });

                        if (trackingArray.length === 0) {
                            return (
                                <div style={{ padding: '60px 40px', textAlign: 'center', color: '#10b981' }}>
                                    <div style={{ fontSize: '3rem', marginBottom: '15px' }}>✅</div>
                                    <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>未消化の代休はありません</div>
                                    <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '8px' }}>コンプライアンス状況は良好です</div>
                                </div>
                            );
                        }

                        const threeMonthsLater = new Date(today);
                        threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

                        return trackingArray.map(t => {
                            const isExpiringSoon = t.earliestExpiration && t.earliestExpiration <= threeMonthsLater;
                            const isExpired = t.earliestExpiration && t.earliestExpiration < today;
                            const daysUntilExpiry = t.earliestExpiration
                                ? Math.ceil((t.earliestExpiration - today) / (1000 * 60 * 60 * 24))
                                : null;

                            return (
                                <div key={t.name} style={{
                                    padding: '16px',
                                    backgroundColor: isExpired ? '#fef2f2' : (isExpiringSoon ? '#fffbeb' : '#f0fdf4'),
                                    borderRadius: '12px',
                                    marginBottom: '12px',
                                    borderLeft: `5px solid ${isExpired ? '#dc2626' : (isExpiringSoon ? '#f59e0b' : '#22c55e')}`,
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <div style={{ fontWeight: '700', color: '#374151', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {t.name}
                                                {isExpired && (
                                                    <span style={{ fontSize: '0.65rem', backgroundColor: '#dc2626', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontWeight: '800' }}>
                                                        期限切れ
                                                    </span>
                                                )}
                                                {!isExpired && isExpiringSoon && (
                                                    <span style={{ fontSize: '0.65rem', backgroundColor: '#f59e0b', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontWeight: '800' }}>
                                                        ⚠️ 期限注意
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '6px', display: 'flex', gap: '16px' }}>
                                                <span>出勤: <strong>{t.totalWorkDays}日</strong></span>
                                                <span>消化済: <strong>{t.totalCompUsed}日</strong></span>
                                            </div>
                                            {t.earliestExpiration && (
                                                <div style={{
                                                    fontSize: '0.8rem',
                                                    color: isExpired ? '#dc2626' : (isExpiringSoon ? '#b45309' : '#6b7280'),
                                                    marginTop: '4px',
                                                    fontWeight: isExpiringSoon ? '600' : '400',
                                                }}>
                                                    最短期限: {t.earliestExpiration.toLocaleDateString('ja-JP')}
                                                    {daysUntilExpiry !== null && !isExpired && (
                                                        <span>（残り{daysUntilExpiry}日）</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '2px' }}>未消化</div>
                                            <div style={{
                                                fontWeight: '900',
                                                fontSize: '1.6rem',
                                                color: isExpired ? '#dc2626' : (isExpiringSoon ? '#f59e0b' : '#059669'),
                                            }}>
                                                {t.unconsumed}<span style={{ fontSize: '0.8rem', fontWeight: '600', marginLeft: '2px' }}>日</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        });
                    })()}
                </div>
            </div>
        </div>
    );
};

export default ComplianceAlerts;
