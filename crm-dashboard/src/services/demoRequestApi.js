import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { getAdminHeaders } from './businessApi';

const endpoint = `${API_BASE_URL}/api/demo-requests`;

export const getDemoRequestAccess = async () => {
  const response = await axios.get(`${endpoint}/access`, { headers: getAdminHeaders() });
  return response.data.allowed === true;
};

export const getDemoRequests = async (params, signal) => {
  const response = await axios.get(endpoint, { params, signal, headers: getAdminHeaders() });
  return response.data;
};

export const updateDemoRequest = async (id, payload) => {
  const response = await axios.patch(`${endpoint}/${id}`, payload, { headers: getAdminHeaders() });
  return response.data.request;
};
