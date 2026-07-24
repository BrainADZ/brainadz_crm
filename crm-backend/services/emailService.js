const nodemailer = require('nodemailer');
const escapeHtml = (value) =>
  String(value || '').replace(
    /[&<>'"]/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character],
  );

const getTransporter = () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    const error = new Error(
      'Email delivery is not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD and MAIL_FROM in backend .env',
    );
    error.status = 503;
    throw error;
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
};

const sendQuotationEmail = async ({ quotation, pdfBuffer }) => {
  const transporter = getTransporter();
  const documentLabel =
    ['marketing-proposal', 'social-media-proposal'].includes(quotation.documentType) ||
    /marketing/i.test(`${quotation.departmentId?.name || ''} ${quotation.departmentId?.slug || ''}`)
      ? 'proposal'
      : 'quotation';
  return transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: quotation.clientEmail,
    subject: `${quotation.quotationNumber} · ${quotation.subject}`,
    text: `Dear ${quotation.clientName},\n\nPlease find attached ${documentLabel} ${quotation.quotationNumber} for ${quotation.subject}. This ${documentLabel} is valid until ${quotation.validUntil}.\n\nRegards,\n${quotation.businessUnitId?.name || 'BrainADZ'}`,
    html: `<p>Dear ${escapeHtml(quotation.clientName)},</p><p>Please find attached ${documentLabel} <strong>${escapeHtml(quotation.quotationNumber)}</strong> for ${escapeHtml(quotation.subject)}.</p><p>This ${documentLabel} is valid until <strong>${escapeHtml(quotation.validUntil)}</strong>.</p><p>Regards,<br>${escapeHtml(quotation.businessUnitId?.name || 'BrainADZ')}</p>`,
    attachments: [
      {
        filename: `${quotation.quotationNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
};

module.exports = { sendQuotationEmail };
