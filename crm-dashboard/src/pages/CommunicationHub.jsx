import { MessageSquareText } from 'lucide-react';
import BusinessResourcePage from '../components/BusinessResourcePage';

const fields = [
  { name: 'clientName', label: 'Client name', required: true },
  { name: 'contact', label: 'Contact person' },
  {
    name: 'channel',
    label: 'Channel',
    type: 'select',
    options: ['WhatsApp', 'Email', 'SMS', 'Call', 'LinkedIn', 'Other'],
    defaultValue: 'WhatsApp',
  },
  {
    name: 'type',
    label: 'Type',
    type: 'select',
    options: ['Follow-up', 'Pitch', 'Quotation', 'Proposal', 'Reminder', 'Support'],
    defaultValue: 'Follow-up',
  },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    options: ['Draft', 'Sent', 'Failed'],
    defaultValue: 'Sent',
  },
  { name: 'owner', label: 'Owner', defaultValue: 'Admin' },
  {
    name: 'message',
    label: 'Message',
    type: 'textarea',
    required: true,
    placeholder: 'Write the communication note or sent message...',
  },
];

const columns = [
  {
    key: 'clientName',
    label: 'Client',
    width: 'w-56',
    render: (item) => <span className="font-bold text-blue-700">{item.clientName}</span>,
  },
  { key: 'contact', label: 'Contact', width: 'w-40' },
  { key: 'channel', label: 'Channel', width: 'w-32' },
  { key: 'type', label: 'Type', width: 'w-36' },
  {
    key: 'message',
    label: 'Message',
    width: 'w-80',
    render: (item) => <span className="line-clamp-2 text-slate-600">{item.message}</span>,
  },
  {
    key: 'status',
    label: 'Status',
    width: 'w-28',
    render: (item) => (
      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
        {item.status}
      </span>
    ),
  },
];

const stats = (items) => {
  const sent = items.filter((item) => item.status === 'Sent').length;
  const whatsapp = items.filter((item) => item.channel === 'WhatsApp').length;
  const email = items.filter((item) => item.channel === 'Email').length;

  return [
    { label: 'Logs', value: items.length, note: 'Communication records' },
    { label: 'Sent', value: sent, note: 'Delivered or logged' },
    { label: 'WhatsApp', value: whatsapp, note: 'WA touchpoints' },
    { label: 'Email', value: email, note: 'Email touchpoints' },
  ];
};

const CommunicationHub = () => (
  <BusinessResourcePage
    resource="communications"
    title="Communication Hub"
    eyebrow="WhatsApp, email, call and message logs"
    description="Log client communication against real CRM users and sales records. Delivery integrations can later plug into this same backend collection."
    icon={MessageSquareText}
    fields={fields}
    columns={columns}
    stats={stats}
    emptyText="No communication logs found. Add the first client message."
    createLabel="Log Communication"
  />
);

export default CommunicationHub;
