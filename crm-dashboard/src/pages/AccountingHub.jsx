import { ReceiptText } from 'lucide-react';
import BusinessResourcePage from '../components/BusinessResourcePage';

const money = (value) => `Rs ${Math.round(Number(value || 0)).toLocaleString('en-IN')}`;

const fields = [
  {
    name: 'type',
    label: 'Record type',
    type: 'select',
    options: ['quotation', 'invoice'],
    defaultValue: 'quotation',
  },
  { name: 'client', label: 'Client', required: true },
  { name: 'amount', label: 'Amount', type: 'number', defaultValue: 0 },
  { name: 'gst', label: 'GST', type: 'number', defaultValue: 0 },
  { name: 'discount', label: 'Discount', type: 'number', defaultValue: 0 },
  { name: 'paid', label: 'Paid', type: 'number', defaultValue: 0 },
  {
    name: 'issueDate',
    label: 'Issue date',
    type: 'date',
    defaultValue: new Date().toISOString().slice(0, 10),
  },
  { name: 'dueDate', label: 'Due date', type: 'date' },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    options: ['Draft', 'Sent', 'Revised', 'Accepted', 'Paid', 'Partially Paid', 'Overdue'],
    defaultValue: 'Draft',
  },
  { name: 'owner', label: 'Owner', defaultValue: 'Accounts' },
  {
    name: 'notes',
    label: 'Notes',
    type: 'textarea',
    placeholder: 'Payment terms, GST notes, discount approval...',
  },
];

const gross = (item) =>
  Number(item.amount || 0) + Number(item.gst || 0) - Number(item.discount || 0);
const pending = (item) => Math.max(gross(item) - Number(item.paid || 0), 0);

const columns = [
  {
    key: 'code',
    label: 'Code',
    width: 'w-32',
    render: (item) => <span className="font-bold text-blue-700">{item.code}</span>,
  },
  {
    key: 'type',
    label: 'Type',
    width: 'w-28',
    render: (item) => <span className="capitalize">{item.type}</span>,
  },
  { key: 'client', label: 'Client', width: 'w-56' },
  { key: 'amount', label: 'Gross', width: 'w-36', render: (item) => money(gross(item)) },
  { key: 'paid', label: 'Paid', width: 'w-32', render: (item) => money(item.paid) },
  {
    key: 'pending',
    label: 'Pending',
    width: 'w-32',
    render: (item) => (item.type === 'invoice' ? money(pending(item)) : '-'),
  },
  {
    key: 'status',
    label: 'Status',
    width: 'w-36',
    render: (item) => (
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
        {item.status}
      </span>
    ),
  },
];

const stats = (items) => {
  const invoices = items.filter((item) => item.type === 'invoice');
  const quotations = items.filter((item) => item.type === 'quotation');
  const invoiceValue = invoices.reduce((sum, item) => sum + gross(item), 0);
  const paid = invoices.reduce((sum, item) => sum + Number(item.paid || 0), 0);
  const pendingValue = invoices.reduce((sum, item) => sum + pending(item), 0);

  return [
    { label: 'Quotations', value: quotations.length, note: 'Commercial proposals' },
    { label: 'Invoices', value: invoices.length, note: 'Billing records' },
    { label: 'Invoice Value', value: money(invoiceValue), note: `${money(paid)} collected` },
    { label: 'Pending', value: money(pendingValue), note: 'Collection balance' },
  ];
};

const AccountingHub = () => (
  <BusinessResourcePage
    resource="finance"
    title="Accounting"
    eyebrow="Quotations, invoices, GST and payment tracking"
    description="Create quotation and invoice records with GST, discount, paid amount and collection status."
    icon={ReceiptText}
    fields={fields}
    columns={columns}
    stats={stats}
    emptyText="No finance records found. Create a quotation or invoice."
    createLabel="Create Finance Record"
  />
);

export default AccountingHub;
