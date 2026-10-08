const axios = require('axios');
const { assertSafeUrl } = require('./urlSafety');

async function safeRequest(config, { maxRedirects = 3, maxContentLength = 1024 * 1024 } = {}) {
  let currentUrl = await assertSafeUrl(config.url);

  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    const response = await axios({
      ...config,
      url: currentUrl,
      maxRedirects: 0,
      maxContentLength,
      maxBodyLength: maxContentLength,
      validateStatus: () => true,
    });

    if (response.status < 300 || response.status >= 400 || !response.headers.location) {
      return response;
    }
    if (redirects === maxRedirects) throw new Error('Too many redirects');
    currentUrl = await assertSafeUrl(new URL(response.headers.location, currentUrl).toString());
  }

  throw new Error('Request failed');
}

module.exports = { safeRequest };
