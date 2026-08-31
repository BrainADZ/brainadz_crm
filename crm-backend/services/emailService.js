const nodemailer = require('nodemailer');
const escapeHtml = (value) =>
  String(value || '').replace(
    /[&<>'"]/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character],
  );

const isEmailDeliveryConfigured = () =>
  ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD'].every((key) =>
    Boolean(String(process.env[key] || '').trim()),
  );

const getTransporter = () => {
  if (!isEmailDeliveryConfigured()) {
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
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
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

const sendMeetingReminderEmail = async ({ meeting, employee }) => {
  if (!employee?.email) {
    const error = new Error('The assigned employee does not have an email address');
    error.status = 400;
    throw error;
  }

  const transporter = getTransporter();
  const meetingTitle = String(meeting.meetingTitle || 'Scheduled meeting').trim();
  const clientName = String(meeting.clientName || '').trim();
  const companyName = String(meeting.companyName || '').trim();
  const contactLabel = clientName || companyName;
  const meetingDate = String(meeting.meetingDate || '').trim();
  const meetingTime = String(meeting.meetingTime || '').trim();
  const meetingMode = String(meeting.meetingMode || '').trim();
  const platformOrLocation = String(meeting.platformOrLocation || '').trim();
  const notes = String(meeting.notes || '').trim();
  const employeeName = String(employee.name || employee.email).trim();
  const crmBaseUrl = String(process.env.CRM_APP_URL || 'http://localhost:5173').replace(
    /\/+$/,
    '',
  );
  const meetingUrl = `${crmBaseUrl}/dashboard/meetings?meetingId=${encodeURIComponent(String(meeting._id || ''))}`;
  const subjectContact = contactLabel ? ` with ${contactLabel}` : '';

  const textDetails = [
    `Meeting: ${meetingTitle}`,
    clientName ? `Client: ${clientName}` : '',
    companyName && companyName !== clientName ? `Company: ${companyName}` : '',
    `Date: ${meetingDate}`,
    `Time: ${meetingTime}`,
    meetingMode ? `Mode: ${meetingMode}` : '',
    platformOrLocation ? `Platform / location: ${platformOrLocation}` : '',
    notes ? `Notes: ${notes}` : '',
  ].filter(Boolean);

  const htmlDetails = [
    ['Meeting', meetingTitle],
    clientName ? ['Client', clientName] : null,
    companyName && companyName !== clientName ? ['Company', companyName] : null,
    ['Date', meetingDate],
    ['Time', meetingTime],
    meetingMode ? ['Mode', meetingMode] : null,
    platformOrLocation ? ['Platform / location', platformOrLocation] : null,
    notes ? ['Notes', notes] : null,
  ]
    .filter(Boolean)
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#64748b;vertical-align:top">${escapeHtml(label)}</td><td style="padding:4px 0;color:#0f172a">${escapeHtml(value)}</td></tr>`,
    )
    .join('');

  return transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: employee.email,
    subject: `Meeting reminder: ${meetingTitle}${subjectContact} today at ${meetingTime}`,
    text: `Hello ${employeeName},\n\nThis is a reminder for your meeting scheduled today.\n\n${textDetails.join('\n')}\n\nOpen CRM: ${meetingUrl}\n\nRegards,\nBrainADZ CRM`,
    html: `<p>Hello ${escapeHtml(employeeName)},</p><p>This is a reminder for your meeting scheduled today.</p><table style="border-collapse:collapse">${htmlDetails}</table><p><a href="${escapeHtml(meetingUrl)}">Open the meeting in CRM</a></p><p>Regards,<br>BrainADZ CRM</p>`,
  });
};

module.exports = {
  isEmailDeliveryConfigured,
  sendQuotationEmail,
  sendMeetingReminderEmail,
};
