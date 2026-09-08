import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { getValidToken } from '../utils/auth';

const getHeaders = () => ({
  Authorization: `Bearer ${getValidToken('admin') || getValidToken('employee') || ''}`,
});

export const getWebsiteEnquiries = async (params) => {
  const response = await axios.get(`${API_BASE_URL}/api/website-enquiries`, {
    headers: getHeaders(),
    params,
  });
  return response.data;
};

export const getWebsiteEnquiryOptions = async (communityKey) => {
  const response = await axios.get(`${API_BASE_URL}/api/website-enquiries/options`, {
    headers: getHeaders(),
    params: { communityKey },
  });
  return response.data;
};

export const assignWebsiteEnquiries = async (payload) => {
  const response = await axios.patch(`${API_BASE_URL}/api/website-enquiries/assign`, payload, {
    headers: getHeaders(),
  });
  return response.data;
};

export const updateWebsiteEnquiryAction = async (enquiryId, payload) => {
  const response = await axios.patch(
    `${API_BASE_URL}/api/website-enquiries/${enquiryId}/action`,
    payload,
    { headers: getHeaders() },
  );
  return response.data;
};
