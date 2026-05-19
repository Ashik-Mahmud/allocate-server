import { env } from './env';

export const sslCommerzConfig = (type: 'live' | 'sandbox' = 'sandbox') => {
  return {
    live: {
      store_id: process.env.SSLCOMMERZ_LIVE_STORE_ID || '',
      store_password: process.env.SSLCOMMERZ_LIVE_STORE_PASSWORD || '',
      ssl_url: 'https://securepay.sslcommerz.com',
      isLive: true,
      validationApiUrl: `https://securepay.sslcommerz.com/validator/api/validationserverAPI.php`,
    },
    sandbox: {
      store_id: env.SSL_STORE_ID || '',
      store_password: env.SSL_STORE_PASSWORD || '',
      ssl_url: env.SSL_API_URL,
      validationApiUrl: `https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php`,
      isLive: false,
    },
  }[type];
};
