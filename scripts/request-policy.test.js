import { expect, test } from 'bun:test';
import { createRequestPolicy } from '../request-policy.js';

test('production trusts HTTPS metadata only from explicitly trusted peers', () => {
  const policy = createRequestPolicy({ trustedProxyIPs: ['127.0.0.1', '172.17.0.2'] });
  const request = protocol => new Request('http://moxiu.vacpro.fyi/files/', { headers: protocol === undefined ? {} : { 'X-Forwarded-Proto': protocol } });
  for (const protocol of [undefined, 'http', 'https,http', 'https, https', 'HTTPS']) expect(policy(request(protocol), '127.0.0.1').ownerAllowed).toBe(false);
  expect(policy(request('https'), '172.17.0.2')).toEqual({ https: true, ownerAllowed: true });
  expect(policy(request('https'), '::ffff:127.0.0.1').ownerAllowed).toBe(true);
  expect(policy(request('https'), '203.0.113.5')).toEqual({ https: false, ownerAllowed: false });
  expect(policy(request('https'), undefined).ownerAllowed).toBe(false);
  expect(createRequestPolicy({ trustedProxyIPs: [] })(request('https'), '127.0.0.1').ownerAllowed).toBe(false);
  expect(() => createRequestPolicy({ trustedProxyIPs: ['0.0.0.0/0'] })).toThrow('individual IPv4 or IPv6');
});

test('HTTP development access is limited to direct loopback requests', () => {
  const policy = createRequestPolicy({ development: true, trustedProxyIPs: [] });
  const direct = new Request('http://localhost:3000/files/');
  expect(policy(direct, '127.0.0.1')).toEqual({ https: false, ownerAllowed: true });
  expect(policy(direct, '::1').ownerAllowed).toBe(true);
  expect(policy(direct, '192.168.1.5').ownerAllowed).toBe(false);
  const forwarded = new Request(direct, { headers: { 'X-Forwarded-Proto': 'http' } });
  expect(policy(forwarded, '127.0.0.1').ownerAllowed).toBe(false);
});
