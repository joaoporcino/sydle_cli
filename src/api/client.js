const axios = require('axios');
const config = require('../utils/config');

const client = axios.create({
    baseURL: process.env.SYDLE_API_URL || 'https://cbmsa-dev.sydle.one/api/1',
    headers: {
        'Content-Type': 'application/json'
    }
});

client.interceptors.request.use(
    (req) => {
        const token = config.get('token');
        if (token) {
            req.headers.Authorization = `Bearer ${token}`;
        }
        req.baseURL = process.env.SYDLE_API_URL || 'https://cbmsa-dev.sydle.one/api/1';
        return req;
    },
    (error) => {
        return Promise.reject(error);
    }
);

module.exports = client;
