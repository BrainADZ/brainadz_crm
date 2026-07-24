import { BarChart3 } from 'lucide-react';
import BusinessResourcePage from '../components/BusinessResourcePage';

const money = (value) => `Rs ${Math.round(Number(value || 0)).toLocaleString('en-IN')}`;

const fields = [
  { name: 'name', label: 'Campaign name', required: true, full: true },
  {
    name: 'channel',
    label: 'Channel',
    type: 'select',
    options: ['Google Ads', 'Meta Ads', 'LinkedIn', 'Email Campaign', 'SEO', 'Referral'],
    defaultValue: 'Google Ads',
  },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    options: ['Draft', 'Active', 'Paused', 'Completed'],
    defaultValue: 'Active',
  },
  { name: 'spend', label: 'Spend', type: 'number', defaultValue: 0 },
  { name: 'impressions', label: 'Impressions', type: 'number', defaultValue: 0 },
  { name: 'clicks', label: 'Clicks', type: 'number', defaultValue: 0 },
  { name: 'leads', label: 'Leads', type: 'number', defaultValue: 0 },
  { name: 'conversions', label: 'Conversions', type: 'number', defaultValue: 0 },
  { name: 'roi', label: 'ROI', type: 'number', defaultValue: 0 },
  { name: 'cpl', label: 'CPL', type: 'number', defaultValue: 0 },
  { name: 'ctr', label: 'CTR %', type: 'number', defaultValue: 0 },
  { name: 'owner', label: 'Owner', defaultValue: 'Marketing' },
  {
    name: 'notes',
    label: 'Notes',
    type: 'textarea',
    placeholder: 'Landing page, audience, creative, next action...',
  },
];

const columns = [
  {
    key: 'name',
    label: 'Campaign',
    width: 'w-64',
    render: (item) => <span className="font-bold text-blue-700">{item.name}</span>,
  },
  { key: 'channel', label: 'Channel', width: 'w-36' },
  { key: 'spend', label: 'Spend', width: 'w-32', render: (item) => money(item.spend) },
  { key: 'leads', label: 'Leads', width: 'w-24' },
  { key: 'conversions', label: 'Conv.', width: 'w-24' },
  {
    key: 'roi',
    label: 'ROI',
    width: 'w-24',
    render: (item) => `${Number(item.roi || 0).toFixed(1)}x`,
  },
  {
    key: 'status',
    label: 'Status',
    width: 'w-32',
    render: (item) => (
      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
        {item.status}
      </span>
    ),
  },
];

const stats = (items) => {
  const spend = items.reduce((sum, item) => sum + Number(item.spend || 0), 0);
  const leads = items.reduce((sum, item) => sum + Number(item.leads || 0), 0);
  const conversions = items.reduce((sum, item) => sum + Number(item.conversions || 0), 0);
  const avgRoi = items.length
    ? items.reduce((sum, item) => sum + Number(item.roi || 0), 0) / items.length
    : 0;

  return [
    { label: 'Campaigns', value: items.length, note: 'Marketing records' },
    { label: 'Ad Spend', value: money(spend), note: 'Total spend' },
    { label: 'Generated Leads', value: leads, note: `${conversions} conversions` },
    { label: 'Average ROI', value: `${avgRoi.toFixed(1)}x`, note: 'Across campaigns' },
  ];
};

const MarketingHub = () => (
  <BusinessResourcePage
    resource="campaigns"
    title="Marketing Hub"
    eyebrow="Campaigns and performance"
    description="Track campaign spend, clicks, leads, conversions, ROI, SEO or social campaigns from the backend."
    icon={BarChart3}
    fields={fields}
    columns={columns}
    stats={stats}
    emptyText="No campaigns found. Create your first campaign to start tracking performance."
    createLabel="Add Campaign"
  />
);

export default MarketingHub;
