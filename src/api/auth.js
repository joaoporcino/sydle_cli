const axios = require('axios');

const signIn = async (userLogin, userPassword, baseURLOverride) => {
    try {
        const baseURL = baseURLOverride || process.env.SYDLE_API_URL || 'https://cbmsa-dev.sydle.one/api/1';
        const url = `${baseURL}/main/sys/auth/signIn/ad5e36ead7ebfa3c9e7cef04c9`;
        const response = await axios.post(
            url,
            {
                userLogin,
                userPassword
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
        return response.data;
    } catch (error) {
        console.error('Error signing in:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        throw error;
    }
};

module.exports = { signIn };
