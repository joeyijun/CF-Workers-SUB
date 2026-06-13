import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./_worker.js', import.meta.url), 'utf8');
const testSource = `${source}\nexport {
  normalizeNodeNames,
  parseRawNodeMetadata,
  restoreEmoji,
  clashFix,
  clashReinjectRegionGroups,
  singboxInjectNodes,
  convertRulesToProviders,
  resolveSubscriptionFormat,
  getUpstreamUserAgent,
  extractNodeLines,
  isValidConvertedContent,
  getSUB,
  KV,
};`;
const worker = await import(`data:text/javascript;base64,${Buffer.from(testSource).toString('base64')}`);

const vless = 'vless://11111111-1111-1111-1111-111111111111@hk.example.com:443?security=tls&type=ws#HK-01';
const normalizedVless = worker.normalizeNodeNames(vless);
assert.match(decodeURIComponent(normalizedVless.split('#')[1]), /^🇭🇰 /u);

const vmessConfig = {
  v: '2',
  ps: '日本 01',
  add: '2001:db8::1',
  port: '443',
  id: '11111111-1111-1111-1111-111111111111',
  net: 'ws',
};
const vmess = `vmess://${Buffer.from(JSON.stringify(vmessConfig)).toString('base64')}`;
const normalizedVmess = worker.normalizeNodeNames(vmess);
const parsedVmess = worker.parseRawNodeMetadata(normalizedVmess)[0];
assert.match(parsedVmess.name, /^🇯🇵 /u);
assert.equal(parsedVmess.server, '2001:db8::1');

const grpcRaw = 'vless://11111111-1111-1111-1111-111111111111@grpc.example.com:443?security=reality&type=grpc&serviceName=mygrpc&pbk=abc#US-01';
const xhttpRaw = 'vless://22222222-2222-2222-2222-222222222222@xhttp.example.com:443?security=reality&type=xhttp&pbk=abc#JP-01';
const clashInput = `proxies:
  - {name: US-01, server: grpc.example.com, port: 443, type: vless, network: grpc, reality-opts: {public-key: abc}}
  - {name: JP-01, server: xhttp.example.com, port: 443, type: vless, network: h2, reality-opts: {public-key: abc}, h2-opts: {path: /x}}
proxy-groups:
  - name: Auto
    type: select
    proxies:
      - US-01
      - JP-01`;
const clashFixed = worker.clashFix(clashInput, `${grpcRaw}\n${xhttpRaw}`);
assert.match(clashFixed, /grpc\.example\.com/);
assert.match(clashFixed, /grpc-service-name: "mygrpc"/);
assert.doesNotMatch(clashFixed, /xhttp\.example\.com/);

const vmessClash = `proxies:
  - {name: 日本 01, server: 2001:db8::1, port: 443, type: vmess}
proxy-groups:
  - name: Auto
    type: select
    proxies:
      - 日本 01`;
assert.match(worker.restoreEmoji(vmessClash, normalizedVmess), /🇯🇵 日本 01/u);

const commaRaw = 'vless://33333333-3333-3333-3333-333333333333@hk2.example.com:443?security=tls&type=ws#%F0%9F%87%AD%F0%9F%87%B0%20HK%2C%20Premium';
const commaClash = `proxies:
  - {name: "HK, Premium", server: hk2.example.com, port: 443, type: vless}
proxy-groups:
  - name: 香港节点
    type: select
    proxies:
      - "HK, Premium"`;
const commaRestored = worker.restoreEmoji(commaClash, commaRaw);
assert.match(commaRestored, /"🇭🇰 HK, Premium"/u);
const commaGrouped = worker.clashReinjectRegionGroups(commaRestored);
assert.match(commaGrouped, /- "🇭🇰 HK, Premium"/u);

const nodesJson = JSON.stringify({
  outbounds: [{ type: 'vless', tag: '🇺🇸 US-01', server: 'us.example.com', server_port: 443 }],
});
const templateJson = JSON.stringify({
  outbounds: [
    { type: 'selector', tag: 'Select', outbounds: ['🇺🇸 美国', '🇯🇵 日本'] },
    { type: 'urltest', tag: '🇺🇸 美国', outbounds: [] },
    { type: 'urltest', tag: '🇯🇵 日本', outbounds: [] },
    { type: 'direct', tag: 'direct' },
  ],
  route: { rules: [] },
});
const injected = JSON.parse(worker.singboxInjectNodes(nodesJson, templateJson));
assert.ok(injected.outbounds.some(outbound => outbound.tag === '🇺🇸 美国'));
assert.ok(!injected.outbounds.some(outbound => outbound.tag === '🇯🇵 日本'));
assert.ok(!injected.outbounds.find(outbound => outbound.tag === 'Select').outbounds.includes('🇯🇵 日本'));

const rulesInput = `proxies:
proxy-groups:
rules:
  - MATCH,DIRECT`;
const rulesOutput = worker.convertRulesToProviders(rulesInput, [
  { group: 'DIRECT', type: 'url', url: 'https://example.com/rules/My List.list?raw=1', behavior: 'classical' },
  { group: 'DIRECT', type: 'inline', rule: 'FINAL' },
]);
assert.match(rulesOutput, /  my_list:/);

assert.equal(worker.resolveSubscriptionFormat(new URL('https://example.com/auto?clash'), 'null', false), 'clash');
assert.equal(worker.resolveSubscriptionFormat(new URL('https://example.com/auto?sb'), 'mozilla', false), 'singbox');
assert.equal(worker.resolveSubscriptionFormat(new URL('https://example.com/auto'), 'mihomo/1.19', false), 'clash');
assert.equal(worker.getUpstreamUserAgent('singbox'), 'sing-box');
assert.deepEqual(worker.extractNodeLines('<html>https://example.com</html>\nvless://id@example.com:443#HK'), ['vless://id@example.com:443#HK']);
assert.equal(worker.isValidConvertedContent('clash', 'proxies:\nproxy-groups:\n  - name: Auto'), true);
assert.equal(worker.isValidConvertedContent('clash', 'dmxlc3M6Ly9ub3QtY2xhc2g='), false);
assert.equal(worker.isValidConvertedContent('singbox', '{"outbounds":[]}'), true);
assert.equal(worker.isValidConvertedContent('surge', '[Proxy]\nA = vmess, example.com, 443'), true);
assert.equal(worker.isValidConvertedContent('quanx', '[server_local]\nA = vmess, example.com, 443'), true);
assert.equal(worker.isValidConvertedContent('loon', '[Proxy]\nA = vmess, example.com, 443'), true);

const originalFetch = globalThis.fetch;
globalThis.fetch = async url => {
  const value = String(url);
  if (value.endsWith('/plain')) return new Response('vless://id@hk.example.com:443#HK');
  if (value.endsWith('/base64')) return new Response(Buffer.from('trojan://pw@us.example.com:443#US').toString('base64'));
  if (value.endsWith('/clash')) return new Response('proxies:\n  - {name: A, server: example.com, port: 443}\nproxy-groups:');
  if (value.endsWith('/html')) return new Response('<html><a href="https://example.com">error</a></html>');
  return new Response('missing', { status: 404 });
};
try {
  const aggregated = await worker.getSUB([
    'https://test.local/plain',
    'https://test.local/base64',
    'https://test.local/clash',
    'https://test.local/html',
  ], 'clash', 'test', { timeoutMs: 1000, concurrency: 2, maxBytes: 65536 });
  assert.equal(aggregated[0].length, 2);
  assert.equal(aggregated[1], 'https://test.local/clash');
  assert.equal(aggregated[2].length, 1);
  assert.ok(!aggregated[0].some(line => line.includes('127.0.0.1')));
} finally {
  globalThis.fetch = originalFetch;
}

const maliciousContent = '</textarea><script>alert(1)</script>';
const pageEnv = {
  KV: {
    get: async key => key === 'LINK.txt' ? maliciousContent : null,
    put: async () => {},
    delete: async () => {},
  },
};
const pageResponse = await worker.KV(
  new Request('https://example.com/auto', { headers: { 'User-Agent': '<img src=x onerror=alert(1)>' } }),
  pageEnv,
  'LINK.txt',
  'guest',
  { fileName: '<script>name</script>', mytoken: 'auto' },
);
const pageHtml = await pageResponse.text();
assert.doesNotMatch(pageHtml, /<script>alert\(1\)<\/script>/);
assert.match(pageHtml, /&lt;\/textarea&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
assert.match(pageHtml, /textarea\.addEventListener\('blur', \(\) => saveContent\(saveButton\)\)/);
assert.equal(pageResponse.headers.get('X-Frame-Options'), 'DENY');

const originalCrypto = globalThis.crypto;
Object.defineProperty(globalThis, 'crypto', {
  configurable: true,
  value: {
    subtle: {
      digest: async (_algorithm, data) => {
        const digest = createHash('md5').update(Buffer.from(data)).digest();
        return digest.buffer.slice(digest.byteOffset, digest.byteOffset + digest.byteLength);
      },
    },
  },
});
const converterOutputs = {
  clash: 'proxies:\n  - {name: HK, server: hk.example.com, port: 443, type: vless}\nproxy-groups:\n  - name: Auto\n    type: select\n    proxies:\n      - HK',
  singbox: JSON.stringify({ outbounds: [{ type: 'vless', tag: 'HK', server: 'hk.example.com', server_port: 443 }] }),
  surge: '[Proxy]\nHK = vmess, hk.example.com, 443',
  quanx: '[server_local]\nHK = vmess, hk.example.com, 443',
  loon: '[Proxy]\nHK = vmess, hk.example.com, 443',
};
globalThis.fetch = async url => {
  const parsed = new URL(String(url));
  if (parsed.pathname === '/sub') return new Response(converterOutputs[parsed.searchParams.get('target')] || 'invalid');
  if (parsed.hostname === 'raw.githubusercontent.com') return new Response('');
  return new Response('not found', { status: 404 });
};
try {
  const env = { TOKEN: 'auto', LINK: vless, SUBAPI: 'https://converter.test' };
  for (const [query, format, contentType] of [
    ['clash', 'clash', 'text/yaml'],
    ['sb', 'singbox', 'application/json'],
    ['surge', 'surge', 'text/plain'],
    ['quanx', 'quanx', 'text/plain'],
    ['loon', 'loon', 'text/plain'],
  ]) {
    const response = await worker.default.fetch(new Request(`https://worker.test/auto?${query}`, { headers: { 'User-Agent': 'curl' } }), env, {});
    assert.equal(response.status, 200, `${format} conversion failed`);
    assert.match(response.headers.get('Content-Type'), new RegExp(`^${contentType.replace('/', '\\/')}`));
    assert.equal(worker.isValidConvertedContent(format, await response.text()), true);
  }
  globalThis.fetch = async () => new Response('not a clash config');
  const invalidResponse = await worker.default.fetch(new Request('https://worker.test/auto?clash'), env, {});
  assert.equal(invalidResponse.status, 502);
  assert.equal(invalidResponse.headers.get('X-Subscription-Error'), 'conversion-failed');
} finally {
  globalThis.fetch = originalFetch;
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: originalCrypto });
}

console.log('All focused worker tests passed.');
