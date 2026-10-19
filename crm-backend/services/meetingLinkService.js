const normalizeMeetingLink = (value) => {
  if (typeof value !== 'string' || value.length > 2048) return '';
  let candidate = value.trim();
  if (
    /^(meet\.google\.com|[\w.-]*zoom\.us|teams\.(microsoft|live)\.com|[\w.-]*webex\.com)\//i.test(
      candidate,
    )
  ) {
    candidate = `https://${candidate}`;
  }
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    return url.href;
  } catch {
    return '';
  }
};

module.exports = { normalizeMeetingLink };
