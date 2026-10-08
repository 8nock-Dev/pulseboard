const dns = require('dns').promises;
const { assertPublicAddress, assertSafeUrl } = require('./urlSafety');

jest.mock('dns', () => ({ promises: { lookup: jest.fn() } }));

describe('URL safety', () => {
  test.each(['127.0.0.1', '10.0.0.1', '169.254.169.254', '::1', 'fc00::1'])(
    'blocks non-public address %s',
    (address) => expect(() => assertPublicAddress(address)).toThrow('Blocked network')
  );

  test('accepts a publicly resolved HTTPS URL', async () => {
    dns.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    await expect(assertSafeUrl('https://example.com/health')).resolves.toBe('https://example.com/health');
  });

  test('rejects non-HTTP protocols', async () => {
    await expect(assertSafeUrl('file:///etc/passwd')).rejects.toThrow('Only HTTP and HTTPS');
  });

  test('rejects hostnames that resolve privately', async () => {
    dns.lookup.mockResolvedValue([{ address: '192.168.1.2', family: 4 }]);
    await expect(assertSafeUrl('http://internal.example')).rejects.toThrow('Blocked network');
  });
});
