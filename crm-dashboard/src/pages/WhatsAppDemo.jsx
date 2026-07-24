import { useMemo, useState } from 'react';

const demoRecipients = [
  {
    id: 'grp-aahar-2025',
    type: 'Group',
    name: 'Aahar 2025 Leads',
    phone: '248 contacts',
    source: 'Uploaded Excel data',
    tone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    id: 'grp-followups',
    type: 'Group',
    name: 'Follow-up Required',
    phone: '64 contacts',
    source: 'CRM status filter',
    tone: 'bg-violet-50 text-violet-700 border-violet-200',
  },
  {
    id: 'grp-pending',
    type: 'Group',
    name: 'Pending Calls',
    phone: '118 contacts',
    source: 'CRM status filter',
    tone: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    id: 'person-forisca',
    type: 'Person',
    name: 'Forisca Foods',
    phone: '+91 98765 43210',
    source: 'Aahar 2025',
    tone: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    id: 'person-hptdc',
    type: 'Person',
    name: 'HPTDC',
    phone: '+91 98111 22557',
    source: 'Travel dataset',
    tone: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    id: 'person-prakriti',
    type: 'Person',
    name: 'Prakriti Wellness',
    phone: '+91 90000 76422',
    source: 'Expo leads',
    tone: 'bg-blue-50 text-blue-700 border-blue-200',
  },
];

const templates = [
  {
    title: 'Follow-up',
    message:
      'Hi {name}, this is a quick follow-up from Company CRM. Are you available for a short discussion today?',
  },
  {
    title: 'Meeting reminder',
    message:
      'Hello {name}, reminder for our scheduled meeting. Please confirm your availability. Thank you.',
  },
  {
    title: 'Offer intro',
    message:
      'Hi {name}, we have a CRM solution update that may help your team manage leads faster. Would you like a demo?',
  },
];

const initialLogs = [
  {
    id: 'demo-1',
    recipientName: 'Aahar 2025 Leads',
    type: 'Group',
    status: 'Demo sent',
    message: 'Hi Aahar 2025 Leads, this is a quick follow-up...',
    createdAt: new Date().toISOString(),
  },
];

const loadLogs = () => {
  try {
    const savedLogs = localStorage.getItem('whatsappDemoLogs');
    return savedLogs ? JSON.parse(savedLogs) : initialLogs;
  } catch {
    return initialLogs;
  }
};

const formatTime = (value) =>
  new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

const WhatsAppDemo = () => {
  const [selectedIds, setSelectedIds] = useState(['grp-aahar-2025']);
  const [message, setMessage] = useState(templates[0].message);
  const [campaignName, setCampaignName] = useState('June lead follow-up');
  const [logs, setLogs] = useState(loadLogs);
  const [notice, setNotice] = useState('');

  const selectedRecipients = useMemo(
    () => demoRecipients.filter((recipient) => selectedIds.includes(recipient.id)),
    [selectedIds],
  );

  const previewRecipient = selectedRecipients[0] || demoRecipients[0];
  const previewMessage = message.replaceAll('{name}', previewRecipient.name);

  const toggleRecipient = (recipientId) => {
    setNotice('');
    setSelectedIds((previous) =>
      previous.includes(recipientId)
        ? previous.filter((id) => id !== recipientId)
        : [...previous, recipientId],
    );
  };

  const selectByType = (type) => {
    setNotice('');
    setSelectedIds(
      demoRecipients
        .filter((recipient) => recipient.type === type)
        .map((recipient) => recipient.id),
    );
  };

  const handleSendDemo = () => {
    if (selectedRecipients.length === 0) {
      setNotice('Select at least one group or person.');
      return;
    }

    if (!message.trim()) {
      setNotice('Write a WhatsApp message first.');
      return;
    }

    const newLogs = selectedRecipients.map((recipient, index) => ({
      id: `${Date.now()}-${recipient.id}`,
      recipientName: recipient.name,
      type: recipient.type,
      status: index % 4 === 0 ? 'Queued' : 'Demo sent',
      message: message.replaceAll('{name}', recipient.name),
      createdAt: new Date().toISOString(),
    }));
    const nextLogs = [...newLogs, ...logs].slice(0, 12);

    setLogs(nextLogs);
    localStorage.setItem('whatsappDemoLogs', JSON.stringify(nextLogs));
    setNotice(
      `Demo campaign "${campaignName}" prepared for ${selectedRecipients.length} recipient${selectedRecipients.length > 1 ? 's' : ''}.`,
    );
  };

  return (
    <div className="w-full space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-r from-white via-white to-emerald-50 p-6 shadow-sm">
        <span className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-emerald-200/70 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold text-emerald-600">WhatsApp campaign demo</p>
            <h1 className="mt-1.5 text-2xl font-semibold text-slate-950">
              Bulk WhatsApp Messaging
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Select CRM groups or individual contacts, prepare a message, and show the client how
              bulk messaging will work once WhatsApp API is connected.
            </p>
          </div>
          <span className="w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
            Demo mode: no real WhatsApp message is sent
          </span>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Recipients</h2>
              <p className="mt-1 text-sm text-slate-500">
                Choose multiple groups or people from CRM.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => selectByType('Group')}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Groups
              </button>
              <button
                type="button"
                onClick={() => selectByType('Person')}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                People
              </button>
            </div>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            {demoRecipients.map((recipient) => (
              <button
                key={recipient.id}
                type="button"
                onClick={() => toggleRecipient(recipient.id)}
                className={`rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
                  selectedIds.includes(recipient.id)
                    ? 'border-emerald-300 bg-emerald-50/70 ring-2 ring-emerald-100'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${recipient.tone}`}
                  >
                    {recipient.type}
                  </span>
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                      selectedIds.includes(recipient.id)
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-slate-300 text-transparent'
                    }`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-3.5 w-3.5 fill-none stroke-current"
                      strokeWidth="3"
                    >
                      <path d="m5 12 4 4L19 6" />
                    </svg>
                  </span>
                </div>
                <h3 className="mt-3 font-semibold text-slate-950">{recipient.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{recipient.phone}</p>
                <p className="mt-2 text-xs font-medium text-slate-400">{recipient.source}</p>
              </button>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-base font-semibold text-slate-950">Message composer</h2>
            <p className="mt-1 text-sm text-slate-500">
              Use <span className="font-semibold text-slate-700">{'{name}'}</span> to personalize
              each message.
            </p>
          </div>
          <div className="space-y-4 p-5">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Campaign name</span>
              <input
                type="text"
                value={campaignName}
                onChange={(event) => setCampaignName(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <div>
              <span className="mb-2 block text-xs font-medium text-slate-600">Quick templates</span>
              <div className="flex flex-wrap gap-2">
                {templates.map((template) => (
                  <button
                    key={template.title}
                    type="button"
                    onClick={() => setMessage(template.message)}
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    {template.title}
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Message</span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows="6"
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-slate-500">WhatsApp preview</p>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-500">
                  {selectedRecipients.length} selected
                </span>
              </div>
              <div className="mt-3 max-w-md rounded-2xl rounded-tl-sm bg-emerald-500 px-4 py-3 text-sm leading-6 text-white shadow-sm">
                {previewMessage}
              </div>
            </div>

            {notice && (
              <p
                className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                  notice.includes('Select') || notice.includes('Write')
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                }`}
              >
                {notice}
              </p>
            )}

            <button
              type="button"
              onClick={handleSendDemo}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
                <path d="M22 2 11 13" />
                <path d="m22 2-7 20-4-9-9-4Z" />
              </svg>
              Send demo campaign
            </button>
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">API-ready flow</h2>
          <div className="mt-4 space-y-3">
            {[
              ['1', 'Select CRM audience', 'Groups, filtered statuses, or one-to-one contact.'],
              ['2', 'Compose message', 'Templates and {name} personalization supported.'],
              [
                '3',
                'Send through API',
                'Later we plug WhatsApp Cloud API / provider webhook here.',
              ],
            ].map(([step, title, copy]) => (
              <div key={step} className="flex gap-3 rounded-xl border border-slate-200 p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-700">
                  {step}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{title}</p>
                  <p className="mt-1 text-sm text-slate-500">{copy}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-base font-semibold text-slate-950">Demo delivery log</h2>
            <p className="mt-1 text-sm text-slate-500">
              Shows how sent, queued, and campaign history will appear.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-5 py-3">Recipient</th>
                  <th className="whitespace-nowrap px-5 py-3">Type</th>
                  <th className="px-5 py-3">Message</th>
                  <th className="whitespace-nowrap px-5 py-3">Status</th>
                  <th className="whitespace-nowrap px-5 py-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="transition hover:bg-slate-50">
                    <td className="px-5 py-4 font-semibold text-slate-900">{log.recipientName}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">{log.type}</td>
                    <td className="max-w-md truncate px-5 py-4 text-slate-500">{log.message}</td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          log.status === 'Queued'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                      {formatTime(log.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  );
};

export default WhatsAppDemo;
