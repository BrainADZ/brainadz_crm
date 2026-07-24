const AuditLog = require('../models/AuditLog');

const stripSecrets = (value) => {
  if (!value || typeof value !== 'object') return value;
  const clone = JSON.parse(JSON.stringify(value));
  ['password', 'securityAnswerHash', 'token'].forEach((key) => delete clone[key]);
  return clone;
};

const getIpAddress = (req) => {
  const forwarded = req?.headers?.['x-forwarded-for'];
  return (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req?.ip) || '';
};

const writeAuditLog = async ({
  req,
  actorUserId,
  targetUserId,
  action,
  resource,
  resourceId,
  previousValue,
  newValue,
  communityKey,
  metadata,
}) =>
  AuditLog.create({
    actorUserId: actorUserId || req?.user?._id || req?.user?.id || null,
    targetUserId: targetUserId || null,
    action,
    resource,
    resourceId: String(resourceId || ''),
    previousValue: stripSecrets(previousValue),
    newValue: stripSecrets(newValue),
    communityKey: communityKey || '',
    ipAddress: getIpAddress(req),
    metadata: metadata || {},
  });

module.exports = { writeAuditLog, stripSecrets };
