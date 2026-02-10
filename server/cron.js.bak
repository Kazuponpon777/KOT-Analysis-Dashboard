/**
 * KOT 勤怠分析 — 週次スケジューラー
 * 毎週金曜日 17:00 にメールレポートを自動送信
 *
 * 使用方法:
 *   node cron.js        — スケジュール起動
 *   node cron.js --now  — 即時テスト送信
 */
const cron = require('node-cron');
const { sendReport } = require('./emailReport');

// 即時テスト送信
if (process.argv.includes('--now')) {
    console.log('[Cron] Sending report immediately (test mode)...');
    sendReport().then(() => {
        console.log('[Cron] Done.');
        process.exit(0);
    });
} else {
    // 毎週金曜日 9:00 JST
    console.log('[Cron] Scheduling weekly report for every Friday at 09:00...');
    cron.schedule('0 9 * * 5', () => {
        console.log(`[Cron] Triggered at ${new Date().toLocaleString('ja-JP')}`);
        sendReport();
    }, {
        timezone: 'Asia/Tokyo'
    });
    console.log('[Cron] Scheduler running. Press Ctrl+C to stop.');
}
