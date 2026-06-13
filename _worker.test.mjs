import assert from 'node:assert/strict';
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

console.log('All focused worker tests passed.');
