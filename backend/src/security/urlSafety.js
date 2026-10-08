const dns = require('dns').promises;
const ipaddr = require('ipaddr.js');

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const BLOCKED_RANGES = new Set([
  'unspecified', 'broadcast', 'multicast', 'linkLocal', 'loopback',
  'private', 'reserved', 'carrierGradeNat', 'uniqueLocal', 'ipv4Mapped',
]);

function assertPublicAddress(address) {
  const parsed = ipaddr.parse(address);
  const range = parsed.range();
  if (BLOCKED_RANGES.has(range)) {
    throw new Error(`Blocked network address range: ${range}`);
  }
}

async function assertSafeUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error('Only HTTP and HTTPS URLs are allowed');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Credentials in URLs are not allowed');
  }

  const addresses = await dns.lookup(parsed.hostname, { all: true, verbatim: true });
  if (!addresses.length) throw new Error('Hostname did not resolve');
  addresses.forEach(({ address }) => assertPublicAddress(address));
  return parsed.toString();
}

module.exports = { assertSafeUrl, assertPublicAddress };
