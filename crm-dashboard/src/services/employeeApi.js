import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { getAdminHeaders } from './businessApi';

export const getEmployeeDirectory = async () => {
  const response = await axios.get(`${API_BASE_URL}/api/employee-directory`, {
    headers: getAdminHeaders(),
  });
  return response.data;
};

export const createEmployeeWithAccess = async (payload) => {
  const response = await axios.post(`${API_BASE_URL}/api/employee-directory`, payload, {
    headers: getAdminHeaders(),
  });
  return response.data;
};

export const updateEmployeeWithAccess = async (employeeId, payload) => {
  const response = await axios.put(
    `${API_BASE_URL}/api/employee-directory/${employeeId}`,
    payload,
    { headers: getAdminHeaders() },
  );
  return response.data;
};

export const deleteEmployee = async (employeeId) => {
  const response = await axios.delete(`${API_BASE_URL}/api/employee-directory/${employeeId}`, {
    headers: getAdminHeaders(),
  });
  return response.data;
};
