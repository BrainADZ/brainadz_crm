const PDFDocument = require('pdfkit');

const RED = '#BE302B';
const INK = '#27243F';
const MUTED = '#626262';
const LIGHT = '#F7F7F5';
const DEFAULT_DELIVERABLES = [
  'Marketing audit, objective alignment and channel planning',
  'Campaign roadmap and agreed monthly execution plan',
  'Creative, content or technical execution for selected services',
  'Ongoing optimization and monthly performance reporting',
];

const money = (value) =>
  `INR ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const safe = (value, fallback = '-') => String(value || '').trim() || fallback;
const serviceLabel = (value) =>
  ({
    'social-media': 'Social Media Marketing',
    'paid-ads': 'Paid Advertising',
  })[value] || safe(value);
const logoBuffer = (dataUrl) => {
  const match = String(dataUrl || '').match(/^data:image\/(?:png|jpe?g);base64,(.+)$/i);
  return match ? Buffer.from(match[1], 'base64') : null;
};

const generateSocialMediaProposalPdf = (proposal) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const unitName = proposal.businessUnitId?.name || 'BrainADZ Marketing';
    const services = proposal.proposalServices?.length
      ? proposal.proposalServices
      : ['Marketing Services'];
    const deliverables = proposal.deliverables?.length
      ? proposal.deliverables
      : DEFAULT_DELIVERABLES;
    const uploadedLogo = logoBuffer(proposal.logoDataUrl);

    const drawHexagon = (centerX, centerY, radius) => {
      const points = Array.from({ length: 6 }, (_, index) => {
        const angle = (Math.PI / 3) * index;
        return [centerX + radius * Math.cos(angle), centerY + radius * Math.sin(angle)];
      });

      doc.moveTo(points[0][0], points[0][1]);
      points.slice(1).forEach(([x, y]) => doc.lineTo(x, y));
      doc.closePath().stroke();
    };

    const drawHexPattern = (startX, startY, columns, rows, radius, opacity = 0.05) => {
      const horizontalGap = radius * 1.75;
      const verticalGap = radius * 1.52;

      doc.save().opacity(opacity).lineWidth(0.7).strokeColor(INK);
      for (let column = 0; column < columns; column += 1) {
        for (let row = 0; row < rows; row += 1) {
          drawHexagon(
            startX + column * horizontalGap,
            startY + row * verticalGap + (column % 2 ? verticalGap / 2 : 0),
            radius,
          );
        }
      }
      doc.restore();
    };

    const decorate = () => {
      doc.rect(0, 0, pageWidth, pageHeight).fill('#FFFFFF');
      doc.rect(0, 0, 198, 6).fill(RED);
      doc.rect(198, 0, 198, 6).fill(INK);
      doc.rect(396, 0, pageWidth - 396, 6).fill('#E7E7E4');
      doc.rect(0, pageHeight - 6, 198, 6).fill(RED);
      doc.rect(198, pageHeight - 6, 198, 6).fill(INK);
      doc.rect(396, pageHeight - 6, pageWidth - 396, 6).fill('#E7E7E4');
      drawHexPattern(416, 66, 7, 19, 17, 0.035);
    };
    const addPage = () => {
      doc.addPage({ size: 'A4', margin: 0 });
      decorate();
    };
    const title = (text, y = 54, size = 25) =>
      doc.fillColor(RED).font('Helvetica-Bold').fontSize(size).text(text, 42, y, { width: 510 });
    const paragraph = (text, y, options = {}) => {
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(options.size || 10.5)
        .text(text, options.x || 42, y, {
          width: options.width || 500,
          lineGap: options.lineGap || 5,
          align: options.align || 'left',
        });
      return doc.y;
    };
    const bullet = (text, y, width = 490) => {
      doc.circle(48, y + 5, 2.2).fill(RED);
      doc.fillColor(INK).font('Helvetica').fontSize(10).text(text, 58, y, { width, lineGap: 3 });
      return doc.y + 8;
    };
    const drawClientLogo = (x, y, maxWidth = 130, maxHeight = 56) => {
      if (uploadedLogo) {
        try {
          doc.image(uploadedLogo, x, y, {
            fit: [maxWidth, maxHeight],
            align: 'left',
            valign: 'center',
          });
          return;
        } catch {
          return;
        }
      }
    };

    const drawMasterWordmark = (x, y, width, size = 42) => {
      doc
        .fillColor(INK)
        .font('Helvetica-Bold')
        .fontSize(size)
        .text('BrainADZ', x, y, { width, align: 'center' });
    };

    const drawMarketingWordmark = (x, y, width, centered = true) => {
      const align = centered ? 'center' : 'left';
      doc
        .fillColor(INK)
        .font('Helvetica-Bold')
        .fontSize(27)
        .text('BrainADZ', x, y, { width, align });
      doc
        .fillColor(RED)
        .font('Helvetica-Bold')
        .fontSize(22)
        .text('Marketing', x, y + 29, { width, align });
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(7.5)
        .text('Ideas That Spark Momentum', x, y + 55, { width, align });
    };

    const drawVerticalBrand = (name, tagline, x, y, width) => {
      doc
        .fillColor(INK)
        .font('Helvetica-Bold')
        .fontSize(18)
        .text('BrainADZ', x, y, { width, align: 'center' });
      doc
        .fillColor(RED)
        .font('Helvetica-Bold')
        .fontSize(name === 'Marketing' ? 17 : 20)
        .text(name, x, y + 23, { width, align: 'center' });
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(6.5)
        .text(tagline, x, y + 49, { width, align: 'center' });
    };

    const drawContactCard = (label, lines, x, y, width, accent = RED) => {
      doc.roundedRect(x, y, width, 82, 6).fillAndStroke('#FFFFFF', '#E6E6E2');
      doc.rect(x, y, 7, 82).fill(accent);
      doc
        .fillColor(INK)
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(label.toUpperCase(), x + 18, y + 14, { width: width - 30 });
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(7.5)
        .text(lines, x + 18, y + 31, { width: width - 30, lineGap: 3 });
    };

    decorate();
    doc
      .fillColor(MUTED)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('PREPARED BY', 64, 104, { width: 220, characterSpacing: 1.4 });
    drawMarketingWordmark(64, 128, 230, false);
    doc.rect(64, 216, 74, 4).fill(RED);
    doc.rect(138, 216, 74, 4).fill(INK);
    doc.rect(212, 216, 74, 4).fill('#DADAD6');
    doc
      .fillColor(RED)
      .font('Helvetica-Bold')
      .fontSize(32)
      .text('DIGITAL MARKETING', 64, 298, { width: 430 });
    doc.fillColor('#777777').fontSize(28).text('GROWTH & CAMPAIGN', 64, 340, { width: 430 });
    doc.fillColor(RED).fontSize(37).text('PROPOSAL', 64, 379, { width: 430 });
    doc
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(9)
      .text(services.map(serviceLabel).join('  |  '), 64, 436, {
        width: 430,
        height: 32,
        ellipsis: true,
      });

    doc.roundedRect(64, 506, 467, 126, 9).fillAndStroke('#F7F7F5', '#E5E5E1');
    doc
      .fillColor(MUTED)
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .text('PREPARED FOR', 84, 528, { width: 250, characterSpacing: 1.1 });
    doc
      .fillColor(INK)
      .font('Helvetica-Bold')
      .fontSize(17)
      .text(safe(proposal.clientCompany || proposal.clientName), 84, 549, {
        width: uploadedLogo ? 280 : 420,
        height: 24,
        ellipsis: true,
      });
    doc
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(8.5)
      .text(`${proposal.quotationNumber}  |  ${proposal.quotationDate}`, 84, 586, { width: 300 });
    drawClientLogo(391, 531, 116, 65);

    doc
      .fillColor('#8A8A8A')
      .font('Helvetica')
      .fontSize(7)
      .text('CONFIDENTIAL BUSINESS PROPOSAL', 64, 766, {
        width: 467,
        align: 'left',
        characterSpacing: 0.8,
      });

    addPage();
    title(`Thank You For Choosing ${unitName}`, 64, 22);
    let y = paragraph(`Dear ${safe(proposal.clientName)},`, 115);
    y = paragraph(
      'Thank you for considering us as your digital marketing partner. We combine planning, content, design and performance insights to build a consistent and meaningful online presence for your brand.',
      y + 18,
    );
    y = paragraph(
      'Our team focuses on clear communication, brand-led storytelling and measurable execution. The following proposal presents the recommended approach, deliverables and commercial investment for your business.',
      y + 16,
    );
    doc.roundedRect(42, y + 30, 511, 145, 8).fill(LIGHT);
    doc
      .fillColor(INK)
      .font('Helvetica-Bold')
      .fontSize(11)
      .text('PROPOSAL FOR', 62, y + 50);
    doc
      .fillColor(RED)
      .fontSize(19)
      .text(safe(proposal.clientCompany || proposal.clientName), 62, y + 72, { width: 450 });
    doc
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(9.5)
      .text(safe(proposal.subject), 62, y + 103, { width: 450 });
    doc.text(`Valid until: ${proposal.validUntil}`, 62, y + 126);
    doc
      .fillColor(INK)
      .font('Helvetica-Bold')
      .fontSize(10)
      .text('Best regards,', 42, y + 215);
    doc.fillColor(RED).text(proposal.createdBy?.name || 'BrainADZ Marketing Team', 42, y + 234);

    addPage();
    title('Strategy', 55, 28);
    doc
      .fillColor(RED)
      .font('Helvetica-Bold')
      .fontSize(17)
      .text('Stage 01 — Foundation & Planning', 42, 110);
    y = 145;
    y = bullet(
      'Audit the current digital presence, competitors, audience and communication gaps.',
      y,
    );
    y = bullet(
      'Define channel priorities, audience, messaging and a practical execution roadmap for the selected services.',
      y,
    );
    y = bullet(
      'Align activities with business goals, seasonal opportunities and priority products or services.',
      y,
    );
    doc
      .fillColor(RED)
      .font('Helvetica-Bold')
      .fontSize(17)
      .text('Stage 02 — Create, Publish & Engage', 42, y + 22);
    y += 60;
    y = bullet(
      'Execute approved creative, media, content or technical activities for the selected marketing services.',
      y,
    );
    y = bullet(
      'Maintain consistent communication, quality control and timely approvals across the engagement.',
      y,
    );
    doc
      .fillColor(RED)
      .font('Helvetica-Bold')
      .fontSize(17)
      .text('Stage 03 — Measure & Optimize', 42, y + 22);
    y += 60;
    y = bullet('Track agreed performance indicators and share clear progress updates.', y);
    y = bullet(
      'Optimize campaigns, content, targeting or technical priorities using performance insights.',
      y,
    );

    addPage();
    title('Deliverables', 55, 28);
    doc
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(10)
      .text('The points below remain fully editable for every client proposal.', 42, 94);
    y = 130;
    deliverables.forEach((item) => {
      if (y > 745) {
        addPage();
        title('Deliverables — Continued', 55, 24);
        y = 110;
      }
      y = bullet(item, y, 465);
    });
    doc.roundedRect(42, Math.min(y + 18, 700), 511, 78, 7).fill('#FFF5F4');
    doc
      .fillColor(RED)
      .font('Helvetica-Bold')
      .fontSize(10)
      .text('SELECTED SERVICES', 60, Math.min(y + 38, 720));
    doc
      .fillColor(INK)
      .font('Helvetica')
      .fontSize(10.5)
      .text(services.map(serviceLabel).join('  •  '), 60, Math.min(y + 57, 739), { width: 470 });

    addPage();
    title('Service Overview & Investment', 55, 25);
    doc
      .fillColor(INK)
      .font('Helvetica-Bold')
      .fontSize(10)
      .text('Scope item', 52, 120, { width: 275 });
    doc.text('Qty', 332, 120, { width: 45, align: 'right' });
    doc.text('Rate', 390, 120, { width: 72, align: 'right' });
    doc.text('Amount', 472, 120, { width: 72, align: 'right' });
    doc.moveTo(42, 142).lineTo(553, 142).strokeColor(RED).lineWidth(2).stroke();
    y = 157;
    proposal.items.forEach((item, index) => {
      if (y > 610) {
        addPage();
        title('Investment — Continued', 55, 23);
        y = 112;
      }
      if (index % 2 === 0) doc.rect(42, y - 7, 511, 38).fill(LIGHT);
      doc
        .fillColor(INK)
        .font('Helvetica')
        .fontSize(9)
        .text(item.description, 52, y, { width: 270, height: 25, ellipsis: true });
      doc.text(String(item.quantity), 332, y, { width: 45, align: 'right' });
      doc.text(money(item.unitRate), 382, y, { width: 80, align: 'right' });
      doc.text(money(item.amount), 470, y, { width: 74, align: 'right' });
      y += 38;
    });
    y += 18;
    const totalLine = (label, value, bold = false) => {
      doc
        .fillColor(bold ? RED : MUTED)
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(bold ? 11 : 9.5)
        .text(label, 330, y, { width: 95 });
      doc.text(money(value), 430, y, { width: 123, align: 'right' });
      y += bold ? 25 : 19;
    };
    totalLine('Subtotal', proposal.subtotal);
    totalLine('Discount', proposal.discountAmount);
    totalLine('GST', proposal.taxAmount);
    doc
      .moveTo(330, y - 5)
      .lineTo(553, y - 5)
      .strokeColor(RED)
      .stroke();
    totalLine('Grand total', proposal.grandTotal, true);
    doc
      .fillColor(INK)
      .font('Helvetica-Bold')
      .fontSize(10)
      .text('Commercial notes', 42, Math.max(y + 20, 600));
    paragraph(
      safe(
        proposal.terms,
        'Payment terms and media budget will be finalized before campaign activation.',
      ),
      Math.max(y + 40, 620),
      { size: 9.2 },
    );

    addPage();
    drawHexPattern(48, 88, 12, 15, 25, 0.022);
    drawMasterWordmark(72, 100, 451, 48);
    doc
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(8)
      .text('ONE TEAM. THREE SPECIALIST VERTICALS.', 72, 161, {
        width: 451,
        align: 'center',
        characterSpacing: 1.1,
      });

    drawVerticalBrand('Marketing', 'Ideas That Spark Momentum', 42, 238, 150);
    drawVerticalBrand('Live', 'From Vision to Visibility', 222, 238, 150);
    drawVerticalBrand('Exhibits', 'Where Elegance Meets Execution', 402, 238, 150);

    doc.rect(42, 326, 166, 2).fill(INK);
    doc.rect(208, 326, 178, 2).fill(RED);
    doc.rect(386, 326, 167, 2).fill('#D7D7D3');

    doc
      .fillColor(INK)
      .font('Helvetica-Bold')
      .fontSize(18)
      .text('Thank you for the opportunity.', 42, 376, {
        width: 511,
        align: 'center',
      });
    doc
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(9)
      .text('We look forward to building meaningful momentum for your brand.', 42, 405, {
        width: 511,
        align: 'center',
      });

    drawContactCard(
      'Phone',
      process.env.COMPANY_PHONE || '+91 95404 68023\n+91 92890 92708',
      42,
      470,
      246,
      RED,
    );
    drawContactCard(
      'Web & Email',
      `${process.env.COMPANY_WEBSITE || 'www.brainADZ.marketing'}\n${process.env.COMPANY_EMAIL || 'preeti@brainADZ.com'}`,
      307,
      470,
      246,
      INK,
    );
    drawContactCard(
      'Head Office - New Delhi',
      process.env.COMPANY_ADDRESS ||
        'Apex Square 3, UGF, Plot 6, Pocket B-3, Sector 17, Dwarka, New Delhi 110075',
      42,
      570,
      246,
      RED,
    );
    drawContactCard(
      'Branch Office - Mumbai',
      process.env.COMPANY_BRANCH_ADDRESS ||
        '643/6th Floor, IJMIMA Complex, Off Link Road, Mindspace, Malad West, Mumbai 400064',
      307,
      570,
      246,
      RED,
    );

    doc
      .fillColor('#8A8A8A')
      .font('Helvetica')
      .fontSize(7)
      .text(
        `${proposal.quotationNumber}  |  ${safe(proposal.clientCompany || proposal.clientName)}`,
        42,
        704,
        { width: 511, align: 'center', lineBreak: false },
      );

    const range = doc.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index += 1) {
      doc.switchToPage(index);
      doc
        .fillColor('#8A8A8A')
        .font('Helvetica')
        .fontSize(7.5)
        .text(`${proposal.quotationNumber}  •  ${index + 1}/${range.count}`, 42, 812, {
          width: 511,
          align: 'right',
          lineBreak: false,
        });
    }
    doc.end();
  });

module.exports = { generateSocialMediaProposalPdf };
