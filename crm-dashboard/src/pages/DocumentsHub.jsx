import { FolderOpen } from 'lucide-react';
import BusinessResourcePage from '../components/BusinessResourcePage';

const fields = [
  { name: 'name', label: 'Document name', required: true, full: true },
  {
    name: 'type',
    label: 'Type',
    type: 'select',
    options: [
      'SOW',
      'WBS',
      'Proposal',
      'Quotation',
      'Invoice',
      'Client Requirements',
      'Design Files',
      'Development Files',
      'Testing Documents',
      'Final Delivery Documents',
    ],
    defaultValue: 'Proposal',
  },
  { name: 'project', label: 'Project', defaultValue: 'All Projects' },
  { name: 'owner', label: 'Owner', defaultValue: 'Admin' },
  {
    name: 'access',
    label: 'Access',
    type: 'select',
    options: ['Internal', 'Client View', 'Restricted'],
    defaultValue: 'Internal',
  },
  { name: 'fileUrl', label: 'File URL', placeholder: 'Optional link or uploaded path', full: true },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];

const columns = [
  {
    key: 'name',
    label: 'Document',
    width: 'w-64',
    render: (item) => <span className="font-bold text-blue-700">{item.name}</span>,
  },
  { key: 'type', label: 'Type', width: 'w-40' },
  { key: 'project', label: 'Project', width: 'w-56' },
  { key: 'owner', label: 'Owner', width: 'w-40' },
  {
    key: 'access',
    label: 'Access',
    width: 'w-36',
    render: (item) => (
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
        {item.access}
      </span>
    ),
  },
  {
    key: 'uploadedAt',
    label: 'Uploaded',
    width: 'w-36',
    render: (item) =>
      item.uploadedAt ? new Date(item.uploadedAt).toLocaleDateString('en-IN') : '-',
  },
];

const stats = (items) => {
  const restricted = items.filter((item) => item.access === 'Restricted').length;
  const clientView = items.filter((item) => item.access === 'Client View').length;
  const projects = new Set(items.map((item) => item.project || 'All Projects')).size;

  return [
    { label: 'Documents', value: items.length, note: 'Stored records' },
    { label: 'Projects Linked', value: projects, note: 'Document groups' },
    { label: 'Client View', value: clientView, note: 'Shareable documents' },
    { label: 'Restricted', value: restricted, note: 'Internal-only records' },
  ];
};

const DocumentsHub = () => (
  <BusinessResourcePage
    resource="documents"
    title="Documents"
    eyebrow="SOW, WBS, proposals, invoices and delivery files"
    description="Store document metadata in MongoDB and connect each record to a project or all-projects library."
    icon={FolderOpen}
    fields={fields}
    columns={columns}
    stats={stats}
    emptyText="No documents found. Add a document record."
    createLabel="Add Document"
  />
);

export default DocumentsHub;
