import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { env } from '@/config/env';
import { IBooking } from '@/models/Booking';
import { IProvider } from '@/models/Provider';
import { formatINR } from '@/common/utils/money';
import { formatDisplayDate } from '@/common/utils/dates';
import { nextCode } from '@/common/utils/counters';

export async function generateInvoicePdf(
  booking: IBooking,
  provider: IProvider
): Promise<string> {
  const invCode = await nextCode('invoice');
  const filename = `${invCode}.pdf`;
  const relativeKey = `invoices/${booking.providerId}/${filename}`;
  const localDir = path.resolve(env.LOCAL_UPLOAD_DIR, `invoices/${booking.providerId}`);

  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }

  const filePath = path.resolve(localDir, filename);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const writeStream = fs.createWriteStream(filePath);

    doc.pipe(writeStream);

    // Header
    doc.fillColor('#0E7C7B').fontSize(22).text('AAGARA THIRUPTHI', { align: 'center' });
    doc.moveDown(0.3);
    doc.fillColor('#444444').fontSize(14).text('TAX INVOICE / RECEIPT', { align: 'center' });
    doc.moveDown(1);

    // Metadata
    doc.fontSize(10).fillColor('#000000');
    doc.text(`Invoice Number: ${invCode}`, 50, 120);
    doc.text(`Invoice Date: ${formatDisplayDate(new Date())}`, 50, 135);
    doc.text(`Booking Reference: ${booking.code}`, 50, 150);

    // Provider Info
    doc.text('Issued By:', 350, 120);
    doc.font('Helvetica-Bold').text(provider.businessName || 'Service Provider', 350, 135);
    doc.font('Helvetica').text(`Contact: +91 ${provider.mobile}`, 350, 150);
    if (provider.district) doc.text(`Location: ${provider.district}`, 350, 165);

    doc.moveDown(3);

    // Customer & Event Info
    doc.font('Helvetica-Bold').text('Billed To:');
    doc.font('Helvetica').text(`Name: ${booking.customer.name}`);
    doc.text(`Mobile: +91 ${booking.customer.mobile}`);
    doc.text(`Event Type: ${booking.eventType}`);
    doc.text(`Event Date: ${formatDisplayDate(booking.eventDate)}`);
    doc.text(`Venue: ${booking.venue}`);
    doc.text(`Guest Count: ${booking.guestCount}`);

    doc.moveDown(1.5);

    // Table Header
    const tableTop = doc.y;
    doc.font('Helvetica-Bold');
    doc.text('Description', 50, tableTop);
    doc.text('Amount', 450, tableTop, { align: 'right' });
    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    // Table Content
    let yPos = tableTop + 25;
    doc.font('Helvetica');
    doc.text(`${booking.category.toUpperCase()} Services for ${booking.eventType}`, 50, yPos);
    doc.text(formatINR(booking.totalAmount), 450, yPos, { align: 'right' });

    yPos += 20;
    doc.moveTo(50, yPos).lineTo(550, yPos).stroke();

    yPos += 15;
    doc.font('Helvetica-Bold');
    doc.text('Total Amount:', 320, yPos);
    doc.text(formatINR(booking.totalAmount), 450, yPos, { align: 'right' });

    yPos += 20;
    doc.text('Advance Paid:', 320, yPos);
    doc.fillColor('#10B981').text(formatINR(booking.advancePaid), 450, yPos, { align: 'right' });

    yPos += 20;
    doc.fillColor('#000000').text('Balance Due:', 320, yPos);
    doc.fillColor(booking.balanceDue > 0 ? '#EF4444' : '#10B981').text(
      formatINR(booking.balanceDue),
      450,
      yPos,
      { align: 'right' }
    );

    // Payments Breakdown
    if (booking.payments && booking.payments.length > 0) {
      yPos += 30;
      doc.fillColor('#000000').font('Helvetica-Bold').text('Payment History:', 50, yPos);
      yPos += 15;
      doc.font('Helvetica').fontSize(9);

      for (const p of booking.payments) {
        doc.text(
          `• ${p.receiptNo} - ${formatDisplayDate(p.paidAt)}: ${formatINR(p.amount)} (${p.method.toUpperCase()})`,
          50,
          yPos
        );
        yPos += 15;
      }
    }

    // Terms
    doc.fontSize(9).fillColor('#666666');
    doc.text(
      'Note: This document confirms receipt of payments made directly to the service provider. For any queries, contact Aagara Thirupthi support.',
      50,
      680,
      { align: 'center', width: 500 }
    );

    doc.end();

    writeStream.on('finish', () => {
      const publicUrl = `${env.CDN_BASE_URL}/${relativeKey}`;
      resolve(publicUrl);
    });

    writeStream.on('error', (err) => {
      reject(err);
    });
  });
}
