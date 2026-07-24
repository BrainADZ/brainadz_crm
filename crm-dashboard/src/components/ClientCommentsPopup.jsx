import { useState } from 'react';
import axios from 'axios';

const fieldClass =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100';

const ClientCommentsPopup = ({ client, onClose }) => {
  const [comment, setComment] = useState('');
  const [callStatus, setCallStatus] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!comment || !callStatus) {
      setError('Comment and call status are required.');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('comment', comment);
      formData.append('callStatus', callStatus);
      if (screenshot) formData.append('screenshotUrl', screenshot);

      const response = await axios.post(
        `http://localhost:5000/api/clients/${client._id}/comment`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${localStorage.getItem('employeeToken')}`,
          },
        },
      );

      if (response.status === 200) onClose();
    } catch (requestError) {
      setError('Failed to submit comment. Please check all fields.');
      console.error(requestError);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <section
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-emerald-600">Record activity</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">{client.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-sm font-semibold text-slate-500 hover:bg-slate-50"
          >
            X
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">Comment</span>
            <textarea
              className={`${fieldClass} min-h-28 resize-y`}
              placeholder="Enter call notes..."
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">Call status</span>
            <select
              className={fieldClass}
              value={callStatus}
              onChange={(event) => setCallStatus(event.target.value)}
              required
            >
              <option value="">Select call status</option>
              <option value="call done">Call done</option>
              <option value="call not received">Call not received</option>
              <option value="meeting fixed">Meeting fixed</option>
            </select>
          </label>
          <label className="block rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <span className="block text-sm font-semibold text-slate-700">Attach screenshot</span>
            <span className="mt-1 block text-xs text-slate-500">
              {screenshot?.name || 'Optional image attachment'}
            </span>
            <input
              type="file"
              className="mt-3 block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-emerald-700"
              onChange={(event) => setScreenshot(event.target.files[0])}
            />
          </label>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Submit activity
          </button>
        </form>
      </section>
    </div>
  );
};

export default ClientCommentsPopup;
