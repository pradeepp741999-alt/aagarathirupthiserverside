import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { env } from '@/config/env';
import { IProvider } from '@/models/Provider';
import { formatINR } from '@/common/utils/money';
import { formatDisplayDate } from '@/common/utils/dates';

export interface AnalyticsExportData {
  period: string;
  totalRevenue: number;
  completedEvents: number;
  totalGuestsServed: number;
  conversionRatePercent: number;
  avgEventValue: number;
  monthlyBreakdown?: Array<{
    month: string;
    revenue: number;
    events: number;
  }>;
}

export async function exportAnalyticsPdf(
  provider: IProvider,
  data: AnalyticsExportData
): Promise<string> {
  const timestamp = Date.now();
  const filename = `analytics_${data.period}_${timestamp}.pdf`;
  const relativeKey = `reports/${provider._id}/${filename}`;
  const localDir = path.resolve(env.LOCAL_UPLOAD_DIR, `reports/${provider._id}`);

  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }

  const filePath = path.resolve(localDir, filename);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const writeStream = fs.createWriteStream(filePath);

    doc.pipe(writeStream);

    doc.fillColor('#0E7C7B').fontSize(20).text('AAGARA THIRUPTHI', { align: 'center' });
    doc.moveDown(0.3);
    doc.fillColor('#333333').fontSize(14).text('Performance & Business Report', { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(10).fillColor('#000000');
    doc.text(`Provider: ${provider.businessName || 'Business'}`);
    doc.text(`Category: ${provider.category?.toUpperCase() || ''}`);
    doc.text(`Report Period: ${data.period.replace(/_/g, ' ').toUpperCase()}`);
    doc.text(`Generated On: ${formatDisplayDate(new Date())}`);
    doc.moveDown(1.5);

    doc.font('Helvetica-Bold').fontSize(12).text('Key Metrics:');
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(10);
    doc.text(`• Total Revenue: ${formatINR(data.totalRevenue)}`);
    doc.text(`• Completed Events: ${data.completedEvents}`);
    doc.text(`• Total Guests Served: ${data.totalGuestsServed}`);
    doc.text(`• Conversion Rate: ${data.conversionRatePercent}%`);
    doc.text(`• Average Event Value: ${formatINR(data.avgEventValue)}`);

    if (data.monthlyBreakdown && data.monthlyBreakdown.length > 0) {
      doc.moveDown(1.5);
      doc.font('Helvetica-Bold').fontSize(12).text('Monthly Breakdown:');
      doc.moveDown(0.5);
      doc.font('Helvetica').fontSize(10);

      for (const m of data.monthlyBreakdown) {
        doc.text(`${m.month}: ${formatINR(m.revenue)} (${m.events} events)`);
      }
    }

    doc.end();

    writeStream.on('finish', () => {
      resolve(`${env.CDN_BASE_URL}/${relativeKey}`);
    });
    writeStream.on('error', reject);
  });
}

export async function exportAnalyticsCsv(
  provider: IProvider,
  data: AnalyticsExportData
): Promise<string> {
  const timestamp = Date.now();
  const filename = `analytics_${data.period}_${timestamp}.csv`;
  const relativeKey = `reports/${provider._id}/${filename}`;
  const localDir = path.resolve(env.LOCAL_UPLOAD_DIR, `reports/${provider._id}`);

  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }

  const filePath = path.resolve(localDir, filename);

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

  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  return `${env.CDN_BASE_URL}/${relativeKey}`;
}
