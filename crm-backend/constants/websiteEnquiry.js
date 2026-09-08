const COMMUNITIES = ['marketing', 'live', 'exhibition'];
const STATUSES = [
  'Pending',
  'Contacted',
  'Follow Up',
  'Interested',
  'Not Interested',
  'Converted',
  'Not Reachable',
];
const PRIORITIES = ['Low', 'Medium', 'High'];
const NUMBER_PREFIXES = { marketing: 'MKT', exhibition: 'EXH', live: 'LIVE' };

module.exports = { COMMUNITIES, NUMBER_PREFIXES, PRIORITIES, STATUSES };
