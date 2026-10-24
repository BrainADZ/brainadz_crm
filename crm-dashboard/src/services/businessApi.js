import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { getValidToken } from '../utils/auth';

export const getAdminHeaders = () => ({
  Authorization: `Bearer ${getValidToken('admin') || getValidToken('employee') || ''}`,
});

export const getMyProfile = async () => {
  const response = await axios.get(`${API_BASE_URL}/api/profile`, {
    headers: getAdminHeaders(),
  });
  return response.data.user;
};

export const getBusinessSummary = async () => {
  const response = await axios.get(`${API_BASE_URL}/api/business/summary`, {
    headers: getAdminHeaders(),
  });
  return response.data;
};

export const listDevelopmentDailyReports = async () => {
  const response = await axios.get(`${API_BASE_URL}/api/business/development/daily-reports`, {
    headers: getAdminHeaders(),
  });
  return response.data;
};

export const getDevelopmentReportOptions = async () => {
  const response = await axios.get(`${API_BASE_URL}/api/business/development/report-options`, {
    headers: getAdminHeaders(),
  });
  return response.data;
};

export const listDevelopmentTeamMembers = async () => {
  const response = await axios.get(`${API_BASE_URL}/api/business/development/team-members`, {
    headers: getAdminHeaders(),
  });
  return response.data;
};

export const listDevelopmentAssignees = async () => {
  const response = await axios.get(`${API_BASE_URL}/api/business/development/assignees`, {
    headers: getAdminHeaders(),
  });
  return response.data;
};

export const listDevelopmentProjectMembers = async () => {
  const response = await axios.get(`${API_BASE_URL}/api/business/development/project-members`, {
    headers: getAdminHeaders(),
  });
  return response.data;
};

export const listDevelopmentWorkloadTasks = async () => {
  const response = await axios.get(`${API_BASE_URL}/api/business/development/workload-tasks`, {
    headers: getAdminHeaders(),
  });
  return response.data;
};

export const saveDevelopmentDailyReport = async (date, payload) => {
  const response = await axios.put(
    `${API_BASE_URL}/api/business/development/daily-reports/${date}`,
    payload,
    { headers: getAdminHeaders() },
  );
  return response.data;
};

export const uploadDevelopmentReportAttachments = async (date, communityKey, files) => {
  const form = new FormData();
  form.append('communityKey', communityKey);
  files.forEach((file) => form.append('files', file));
  const response = await axios.post(`${API_BASE_URL}/api/business/development/daily-reports/${date}/attachments`, form, {
    headers: getAdminHeaders(),
  });
  return response.data;
};

export const downloadDevelopmentReportAttachment = async (reportId, attachment) => {
  const response = await axios.get(`${API_BASE_URL}/api/business/development/daily-reports/${reportId}/attachments/${attachment._id}`, {
    headers: getAdminHeaders(), responseType: 'blob',
  });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = attachment.name;
  link.click();
  URL.revokeObjectURL(url);
};

export const listBusinessResource = async (resource) => {
  const response = await axios.get(`${API_BASE_URL}/api/business/${resource}`, {
    headers: getAdminHeaders(),
  });
  return response.data;
};

export const createBusinessResource = async (resource, payload) => {
  const response = await axios.post(`${API_BASE_URL}/api/business/${resource}`, payload, {
    headers: getAdminHeaders(),
  });
  return response.data;
};

export const updateBusinessResource = async (resource, id, payload) => {
  const response = await axios.patch(`${API_BASE_URL}/api/business/${resource}/${id}`, payload, {
    headers: getAdminHeaders(),
  });
  return response.data;
};

export const deleteBusinessResource = async (resource, id) => {
  const response = await axios.delete(`${API_BASE_URL}/api/business/${resource}/${id}`, {
    headers: getAdminHeaders(),
  });
  return response.data;
};

export const getBusinessPermissions = async () => {
  const response = await axios.get(`${API_BASE_URL}/api/business/permissions`, {
    headers: getAdminHeaders(),
  });
  return response.data;
};

export const updateBusinessPermissions = async (roleKey, modules) => {
  const response = await axios.put(
    `${API_BASE_URL}/api/business/permissions/${roleKey}`,
    { modules },
    {
      headers: getAdminHeaders(),
    },
  );
  return response.data;
};

export const getWorkStructure = async (headers = getAdminHeaders()) => {
  const response = await axios.get(`${API_BASE_URL}/api/business/work-structure`, { headers });
  return response.data;
};

export const createWorkModule = async (name) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/business/work-structure/modules`,
    { name },
    {
      headers: getAdminHeaders(),
    },
  );
  return response.data;
};

export const createWorkTeam = async (payload) => {
  const response = await axios.post(`${API_BASE_URL}/api/business/work-structure/teams`, payload, {
    headers: getAdminHeaders(),
  });
  return response.data;
};

export const createWorkDesignation = async (payload) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/business/work-structure/designations`,
    payload,
    {
      headers: getAdminHeaders(),
    },
  );
  return response.data;
};

export const deleteWorkModule = async (id) => {
  const response = await axios.delete(`${API_BASE_URL}/api/business/work-structure/modules/${id}`, {
    headers: getAdminHeaders(),
  });
  return response.data;
};

export const deleteWorkTeam = async (id) => {
  const response = await axios.delete(`${API_BASE_URL}/api/business/work-structure/teams/${id}`, {
    headers: getAdminHeaders(),
  });
  return response.data;
};

export const deleteWorkDesignation = async (id) => {
  const response = await axios.delete(
    `${API_BASE_URL}/api/business/work-structure/designations/${id}`,
    {
      headers: getAdminHeaders(),
    },
  );
  return response.data;
};
