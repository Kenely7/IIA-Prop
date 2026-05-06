const PDFDocument = require('pdfkit');

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
};

const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-NG', { day: '2-digit', month: 'long', year: 'numeric' });
};

const generateReceipt = (payment) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Colors
      const primaryGreen = '#1B4332';
      const lightGreen = '#40916C';
      const accentGold = '#D4A017';
      const lightGray = '#F8F9FA';

      // === HEADER BACKGROUND ===
      doc.rect(0, 0, doc.page.width, 160).fill(primaryGreen);

      // Company name
      doc.fillColor('white').font('Helvetica-Bold').fontSize(28).text('PropMS', 50, 40);
      doc.fillColor('#A8D5BA').font('Helvetica').fontSize(10).text('Property Management System', 50, 75);

      // RECEIPT label
      doc.fillColor('white').font('Helvetica-Bold').fontSize(22).text('PAYMENT RECEIPT', 0, 50, { align: 'right', width: doc.page.width - 50 });

      // Receipt details on header
      doc.fillColor('#A8D5BA').font('Helvetica').fontSize(10)
        .text(`Receipt No: ${payment.receipt_number}`, 0, 80, { align: 'right', width: doc.page.width - 50 })
        .text(`Date: ${formatDate(payment.payment_date)}`, 0, 95, { align: 'right', width: doc.page.width - 50 });

      // Status badge
      const statusColor = payment.status === 'confirmed' ? '#52B788' : '#F4A261';
      doc.roundedRect(doc.page.width - 130, 110, 80, 25, 5).fill(statusColor);
      doc.fillColor('white').font('Helvetica-Bold').fontSize(10)
        .text(payment.status.toUpperCase(), doc.page.width - 130, 117, { width: 80, align: 'center' });

      doc.moveDown(5);

      // === TENANT & PROPERTY INFO ===
      const boxY = 185;
      const boxHeight = 110;

      // Left box - Tenant
      doc.rect(50, boxY, 230, boxHeight).fill(lightGray).stroke('#DEE2E6');
      doc.fillColor(primaryGreen).font('Helvetica-Bold').fontSize(9).text('RECEIVED FROM', 65, boxY + 12);
      doc.fillColor('#212529').font('Helvetica-Bold').fontSize(13).text(payment.tenant_name || '', 65, boxY + 28);
      doc.font('Helvetica').fontSize(10)
        .text(payment.tenant_phone || '', 65, boxY + 50)
        .text(payment.tenant_email || '', 65, boxY + 65);

      // Right box - Property
      doc.rect(310, boxY, 235, boxHeight).fill(lightGray).stroke('#DEE2E6');
      doc.fillColor(primaryGreen).font('Helvetica-Bold').fontSize(9).text('PROPERTY DETAILS', 325, boxY + 12);
      doc.fillColor('#212529').font('Helvetica-Bold').fontSize(13).text(payment.property_name || '', 325, boxY + 28);
      doc.font('Helvetica').fontSize(10)
        .text(payment.property_address || '', 325, boxY + 50, { width: 200 });
      if (payment.unit_number) {
        doc.text(`Unit: ${payment.unit_number}`, 325, boxY + 77);
      }

      // === AMOUNT BOX ===
      const amtY = 315;
      doc.rect(50, amtY, 495, 80).fill(primaryGreen);
      doc.fillColor('#A8D5BA').font('Helvetica').fontSize(11).text('AMOUNT PAID', 0, amtY + 15, { align: 'center' });
      doc.fillColor('white').font('Helvetica-Bold').fontSize(32).text(formatCurrency(payment.amount), 0, amtY + 32, { align: 'center' });

      // === PAYMENT DETAILS TABLE ===
      const tableY = 420;
      doc.fillColor(primaryGreen).font('Helvetica-Bold').fontSize(12).text('Payment Details', 50, tableY);
      doc.moveTo(50, tableY + 18).lineTo(545, tableY + 18).stroke('#DEE2E6');

      const details = [
        ['Payment Method', (payment.payment_method || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())],
        ['Payment Date', formatDate(payment.payment_date)],
        ['Rent Period', `${formatDate(payment.period_from)} — ${formatDate(payment.period_to)}`],
        ['Status', payment.status.charAt(0).toUpperCase() + payment.status.slice(1)],
      ];
      if (payment.notes) details.push(['Notes', payment.notes]);

      let rowY = tableY + 28;
      details.forEach(([label, value], idx) => {
        if (idx % 2 === 0) {
          doc.rect(50, rowY, 495, 25).fill('#F8F9FA');
        }
        doc.fillColor('#6C757D').font('Helvetica').fontSize(10).text(label, 65, rowY + 7);
        doc.fillColor('#212529').font('Helvetica-Bold').fontSize(10).text(value, 200, rowY + 7);
        rowY += 25;
      });

      // === FOOTER ===
      doc.moveTo(50, rowY + 20).lineTo(545, rowY + 20).stroke('#DEE2E6');
      doc.fillColor(lightGreen).font('Helvetica-Bold').fontSize(11)
        .text('Thank you for your payment!', 0, rowY + 35, { align: 'center' });
      doc.fillColor('#6C757D').font('Helvetica').fontSize(9)
        .text('This is a computer-generated receipt. No signature required.', 0, rowY + 52, { align: 'center' })
        .text(`Generated on ${new Date().toLocaleString('en-NG')}`, 0, rowY + 65, { align: 'center' });

      // Watermark for non-confirmed
      if (payment.status !== 'confirmed') {
        doc.save();
        doc.opacity(0.08).fontSize(80).fillColor('red').rotate(-45, { origin: [300, 400] });
        doc.text(payment.status.toUpperCase(), 100, 350);
        doc.restore();
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = { generateReceipt };
