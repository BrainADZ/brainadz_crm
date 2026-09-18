const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Ship the font assets with the backend so deployments do not depend on
// node_modules font files. The Devanagari subset contains the rupee glyph.
const resolveFont = (subset, weight) =>
  path.resolve(__dirname, `../assets/fonts/noto-sans-${subset}-${weight}-normal.woff`);
const REGULAR_FONT = resolveFont('latin', 400);
const BOLD_FONT = resolveFont('latin', 700);
const RUPEE_FONT = resolveFont('devanagari', 400);
const RUPEE_BOLD_FONT = resolveFont('devanagari', 700);
const BRAND_BLUE = '#1D4ED8';

const BRAND = {
  marketing: {
    name: 'BrainADZ Marketing',
    color: BRAND_BLUE,
    tagline: 'Ideas That Spark Momentum',
  },
  exhibition: {
    name: 'BrainADZ Exhibits',
    color: BRAND_BLUE,
    tagline: 'Exhibitions, Experiences & Brand Spaces',
  },
  live: {
    name: 'BrainADZ Live',
    color: BRAND_BLUE,
    tagline: 'Live Experiences & Digital Solutions',
  },
};
const UNIT_LOGOS = {
  marketing: path.resolve(__dirname, '../../crm-dashboard/public/logo/marketing.png'),
  exhibition: path.resolve(__dirname, '../../crm-dashboard/public/logo/ex.png'),
  live: path.resolve(__dirname, '../../crm-dashboard/public/logo/liv.png'),
};

const money = (value) =>
  Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const safe = (value, fallback = '-') => String(value || '').trim() || fallback;
const generateQuotationPdf = (quotation) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true });
    doc.registerFont('Helvetica', REGULAR_FONT);
    doc.registerFont('Helvetica-Bold', BOLD_FONT);
    doc.registerFont('Rupee', RUPEE_FONT);
    doc.registerFont('Rupee-Bold', RUPEE_BOLD_FONT);
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    const brand = BRAND[quotation.communityKey] || BRAND.marketing;
    const drawMoney = (value, x, top, width, { bold = false, size = 8.5 } = {}) => {
      const number = money(value);
      const numberFont = bold ? 'Helvetica-Bold' : 'Helvetica';
      const rupeeFont = bold ? 'Rupee-Bold' : 'Rupee';
      const currencyLabel = '₹ ';
      doc.font(numberFont).fontSize(size);
      const numberWidth = doc.widthOfString(number);
      doc.font(rupeeFont).fontSize(size);
      const symbolWidth = doc.widthOfString(currencyLabel);
      const start = x + Math.max(0, width - numberWidth - symbolWidth);
      doc
        .fillColor(bold ? brand.color : '#374151')
        .text(currencyLabel, start, top, { lineBreak: false });
      doc.font(numberFont).text(number, start + symbolWidth, top, { lineBreak: false });
    };

    doc.rect(0, 0, 595.28, 112).fill('#FFFFFF');
    doc.rect(0, 0, 595.28, 7).fill(brand.color);
    const unitLogoPath = UNIT_LOGOS[quotation.communityKey];
    let logoDrawn = false;
    if (unitLogoPath && fs.existsSync(unitLogoPath)) {
      try {
        doc.image(unitLogoPath, 42, 18, { fit: [105, 58], align: 'left', valign: 'center' });
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
    if (quotation.communityKey === 'live') {
      doc.text(`Type: ${quotation.quotationMode === 'rental' ? 'Rental' : 'Sale'}`, 42, y + 49);
    }
    doc.text(`Company GSTIN: ${safe(quotation.companyGstin, 'Not provided')}`, 42, y + 64, {
      width: 270,
    });
    doc.font('Helvetica-Bold').fillColor('#111827').text('BILL TO', 330, y);
    doc
      .font('Helvetica')
      .fillColor('#4B5563')
      .text(safe(quotation.clientCompany || quotation.clientName), 330, y + 19, { width: 220 });
    doc.text(safe(quotation.clientName), 330, y + 34, { width: 220 });
    doc.text(safe(quotation.clientEmail), 330, y + 49, { width: 220 });
    if (quotation.clientPhone) doc.text(quotation.clientPhone, 330, y + 64, { width: 220 });
    if (quotation.clientAddress) doc.text(quotation.clientAddress, 330, y + 79, { width: 220 });

    y = Math.max(y + 123, doc.y + 12);
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

    const rental = quotation.communityKey === 'live' && quotation.quotationMode === 'rental';
    const widths = rental ? [22, 132, 60, 36, 62, 64, 42, 93] : [24, 163, 60, 65, 70, 45, 84];
    const headers = rental
      ? ['#', 'Description', 'Qty / Area', 'Days', 'Unit', 'Rate', 'Tax', 'Amount']
      : ['#', 'Description', 'Qty / Area', 'Unit', 'Rate', 'Tax', 'Amount'];
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
        if (!header && value && typeof value === 'object' && 'currency' in value) {
          drawMoney(value.currency, x + 5, top + 8, widths[index] - 10);
        } else {
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
        }
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
      const values = rental
        ? [
            index + 1,
            item.description,
            item.quantity,
            item.days || 1,
            item.unit || 'Unit',
            { currency: item.unitRate },
            `${item.taxRate}%`,
            { currency: item.amount },
          ]
        : [
            index + 1,
            item.description,
            item.quantity,
            item.unit || 'Unit',
            { currency: item.unitRate },
            `${item.taxRate}%`,
            { currency: item.amount },
          ];
      y = drawRow(values, y);
    });

    y += 16;
    const totalX = 330;
    const totalLine = (label, value, bold = false) => {
      doc
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(bold ? 10.5 : 9)
        .fillColor(bold ? brand.color : '#4B5563')
        .text(label, totalX, y, { width: 105 });
      drawMoney(value, 438, y, 115, { bold, size: bold ? 10.5 : 9 });
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
    const notes = String(quotation.notes || '')
      .split(/\r?\n/)
      .map((note) => note.trim())
      .filter(Boolean);
    if (notes.length) {
      doc
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('NOTES', 42, y + 5);
      y += 22;
      notes.forEach((note) => {
        if (y > 720) {
          doc.addPage();
          y = 48;
        }
        doc.fillColor(brand.color).font('Helvetica-Bold').fontSize(9).text('•', 42, y);
        doc
          .fillColor('#4B5563')
          .font('Helvetica')
          .fontSize(8.5)
          .text(note.replace(/^[•\-]\s*/, ''), 55, y, { width: 485 });
        y = doc.y + 7;
      });
      y += 5;
    }
    doc
      .fillColor('#111827')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('PAYMENT TERMS', 42, y + 5);
    y += 22;
    const paymentTerms = String(quotation.terms || '')
      .split(/\r?\n/)
      .map((term) => term.trim())
      .filter(Boolean);
    (paymentTerms.length
      ? paymentTerms
      : ['Payment terms will be agreed with the client.']
    ).forEach((term) => {
      if (y > 720) {
        doc.addPage();
        y = 48;
      }
      doc.fillColor(brand.color).font('Helvetica-Bold').fontSize(9).text('•', 42, y);
      doc
        .fillColor('#4B5563')
        .font('Helvetica')
        .fontSize(8.5)
        .text(term.replace(/^[•\-–]\s*/, ''), 55, y, { width: 485 });
      y = doc.y + 7;
    });

    if (quotation.communityKey === 'live') {
      y += 8;
      if (y > 660) {
        doc.addPage();
        y = 48;
      }
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9).text('BANK DETAILS', 42, y);
      doc.fillColor('#4B5563').font('Helvetica').fontSize(8.5);
      doc.text("A/c Holder's Name : Brainadz Live Pvt. Ltd.", 42, y + 15, { width: 300 });
      doc.text('Bank Name : ICICI Bank', 42, y + 29, { width: 300 });
      doc.text('A/c No. : 057105004479', 42, y + 43, { width: 300 });
      doc.text('RTGS/NEFT/ & IFS Code : ICIC0000571', 42, y + 57, { width: 300 });
    }

    const footerY = 770;
    const preparedByY = footerY - 24;
    if (doc.y > preparedByY - 12) doc.addPage();
    doc
      .fillColor('#374151')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(`Prepared by: ${safe(quotation.createdBy?.name)}`, 42, preparedByY, {
        width: 511,
        height: 18,
        ellipsis: true,
      });
    doc.moveTo(42, footerY).lineTo(553, footerY).strokeColor('#D1D5DB').stroke();
    doc
      .fillColor('#6B7280')
      .font('Helvetica')
      .fontSize(8)
      .text(
        quotation.companyAddress ||
          process.env.COMPANY_ADDRESS ||
          'Apex Square III, UGF, Plot 6, Pocket B-3, Sector 17, Dwarka, New Delhi 110075',
        42,
        footerY + 8,
        { width: 300, height: 24, ellipsis: true },
      );
    const footerCompanyDetails = [
      quotation.companyGstin ? `GSTIN: ${quotation.companyGstin}` : '',
      String(quotation.createdBy?.email || '').trim(),
    ]
      .filter(Boolean)
      .join('\n');
    doc.text(footerCompanyDetails, 353, footerY + 8, {
      width: 200,
      height: 24,
      ellipsis: true,
      align: 'right',
    });
    doc.end();
  });

module.exports = { generateQuotationPdf };
