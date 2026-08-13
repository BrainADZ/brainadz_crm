import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { getAdminHeaders } from './businessApi';
import { getValidToken } from '../utils/auth';

export const getRoles = async () => {
  const response = await axios.get(`${API_BASE_URL}/api/roles`, { headers: getAdminHeaders() });
  return response.data;
};

export const createRole = async (payload) => {
  const response = await axios.post(`${API_BASE_URL}/api/roles`, payload, {
    headers: getAdminHeaders(),
  });
  return response.data;
};

export const updateRole = async (roleKey, payload) => {
  const response = await axios.put(`${API_BASE_URL}/api/roles/${roleKey}`, payload, {
    headers: getAdminHeaders(),
  });
  return response.data;
};

export const resetRole = async (roleKey) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/roles/${roleKey}/reset-default`,
    {},
    { headers: getAdminHeaders() },
  );
  return response.data;
};

export const duplicateRole = async (roleKey, payload) => {
  const response = await axios.post(`${API_BASE_URL}/api/roles/${roleKey}/duplicate`, payload, {
    headers: getAdminHeaders(),
  });
  return response.data;
};

export const deleteRole = async (roleKey) => {
  const response = await axios.delete(`${API_BASE_URL}/api/roles/${roleKey}`, {
    headers: getAdminHeaders(),
  });
  return response.data;
};

export const getPermissionMeta = async () => {
  const response = await axios.get(`${API_BASE_URL}/api/permissions/resources`, {
    headers: getAdminHeaders(),
  });
  return response.data;
};

export const getCommunities = async () => {
  const response = await axios.get(`${API_BASE_URL}/api/communities`, {
    headers: getAdminHeaders(),
  });
  return response.data;
};

export const getPermissionWorkspace = async () => {
  const response = await axios.get(`${API_BASE_URL}/api/permissions/workspace`, {
    headers: getAdminHeaders(),
  });
  return response.data;
};

let myAccessRequest;
let myAccessToken;
export const getMyAccess = async ({ refresh = false } = {}) => {
  // Access must never be reused after logout/login in the same browser tab.
  // A cached Super Admin response would otherwise make the next employee see
  // every sidebar module.
  const sessionToken = getValidToken('admin') || getValidToken('employee') || '';
  if (!myAccessRequest || refresh || myAccessToken !== sessionToken) {
    myAccessToken = sessionToken;
    myAccessRequest = axios
      .get(`${API_BASE_URL}/api/permissions/me`, { headers: getAdminHeaders() })
      .then((response) => response.data)
      .catch((error) => {
        myAccessRequest = undefined;
        myAccessToken = undefined;
        throw error;
      });
  }
  return myAccessRequest;
};

export const updateDepartmentAccess = async (departmentId, payload) => {
  const response = await axios.put(
    `${API_BASE_URL}/api/permissions/departments/${departmentId}`,
    payload,
    { headers: getAdminHeaders() },
  );
  return response.data;
};

export const createDepartmentTeam = async (departmentId, payload) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/permissions/departments/${departmentId}/teams`,
    payload,
    { headers: getAdminHeaders() },
  );
  return response.data;
};

export const updateDepartmentTeam = async (teamId, payload) => {
  const response = await axios.put(`${API_BASE_URL}/api/permissions/teams/${teamId}`, payload, {
    headers: getAdminHeaders(),
  });
  return response.data;
};

export const deleteDepartmentTeam = async (teamId) => {
  const response = await axios.delete(`${API_BASE_URL}/api/permissions/teams/${teamId}`, {
    headers: getAdminHeaders(),
  });
  return response.data;
};

export const getAccessAssignments = async (userId = '') => {
  const response = await axios.get(`${API_BASE_URL}/api/permissions/assignments`, {
    headers: getAdminHeaders(),
    params: userId ? { userId } : {},
  });
  return response.data;
};

export const createAccessAssignment = async (payload) => {
  const response = await axios.post(`${API_BASE_URL}/api/permissions/assignments`, payload, {
    headers: getAdminHeaders(),
  });
  return response.data;
};

export const updateAccessAssignment = async (assignmentId, payload) => {
  const response = await axios.put(
    `${API_BASE_URL}/api/permissions/assignments/${assignmentId}`,
    payload,
    { headers: getAdminHeaders() },
  );
  return response.data;
};

export const removeAccessAssignment = async (assignmentId) => {
  const response = await axios.delete(
    `${API_BASE_URL}/api/permissions/assignments/${assignmentId}`,
    { headers: getAdminHeaders() },
  );
  return response.data;
};

export const previewAccess = async (payload) => {
  const response = await axios.post(`${API_BASE_URL}/api/permissions/preview`, payload, {
    headers: getAdminHeaders(),
  });
  return response.data;
};

export const getPermissionAudit = async () => {
  const response = await axios.get(`${API_BASE_URL}/api/permissions/audit`, {
    headers: getAdminHeaders(),
  });
  return response.data;
};

export const getAccessUsers = async () => {
  const response = await axios.get(`${API_BASE_URL}/api/users`, { headers: getAdminHeaders() });
  return Array.isArray(response.data) ? response.data : response.data.users || [];
};
