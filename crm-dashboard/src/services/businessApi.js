import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { getValidToken } from '../utils/auth';

export const getAdminHeaders = () => ({
  Authorization: `Bearer ${getValidToken('admin') || getValidToken('employee') || ''}`,
});

export const getBusinessSummary = async () => {
  const response = await axios.get(`${API_BASE_URL}/api/business/summary`, {
    headers: getAdminHeaders(),
  });
  return response.data;
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
