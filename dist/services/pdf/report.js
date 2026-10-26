"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportAnalyticsPdf = exportAnalyticsPdf;
exports.exportAnalyticsCsv = exportAnalyticsCsv;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const env_1 = require("@/config/env");
const money_1 = require("@/common/utils/money");
const dates_1 = require("@/common/utils/dates");
async function exportAnalyticsPdf(provider, data) {
    const timestamp = Date.now();
    const filename = `analytics_${data.period}_${timestamp}.pdf`;
    const relativeKey = `reports/${provider._id}/${filename}`;
    const localDir = path_1.default.resolve(env_1.env.LOCAL_UPLOAD_DIR, `reports/${provider._id}`);
    if (!fs_1.default.existsSync(localDir)) {
        fs_1.default.mkdirSync(localDir, { recursive: true });
    }
    const filePath = path_1.default.resolve(localDir, filename);
    return new Promise((resolve, reject) => {
        const doc = new pdfkit_1.default({ margin: 50 });
        const writeStream = fs_1.default.createWriteStream(filePath);
        doc.pipe(writeStream);
        doc.fillColor('#0E7C7B').fontSize(20).text('AAGARA THIRUPTHI', { align: 'center' });
        doc.moveDown(0.3);
        doc.fillColor('#333333').fontSize(14).text('Performance & Business Report', { align: 'center' });
        doc.moveDown(1);
        doc.fontSize(10).fillColor('#000000');
        doc.text(`Provider: ${provider.businessName || 'Business'}`);
        doc.text(`Category: ${provider.category?.toUpperCase() || ''}`);
        doc.text(`Report Period: ${data.period.replace(/_/g, ' ').toUpperCase()}`);
        doc.text(`Generated On: ${(0, dates_1.formatDisplayDate)(new Date())}`);
        doc.moveDown(1.5);
        doc.font('Helvetica-Bold').fontSize(12).text('Key Metrics:');
        doc.moveDown(0.5);
        doc.font('Helvetica').fontSize(10);
        doc.text(`• Total Revenue: ${(0, money_1.formatINR)(data.totalRevenue)}`);
        doc.text(`• Completed Events: ${data.completedEvents}`);
        doc.text(`• Total Guests Served: ${data.totalGuestsServed}`);
        doc.text(`• Conversion Rate: ${data.conversionRatePercent}%`);
        doc.text(`• Average Event Value: ${(0, money_1.formatINR)(data.avgEventValue)}`);
        if (data.monthlyBreakdown && data.monthlyBreakdown.length > 0) {
            doc.moveDown(1.5);
            doc.font('Helvetica-Bold').fontSize(12).text('Monthly Breakdown:');
            doc.moveDown(0.5);
            doc.font('Helvetica').fontSize(10);
            for (const m of data.monthlyBreakdown) {
                doc.text(`${m.month}: ${(0, money_1.formatINR)(m.revenue)} (${m.events} events)`);
            }
        }
        doc.end();
        writeStream.on('finish', () => {
            resolve(`${env_1.env.CDN_BASE_URL}/${relativeKey}`);
        });
        writeStream.on('error', reject);
    });
}
async function exportAnalyticsCsv(provider, data) {
    const timestamp = Date.now();
    const filename = `analytics_${data.period}_${timestamp}.csv`;
    const relativeKey = `reports/${provider._id}/${filename}`;
    const localDir = path_1.default.resolve(env_1.env.LOCAL_UPLOAD_DIR, `reports/${provider._id}`);
    if (!fs_1.default.existsSync(localDir)) {
        fs_1.default.mkdirSync(localDir, { recursive: true });
    }
    const filePath = path_1.default.resolve(localDir, filename);
    const lines = [
        'Metric,Value',
        `Provider,"${provider.businessName || 'Business'}"`,
        `Period,${data.period}`,
        `Total Revenue (INR),${data.totalRevenue}`,
        `Completed Events,${data.completedEvents}`,
        `Total Guests Served,${data.totalGuestsServed}`,
        `Conversion Rate (%),${data.conversionRatePercent}`,
        `Average Event Value (INR),${data.avgEventValue}`,
    ];
    if (data.monthlyBreakdown && data.monthlyBreakdown.length > 0) {
        lines.push('');
        lines.push('Month,Revenue,Events');
        for (const m of data.monthlyBreakdown) {
            lines.push(`${m.month},${m.revenue},${m.events}`);
        }
    }
    fs_1.default.writeFileSync(filePath, lines.join('\n'), 'utf8');
    return `${env_1.env.CDN_BASE_URL}/${relativeKey}`;
}
