const PDFDocument = require('pdfkit');

const BRAND = {
  marketing: { name: 'BrainADZ Marketing', color: '#1D4ED8', tagline: 'Ideas That Spark Momentum' },
  exhibition: {
    name: 'BrainADZ Exhibits',
    color: '#B45309',
    tagline: 'Exhibitions, Experiences & Brand Spaces',
  },
  live: {
    name: 'BrainADZ Live',
    color: '#047857',
    tagline: 'Live Experiences & Digital Solutions',
  },
};

const money = (value) =>
  `INR ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const safe = (value, fallback = '-') => String(value || '').trim() || fallback;
const logoBuffer = (dataUrl) => {
  const match = String(dataUrl || '').match(/^data:image\/(?:png|jpe?g);base64,(.+)$/i);
  return match ? Buffer.from(match[1], 'base64') : null;
};

const generateQuotationPdf = (quotation) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    const brand = BRAND[quotation.communityKey] || BRAND.marketing;
    const unitName = quotation.businessUnitId?.name || brand.name;

    doc.rect(0, 0, 595.28, 112).fill('#FFFFFF');
    doc.rect(0, 0, 595.28, 7).fill(brand.color);
    const uploadedLogo = logoBuffer(quotation.logoDataUrl);
    let logoDrawn = false;
    if (uploadedLogo) {
      try {
        doc.image(uploadedLogo, 42, 22, { fit: [92, 48], align: 'left', valign: 'center' });
        logoDrawn = true;
      } catch {
        logoDrawn = false;
      }
    }
    if (!logoDrawn) {
      doc.roundedRect(42, 22, 48, 48, 8).fill(brand.color);
      doc
        .fillColor('#FFFFFF')
        .font('Helvetica-Bold')
        .fontSize(25)
        .text('B', 42, 31, { width: 48, align: 'center' });
    }
    doc
      .fillColor('#111827')
      .font('Helvetica-Bold')
      .fontSize(17)
      .text(unitName, logoDrawn ? 148 : 104, 28, { width: 255 });
    doc
      .fillColor('#64748B')
      .font('Helvetica')
      .fontSize(8.5)
      .text(brand.tagline, logoDrawn ? 148 : 104, 52, { width: 255 });
    doc
      .fillColor(brand.color)
      .font('Helvetica-Bold')
      .fontSize(19)
      .text('QUOTATION', 390, 27, { width: 163, align: 'right' });
    doc
      .fillColor('#475569')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(quotation.quotationNumber, 390, 53, { width: 163, align: 'right' });
    doc.moveTo(42, 91).lineTo(553, 91).strokeColor('#E2E8F0').stroke();

    let y = 112;
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(10).text('QUOTATION DETAILS', 42, y);
    doc.font('Helvetica').fontSize(9).fillColor('#4B5563');
    doc.text(`Date: ${quotation.quotationDate}`, 42, y + 19);
    doc.text(`Valid until: ${quotation.validUntil}`, 42, y + 34);
    doc.font('Helvetica-Bold').fillColor('#111827').text('BILL TO', 330, y);
    doc
      .font('Helvetica')
      .fillColor('#4B5563')
      .text(safe(quotation.clientCompany || quotation.clientName), 330, y + 19, { width: 220 });
    doc.text(safe(quotation.clientName), 330, y + 34, { width: 220 });
    doc.text(safe(quotation.clientEmail), 330, y + 49, { width: 220 });
    if (quotation.clientPhone) doc.text(quotation.clientPhone, 330, y + 64, { width: 220 });
    if (quotation.clientAddress) doc.text(quotation.clientAddress, 330, y + 79, { width: 220 });

    y = Math.max(y + 108, doc.y + 12);
    doc.roundedRect(42, y, 511, 42, 4).fill('#F3F4F6');
    doc
      .fillColor('#374151')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('SUBJECT', 54, y + 9);
    doc
      .fillColor('#111827')
      .font('Helvetica')
      .fontSize(10)
      .text(safe(quotation.subject), 54, y + 23, { width: 485 });
    y += 62;

    if (quotation.customFields?.length) {
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9).text('ADDITIONAL DETAILS', 42, y);
      y += 17;
      quotation.customFields.forEach((field, index) => {
        if (y > 700) {
          doc.addPage();
          y = 48;
        }
        const column = index % 2;
        const x = column ? 303 : 42;
        doc.roundedRect(x, y, 250, 38, 4).fill('#F8FAFC').stroke('#E2E8F0');
        doc
          .fillColor('#64748B')
          .font('Helvetica-Bold')
          .fontSize(7.5)
          .text(safe(field.label), x + 10, y + 7, { width: 230 });
        doc
          .fillColor('#1E293B')
          .font('Helvetica')
          .fontSize(8.5)
          .text(safe(field.value), x + 10, y + 20, { width: 230, height: 13, ellipsis: true });
        if (column || index === quotation.customFields.length - 1) y += 46;
      });
      y += 4;
    }

    const widths = [28, 220, 48, 72, 52, 91];
    const headers = ['#', 'Description', 'Qty', 'Rate', 'Tax', 'Amount'];
    const drawRow = (values, top, header = false) => {
      const height = header ? 27 : 34;
      doc
        .rect(42, top, 511, height)
        .fill(header ? brand.color : '#FFFFFF')
        .stroke('#D1D5DB');
      let x = 42;
      values.forEach((value, index) => {
        if (index)
          doc
            .moveTo(x, top)
            .lineTo(x, top + height)
            .strokeColor('#D1D5DB')
            .stroke();
        doc
          .fillColor(header ? '#FFFFFF' : '#374151')
          .font(header ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(header ? 8 : 8.5)
          .text(String(value), x + 5, top + (header ? 9 : 8), {
            width: widths[index] - 10,
            align: index >= 2 ? 'right' : 'left',
            height: height - 10,
            ellipsis: true,
          });
        x += widths[index];
      });
      return top + height;
    };
    y = drawRow(headers, y, true);
    quotation.items.forEach((item, index) => {
      if (y > 690) {
        doc.addPage();
        y = 48;
        y = drawRow(headers, y, true);
      }
      y = drawRow(
        [
          index + 1,
          item.description,
          item.quantity,
          money(item.unitRate),
          `${item.taxRate}%`,
          money(item.amount),
        ],
        y,
      );
    });

    y += 16;
    const totalX = 330;
    const totalLine = (label, value, bold = false) => {
      doc
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(bold ? 10.5 : 9)
        .fillColor(bold ? brand.color : '#4B5563')
        .text(label, totalX, y, { width: 105 });
      doc.text(money(value), 438, y, { width: 115, align: 'right' });
      y += bold ? 22 : 17;
    };
    totalLine('Subtotal', quotation.subtotal);
    totalLine('Discount', quotation.discountAmount);
    totalLine('Taxable amount', quotation.taxableAmount);
    totalLine('GST', quotation.taxAmount);
    doc
      .moveTo(totalX, y - 4)
      .lineTo(553, y - 4)
      .strokeColor(brand.color)
      .stroke();
    totalLine('Grand total', quotation.grandTotal, true);

    if (y > 650) {
      doc.addPage();
      y = 48;
    }
    doc
      .fillColor('#111827')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('NOTES', 42, y + 5);
    doc
      .fillColor('#4B5563')
      .font('Helvetica')
      .fontSize(8.5)
      .text(
        safe(quotation.notes, 'Thank you for the opportunity to submit this quotation.'),
        42,
        y + 20,
        { width: 500 },
      );
    y = doc.y + 14;
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9).text('TERMS & CONDITIONS', 42, y);
    doc
      .fillColor('#4B5563')
      .font('Helvetica')
      .fontSize(8.5)
      .text(safe(quotation.terms), 42, y + 15, { width: 500 });

    const footerY = 770;
    doc.moveTo(42, footerY).lineTo(553, footerY).strokeColor('#D1D5DB').stroke();
    doc
      .fillColor('#6B7280')
      .font('Helvetica')
      .fontSize(8)
      .text(process.env.COMPANY_ADDRESS || 'BrainADZ · India', 42, footerY + 8, { width: 300 });
    doc.text(process.env.COMPANY_EMAIL || 'accounts@brainadz.com', 350, footerY + 8, {
      width: 203,
      align: 'right',
    });
    doc.end();
  });

module.exports = { generateQuotationPdf };
