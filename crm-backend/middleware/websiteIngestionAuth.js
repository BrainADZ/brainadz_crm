const crypto = require('crypto');

const WEBSITE_KEY_HEADER = 'X-Website-Key';

const authenticateWebsiteIngestion = (req, res, next) => {
  const configuredKey = process.env.WEBSITE_INGESTION_KEY;
  const suppliedKey = req.get(WEBSITE_KEY_HEADER) || '';

  if (!configuredKey) {
    return res.status(503).json({
      message: 'Website enquiry ingestion is not configured',
    });
  }

  const configuredBuffer = Buffer.from(configuredKey);
  const suppliedBuffer = Buffer.from(suppliedKey);
  const isValid =
    configuredBuffer.length === suppliedBuffer.length &&
    crypto.timingSafeEqual(configuredBuffer, suppliedBuffer);

  if (!isValid) {
    return res.status(401).json({ message: 'Invalid website credentials' });
  }

  return next();
};

module.exports = authenticateWebsiteIngestion;
