import { isIP } from 'node:net';

function normalizeIP(address) {
  if (address?.startsWith('::ffff:') && isIP(address.slice(7)) === 4) return address.slice(7);
  return address;
}

export function createRequestPolicy({ development = false, trustedProxyIPs = ['127.0.0.1', '::1'] } = {}) {
  if (trustedProxyIPs.some(address => !isIP(address))) throw new Error('TRUSTED_PROXY_IPS must contain only individual IPv4 or IPv6 addresses.');
  const trusted = new Set(trustedProxyIPs.map(normalizeIP));
  return (request, peerAddress) => {
    const peer = normalizeIP(peerAddress);
    const forwarded = request.headers.get('x-forwarded-proto');
    const https = Boolean(peer && trusted.has(peer) && forwarded === 'https');
    const localDevelopment = development && (peer === '127.0.0.1' || peer === '::1') && forwarded === null;
    return { https, ownerAllowed: https || localDevelopment };
  };
}
