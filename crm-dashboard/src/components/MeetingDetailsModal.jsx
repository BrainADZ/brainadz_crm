import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { ExternalLink, Link2, Trash2, Video, X } from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { getAdminHeaders } from '../services/businessApi';
import { getMeetingJoinUrl } from '../utils/meetingLinks';

const inputClass =
  'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export default function MeetingDetailsModal({ meetingId, onClose, onUpdated, onDeleted }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [link, setLink] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const panelRef = useRef(null);
  const busyRef = useRef(false);
  busyRef.current = saving || deleting;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setData(null);
    setConfirmDelete(false);
    axios
      .get(`${API_BASE_URL}/api/meetings/${meetingId}`, {
        headers: getAdminHeaders(),
        signal: controller.signal,
      })
      .then((response) => {
        setData(response.data);
        setLink(response.data.meeting.platformOrLocation || '');
      })
      .catch((requestError) => {
        if (!controller.signal.aborted)
          setError(requestError.response?.data?.message || 'Unable to open meeting details.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [meetingId]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape' && !busyRef.current) onClose();
      if (event.key !== 'Tab') return;
      const focusable = panelRef.current?.querySelectorAll(
        'button:not(:disabled), a[href], input:not(:disabled)',
      );
      if (!focusable?.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === panelRef.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === panelRef.current)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [onClose]);

  const meeting = data?.meeting;
  const joinUrl = getMeetingJoinUrl(meeting);
  const saveLink = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await axios.patch(
        `${API_BASE_URL}/api/meetings/${meetingId}/link`,
        {
          platformOrLocation: link,
        },
        { headers: getAdminHeaders() },
      );
      setData(response.data);
      setLink(response.data.meeting.platformOrLocation);
      onUpdated(response.data.meeting);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save the meeting link.');
    } finally {
      setSaving(false);
    }
  };

  const deleteMeeting = async () => {
    setDeleting(true);
    setError('');
    try {
      await axios.delete(`${API_BASE_URL}/api/meetings/${meetingId}`, {
        headers: getAdminHeaders(),
      });
      onDeleted(meetingId);
      onClose();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to delete this meeting.');
    } finally {
      setDeleting(false);
    }
  };

  const details = meeting
    ? {
        Date: meeting.meetingDate,
        Time: meeting.meetingTime,
        Duration: `${meeting.durationMinutes || 30} minutes`,
        Status: meeting.status || 'scheduled',
        'Business unit': meeting.businessUnitId?.name || meeting.communityKey,
        Department: meeting.departmentId?.name || meeting.officeModule || 'General',
        Organizer: meeting.employee?.name || 'Not available',
        'Organizer email': meeting.employee?.email || 'Not available',
        Client: meeting.clientName || meeting.companyName || 'Not linked',
        Dataset: meeting.datasetName || meeting.dataset?.name || 'Not linked',
        Mode: meeting.meetingMode,
      }
    : {};

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/55 p-4">
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="meeting-details-title"
        tabIndex={-1}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl outline-none"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              Meeting details
            </p>
            <h2
              id="meeting-details-title"
              className="mt-1 text-xl font-semibold text-slate-950"
            >
              {meeting?.meetingTitle || 'Meeting'}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close meeting details"
            disabled={saving || deleting}
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </header>
        <div className="space-y-5 p-6">
          {loading && (
            <p
              role="status"
              className="py-12 text-center text-sm text-slate-500"
            >
              Loading meeting details...
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}
          {meeting && (
            <>
              <dl className="grid gap-4 sm:grid-cols-2">
                {Object.entries(details).map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {label}
                    </dt>
                    <dd className="mt-1 break-words text-sm text-slate-800">{value}</dd>
                  </div>
                ))}
              </dl>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Participants
                </h3>
                <p className="mt-2 text-sm text-slate-800">
                  {meeting.participantUserIds?.length
                    ? meeting.participantUserIds.map((user) => user.name || user.email).join(', ')
                    : 'Organizer only'}
                </p>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Agenda & notes
                </h3>
                <p className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  {meeting.notes || 'No agenda added.'}
                </p>
              </div>
              {meeting.meetingMode === 'Online' ? (
                <section className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Video size={17} />
                    Online meeting
                  </h3>
                  {joinUrl ? (
                    <a
                      href={joinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      <ExternalLink size={16} />
                      Join meeting
                    </a>
                  ) : (
                    <p className="text-sm text-slate-600">
                      {meeting.status === 'cancelled'
                        ? 'This meeting has been cancelled.'
                        : 'A valid join link has not been added. Ask the organizer to add the meeting link.'}
                    </p>
                  )}
                  {data.canEditLink && (
                    <form
                      onSubmit={saveLink}
                      className="space-y-2"
                    >
                      <label
                        htmlFor="meeting-join-link"
                        className="block text-xs font-semibold text-slate-600"
                      >
                        Meeting link
                      </label>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          id="meeting-join-link"
                          type="url"
                          required
                          maxLength={2048}
                          placeholder="https://meet.google.com/..."
                          value={link}
                          onChange={(event) => setLink(event.target.value)}
                          className={inputClass}
                          disabled={saving || deleting}
                        />
                        <button
                          type="submit"
                          disabled={saving || deleting}
                          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50"
                        >
                          <Link2 size={15} />
                          {saving ? 'Saving...' : 'Save link'}
                        </button>
                      </div>
                    </form>
                  )}
                </section>
              ) : (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {meeting.meetingMode === 'Phone' ? 'Phone / dial-in details' : 'Location'}
                  </h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                    {meeting.platformOrLocation || 'Not specified'}
                  </p>
                </div>
              )}
              {data.canDelete && (
                <div className="border-t border-slate-200 pt-5">
                  {confirmDelete ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                      <p className="text-sm font-semibold text-red-800">
                        Delete this meeting permanently?
                      </p>
                      <p className="mt-1 text-xs text-red-700">
                        It will be removed from the meeting schedule.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          disabled={deleting || saving}
                          onClick={deleteMeeting}
                          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          {deleting ? 'Deleting...' : 'Delete meeting'}
                        </button>
                        <button
                          type="button"
                          disabled={deleting}
                          onClick={() => setConfirmDelete(false)}
                          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setConfirmDelete(true)}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                      Delete meeting
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
