// 部署完成后在网址后面加上这个，获取自建节点和机场聚合节点，/?token=auto或/auto或

const DEFAULT_TOKEN = 'auto';
const DEFAULT_GUEST_TOKEN = '';
const DEFAULT_BOT_TOKEN = '';
const DEFAULT_CHAT_ID = '';
const DEFAULT_TG = 0;
const DEFAULT_FILE_NAME = 'CF-Workers-SUB';
const DEFAULT_SUB_UPDATE_TIME = 6;

//节点链接 + 订阅链接
const DEFAULT_MAIN_DATA = `
https://cfxr.eu.org/getSub
`;

const DEFAULT_SUB_CONVERTER = "SUBAPI.cmliussss.net"; //在线订阅转换后端，目前使用CM的订阅转换功能。支持自建psub 可自行搭建https://github.com/bulianglin/psub
const DEFAULT_SUB_CONFIG = "https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/config/ACL4SSR_Online_MultiCountry.ini"; //订阅配置文件
const DEFAULT_SB_CONFIG = ""; // sing-box JSON 模板地址
const REMOTE_TEXT_CACHE = new Map();
const MAX_REMOTE_CACHE_ENTRIES = 16;

export default {
	async fetch(request, env, ctx) {
		const userAgentHeader = request.headers.get('User-Agent') || '';
		const userAgent = userAgentHeader ? userAgentHeader.toLowerCase() : "null";
		const url = new URL(request.url);
		const token = url.searchParams.get('token');
		const mytoken = env.TOKEN || DEFAULT_TOKEN;
		const botToken = env.TGTOKEN || DEFAULT_BOT_TOKEN;
		const chatID = env.TGID || DEFAULT_CHAT_ID;
		const tgEnabled = Number(env.TG ?? DEFAULT_TG) === 1;
		const converter = parseSubConverter(env.SUBAPI || DEFAULT_SUB_CONVERTER);
		const subConverter = converter.host;
		const subProtocol = converter.protocol;
		const subConfig = env.SUBCONFIG || DEFAULT_SUB_CONFIG;
		let sbConfig = env.SBCONFIG || DEFAULT_SB_CONFIG;
		const fileName = env.SUBNAME || DEFAULT_FILE_NAME;
		const subUpdateTime = env.SUBUPTIME || DEFAULT_SUB_UPDATE_TIME;
		const subTimeoutMs = clampNumber(env.SUBTIMEOUT, 1000, 30000, 8000);
		const subConcurrency = clampNumber(env.SUBCONCURRENCY, 1, 12, 6);
		const subMaxBytes = clampNumber(env.SUBMAXSIZE, 65536, 10485760, 4194304);

		const currentDate = new Date();
		currentDate.setHours(0, 0, 0, 0);
		const timeTemp = Math.ceil(currentDate.getTime() / 1000);
		const fakeToken = await MD5MD5(`${mytoken}${timeTemp}`);
		let guestToken = env.GUESTTOKEN || env.GUEST || DEFAULT_GUEST_TOKEN;
		if (!guestToken) guestToken = await MD5MD5(mytoken);
		const 访客订阅 = guestToken;
		const isOwnerRequest = token === mytoken || url.pathname === ("/" + mytoken);

		if (!([mytoken, fakeToken, 访客订阅].includes(token) || url.pathname === ("/" + mytoken))) {
			if (tgEnabled && url.pathname !== "/" && url.pathname !== "/favicon.ico") queueTask(ctx, sendMessage(`#异常访问 ${fileName}`, request.headers.get('CF-Connecting-IP'), `UA: ${userAgent}</tg-spoiler>\n域名: ${url.hostname}\n<tg-spoiler>入口: ${url.pathname + url.search}</tg-spoiler>`, botToken, chatID));
			if (env.URL302) return Response.redirect(env.URL302, 302);
			else if (env.URL) return await proxyURL(env.URL, url);
			else return new Response(await nginx(), {
				status: 200,
				headers: {
					'Content-Type': 'text/html; charset=UTF-8',
				},
			});
		} else {
			let mainData = DEFAULT_MAIN_DATA;
			let urls = [];
			const responseWarnings = [];
			if (env.KV) {
				await 迁移地址列表(env, 'LINK.txt');
				if (userAgent.includes('mozilla') && !url.search) {
					queueTask(ctx, sendMessage(`#编辑订阅 ${fileName}`, request.headers.get('CF-Connecting-IP'), `UA: ${userAgentHeader}</tg-spoiler>\n域名: ${url.hostname}\n<tg-spoiler>入口: ${url.pathname + url.search}</tg-spoiler>`, botToken, chatID));
					return await KV(request, env, 'LINK.txt', 访客订阅, {
						fileName,
						mytoken,
						sbConfig,
						subProtocol,
						subConverter,
						subConfig,
					});
				} else {
					mainData = await env.KV.get('LINK.txt') || mainData;
				}
			} else {
				mainData = env.LINK || mainData;
				if (env.LINKSUB) urls = await ADD(env.LINKSUB);
			}
			let 重新汇总所有链接 = await ADD(mainData + '\n' + urls.join('\n'));
			let 自建节点 = "";
			let 订阅链接 = "";
			for (let x of 重新汇总所有链接) {
				if (x.toLowerCase().startsWith('http')) {
					订阅链接 += x + '\n';
				} else {
					自建节点 += x + '\n';
				}
			}
			mainData = 自建节点;
			urls = await ADD(订阅链接);
			queueTask(ctx, sendMessage(`#获取订阅 ${fileName}`, request.headers.get('CF-Connecting-IP'), `UA: ${userAgentHeader}</tg-spoiler>\n域名: ${url.hostname}\n<tg-spoiler>入口: ${url.pathname + url.search}</tg-spoiler>`, botToken, chatID));
			const isSubConverterRequest = request.headers.get('subconverter-request') || request.headers.get('subconverter-version') || userAgent.includes('subconverter');
			let 订阅格式 = resolveSubscriptionFormat(url, userAgent, isSubConverterRequest);
			if (isOwnerRequest && url.searchParams.has('sbconfig')) {
				const requestedTemplate = url.searchParams.get('sbconfig') || '';
				if (isHttpUrl(requestedTemplate)) sbConfig = requestedTemplate;
			}

			let subConverterUrl;
			let 订阅转换URL = `${url.origin}/${await MD5MD5(fakeToken)}?token=${fakeToken}`;
			//console.log(订阅转换URL);
			let req_data = mainData;

			const 追加UA = getUpstreamUserAgent(订阅格式);

			const 订阅链接数组 = [...new Set(urls)].filter(item => item?.trim?.()); // 去重
			if (订阅链接数组.length > 0) {
				const 请求订阅响应内容 = await getSUB(订阅链接数组, 追加UA, userAgentHeader, {
					timeoutMs: subTimeoutMs,
					concurrency: subConcurrency,
					maxBytes: subMaxBytes,
				});
				req_data += 请求订阅响应内容[0].join('\n');
				if (请求订阅响应内容[1]) 订阅转换URL += "|" + 请求订阅响应内容[1];
				if (请求订阅响应内容[2].length > 0) responseWarnings.push(...请求订阅响应内容[2]);
				if (订阅格式 == 'base64' && !isSubConverterRequest && 请求订阅响应内容[1].includes('://')) {
					subConverterUrl = `${subProtocol}://${subConverter}/sub?target=mixed&url=${encodeURIComponent(请求订阅响应内容[1])}&insert=false&config=${encodeURIComponent(subConfig)}&emoji=true&list=false&tfo=false&scv=true&fdn=false&sort=false&new_name=true`;
					try {
						const subConverterResponse = await fetchWithTimeout(subConverterUrl, { headers: { 'User-Agent': 'v2rayN/CF-Workers-SUB (https://github.com/cmliu/CF-Workers-SUB)' } }, subTimeoutMs);
						if (subConverterResponse.ok) {
							const subConverterContent = await subConverterResponse.text();
							const convertedNodes = extractNodeLines(base64Decode(subConverterContent));
							if (convertedNodes.length > 0) req_data += '\n' + convertedNodes.join('\n');
							else responseWarnings.push('转换器未从配置订阅中返回有效节点');
						} else {
							responseWarnings.push(`配置订阅转换失败 HTTP ${subConverterResponse.status}`);
						}
					} catch (error) {
						responseWarnings.push(`配置订阅转换失败: ${error.name === 'AbortError' ? '超时' : error.message}`);
					}
				}
			}

			if (env.WARP) 订阅转换URL += "|" + (await ADD(env.WARP)).join("|");
			//修复中文错误
			const utf8Encoder = new TextEncoder();
			const encodedData = utf8Encoder.encode(req_data);
			//const text = String.fromCharCode.apply(null, encodedData);
			const utf8Decoder = new TextDecoder();
			const text = normalizeNodeNames(utf8Decoder.decode(encodedData));

			//去重
			const uniqueLines = new Set(text.split('\n'));
			const result = [...uniqueLines].join('\n');
			//console.log(result);

			const base64Data = base64Encode(result);

			// 构建响应头对象
			const responseHeaders = {
				"content-type": getFormatMetadata(订阅格式).contentType,
				"Profile-Update-Interval": `${subUpdateTime}`,
				"Profile-web-page-url": request.url.includes('?') ? request.url.split('?')[0] : request.url,
				"Cache-Control": "no-store",
			};
			if (responseWarnings.length > 0) responseHeaders['X-Subscription-Warnings'] = `${responseWarnings.length} upstream issue(s)`;

			if (订阅格式 == 'base64' && token !== fakeToken && !result.trim()) {
				return createConversionError('base64', 502, responseWarnings[0] || '没有可用节点', responseHeaders);
			}
			if (订阅格式 == 'base64' || token == fakeToken) {
				return new Response(base64Data, { headers: responseHeaders });
			} else if (订阅格式 == 'clash') {
				subConverterUrl = `${subProtocol}://${subConverter}/sub?target=clash&url=${encodeURIComponent(订阅转换URL)}&insert=false&config=${encodeURIComponent(subConfig)}&emoji=false&list=false&tfo=false&scv=true&fdn=false&sort=false&new_name=true&rule-providers=true`;
			} else if (订阅格式 == 'singbox') {
				subConverterUrl = `${subProtocol}://${subConverter}/sub?target=singbox&url=${encodeURIComponent(订阅转换URL)}&insert=false&emoji=true&list=true&tfo=false&scv=true&fdn=false&sort=false&new_name=true`;
			} else if (订阅格式 == 'surge') {
				subConverterUrl = `${subProtocol}://${subConverter}/sub?target=surge&ver=4&url=${encodeURIComponent(订阅转换URL)}&insert=false&config=${encodeURIComponent(subConfig)}&emoji=true&list=false&tfo=false&scv=true&fdn=false&sort=false&new_name=true`;
			} else if (订阅格式 == 'quanx') {
				subConverterUrl = `${subProtocol}://${subConverter}/sub?target=quanx&url=${encodeURIComponent(订阅转换URL)}&insert=false&config=${encodeURIComponent(subConfig)}&emoji=true&list=false&tfo=false&scv=true&fdn=false&sort=false&udp=true`;
			} else if (订阅格式 == 'loon') {
				subConverterUrl = `${subProtocol}://${subConverter}/sub?target=loon&url=${encodeURIComponent(订阅转换URL)}&insert=false&config=${encodeURIComponent(subConfig)}&emoji=true&list=false&tfo=false&scv=true&fdn=false&sort=false`;
			}
			//console.log(订阅转换URL);
			try {
				const subConverterResponse = await fetchWithTimeout(subConverterUrl, { headers: { 'User-Agent': userAgentHeader || getUpstreamUserAgent(订阅格式) } }, subTimeoutMs);//订阅转换
				if (!subConverterResponse.ok) return createConversionError(订阅格式, 502, `转换器 HTTP ${subConverterResponse.status}`, responseHeaders);
				let subConverterContent = await subConverterResponse.text();
				if (!isValidConvertedContent(订阅格式, subConverterContent)) return createConversionError(订阅格式, 502, '转换器返回格式无效', responseHeaders);
				if (订阅格式 == 'clash') {
					subConverterContent = await clashFix(subConverterContent, result);
					// 恢复被 subconverter 去掉的 emoji 国旗
					try {
						subConverterContent = restoreEmoji(subConverterContent, result);
						// emoji 恢复后先同步分组里的节点名，再清幽灵引用
						subConverterContent = fixProxyGroups(subConverterContent);
						// fixProxyGroups 后节点名已正确，再清幽灵引用（避免误删）
						subConverterContent = removeGhostProxyRefs(subConverterContent);
						// 地区分组按旗帜 emoji 重新注入节点（修复 subconverter 用裸名匹配正则导致的分组为空问题）
						subConverterContent = clashReinjectRegionGroups(subConverterContent);
					} catch (e) {
						console.log('emoji/分组恢复失败: ' + e.message);
					}
					// ===== 修复：从原始节点链接注入缺失的 reality-opts（修复 Trojan+gRPC+REALITY 等） =====
					try {
						subConverterContent = injectRealityOpts(subConverterContent, result);
					} catch (e) {
						console.log('reality-opts 注入失败: ' + e.message);
					}
					// 将 inline rules 转换为 rule-providers 格式
					try {
						const rulesets = await parseSubConfig(subConfig, subTimeoutMs);
						if (rulesets && rulesets.length > 0) {
							subConverterContent = convertRulesToProviders(subConverterContent, rulesets);
						}
					} catch (e) {
						console.log('rule-providers 转换失败，使用原始 rules: ' + e.message);
					}
				}
				if (订阅格式 == 'singbox') {
					try {
						subConverterContent = singboxFix(subConverterContent, result);
					} catch (e) {
						console.log('singbox 修复失败: ' + e.message);
					}
					// 如果提供了 sing-box JSON 模板，将节点注入模板
					// 恢复 sing-box 节点名中被 subconverter 去掉的 emoji
					try {
						subConverterContent = singboxRestoreEmoji(subConverterContent, result);
					} catch (e) {
						console.log('singbox emoji 恢复失败: ' + e.message);
					}
					if (sbConfig) {
						try {
							const tmplText = await fetchTextCached(sbConfig, { timeoutMs: subTimeoutMs, maxBytes: 2097152 });
							subConverterContent = singboxInjectNodes(subConverterContent, tmplText);
						} catch (e) {
							return createConversionError(订阅格式, 502, `sing-box 模板加载失败: ${e.message}`, responseHeaders);
						}
					}
				}
				if (!isValidConvertedContent(订阅格式, subConverterContent)) return createConversionError(订阅格式, 502, '后处理后的配置格式无效', responseHeaders);
				// 只有非浏览器订阅才会返回SUBNAME
				if (!userAgent.includes('mozilla')) {
					const extension = getFormatMetadata(订阅格式).extension;
					responseHeaders["Content-Disposition"] = `attachment; filename*=utf-8''${encodeURIComponent(`${fileName}.${extension}`)}`;
				}
				return new Response(subConverterContent, { headers: responseHeaders });
			} catch (error) {
				return createConversionError(订阅格式, 504, error.name === 'AbortError' ? '转换超时' : error.message, responseHeaders);
			}
		}
	}
};

function parseSubConverter(value) {
	const raw = String(value || DEFAULT_SUB_CONVERTER).trim().replace(/\/+$/, '');
	const match = raw.match(/^(https?):\/\/(.+)$/i);
	return match
		? { protocol: match[1].toLowerCase(), host: match[2] }
		: { protocol: 'https', host: raw };
}

function clampNumber(value, min, max, fallback) {
	const number = Number(value);
	if (!Number.isFinite(number)) return fallback;
	return Math.min(max, Math.max(min, Math.round(number)));
}

function queueTask(ctx, promise) {
	if (!promise || typeof promise.then !== 'function') return;
	if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(promise.catch(() => {}));
	else promise.catch(() => {});
}

function resolveSubscriptionFormat(url, userAgent, isSubConverterRequest) {
	const explicitFormats = [
		[['b64', 'base64'], 'base64'],
		[['clash'], 'clash'],
		[['sb', 'singbox'], 'singbox'],
		[['surge'], 'surge'],
		[['quanx'], 'quanx'],
		[['loon'], 'loon'],
	];
	for (const [keys, format] of explicitFormats) {
		if (keys.some(key => url.searchParams.has(key))) return format;
	}
	if (isSubConverterRequest || userAgent.includes('nekobox') || userAgent.includes('cf-workers-sub')) return 'base64';
	if (userAgent.includes('sing-box') || userAgent.includes('singbox')) return 'singbox';
	if (userAgent.includes('surge')) return 'surge';
	if (userAgent.includes('quantumult')) return 'quanx';
	if (userAgent.includes('loon')) return 'loon';
	if (userAgent.includes('clash') || userAgent.includes('mihomo') || userAgent.includes('clash.meta')) return 'clash';
	return 'base64';
}

function getUpstreamUserAgent(format) {
	return ({
		clash: 'clash',
		singbox: 'sing-box',
		surge: 'surge',
		quanx: 'Quantumult X',
		loon: 'Loon',
	})[format] || 'v2rayn';
}

function isHttpUrl(value) {
	try {
		return ['http:', 'https:'].includes(new URL(value).protocol);
	} catch (_) {
		return false;
	}
}

function escapeHtml(value) {
	return String(value ?? '').replace(/[&<>"']/g, char => ({
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;',
	})[char]);
}

function isNodeUri(value) {
	return /^(?!https?:\/\/)[a-z][a-z0-9+.-]*:\/\/\S+$/i.test(String(value || '').trim());
}

function extractNodeLines(content) {
	return [...new Set(String(content || '')
		.replace(/^\uFEFF/, '')
		.split(/\r?\n/)
		.map(line => line.trim())
		.filter(isNodeUri))];
}

function getFormatMetadata(format) {
	return ({
		base64: { contentType: 'text/plain; charset=utf-8', extension: 'txt' },
		clash: { contentType: 'text/yaml; charset=utf-8', extension: 'yaml' },
		singbox: { contentType: 'application/json; charset=utf-8', extension: 'json' },
		surge: { contentType: 'text/plain; charset=utf-8', extension: 'conf' },
		quanx: { contentType: 'text/plain; charset=utf-8', extension: 'conf' },
		loon: { contentType: 'text/plain; charset=utf-8', extension: 'conf' },
	})[format] || { contentType: 'text/plain; charset=utf-8', extension: 'txt' };
}

function isValidConvertedContent(format, content) {
	const text = String(content || '').trim();
	if (!text || /(?:failed|error|invalid\s+request)/i.test(text.slice(0, 300))) return false;
	if (format === 'clash') return /^proxies:\s*$/m.test(text) && /^proxy-groups:\s*$/m.test(text);
	if (format === 'singbox') {
		try {
			return Array.isArray(JSON.parse(text).outbounds);
		} catch (_) {
			return false;
		}
	}
	if (format === 'surge' || format === 'loon') return /^\[Proxy\]\s*$/mi.test(text);
	if (format === 'quanx') return /^\[(?:server_local|policy|filter_local)\]\s*$/mi.test(text);
	return true;
}

function createConversionError(format, status, detail, headers) {
	const safeDetail = String(detail || '').replace(/[\r\n]+/g, ' ').slice(0, 200);
	const responseHeaders = new Headers(headers);
	responseHeaders.set('Content-Type', 'text/plain; charset=utf-8');
	responseHeaders.set('X-Subscription-Error', 'conversion-failed');
	return new Response(`${format} 订阅转换失败${safeDetail ? `: ${safeDetail}` : ''}`, {
		status,
		headers: responseHeaders,
	});
}

async function fetchWithTimeout(url, init = {}, timeoutMs = 8000) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(url, { ...init, signal: controller.signal });
	} finally {
		clearTimeout(timeout);
	}
}

async function fetchTextCached(url, { timeoutMs = 8000, maxBytes = 1048576, ttlMs = 300000 } = {}) {
	if (!isHttpUrl(url)) throw new Error('无效的远程配置地址');
	const cached = REMOTE_TEXT_CACHE.get(url);
	if (cached && cached.expiresAt > Date.now()) return cached.text;
	const response = await fetchWithTimeout(url, { headers: { 'User-Agent': 'CF-Workers-SUB' } }, timeoutMs);
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	const contentLength = Number(response.headers.get('content-length') || 0);
	if (contentLength > maxBytes) throw new Error('远程配置过大');
	const text = await response.text();
	if (new TextEncoder().encode(text).length > maxBytes) throw new Error('远程配置过大');
	if (REMOTE_TEXT_CACHE.size >= MAX_REMOTE_CACHE_ENTRIES) REMOTE_TEXT_CACHE.delete(REMOTE_TEXT_CACHE.keys().next().value);
	REMOTE_TEXT_CACHE.set(url, { text, expiresAt: Date.now() + ttlMs });
	return text;
}

async function mapSettledWithConcurrency(items, limit, mapper) {
	const results = new Array(items.length);
	let nextIndex = 0;
	async function worker() {
		while (true) {
			const index = nextIndex++;
			if (index >= items.length) return;
			try {
				results[index] = { status: 'fulfilled', value: await mapper(items[index], index) };
			} catch (reason) {
				results[index] = { status: 'rejected', reason };
			}
		}
	}
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
	return results;
}

const COUNTRY_NAME_RULES = [
	['🇭🇰', /香港|hong\s*kong|(?:^|[\s_.|()[\]-])hk(?:\d+|[\s_.|()[\]-]|$)/i],
	['🇲🇴', /澳门|macao|macau|(?:^|[\s_.|()[\]-])mo(?:\d+|[\s_.|()[\]-]|$)/i],
	['🇹🇼', /台湾|台灣|taiwan|(?:^|[\s_.|()[\]-])tw(?:\d+|[\s_.|()[\]-]|$)/i],
	['🇯🇵', /日本|东京|東京|大阪|japan|tokyo|osaka|(?:^|[\s_.|()[\]-])jp(?:\d+|[\s_.|()[\]-]|$)/i],
	['🇸🇬', /新加坡|狮城|獅城|singapore|(?:^|[\s_.|()[\]-])sg(?:\d+|[\s_.|()[\]-]|$)/i],
	['🇺🇸', /美国|美國|洛杉矶|洛杉磯|西雅图|西雅圖|纽约|紐約|united\s*states|america|los\s*angeles|seattle|new\s*york|(?:^|[\s_.|()[\]-])(?:us|usa)(?:\d+|[\s_.|()[\]-]|$)/i],
	['🇰🇷', /韩国|韓國|首尔|首爾|korea|seoul|(?:^|[\s_.|()[\]-])kr(?:\d+|[\s_.|()[\]-]|$)/i],
	['🇬🇧', /英国|英國|伦敦|倫敦|united\s*kingdom|britain|london|(?:^|[\s_.|()[\]-])(?:uk|gb)(?:\d+|[\s_.|()[\]-]|$)/i],
	['🇩🇪', /德国|德國|法兰克福|法蘭克福|germany|frankfurt|(?:^|[\s_.|()[\]-])de(?:\d+|[\s_.|()[\]-]|$)/i],
	['🇫🇷', /法国|法國|巴黎|france|paris|(?:^|[\s_.|()[\]-])fr(?:\d+|[\s_.|()[\]-]|$)/i],
	['🇨🇦', /加拿大|多伦多|多倫多|canada|toronto|(?:^|[\s_.|()[\]-])ca(?:\d+|[\s_.|()[\]-]|$)/i],
	['🇦🇺', /澳大利亚|澳大利亞|澳洲|悉尼|australia|sydney|(?:^|[\s_.|()[\]-])au(?:\d+|[\s_.|()[\]-]|$)/i],
	['🇷🇺', /俄罗斯|俄羅斯|莫斯科|russia|moscow|(?:^|[\s_.|()[\]-])ru(?:\d+|[\s_.|()[\]-]|$)/i],
	['🇮🇳', /印度|孟买|孟買|india|mumbai|(?:^|[\s_.|()[\]-])in(?:\d+|[\s_.|()[\]-]|$)/i],
	['🇳🇱', /荷兰|荷蘭|阿姆斯特丹|netherlands|amsterdam|(?:^|[\s_.|()[\]-])nl(?:\d+|[\s_.|()[\]-]|$)/i],
	['🇹🇷', /土耳其|伊斯坦布尔|伊斯坦堡|turkey|istanbul|(?:^|[\s_.|()[\]-])tr(?:\d+|[\s_.|()[\]-]|$)/i],
	['🇧🇷', /巴西|圣保罗|聖保羅|brazil|sao\s*paulo|(?:^|[\s_.|()[\]-])br(?:\d+|[\s_.|()[\]-]|$)/i],
	['🇹🇭', /泰国|泰國|曼谷|thailand|bangkok|(?:^|[\s_.|()[\]-])th(?:\d+|[\s_.|()[\]-]|$)/i],
	['🇻🇳', /越南|河内|河內|vietnam|hanoi|(?:^|[\s_.|()[\]-])vn(?:\d+|[\s_.|()[\]-]|$)/i],
	['🇲🇾', /马来西亚|馬來西亞|吉隆坡|malaysia|kuala\s*lumpur|(?:^|[\s_.|()[\]-])my(?:\d+|[\s_.|()[\]-]|$)/i],
	['🇵🇭', /菲律宾|菲律賓|马尼拉|馬尼拉|philippines|manila|(?:^|[\s_.|()[\]-])ph(?:\d+|[\s_.|()[\]-]|$)/i],
	['🇮🇩', /印度尼西亚|印度尼西亞|印尼|雅加达|雅加達|indonesia|jakarta|(?:^|[\s_.|()[\]-])id(?:\d+|[\s_.|()[\]-]|$)/i],
	['🇦🇪', /阿联酋|阿聯酋|迪拜|dubai|united\s*arab\s*emirates|(?:^|[\s_.|()[\]-])(?:ae|uae)(?:\d+|[\s_.|()[\]-]|$)/i],
];

function safeDecodeURIComponent(value) {
	try {
		return decodeURIComponent(value);
	} catch (_) {
		return value;
	}
}

function detectCountryFlag(name) {
	if (!name) return '';
	const existing = name.match(/^([\u{1F1E6}-\u{1F1FF}]{2})/u);
	if (existing) return existing[1];
	for (const [flag, pattern] of COUNTRY_NAME_RULES) {
		if (pattern.test(name)) return flag;
	}
	return '';
}

function normalizeNodeName(name) {
	const trimmed = String(name || '').trim();
	if (!trimmed || /^[\u{1F1E6}-\u{1F1FF}]{2}/u.test(trimmed)) return trimmed;
	const flag = detectCountryFlag(trimmed);
	return flag ? `${flag} ${trimmed}` : trimmed;
}

function normalizeNodeNames(nodeText) {
	return String(nodeText || '').split(/\r?\n/).map(line => {
		const trimmed = line.trim();
		if (!isNodeUri(trimmed)) return '';
		try {
			if (trimmed.startsWith('vmess://')) {
				const config = JSON.parse(base64Decode(trimmed.slice(8)));
				const normalized = normalizeNodeName(config.ps);
				if (!normalized || normalized === config.ps) return trimmed;
				config.ps = normalized;
				return 'vmess://' + base64Encode(JSON.stringify(config));
			}
			if (/^(?:vless|trojan|ss|hy2|hysteria2?|tuic):\/\//i.test(trimmed)) {
				const hashIndex = trimmed.lastIndexOf('#');
				if (hashIndex === -1) return trimmed;
				const oldName = safeDecodeURIComponent(trimmed.slice(hashIndex + 1));
				const normalized = normalizeNodeName(oldName);
				if (!normalized || normalized === oldName) return trimmed;
				return trimmed.slice(0, hashIndex + 1) + encodeURIComponent(normalized);
			}
		} catch (_) {}
		return trimmed;
	}).filter(Boolean).join('\n');
}

function normalizeServer(server) {
	return String(server || '').trim().replace(/^\[|\]$/g, '').toLowerCase();
}

function endpointKey(server, port) {
	const normalizedServer = normalizeServer(server);
	const normalizedPort = String(port || '').trim();
	return normalizedServer && normalizedPort ? `${normalizedServer}:${normalizedPort}` : '';
}

function extractYamlField(line, field) {
	const marker = `${field}:`;
	const markerIndex = line.indexOf(marker);
	if (markerIndex === -1) return '';
	let index = markerIndex + marker.length;
	while (/\s/.test(line[index] || '')) index++;
	const quote = line[index];
	if (quote === '"' || quote === "'") {
		let value = '';
		for (index++; index < line.length; index++) {
			const char = line[index];
			if (char === quote && line[index - 1] !== '\\') return value;
			value += char;
		}
		return value;
	}
	let end = index;
	while (end < line.length && line[end] !== ',' && line[end] !== '}') end++;
	return line.slice(index, end).trim();
}

function parseYamlScalar(value) {
	const trimmed = String(value || '').trim();
	if (trimmed.length >= 2 && ((trimmed[0] === '"' && trimmed.at(-1) === '"') || (trimmed[0] === "'" && trimmed.at(-1) === "'"))) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
}

function yamlQuote(value) {
	return JSON.stringify(String(value || ''));
}

function parseRawNodeMetadata(nodeText) {
	const nodes = [];
	for (const line of String(nodeText || '').split(/\r?\n/)) {
		const raw = line.trim();
		if (!raw) continue;
		try {
			if (raw.startsWith('vmess://')) {
				const config = JSON.parse(base64Decode(raw.slice(8)));
				nodes.push({
					protocol: 'vmess',
					name: String(config.ps || '').trim(),
					server: normalizeServer(config.add),
					port: String(config.port || '').trim(),
					credential: String(config.id || '').trim(),
					transport: String(config.net || '').toLowerCase(),
					serviceName: String(config.path || '').replace(/^\//, ''),
				});
				continue;
			}
			if (!/^(?:vless|trojan|ss|hy2|hysteria2?|tuic):\/\//i.test(raw)) continue;
			const parsed = new URL(raw);
			nodes.push({
				protocol: parsed.protocol.slice(0, -1).toLowerCase(),
				name: safeDecodeURIComponent(parsed.hash.slice(1)).trim(),
				server: normalizeServer(parsed.hostname),
				port: String(parsed.port || '').trim(),
				credential: safeDecodeURIComponent(parsed.username || '').trim(),
				transport: String(parsed.searchParams.get('type') || '').toLowerCase(),
				serviceName: String(parsed.searchParams.get('serviceName') || parsed.searchParams.get('service_name') || ''),
			});
		} catch (_) {}
	}
	return nodes.filter(node => node.server && node.port);
}

async function ADD(envadd) {
	var addtext = String(envadd || '').replace(/[	"'|\r\n]+/g, '\n').replace(/\n+/g, '\n');	// 替换为换行
	//console.log(addtext);
	if (addtext.charAt(0) == '\n') addtext = addtext.slice(1);
	if (addtext.charAt(addtext.length - 1) == '\n') addtext = addtext.slice(0, addtext.length - 1);
	const add = addtext.split('\n');
	//console.log(add);
	return add;
}

async function nginx() {
	const text = `
	<!DOCTYPE html>
	<html>
	<head>
	<title>Welcome to nginx!</title>
	<style>
		body {
			width: 35em;
			margin: 0 auto;
			font-family: Tahoma, Verdana, Arial, sans-serif;
		}
	</style>
	</head>
	<body>
	<h1>Welcome to nginx!</h1>
	<p>If you see this page, the nginx web server is successfully installed and
	working. Further configuration is required.</p>
	
	<p>For online documentation and support please refer to
	<a href="http://nginx.org/">nginx.org</a>.<br/>
	Commercial support is available at
	<a href="http://nginx.com/">nginx.com</a>.</p>
	
	<p><em>Thank you for using nginx.</em></p>
	</body>
	</html>
	`
	return text;
}

async function sendMessage(type, ip, add_data = "", botToken = "", chatID = "") {
	if (botToken !== '' && chatID !== '') {
		let msg = "";
		const response = await fetch(`http://ip-api.com/json/${ip}?lang=zh-CN`);
		if (response.status == 200) {
			const ipInfo = await response.json();
			msg = `${type}\nIP: ${ip}\n国家: ${ipInfo.country}\n<tg-spoiler>城市: ${ipInfo.city}\n组织: ${ipInfo.org}\nASN: ${ipInfo.as}\n${add_data}`;
		} else {
			msg = `${type}\nIP: ${ip}\n<tg-spoiler>${add_data}`;
		}

		let url = "https://api.telegram.org/bot" + botToken + "/sendMessage?chat_id=" + chatID + "&parse_mode=HTML&text=" + encodeURIComponent(msg);
		return fetch(url, {
			method: 'get',
			headers: {
				'Accept': 'text/html,application/xhtml+xml,application/xml;',
				'Accept-Encoding': 'gzip, deflate, br',
				'User-Agent': 'Mozilla/5.0 Chrome/90.0.4430.72'
			}
		});
	}
}

function base64Decode(str) {
	const normalized = String(str || '').replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
	const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
	const bytes = new Uint8Array(atob(padded).split('').map(c => c.charCodeAt(0)));
	const decoder = new TextDecoder('utf-8');
	return decoder.decode(bytes);
}

function base64Encode(str) {
	const bytes = new TextEncoder().encode(String(str || ''));
	let binary = '';
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	}
	return btoa(binary);
}

async function MD5MD5(text) {
	const encoder = new TextEncoder();

	const firstPass = await crypto.subtle.digest('MD5', encoder.encode(text));
	const firstPassArray = Array.from(new Uint8Array(firstPass));
	const firstHex = firstPassArray.map(b => b.toString(16).padStart(2, '0')).join('');

	const secondPass = await crypto.subtle.digest('MD5', encoder.encode(firstHex.slice(7, 27)));
	const secondPassArray = Array.from(new Uint8Array(secondPass));
	const secondHex = secondPassArray.map(b => b.toString(16).padStart(2, '0')).join('');

	return secondHex.toLowerCase();
}

// 修复 subconverter 输出的 proxy-groups 结构错误：
// Bug1: 每个 group 末尾多一个空的 proxies: 行
// Bug2: 部分 group 的节点列表游离在外（没有 proxies: 标头）
// 修复：收集每个 group 的所有节点项（无论游离还是在 proxies: 下），重建为标准结构
async function parseSubConfig(configUrl, timeoutMs = 8000) {
	try {
		const text = await fetchTextCached(configUrl, { timeoutMs, maxBytes: 2097152 });
		const lines = text.split(/\r?\n/);
		const rulesets = [];
		for (const line of lines) {
			const trimmed = line.trim();
			if (trimmed.startsWith(';') || trimmed === '') continue;
			if (trimmed.startsWith('ruleset=')) {
				const value = trimmed.substring('ruleset='.length);
				const commaIndex = value.indexOf(',');
				if (commaIndex === -1) continue;
				const group = value.substring(0, commaIndex).trim();
				const target = value.substring(commaIndex + 1).trim();
				if (target.startsWith('[]')) {
					// 内置规则如 []GEOIP,CN,no-resolve 或 []FINAL，保留为 inline rule
					rulesets.push({ group, type: 'inline', rule: target.substring(2) });
				} else if (target.startsWith('http')) {
					// 远程规则集 URL
					rulesets.push({ group, type: 'url', url: target, behavior: 'classical' });
				} else if (target.startsWith('clash-domain:')) {
					// clash-domain: 前缀，behavior 为 domain
					rulesets.push({ group, type: 'url', url: target.substring('clash-domain:'.length), behavior: 'domain' });
				} else if (target.startsWith('clash-ipcidr:')) {
					// clash-ipcidr: 前缀，behavior 为 ipcidr
					rulesets.push({ group, type: 'url', url: target.substring('clash-ipcidr:'.length), behavior: 'ipcidr' });
				} else if (target.startsWith('clash-classical:')) {
					// clash-classical: 前缀，behavior 为 classical
					rulesets.push({ group, type: 'url', url: target.substring('clash-classical:'.length), behavior: 'classical' });
				}
			}
		}
		return rulesets;
	} catch (e) {
		console.log('解析 subConfig 失败: ' + e.message);
		return [];
	}
}

// 将 Clash 配置中的 inline rules 替换为 rule-providers 格式
// 根据 rulesets 生成标准的 rule-providers + rules YAML 块
// 当 subconverter 没有生成 rules 段时使用
function createProviderName(url, usedNames) {
	let baseName = '';
	try {
		const parsed = new URL(url);
		baseName = safeDecodeURIComponent(parsed.pathname.split('/').pop() || 'ruleset');
	} catch (_) {
		baseName = String(url || '').split(/[/?#]/).filter(Boolean).pop() || 'ruleset';
	}
	baseName = baseName.replace(/\.(?:list|ya?ml|txt)$/i, '').toLowerCase();
	baseName = baseName.replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'ruleset';
	let providerName = baseName;
	let suffix = 2;
	while (usedNames.has(providerName)) providerName = `${baseName}_${suffix++}`;
	usedNames.add(providerName);
	return providerName;
}

function buildDefaultRules(rulesets, lineBreak) {
	// 如果 rulesets 为空，使用内置的 ACL4SSR 规则集
	const defaultRulesets = rulesets && rulesets.length > 0 ? rulesets : [
		{ group: 'DIRECT', type: 'url', url: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/LocalAreaNetwork.list', behavior: 'classical' },
		{ group: 'DIRECT', type: 'url', url: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/UnBan.list', behavior: 'classical' },
		{ group: '🚀 节点选择', type: 'url', url: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/GoogleFCM.list', behavior: 'classical' },
		{ group: 'DIRECT', type: 'url', url: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/GoogleCN.list', behavior: 'classical' },
		{ group: '🚀 节点选择', type: 'url', url: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/Telegram.list', behavior: 'classical' },
		{ group: '🚀 节点选择', type: 'url', url: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/ProxyMedia.list', behavior: 'classical' },
		{ group: '🚀 节点选择', type: 'url', url: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/ProxyLite.list', behavior: 'classical' },
		{ group: 'DIRECT', type: 'url', url: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/ChinaDomain.list', behavior: 'classical' },
		{ group: 'DIRECT', type: 'url', url: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/ChinaCompanyIp.list', behavior: 'classical' },
		{ group: 'DIRECT', type: 'inline', rule: 'GEOIP,CN,no-resolve' },
		{ group: '🚀 节点选择', type: 'inline', rule: 'FINAL' },
	];

	const ruleProviders = {};
	const newRules = [];
	const usedProviderNames = new Set();

	for (const ruleset of defaultRulesets) {
		if (ruleset.type === 'inline') {
			if (ruleset.rule === 'FINAL') {
				newRules.push('  - MATCH,' + ruleset.group);
			} else if (ruleset.rule.endsWith(',no-resolve')) {
				const ruleBase = ruleset.rule.slice(0, -',no-resolve'.length);
				newRules.push('  - ' + ruleBase + ',' + ruleset.group + ',no-resolve');
			} else {
				newRules.push('  - ' + ruleset.rule + ',' + ruleset.group);
			}
		} else if (ruleset.type === 'url') {
			const providerName = createProviderName(ruleset.url, usedProviderNames);
			ruleProviders[providerName] = {
				type: 'http',
				behavior: ruleset.behavior || 'classical',
				url: ruleset.url,
				path: './ruleset/' + providerName + '.yaml',
				interval: 86400,
			};
			newRules.push('  - RULE-SET,' + providerName + ',' + ruleset.group);
		}
	}

	let rpText = 'rule-providers:' + lineBreak;
	for (const [name, p] of Object.entries(ruleProviders)) {
		rpText += '  ' + name + ':' + lineBreak;
		rpText += '    type: ' + p.type + lineBreak;
		rpText += '    behavior: ' + p.behavior + lineBreak;
		rpText += '    url: "' + p.url + '"' + lineBreak;
		rpText += '    path: ' + p.path + lineBreak;
		rpText += '    interval: ' + p.interval + lineBreak;
	}

	let rulesText = 'rules:' + lineBreak;
	for (const rule of newRules) {
		rulesText += rule + lineBreak;
	}

	return rpText + lineBreak + rulesText;
}

function convertRulesToProviders(content, rulesets) {
	// 检查是否已经有 rule-providers（避免重复转换）
	if (content.includes('rule-providers:')) return content;

	const lineBreak = content.includes('\r\n') ? '\r\n' : '\n';

	// 如果 subconverter 没有生成 rules 段，追加一套默认 rule-providers + rules
	if (!/^rules:\s*$/m.test(content)) {
		return content + lineBreak + buildDefaultRules(rulesets, lineBreak);
	}
	const lines = content.split(lineBreak);

	// 找到 rules: 段的位置
	let rulesStartIndex = -1;
	let rulesEndIndex = -1;
	for (let i = 0; i < lines.length; i++) {
		if (lines[i].trim() === 'rules:') {
			rulesStartIndex = i;
			continue;
		}
		if (rulesStartIndex !== -1 && rulesEndIndex === -1) {
			// rules 段中的行以 "  -" 开头
			if (!lines[i].trim().startsWith('-') && lines[i].trim() !== '') {
				rulesEndIndex = i;
			}
		}
	}
	if (rulesStartIndex === -1) return content;
	if (rulesEndIndex === -1) rulesEndIndex = lines.length;

	// 生成 rule-providers 和新的 rules
	const ruleProviders = {};
	const newRules = [];
	const usedProviderNames = new Set();

	for (const ruleset of rulesets) {
		if (ruleset.type === 'inline') {
			// GEOIP,CN / GEOIP,CN,no-resolve / FINAL 等内置规则
			const rule = ruleset.rule;
			if (rule === 'FINAL') {
				newRules.push(`  - MATCH,${ruleset.group}`);
			} else if (rule.endsWith(',no-resolve')) {
				// GEOIP,CN,no-resolve -> GEOIP,CN,GROUP,no-resolve
				const ruleBase = rule.slice(0, -',no-resolve'.length);
				newRules.push(`  - ${ruleBase},${ruleset.group},no-resolve`);
			} else {
				newRules.push(`  - ${rule},${ruleset.group}`);
			}
		} else if (ruleset.type === 'url') {
			// 远程规则集 -> rule-provider
			const url = ruleset.url;
			// 从 URL 提取 provider 名称
			const providerName = createProviderName(url, usedProviderNames);

			// 根据 URL 中的文件扩展名和路径判断 behavior
			let behavior = ruleset.behavior || 'classical';  // 使用 INI 指定的 behavior，默认 classical

			ruleProviders[providerName] = {
				type: 'http',
				behavior: behavior,
				url: url,
				path: `./ruleset/${providerName}.yaml`,
				interval: 86400
			};

			newRules.push(`  - RULE-SET,${providerName},${ruleset.group}`);
		}
	}

	// 构建 rule-providers YAML 文本
	let rpText = 'rule-providers:' + lineBreak;
	for (const [name, provider] of Object.entries(ruleProviders)) {
		rpText += `  ${name}:` + lineBreak;
		rpText += `    type: ${provider.type}` + lineBreak;
		rpText += `    behavior: ${provider.behavior}` + lineBreak;
		rpText += `    url: "${provider.url}"` + lineBreak;
		rpText += `    path: ${provider.path}` + lineBreak;
		rpText += `    interval: ${provider.interval}` + lineBreak;
	}

	// 构建新的 rules 段
	let rulesText = 'rules:' + lineBreak;
	for (const rule of newRules) {
		rulesText += rule + lineBreak;
	}

	// 替换原始内容
	const beforeRules = lines.slice(0, rulesStartIndex).join(lineBreak);
	const afterRules = lines.slice(rulesEndIndex).join(lineBreak);

	return beforeRules + lineBreak + rpText + lineBreak + rulesText + afterRules;
}

// 从原始节点链接中提取 emoji 映射：baseName -> emoji
function extractEmojiMap(nodeText) {
	const emojiMap = {};
	const lines = nodeText.split('\n');
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		let name = '';
		try {
			if (trimmed.startsWith('vmess://')) {
				const b64 = trimmed.substring(8);
				const json = JSON.parse(base64Decode(b64));
				name = json.ps || '';
			} else if (trimmed.startsWith('vless://') || trimmed.startsWith('trojan://') || trimmed.startsWith('ss://') || trimmed.startsWith('ssr://')) {
				const hash = trimmed.lastIndexOf('#');
				if (hash !== -1) {
					name = decodeURIComponent(trimmed.substring(hash + 1));
				}
			}
		} catch (e) {
			continue;
		}
		if (!name) continue;

		// 匹配开头的 emoji 国旗（两个区域指示符组成一个国旗）
		const match = name.match(/^([\u{1F1E6}-\u{1F1FF}]{2}\s*)/u);
		if (match) {
			const emoji = match[1].trim();
			const baseName = name.substring(match[1].length).trim();
			if (baseName && !emojiMap[baseName]) {
				emojiMap[baseName] = emoji;
			}
		}
	}
	return emojiMap;
}

// 恢复 Clash 配置中被 subconverter 去掉/修改的节点名（emoji 国旗恢复）
// 核心策略：用 server:port 精确匹配，完全不依赖节点名字符串
// 支持 subconverter 对同名节点自动编号的情况（wanxy → wanxy1/wanxy2/wanxy3）
function restoreEmoji(content, nodeText) {
	const lineBreak = content.includes('\r\n') ? '\r\n' : '\n';

	// 第1步：从原始链接构建 server:port → fullName 映射
	const portToFullName = {};
	const rawNodes = parseRawNodeMetadata(nodeText);
	for (const node of rawNodes) {
		if (!node.name || !/^[\u{1F1E0}-\u{1F1FF}]{2}/u.test(node.name)) continue;
		const key = endpointKey(node.server, node.port);
		if (key && !portToFullName[key]) portToFullName[key] = node.name;
	}

	if (Object.keys(portToFullName).length === 0) return content;

	// 第2步：解析 proxies 段，建立 subconverter输出名 → fullName 的映射
	// 用 server:port 匹配，不管 subconverter 给了什么名字
	// 对于同名节点（subconverter 自动编号如 wanxy / wanxy 2 / wanxy 3），
	// 恢复时保留序号后缀，生成 🇯🇵 wanxy / 🇯🇵 wanxy 2 / 🇯🇵 wanxy 3，
	// 避免所有同名节点都变成同一个名字后被 removeGhostProxyRefs 误删。
	const TOP = /^[a-zA-Z][a-zA-Z0-9_-]*:/;
	const lines = content.split(lineBreak);
	const nameMap = {}; // subconverter名 → fullName

	// 统计每个 fullName 在 portToFullName 中出现的次数（即同名节点数）
	const fullNameCount = {};
	for (const node of rawNodes) {
		if (node.name) fullNameCount[node.name] = (fullNameCount[node.name] || 0) + 1;
	}

	let section = '';
	for (const line of lines) {
		if (TOP.test(line)) { section = line.split(':')[0].trim(); continue; }
		if (section !== 'proxies') continue;

		// 提取 name、server、port
		const name = extractYamlField(line, 'name');
		const server = extractYamlField(line, 'server');
		const portMatch = line.match(/port:\s*(\d+)/);
		if (!name || !server || !portMatch) continue;

		const port = portMatch[1].trim();
		const key = endpointKey(server, port);

		const fullName = portToFullName[key];
		if (!fullName || fullName === name) continue;

		// 如果该 fullName 对应多个节点（同名节点），则需要保留 subconverter 追加的序号后缀
		// subconverter 规则：第1个保持原名（wanxy），后续追加 " 2"、" 3"...（含空格）
		// 我们把序号后缀拼到 emoji 后面：🇯🇵 wanxy / 🇯🇵 wanxy 2 / 🇯🇵 wanxy 3
		if (fullNameCount[fullName] > 1) {
			// 提取 subconverter 在名字末尾加的序号后缀（如 " 2"、" 3"）
			// 原始裸名是 fullName 去掉 emoji 前缀
			const bareBase = fullName.replace(/^[\u{1F1E0}-\u{1F1FF}\u{1F300}-\u{1F9FF}\s]+/u, '').trim();
			// subconverter 会把原始名作为第一个，后面的在末尾加 " 2"、" 3"
			// name 可能是 "wanxy"、"wanxy 2"、"wanxy 3"
			// bareBase 是 "wanxy"，suffix 是 name 中 bareBase 之后的部分
			let suffix = '';
			if (name === bareBase) {
				suffix = '';
			} else if (name.startsWith(bareBase)) {
				suffix = name.slice(bareBase.length); // 如 " 2"、" 3"
			} else {
				// 名字不匹配 bareBase，可能 subconverter 做了其他处理，直接用 fullName
				nameMap[name] = fullName;
				continue;
			}
			// 恢复后的名字：emoji前缀 + bareBase + suffix
			const restoredName = fullName + suffix; // fullName 已含 emoji，suffix 如 "" / " 2" / " 3"
			nameMap[name] = restoredName;
		} else {
			nameMap[name] = fullName;
		}
	}

	if (Object.keys(nameMap).length === 0) return content;

	// 第3步：按名称长度降序替换（避免短名误匹配长名）
	const entries = Object.entries(nameMap).sort((a, b) => b[0].length - a[0].length);

	for (const [oldName, fullName] of entries) {
		const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const namePattern = new RegExp(`(name:\\s*)(["']?)${escaped}\\2(?=\\s*[,}])`, 'g');
		content = content.replace(namePattern, (_, prefix, quote) => `${prefix}${quote}${fullName}${quote}`);
		const referencePattern = new RegExp(`(^\\s*-\\s*)(["']?)${escaped}\\2\\s*$`, 'gm');
		content = content.replace(referencePattern, (_, prefix, quote) => `${prefix}${quote}${fullName}${quote}`);
	}

	return content;
}


function fixProxyGroups(content) {
	// 思路：subconverter 已经按 ini 正则把节点分好组了，但节点名 emoji 被去掉了。
	// 我们只需要：把 proxies 段里的带 emoji 节点名建立映射，
	// 然后把 proxy-groups 里的裸名引用替换成带 emoji 的正确名字。
	// 完全不重新分配节点，尊重 subconverter 的分组结果。

	const lineBreak = content.includes('\r\n') ? '\r\n' : '\n';
	const lines = content.split(lineBreak);
	const TOP = /^[a-zA-Z][a-zA-Z0-9_-]*:/;

	// 第1步：从 proxies 段提取所有节点名，建立 裸名→带emoji名 的映射
	// 带 emoji 的节点名是权威名（由 restoreEmoji 恢复），裸名是 subconverter 去掉 emoji 后的名字
	// 对于同名节点（🇯🇵 wanxy / 🇯🇵 wanxy 2 / 🇯🇵 wanxy 3），
	// 需要建立带序号后缀的映射：wanxy→🇯🇵 wanxy，wanxy 2→🇯🇵 wanxy 2，wanxy 3→🇯🇵 wanxy 3
	const emojiNameMap = {}; // 裸名(含可能的序号后缀) → 带emoji名
	const allEmojiNames = new Set(); // 所有带emoji的节点名
	let section = '';
	for (const line of lines) {
		if (TOP.test(line)) { section = line.split(':')[0].trim(); continue; }
		if (section !== 'proxies') continue;
		const name = extractYamlField(line, 'name');
		if (!name) continue;
		// 带 emoji 旗帜的节点名
		if (/[\u{1F1E0}-\u{1F1FF}]/u.test(name)) {
			allEmojiNames.add(name);
			// 去掉 emoji 前缀得到裸名（含可能的序号后缀，如 "wanxy" / "wanxy 2" / "wanxy 3"）
			const bare = name.replace(/^[\u{1F1E0}-\u{1F1FF}\u{1F300}-\u{1F9FF}\s]+/u, '').trim();
			if (bare && bare !== name) {
				// 精确映射：裸名(含序号) → 带emoji完整名
				emojiNameMap[bare] = name;
				// subconverter 有时会去掉空格（"wanxy 2" → "wanxy2"），同时建立无空格版本的映射
				const bareNoSpace = bare.replace(/\s+/g, '');
				if (bareNoSpace !== bare) emojiNameMap[bareNoSpace] = name;
			}
		}
	}

	// 对第一个同名节点（如 🇯🇵 wanxy，bare="wanxy"），
	// subconverter 可能把它编为 "wanxy1"（无空格），补充该映射
	// 但只在 bare 不以数字结尾且 "bare1" 尚未被其他节点占用时才建立
	for (const [bare, emojiName] of Object.entries(emojiNameMap)) {
		if (!bare.match(/\d+$/) && !emojiNameMap[bare + '1']) {
			emojiNameMap[bare + '1'] = emojiName;
		}
	}

	// 如果没有 emoji 节点名，说明 emoji 未恢复，直接返回不处理
	if (allEmojiNames.size === 0) return content;

	// 第2步：逐行处理 proxy-groups，把组内的节点引用替换成带 emoji 的正确名字
	const result = [];
	let topSection = '';
	let inGroupProxies = false;
	let proxiesIndent = '';

	for (const line of lines) {
		const trimmed = line.trim();

		if (TOP.test(line)) {
			topSection = line.split(':')[0].trim();
			inGroupProxies = false;
			result.push(line);
			continue;
		}

		if (topSection !== 'proxy-groups') {
			result.push(line);
			continue;
		}

		// 新 group 开始，重置状态
		if (/^\s+- name:/.test(line) || /^\s+- \{name:/.test(line)) {
			inGroupProxies = false;
			result.push(line);
			continue;
		}

		// 进入 proxies: 子段
		if (trimmed === 'proxies:' && line !== 'proxies:' && line !== 'proxies:\r') {
			inGroupProxies = true;
			proxiesIndent = line.match(/^(\s*)/)[1];
			result.push(line);
			continue;
		}

		// 在 proxies 列表里，把裸名替换成带 emoji 的名字
		if (inGroupProxies) {
			const lineIndent = line.match(/^(\s*)/)[1].length;
			if (lineIndent >= proxiesIndent.length + 2 && trimmed.startsWith('- ')) {
				const refName = parseYamlScalar(trimmed.slice(2));
				// 如果是裸名且有对应的带 emoji 名，替换
				if (emojiNameMap[refName]) {
					result.push(line.replace(refName, emojiNameMap[refName]));
				} else {
					result.push(line);
				}
				continue;
			} else {
				inGroupProxies = false;
			}
		}

		result.push(line);
	}

	return result.join(lineBreak);
}

// 清理 proxy-groups 中引用了不存在的节点名的条目
// 例如 subconverter 有时会在 proxy-groups 里留下原始名（wanxy），
// 但 proxies 段里实际只有带编号的版本（wanxy 2、wanxy 3）
// 清理 proxy-groups 中引用了不存在节点名的条目
// 正确逻辑：保留 realNames（真实节点）、groupNames（proxy-group 名）、内置关键字（DIRECT/REJECT）
// 绝不用 emoji 判断——带国旗的引用也可能是幽灵（如 🇯🇵 wanxy 并不存在）
function removeGhostProxyRefs(content) {
	const lineBreak = content.includes('\r\n') ? '\r\n' : '\n';
	const lines = content.split(lineBreak);
	const TOP = /^[a-zA-Z][a-zA-Z0-9_-]*:/;

	// 第1步：收集 proxies 段所有真实节点名
	const realNames = new Set();
	let section = '';
	for (const line of lines) {
		if (TOP.test(line)) { section = line.split(':')[0].trim(); continue; }
		if (section === 'proxies') {
			const name = extractYamlField(line, 'name');
			if (name) realNames.add(name);
		}
	}

	// 第2步：收集 proxy-groups 段所有 group 名
	const groupNames = new Set();
	section = '';
	for (const line of lines) {
		if (TOP.test(line)) { section = line.split(':')[0].trim(); continue; }
		if (section === 'proxy-groups') {
			// 匹配 "  - name: xxx" 或 "  - {name: xxx,"
			const name = extractYamlField(line, 'name');
			if (name && /^\s+- (?:name:|\{name:)/.test(line)) groupNames.add(name);
		}
	}

	// 内置关键字
	const BUILTINS = new Set(['DIRECT', 'REJECT', 'GLOBAL', 'PASS']);

	// 第3步：过滤 proxy-groups 中的幽灵引用
	const result = [];
	let topSection = '';
	let inGroupProxies = false;
	let proxiesIndent = '';

	for (const line of lines) {
		const trimmed = line.trim();

		if (TOP.test(line)) {
			topSection = line.split(':')[0].trim();
			inGroupProxies = false;
			result.push(line);
			continue;
		}

		if (topSection !== 'proxy-groups') {
			result.push(line);
			continue;
		}

		// 新 group 开始，重置
		if (/^\s+- name:/.test(line) || /^\s+- \{name:/.test(line)) {
			inGroupProxies = false;
			result.push(line);
			continue;
		}

		// proxies: 子段
		if (trimmed === 'proxies:' && line !== 'proxies:' && line !== 'proxies:\r') {
			inGroupProxies = true;
			proxiesIndent = line.match(/^(\s*)/)[1];
			result.push(line);
			continue;
		}

		// 在 proxies 子列表中过滤幽灵引用
		if (inGroupProxies && trimmed.startsWith('- ')) {
			const lineIndent = line.match(/^(\s*)/)[1].length;
			if (lineIndent > proxiesIndent.length) {
				const refName = parseYamlScalar(trimmed.substring(2));
				const keep = realNames.has(refName) || groupNames.has(refName) || BUILTINS.has(refName);
				if (!keep) {
					console.log(`[removeGhostProxyRefs] 移除幽灵引用: "${refName}"`);
					continue;
				}
				result.push(line);
				continue;
			} else {
				inGroupProxies = false;
			}
		}

		if (inGroupProxies && !trimmed.startsWith('-')) inGroupProxies = false;
		result.push(line);
	}

	return result.join(lineBreak);
}

// 地区分组按旗帜 emoji 重新注入节点
// 背景：subconverter 用「裸名」（去掉 emoji 后的名字）匹配 ini 正则，
// 节点名如 "🇯🇵 wanxy"，裸名 "wanxy" 无法命中 (日本|🇯🇵|JP) 正则，
// 导致日本/新加坡/美国等分组为空（只剩 DIRECT）。
// 修复策略：与 singboxInjectNodes 一致，直接用节点 tag 中的旗帜 emoji 重新填充地区分组。
// 只处理「旗帜 emoji 开头」的 proxy-group（即地区分组），其他分组（节点选择、自动选择等）保持不变。
function clashReinjectRegionGroups(content) {
	const lineBreak = content.includes('\r\n') ? '\r\n' : '\n';
	const lines = content.split(lineBreak);
	const TOP = /^[a-zA-Z][a-zA-Z0-9_-]*:/;

	// 第1步：从 proxies 段收集所有真实节点名，按旗帜分组
	// 旗帜 = 两个区域指示符字符（U+1F1E0-U+1F1FF）
	const flagToProxyNames = {}; // "🇯🇵" → ["🇯🇵 wanxy", "🇯🇵 wanxy 2", ...]
	const allProxyNames = [];
	let section = '';
	for (const line of lines) {
		if (TOP.test(line)) { section = line.split(':')[0].trim(); continue; }
		if (section !== 'proxies') continue;
		const name = extractYamlField(line, 'name');
		if (!name) continue;
		allProxyNames.push(name);
		const flag = detectCountryFlag(name);
		if (flag) {
			if (!flagToProxyNames[flag]) flagToProxyNames[flag] = [];
			flagToProxyNames[flag].push(name);
		}
	}

	if (Object.keys(flagToProxyNames).length === 0) return content; // 无 emoji 节点，跳过

	// 第2步：收集所有 proxy-group 名，用于保留现有的非节点引用
	const groupNames = new Set();
	section = '';
	for (const line of lines) {
		if (TOP.test(line)) { section = line.split(':')[0].trim(); continue; }
		if (section !== 'proxy-groups') continue;
		const name = extractYamlField(line, 'name');
		if (name && /^\s+- (?:name:|\{name:)/.test(line)) groupNames.add(name);
	}

	const BUILTINS = new Set(['DIRECT', 'REJECT', 'GLOBAL', 'PASS']);

	// 旗帜兼容映射：部分 ini 模板使用的旗帜与节点实际旗帜不同，在此统一处理
	// 例如 🇺🇲（UM，联合国外岛）≠ 🇺🇸（US，美国），但都代表美国节点分组
	const FLAG_COMPAT = {
		'🇺🇲': '🇺🇸', // UM → US
	};

	// 查询某个分组旗帜对应的节点列表（含兼容映射）
	function resolveFlag(groupFlag) {
		if (flagToProxyNames[groupFlag]) return flagToProxyNames[groupFlag];
		const compat = FLAG_COMPAT[groupFlag];
		if (compat && flagToProxyNames[compat]) return flagToProxyNames[compat];
		return null;
	}

	// 第3步：按 group 块处理 proxy-groups 段
	// 策略：收集每个 group 的所有行，判断后再决定输出还是整块丢弃（空地区分组删除）
	const result = [];

	// 先找 proxy-groups 段的范围
	let pgStart = -1;
	for (let i = 0; i < lines.length; i++) {
		if (TOP.test(lines[i]) && lines[i].split(':')[0].trim() === 'proxy-groups') {
			pgStart = i; break;
		}
	}
	if (pgStart === -1) return content;

	let pgEnd = lines.length;
	for (let i = pgStart + 1; i < lines.length; i++) {
		if (TOP.test(lines[i])) { pgEnd = i; break; }
	}

	// 把 proxy-groups 段内容拆成独立的 group 块
	const pgLines = lines.slice(pgStart + 1, pgEnd);
	const groupBlocks = [];
	let cur = null;
	for (const l of pgLines) {
		if (/^\s+- name:/.test(l) || /^\s+- \{name:/.test(l)) {
			if (cur) groupBlocks.push(cur);
			cur = [l];
		} else if (cur) {
			cur.push(l);
		} else {
			groupBlocks.push([l]);
		}
	}
	if (cur) groupBlocks.push(cur);

	// 处理每个 group 块
	const processedGroups = [];
	const deletedGroupNames = new Set();

	for (const block of groupBlocks) {
		const firstLine = block[0];
		if (!(/^\s+- name:/.test(firstLine) || /^\s+- \{name:/.test(firstLine))) {
			processedGroups.push(block); continue;
		}
		const gName = extractYamlField(firstLine, 'name');
		if (!gName) { processedGroups.push(block); continue; }
		const groupFlag = detectCountryFlag(gName);
		if (!groupFlag) { processedGroups.push(block); continue; } // 非地区分组，原样保留

		const resolvedNames = resolveFlag(groupFlag);
		if (!resolvedNames) {
			// 地区分组但无匹配节点 → 整块删除
			deletedGroupNames.add(gName);
			console.log('[clashReinjectRegionGroups] 删除空地区分组: ' + gName);
			continue;
		}

		// 有匹配节点：重建 block，替换 proxies 列表
		const newBlock = [];
		let proxiesIndent = '';
		let inProxies = false;
		for (const line of block) {
			const trimmed = line.trim();
			if (trimmed === 'proxies:' && line !== 'proxies:' && line !== 'proxies:\r') {
				inProxies = true;
				proxiesIndent = line.match(/^(\s*)/)[1];
				newBlock.push(line);
				const itemIndent = proxiesIndent + '  ';
				for (const name of resolvedNames) newBlock.push(itemIndent + '- ' + yamlQuote(name));
				continue;
			}
			if (inProxies && trimmed.startsWith('- ')) {
				const li = line.match(/^(\s*)/)[1].length;
				if (li > proxiesIndent.length) continue; // 跳过旧节点列表
				else inProxies = false;
			}
			if (inProxies && !trimmed.startsWith('-')) inProxies = false;
			newBlock.push(line);
		}
		processedGroups.push(newBlock);
	}

	// 重新组装整个文件
	for (let i = 0; i < lines.length; i++) {
		if (i === pgStart) {
			result.push(lines[pgStart]);
			for (const block of processedGroups) for (const l of block) result.push(l);
			i = pgEnd - 1;
			continue;
		}
		result.push(lines[i]);
	}

	// 从其他分组的 proxies 列表中删除已被删除的地区分组引用
	if (deletedGroupNames.size === 0) return result.join(lineBreak);
	return removeGhostGroupRefs(result.join(lineBreak), deletedGroupNames);
}


// 从 proxy-groups 的 proxies 列表中删除对已删除地区分组的引用
function removeGhostGroupRefs(content, deletedGroupNames) {
	const lineBreak = content.includes('\r\n') ? '\r\n' : '\n';
	const lines = content.split(lineBreak);
	const TOP = /^[a-zA-Z][a-zA-Z0-9_-]*:/;
	const result = [];
	let topSection = '';
	let inGroupProxies = false;
	let proxiesIndent = '';

	for (const line of lines) {
		const trimmed = line.trim();
		if (TOP.test(line)) {
			topSection = line.split(':')[0].trim();
			inGroupProxies = false;
			result.push(line); continue;
		}
		if (topSection !== 'proxy-groups') { result.push(line); continue; }
		if (/^\s+- name:/.test(line) || /^\s+- \{name:/.test(line)) {
			inGroupProxies = false;
			result.push(line); continue;
		}
		if (trimmed === 'proxies:' && line !== 'proxies:' && line !== 'proxies:\r') {
			inGroupProxies = true;
			proxiesIndent = line.match(/^(\s*)/)[1];
			result.push(line); continue;
		}
		if (inGroupProxies && trimmed.startsWith('- ')) {
			const li = line.match(/^(\s*)/)[1].length;
			if (li > proxiesIndent.length) {
				const refName = parseYamlScalar(trimmed.slice(2));
				if (deletedGroupNames.has(refName)) continue; // 删除引用
				result.push(line); continue;
			} else { inGroupProxies = false; }
		}
		if (inGroupProxies && !trimmed.startsWith('-')) inGroupProxies = false;
		result.push(line);
	}
	return result.join(lineBreak);
}

function fixSubconverterGroupStructure(content) {
	const lb = content.includes('\r\n') ? '\r\n' : '\n';
	const lines = content.split(lb);
	const TOP = /^[a-zA-Z][a-zA-Z0-9_-]*:/;
	const result = [];
	let topSection = '';
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];

		if (TOP.test(line)) {
			topSection = line.split(':')[0].trim();
			result.push(line);
			i++; continue;
		}

		if (topSection !== 'proxy-groups') {
			result.push(line);
			i++; continue;
		}

		// proxy-groups 段内：收集整个 group 块并修复
		if (/^\s+- name:/.test(line) || /^\s+- \{name:/.test(line)) {
			const groupLines = [line];
			i++;
			while (i < lines.length) {
				const nl = lines[i];
				if (nl.trim() !== '' && (/^\s+- name:/.test(nl) || /^\s+- \{name:/.test(nl) || TOP.test(nl))) break;
				groupLines.push(nl);
				i++;
			}
			result.push(...fixGroupBlock(groupLines));
			continue;
		}

		result.push(line);
		i++;
	}

	return result.join(lb);
}

function fixGroupBlock(lines) {
	if (!lines.length) return lines;
	const groupIndent = (lines[0].match(/^(\s+)/) || ['',''])[1];
	const propIndent = groupIndent + '  ';
	const itemIndent = groupIndent + '    ';

	const allItems = [];
	const attrLines = [lines[0]];

	let j = 1;
	while (j < lines.length) {
		const line = lines[j];
		const trimmed = line.trim();
		if (trimmed === '') { j++; continue; }

		// 有缩进的 proxies: 行
		if (line === propIndent + 'proxies:' || line === propIndent + 'proxies:\r') {
			j++;
			// 收集其下的列表项
			while (j < lines.length && lines[j].startsWith(itemIndent + '- ')) {
				allItems.push(lines[j].trim().substring(2));
				j++;
			}
			continue;
		}

		// 游离列表项
		if (line.startsWith(itemIndent + '- ')) {
			allItems.push(line.trim().substring(2));
			j++; continue;
		}

		// 属性行
		attrLines.push(line);
		j++;
	}

	const result = [...attrLines];
	if (allItems.length > 0) {
		result.push(propIndent + 'proxies:');
		for (const item of allItems) {
			result.push(itemIndent + '- ' + item);
		}
	}
	return result;
}

// 为 network: grpc 但缺少 grpc-opts 的节点（单行格式）补上 grpc-opts
// Mihomo 处理 gRPC 节点时需要 grpc-opts，缺失会导致连接失败
// sing-box JSON 后处理：修复 subconverter 的已知问题
// 1. Trojan/VLESS+gRPC+REALITY 丢失 reality 块 → 从原始节点链接重新注入
// 2. xhttp 节点（被误转为 httpupgrade）→ 过滤掉（sing-box 不支持 xhttp）
// 3. gRPC service_name 为 "/" → 改成 ""
// sing-box 节点注入：把 subconverter 输出的节点列表注入到 JSON 模板的分组 outbounds 里
// sing-box 节点名 emoji 恢复：从原始节点链接提取 emoji 映射，恢复被 subconverter 去掉的 emoji
// 策略：优先用 server:port 匹配（处理同名节点），fallback 用裸名匹配
function singboxRestoreEmoji(jsonStr, rawNodeText) {
	let config;
	try {
		config = JSON.parse(jsonStr);
	} catch (e) {
		return jsonStr;
	}
	if (!config.outbounds) return jsonStr;

	// 构建 server:port → fullName 的映射（处理同名节点）
	const portMap = {};
	const rawNodes = parseRawNodeMetadata(rawNodeText).filter(node => /^[\u{1F1E0}-\u{1F1FF}]{2}/u.test(node.name));
	for (const node of rawNodes) {
		const key = endpointKey(node.server, node.port);
		if (key && !portMap[key]) portMap[key] = node.name;
	}

	// subconverter 给同名节点加序号的规律：第一个保持原名，后续加 " 2"、" 3"...
	// 按 server:port 重建序号映射
	// 统计每个裸名出现几次，建立 "裸名 N" → fullName 的映射
	const bareCount = {};
	const seqMap = {}; // "wanxy 2" → "🇯🇵 wanxy"（带旗帜）

	for (const node of rawNodes) {
		const bareName = node.name.replace(/^[\u{1F1E0}-\u{1F1FF}\u{1F300}-\u{1F9FF}\s]+/u, '').trim();
		if (!bareName || node.name === bareName) continue;
		bareCount[bareName] = (bareCount[bareName] || 0) + 1;
		const seq = bareCount[bareName];
		const seqKey = seq === 1 ? bareName : `${bareName} ${seq}`;
		seqMap[seqKey] = node.name;
	}

	// 替换 outbounds 里的节点名
	let restored = 0;
	config.outbounds = config.outbounds.map(ob => {
		if (!ob.tag) return ob;
		const key = endpointKey(ob.server, ob.server_port);

		// 优先用 server:port 精确匹配
		if (portMap[key]) {
			ob.tag = portMap[key];
			restored++;
			return ob;
		}
		// fallback：用序号映射（处理同名节点）
		if (seqMap[ob.tag]) {
			ob.tag = seqMap[ob.tag];
			restored++;
			return ob;
		}
		return ob;
	});

	if (restored > 0) console.log(`[singboxRestoreEmoji] 恢复 ${restored} 个节点名 emoji`);
	return JSON.stringify(config);
}

function singboxInjectNodes(nodesJson, templateJson) {
	// 思路：完全从模板读取分组定义，不硬编码地区。
	// 对模板里每个含 outbounds 的分组：
	// - 地区组（tag 含旗帜 emoji）→ 用节点 tag 里的旗帜精确匹配后注入
	// - urltest/loadbalance 无旗帜 → 注入所有节点
	// - selector 无旗帜 → 保持模板定义不变
	let nodes, template;
	try {
		nodes = JSON.parse(nodesJson);
		template = JSON.parse(templateJson);
	} catch (e) {
		console.log('[singboxInjectNodes] JSON 解析失败: ' + e.message);
		return nodesJson;
	}

	// 提取真实代理节点
	const proxyTypes = new Set(['vless', 'vmess', 'trojan', 'shadowsocks', 'ss', 'hysteria', 'hysteria2', 'tuic', 'wireguard']);
	const proxyNodes = (nodes.outbounds || []).filter(ob => proxyTypes.has(ob.type));
	if (proxyNodes.length === 0) {
		console.log('[singboxInjectNodes] 没有找到代理节点');
		return nodesJson;
	}

	const allNodeTags = proxyNodes.map(n => n.tag);

	// 从 tag 里提取旗帜（区域指示符对 U+1F1E0-U+1F1FF）
	const getFlagFromTag = (tag) => detectCountryFlag(tag);

	// 按旗帜分类节点 tag
	const flagToTags = {};
	for (const node of proxyNodes) {
		const flag = getFlagFromTag(node.tag);
		if (flag) {
			if (!flagToTags[flag]) flagToTags[flag] = [];
			flagToTags[flag].push(node.tag);
		}
	}
	const flagCompat = { '🇺🇲': '🇺🇸' };
	const resolveFlagTags = flag => flagToTags[flag] || flagToTags[flagCompat[flag]] || null;

	// 把代理节点插入模板（放在第一个 direct 之前）
	const directIdx = template.outbounds.findIndex(ob => ob.type === 'direct');
	if (directIdx > -1) {
		template.outbounds.splice(directIdx, 0, ...proxyNodes);
	} else {
		template.outbounds.push(...proxyNodes);
	}

	// 遍历模板 outbounds，智能注入节点
	const emptyRegionTags = new Set();
	for (const ob of template.outbounds) {
		if (!Array.isArray(ob.outbounds)) continue;

		const groupFlag = getFlagFromTag(ob.tag);
		const regionNodes = groupFlag ? resolveFlagTags(groupFlag) : null;

		if (groupFlag && regionNodes) {
			// 地区组有匹配节点 → 精确注入
			ob.outbounds = regionNodes;
		} else if (groupFlag) {
			// 空地区组不能回填全部节点，否则会把其他国家节点错误标成该地区。
			emptyRegionTags.add(ob.tag);
		} else if (ob.type === 'urltest' || ob.type === 'loadbalance') {
			// 无旗帜的 urltest/loadbalance（自动选择、负载均衡）→ 全节点
			ob.outbounds = allNodeTags;
		}
		// selector 无旗帜（节点选择、Onedrive 等）→ 保持模板定义不变
	}

	if (emptyRegionTags.size > 0) {
		template.outbounds = template.outbounds.filter(ob => !emptyRegionTags.has(ob.tag));
		for (const ob of template.outbounds) {
			if (!Array.isArray(ob.outbounds)) continue;
			ob.outbounds = ob.outbounds.filter(tag => !emptyRegionTags.has(tag));
			if (ob.outbounds.length === 0 && (ob.type === 'selector' || ob.type === 'urltest' || ob.type === 'loadbalance')) {
				ob.outbounds = allNodeTags;
			}
		}
		for (const rule of template.route?.rules || []) {
			if (typeof rule.outbound === 'string' && emptyRegionTags.has(rule.outbound)) rule.outbound = 'direct';
		}
	}

	console.log(`[singboxInjectNodes] 注入 ${proxyNodes.length} 个节点，旗帜分组: ${JSON.stringify(Object.keys(flagToTags))}`);
	return JSON.stringify(template);
}

function singboxFix(jsonStr, rawNodeText) {
	let config;
	try {
		config = JSON.parse(jsonStr);
	} catch (e) {
		return jsonStr;
	}
	if (!config.outbounds || !Array.isArray(config.outbounds)) return jsonStr;

	// 从原始节点链接构建 reality 参数映射：server:port -> {public_key, short_id, sni}
	const realityMap = {};
	const lines = (rawNodeText || '').split('\n');
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed.startsWith('vless://') && !trimmed.startsWith('trojan://')) continue;
		try {
			const parsed = new URL(trimmed);
			const params = parsed.searchParams;
			if (params.get('security') !== 'reality') continue;
			const pbk = params.get('pbk');
			const sid = params.get('sid') || '';
			const sni = params.get('sni') || '';
			const fp = params.get('fp') || 'chrome';
			const key = endpointKey(parsed.hostname, parsed.port);
			if (pbk && key) realityMap[key] = { public_key: pbk, short_id: sid, server_name: sni, fingerprint: fp };
		} catch (_) {}
	}

	// 从原始节点链接构建 xhttp 路径映射：server:port -> {path, host, mode}
	const xhttpMap = {};
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed.startsWith('vless://') && !trimmed.startsWith('trojan://')) continue;
		try {
			const parsed = new URL(trimmed);
			const params = parsed.searchParams;
			if (params.get('type') !== 'xhttp') continue;
			const key = endpointKey(parsed.hostname, parsed.port);
			if (!key) continue;
			xhttpMap[key] = {
				path: params.get('path') || '/',
				host: params.get('host') || params.get('sni') || '',
				mode: params.get('mode') || 'auto',
			};
		} catch (_) {}
	}

	// 修复2：过滤掉 xhttp 误转的 httpupgrade 节点（sing-box 不支持 xhttp）
	config.outbounds = config.outbounds.filter(ob => {
		const key = endpointKey(ob.server, ob.server_port);
		if (xhttpMap[key]) {
			console.log(`[singboxFix] 过滤 xhttp 节点: ${ob.tag}`);
			return false;
		}
		return true;
	});

	config.outbounds = config.outbounds.map(ob => {
		const key = endpointKey(ob.server, ob.server_port);

		// 修复1：gRPC+REALITY 丢失 reality 块，同时补 utls（REALITY 需要 TLS 指纹伪装）
		const isGrpc = ob.transport && ob.transport.type === 'grpc';
		const hasReality = ob.tls && ob.tls.reality && ob.tls.reality.enabled;
		if (isGrpc && !hasReality && realityMap[key]) {
			const ri = realityMap[key];
			ob.tls = ob.tls || { enabled: true };
			ob.tls.reality = {
				enabled: true,
				public_key: ri.public_key,
				short_id: ri.short_id,
			};
			if (ri.server_name && !ob.tls.server_name) {
				ob.tls.server_name = ri.server_name;
			}
			// 补 utls：REALITY 节点必须有 utls 做 TLS 指纹伪装
			if (!ob.tls.utls) {
				ob.tls.utls = { enabled: true, fingerprint: ri.fingerprint || 'chrome' };
			}
			console.log(`[singboxFix] 注入 reality+utls: ${ob.tag}`);
		}

		// 修复3：gRPC service_name 为 "/" → ""
		if (ob.transport && ob.transport.type === 'grpc' && ob.transport.service_name === '/') {
			ob.transport.service_name = '';
			console.log(`[singboxFix] 修复 grpc service_name: ${ob.tag}`);
		}

		return ob;
	});

	return JSON.stringify(config);
}

function fixMissingGrpcOpts(content, rawNodeText = '') {
	const lineBreak = content.includes('\r\n') ? '\r\n' : '\n';
	const lines = content.split(lineBreak);
	const result = [];
	const grpcServices = new Map(
		parseRawNodeMetadata(rawNodeText)
			.filter(node => node.transport === 'grpc')
			.map(node => [endpointKey(node.server, node.port), node.serviceName || ''])
	);

	for (const line of lines) {
		// 只处理 proxies 段的单行节点（以 "  - {" 开头，含 network: grpc，不含 grpc-opts）
		if (line.trim().startsWith('- {') &&
			line.includes('network: grpc') &&
			!line.includes('grpc-opts')) {
			// 在行尾 } 前插入 grpc-opts
			const key = endpointKey(extractYamlField(line, 'server'), line.match(/port:\s*(\d+)/)?.[1]);
			const serviceName = grpcServices.get(key) || '';
			const fixed = line.replace(/,?\s*\}$/, `, grpc-opts: {grpc-mode: gun, grpc-service-name: ${yamlQuote(serviceName)}}}`);
			result.push(fixed);
		} else {
			result.push(line);
		}
	}
	return result.join(lineBreak);
}

function clashFix(content, rawNodeText = '') {
	// ===== 最优先：修复 subconverter 输出的 proxy-groups 结构错误 =====
	// subconverter 存在 bug：proxy-groups 中每个组末尾多一个空的 proxies:，
	// 且部分组的节点列表游离在 proxies: 标头之外，导致 yaml 结构混乱无法使用。
	content = fixSubconverterGroupStructure(content);
	// ===== 修复：清理 proxy-groups 中引用了不存在节点的条目 =====

	if (content.includes('wireguard') && !content.includes('remote-dns-resolve')) {
		let lines;
		if (content.includes('\r\n')) {
			lines = content.split('\r\n');
		} else {
			lines = content.split('\n');
		}

		let result = "";
		for (let line of lines) {
			if (line.includes('type: wireguard')) {
				const 备改内容 = `, mtu: 1280, udp: true`;
				const 正确内容 = `, mtu: 1280, remote-dns-resolve: true, udp: true`;
				result += line.replace(new RegExp(备改内容, 'g'), 正确内容) + '\n';
			} else {
				result += line + '\n';
			}
		}

		content = result;
	}

	// ===== 修复1：移除 xhttp 传输协议的节点（Clash/Mihomo 不支持 xhttp）=====
	// xhttp 是 Xray 专有协议，subconverter 会将其错误转换为 h2，导致连接失败
	// 此类节点请使用 v2rayN / NekoBox 等 Xray 内核客户端
	content = removeXhttpProxies(content, rawNodeText);

	// ===== 修复2：gRPC service-name 为空时被错误写成 "/" 的问题 =====
	// 原始节点 serviceName= 为空，转换后应为 "" 而非 "/"
	content = content.replace(/grpc-service-name:\s*["']?\/["']?(\s*[,}])/g, 'grpc-service-name: ""$1');

	// ===== 修复3：为 network: grpc 但缺少 grpc-opts 的节点补上 grpc-opts =====
	// subconverter 转换 Trojan+gRPC 时有时会丢失 grpc-opts，Mihomo 需要此字段
	content = fixMissingGrpcOpts(content, rawNodeText);

	// ===== 修复4：Trojan/VLESS + gRPC + REALITY 节点 reality-opts 丢失问题 =====
	// subconverter 在转换 Trojan+gRPC+REALITY 时可能丢失 reality-opts，
	// 导致节点变成普通 TLS 而连接失败。此问题需从原始节点链接重新注入。
	// （已在 injectRealityOpts 中处理，见下方函数）

	return content;
}

// 从原始节点文本中解析 REALITY 参数，注入到 Clash 配置缺失 reality-opts 的节点中
// 主要修复：Trojan + gRPC + REALITY、VLESS + gRPC + REALITY 经 subconverter 转换后 reality-opts 丢失的问题
function injectRealityOpts(clashContent, rawNodeText) {
	// 第1步：从原始节点链接解析 REALITY 参数，建立 uuid/password -> realityInfo 的映射
	const realityMap = {};
	const lines = rawNodeText.split('\n');

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		try {
			let params = null;
			let key = null;

			if (trimmed.startsWith('vless://') || trimmed.startsWith('trojan://')) {
				const withoutScheme = trimmed.replace(/^(vless|trojan):\/\//, '');
				const atIdx = withoutScheme.indexOf('@');
				if (atIdx === -1) continue;
				key = withoutScheme.substring(0, atIdx);
				const rest = withoutScheme.substring(atIdx + 1);
				const qIdx = rest.indexOf('?');
				if (qIdx === -1) continue;
				const queryAndHash = rest.substring(qIdx + 1);
				const hashIdx = queryAndHash.lastIndexOf('#');
				const query = hashIdx !== -1 ? queryAndHash.substring(0, hashIdx) : queryAndHash;
				params = new URLSearchParams(query);
			} else {
				continue;
			}

			const security = params.get('security') || '';
			if (security !== 'reality') continue;

			const pbk = params.get('pbk') || '';
			const sid = params.get('sid') || '';
			const sni = params.get('sni') || '';
			const fp = params.get('fp') || 'chrome';
			const type = params.get('type') || 'tcp';
			const serviceName = params.get('serviceName') || '';

			if (!pbk) continue;
			realityMap[key] = { pbk, sid, sni, fp, type, serviceName };
		} catch (e) {
			continue;
		}
	}

	if (Object.keys(realityMap).length === 0) return clashContent;

	// 第2步：遍历 Clash 配置，找到缺少 reality-opts 但实际上应该有的节点并注入
	const lineBreak = clashContent.includes('\r\n') ? '\r\n' : '\n';
	const clashLines = clashContent.split(lineBreak);
	const result = [];
	let inProxiesSection = false;

	for (let i = 0; i < clashLines.length; i++) {
		const trimmed = clashLines[i].trim();

		if (trimmed === 'proxies:') {
			inProxiesSection = true;
			result.push(clashLines[i]);
			continue;
		}

		if (inProxiesSection && trimmed !== '' && !trimmed.startsWith('-') && !trimmed.startsWith('#') && !clashLines[i].startsWith('  ') && !clashLines[i].startsWith('\t')) {
			inProxiesSection = false;
		}

		// 处理单行内联格式节点
		if (inProxiesSection && (trimmed.startsWith('- {name:') || trimmed.startsWith('- name:'))) {
			let lineToProcess = clashLines[i];

			if (!lineToProcess.includes('reality-opts')) {
				const uuidMatch = lineToProcess.match(/uuid:\s*([0-9a-f-]{36})/i);
				const pwMatch = lineToProcess.match(/password:\s*([^\s,}]+)/i);
				const matchKey = (uuidMatch && uuidMatch[1]) || (pwMatch && pwMatch[1]);

				if (matchKey && realityMap[matchKey]) {
					const ri = realityMap[matchKey];
					const sidStr = ri.sid ? `"${ri.sid}"` : '""';
					const realityOpts = `reality-opts: {public-key: ${ri.pbk}, short-id: ${sidStr}}`;

					// 确保 tls: true
					if (lineToProcess.includes('tls: false')) {
						lineToProcess = lineToProcess.replace(/tls:\s*false/, 'tls: true');
					} else if (!lineToProcess.includes('tls:')) {
						lineToProcess = lineToProcess.replace(/}(\s*)$/, ', tls: true}$1');
					}

					// 注入 reality-opts 到行末 } 前
					lineToProcess = lineToProcess.replace(/}(\s*)$/, `, ${realityOpts}}$1`);

					// 注入 servername（如果没有）
					if (ri.sni && !lineToProcess.includes('servername:')) {
						lineToProcess = lineToProcess.replace(/}(\s*)$/, `, servername: ${ri.sni}}$1`);
					}

					// 修复 gRPC service-name 为空时被写成 "/" 的问题
					if (ri.type === 'grpc' && ri.serviceName === '' && lineToProcess.includes('grpc-opts:')) {
						lineToProcess = lineToProcess.replace(/grpc-service-name:\s*["']?\/["']?/g, 'grpc-service-name: ""');
					}

					// 注入 client-fingerprint（如果没有）
					if (ri.fp && !lineToProcess.includes('client-fingerprint:')) {
						lineToProcess = lineToProcess.replace(/}(\s*)$/, `, client-fingerprint: ${ri.fp}}$1`);
					}

					console.log(`[injectRealityOpts] 已注入 reality-opts: key=${matchKey.substring(0, 8)}...`);
				}
			} else {
				// 即使已有 reality-opts，也修复 gRPC service-name 为 "/" 的问题
				const uuidMatch = lineToProcess.match(/uuid:\s*([0-9a-f-]{36})/i);
				const pwMatch = lineToProcess.match(/password:\s*([^\s,}]+)/i);
				const matchKey = (uuidMatch && uuidMatch[1]) || (pwMatch && pwMatch[1]);
				if (matchKey && realityMap[matchKey]) {
					const ri = realityMap[matchKey];
					if (ri.type === 'grpc' && ri.serviceName === '' && lineToProcess.includes('grpc-opts:')) {
						lineToProcess = lineToProcess.replace(/grpc-service-name:\s*["']?\/["']?/g, 'grpc-service-name: ""');
					}
				}
			}

			result.push(lineToProcess);
			continue;
		}

		result.push(clashLines[i]);
	}

	return result.join(lineBreak);
}

// 只按原始 xhttp 节点的 server:port 精确移除误转节点，避免误删正常 h2 或 gRPC+REALITY。
// 只处理顶级 proxies: 段，不碰 proxy-groups。
function removeXhttpProxies(content, rawNodeText = '') {
	const lineBreak = content.includes('\r\n') ? '\r\n' : '\n';
	const lines = content.split(lineBreak);
	const TOP = /^[a-zA-Z][a-zA-Z0-9_-]*:/;
	const result = [];
	let topSection = '';
	let blockLines = [];
	const xhttpEndpoints = new Set(
		parseRawNodeMetadata(rawNodeText)
			.filter(node => node.transport === 'xhttp')
			.map(node => endpointKey(node.server, node.port))
			.filter(Boolean)
	);

	const flushBlock = () => {
		if (!blockLines.length) return;
		const blockStr = blockLines.join(lineBreak);
		const server = blockStr.match(/server:\s*["']?([^,"'}\r\n]+)/)?.[1]?.trim();
		const port = blockStr.match(/port:\s*(\d+)/)?.[1];
		const isXhttp = xhttpEndpoints.has(endpointKey(server, port));

		if (!isXhttp) {
			result.push(...blockLines);
		} else {
			console.log(`[removeXhttpProxies] 已移除 xhttp 误转节点: ${blockStr.match(/name:\s*["']?([^"',}\r\n]+)/)?.[1] || ''}`);
		}
		blockLines = [];
	};

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// 检测顶级段切换
		if (TOP.test(line)) {
			flushBlock();
			topSection = line.split(':')[0].trim();
			result.push(line);
			continue;
		}

		// 只在顶级 proxies: 段内处理
		if (topSection !== 'proxies') {
			flushBlock();
			result.push(line);
			continue;
		}

		// proxies 段内：检测新节点块（以 "  - {name:" 开头）
		if (/^\s+- \{?name:/.test(line)) {
			flushBlock();
			blockLines = [line];
			continue;
		}

		if (blockLines.length > 0) {
			blockLines.push(line);
		} else {
			result.push(line);
		}
	}
	flushBlock();

	return result.join(lineBreak);
}

async function getSUB(api, 追加UA, userAgentHeader, options = {}) {
	if (!api || api.length === 0) {
		return [[], '', []];
	} else api = [...new Set(api)]; // 去重
	const timeoutMs = options.timeoutMs || 8000;
	const concurrency = options.concurrency || 6;
	const maxBytes = options.maxBytes || 4194304;
	const nodeLines = [];
	const 订阅转换URLs = [];
	const failures = [];

	try {
		const responses = await mapSettledWithConcurrency(api, concurrency, apiUrl => getUrl(apiUrl, 追加UA, userAgentHeader, timeoutMs, maxBytes));
		for (let index = 0; index < responses.length; index++) {
			const response = responses[index];
			const apiUrl = api[index];
			if (response.status === 'rejected') {
				const reason = response.reason;
				failures.push(`${getUrlHost(apiUrl)}: ${reason?.name === 'AbortError' ? '超时' : (reason?.message || '请求失败')}`);
				continue;
			}
			const content = response.value;
			if (/^proxies:\s*$/m.test(content) || isSingBoxConfig(content)) {
				订阅转换URLs.push(apiUrl);
				continue;
			}
			let extracted = extractNodeLines(content);
			if (extracted.length === 0 && isValidBase64(content)) {
				try {
					extracted = extractNodeLines(base64Decode(content));
				} catch (_) {}
			}
			if (extracted.length > 0) nodeLines.push(...extracted);
			else failures.push(`${getUrlHost(apiUrl)}: 未识别到有效订阅内容`);
		}
	} catch (error) {
		failures.push(error.message || '订阅汇总失败');
	}

	return [[...new Set(nodeLines)], 订阅转换URLs.join('|'), failures];
}

async function getUrl(targetUrl, 追加UA, userAgentHeader, timeoutMs, maxBytes) {
	if (!isHttpUrl(targetUrl)) throw new Error('无效 URL');
	const response = await fetchWithTimeout(targetUrl, {
		method: 'GET',
		headers: {
			'Accept': 'text/plain, application/json, application/yaml, */*;q=0.8',
			'User-Agent': `${atob('djJyYXlOLzYuNDU=')} cmliu/CF-Workers-SUB ${追加UA}(${userAgentHeader})`,
		},
		redirect: 'follow',
	}, timeoutMs);
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	const contentLength = Number(response.headers.get('content-length') || 0);
	if (contentLength > maxBytes) throw new Error('响应过大');
	const content = await response.text();
	if (new TextEncoder().encode(content).length > maxBytes) throw new Error('响应过大');
	return content;
}

function isValidBase64(str) {
	// 先移除所有空白字符(空格、换行、回车等)
	const cleanStr = String(str || '').replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
	if (!cleanStr || cleanStr.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(cleanStr)) return false;
	try {
		atob(cleanStr + '='.repeat((4 - cleanStr.length % 4) % 4));
		return true;
	} catch (_) {
		return false;
	}
}

function isSingBoxConfig(content) {
	try {
		const config = JSON.parse(content);
		return Array.isArray(config.outbounds) || Array.isArray(config.inbounds);
	} catch (_) {
		return false;
	}
}

function getUrlHost(value) {
	try {
		return new URL(value).host;
	} catch (_) {
		return 'unknown';
	}
}

async function 迁移地址列表(env, txt = 'ADD.txt') {
	const 旧数据 = await env.KV.get(`/${txt}`);
	const 新数据 = await env.KV.get(txt);

	if (旧数据 && !新数据) {
		// 写入新位置
		await env.KV.put(txt, 旧数据);
		// 删除旧数据
		await env.KV.delete(`/${txt}`);
		return true;
	}
	return false;
}

async function KV(request, env, txt = 'ADD.txt', guest, config = {}) {
	const url = new URL(request.url);
	const {
		fileName = DEFAULT_FILE_NAME,
		mytoken = DEFAULT_TOKEN,
		sbConfig = DEFAULT_SB_CONFIG,
		subProtocol = 'https',
		subConverter = DEFAULT_SUB_CONVERTER,
		subConfig = DEFAULT_SUB_CONFIG,
	} = config;
	try {
		// POST请求处理
		if (request.method === "POST") {
			if (!env.KV) return new Response("未绑定KV空间", { status: 400 });
			try {
				const content = await request.text();
				if (new TextEncoder().encode(content).length > 1048576) return new Response("内容超过 1 MiB 限制", { status: 413 });
				await env.KV.put(txt, content);
				return new Response("保存成功", { headers: { 'Cache-Control': 'no-store' } });
			} catch (error) {
				console.error('保存KV时发生错误:', error);
				return new Response("保存失败: " + error.message, { status: 500 });
			}
		}

		// GET请求部分
		let content = '';
		let hasKV = !!env.KV;

		if (hasKV) {
			try {
				content = await env.KV.get(txt) || '';
			} catch (error) {
				console.error('读取KV时发生错误:', error);
				content = '读取数据时发生错误: ' + error.message;
			}
		}
		const ownerTokenPath = encodeURIComponent(mytoken);
		const guestParam = encodeURIComponent(guest);
		const safeFileName = escapeHtml(fileName);
		const safeContent = escapeHtml(content);
		const safeGuest = escapeHtml(guest);
		const safeSubApi = escapeHtml(`${subProtocol}://${subConverter}`);
		const safeSubConfig = escapeHtml(subConfig);
		const safeSbConfig = escapeHtml(sbConfig || '未设置');
		const safeUserAgent = escapeHtml(request.headers.get('User-Agent') || '');

		const html = `
			<!DOCTYPE html>
			<html>
				<head>
					<title>${safeFileName} 订阅编辑</title>
					<meta charset="utf-8">
					<meta name="viewport" content="width=device-width, initial-scale=1">
					<style>
						body {
							margin: 0;
							padding: 15px; /* 调整padding */
							box-sizing: border-box;
							font-size: 13px; /* 设置全局字体大小 */
						}
						.editor-container {
							width: 100%;
							max-width: 100%;
							margin: 0 auto;
						}
						.editor {
							width: 100%;
							height: 300px; /* 调整高度 */
							margin: 15px 0; /* 调整margin */
							padding: 10px; /* 调整padding */
							box-sizing: border-box;
							border: 1px solid #ccc;
							border-radius: 4px;
							font-size: 13px;
							line-height: 1.5;
							overflow-y: auto;
							resize: none;
						}
						.save-container {
							margin-top: 8px; /* 调整margin */
							display: flex;
							align-items: center;
							gap: 10px; /* 调整gap */
						}
						.save-btn, .back-btn {
							padding: 6px 15px; /* 调整padding */
							color: white;
							border: none;
							border-radius: 4px;
							cursor: pointer;
						}
						.save-btn {
							background: #4CAF50;
						}
						.save-btn:hover {
							background: #45a049;
						}
						.back-btn {
							background: #666;
						}
						.back-btn:hover {
							background: #555;
						}
						.save-status {
							color: #666;
						}
					</style>
					<script src="https://cdn.jsdelivr.net/npm/@keeex/qrcodejs-kx@1.0.2/qrcode.min.js"></script>
				</head>
				<body>
					################################################################<br>
					Subscribe / sub 订阅地址, 点击链接自动 <strong>复制订阅链接</strong> 并 <strong>生成订阅二维码</strong> <br>
					---------------------------------------------------------------<br>
					自适应订阅地址:<br>
					<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/${ownerTokenPath}?sub','qrcode_0')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/${ownerTokenPath}</a><br>
					<div id="qrcode_0" style="margin: 10px 10px 10px 10px;"></div>
					Base64订阅地址:<br>
					<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/${ownerTokenPath}?b64','qrcode_1')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/${ownerTokenPath}?b64</a><br>
					<div id="qrcode_1" style="margin: 10px 10px 10px 10px;"></div>
					clash订阅地址:<br>
					<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/${ownerTokenPath}?clash','qrcode_2')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/${ownerTokenPath}?clash</a><br>
					<div id="qrcode_2" style="margin: 10px 10px 10px 10px;"></div>
					singbox订阅地址:<br>
					<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/${ownerTokenPath}?sb','qrcode_3')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/${ownerTokenPath}?sb</a><br>
					<div id="qrcode_3" style="margin: 10px 10px 10px 10px;"></div>
					${sbConfig ? `singbox订阅地址（含模板）:<br>
					<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/${ownerTokenPath}?sb&sbconfig=${encodeURIComponent(sbConfig)}','qrcode_3t')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/${ownerTokenPath}?sb&sbconfig=${encodeURIComponent(sbConfig)}</a><br>
					<div id="qrcode_3t" style="margin: 10px 10px 10px 10px;"></div>` : ''}
					surge订阅地址:<br>
					<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/${ownerTokenPath}?surge','qrcode_4')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/${ownerTokenPath}?surge</a><br>
					<div id="qrcode_4" style="margin: 10px 10px 10px 10px;"></div>
					loon订阅地址:<br>
					<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/${ownerTokenPath}?loon','qrcode_5')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/${ownerTokenPath}?loon</a><br>
					<div id="qrcode_5" style="margin: 10px 10px 10px 10px;"></div>
					&nbsp;&nbsp;<strong><a href="javascript:void(0);" id="noticeToggle" onclick="toggleNotice()">查看访客订阅∨</a></strong><br>
					<div id="noticeContent" class="notice-content" style="display: none;">
						---------------------------------------------------------------<br>
						访客订阅只能使用订阅功能，无法查看配置页！<br>
						GUEST（访客订阅TOKEN）: <strong>${safeGuest}</strong><br>
						---------------------------------------------------------------<br>
						自适应订阅地址:<br>
						<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/sub?token=${guestParam}','guest_0')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/sub?token=${guestParam}</a><br>
						<div id="guest_0" style="margin: 10px 10px 10px 10px;"></div>
						Base64订阅地址:<br>
						<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/sub?token=${guestParam}&b64','guest_1')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/sub?token=${guestParam}&b64</a><br>
						<div id="guest_1" style="margin: 10px 10px 10px 10px;"></div>
						clash订阅地址:<br>
						<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/sub?token=${guestParam}&clash','guest_2')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/sub?token=${guestParam}&clash</a><br>
						<div id="guest_2" style="margin: 10px 10px 10px 10px;"></div>
						singbox订阅地址:<br>
						<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/sub?token=${guestParam}&sb','guest_3')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/sub?token=${guestParam}&sb</a><br>
						<div id="guest_3" style="margin: 10px 10px 10px 10px;"></div>
						surge订阅地址:<br>
						<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/sub?token=${guestParam}&surge','guest_4')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/sub?token=${guestParam}&surge</a><br>
						<div id="guest_4" style="margin: 10px 10px 10px 10px;"></div>
						loon订阅地址:<br>
						<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/sub?token=${guestParam}&loon','guest_5')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/sub?token=${guestParam}&loon</a><br>
						<div id="guest_5" style="margin: 10px 10px 10px 10px;"></div>
					</div>
					---------------------------------------------------------------<br>
					################################################################<br>
					订阅转换配置<br>
					---------------------------------------------------------------<br>
					SUBAPI（订阅转换后端）: <strong>${safeSubApi}</strong><br>
					SUBCONFIG（订阅转换配置文件）: <strong>${safeSubConfig}</strong><br>
					SBCONFIG（sing-box JSON模板）: <strong>${safeSbConfig}</strong><br>
					---------------------------------------------------------------<br>
					################################################################<br>
					${safeFileName} 汇聚订阅编辑:
					<div class="editor-container">
						${hasKV ? `
						<textarea class="editor" 
							placeholder="${decodeURIComponent(atob('TElOSyVFNyVBNCVCQSVFNCVCRSU4QiVFRiVCQyU4OCVFNCVCOCU4MCVFOCVBMSU4QyVFNCVCOCU4MCVFNCVCOCVBQSVFOCU4QSU4MiVFNyU4MiVCOSVFOSU5MyVCRSVFNiU4RSVBNSVFNSU4RCVCMyVFNSU4RiVBRiVFRiVCQyU4OSVFRiVCQyU5QQp2bGVzcyUzQSUyRiUyRjI0NmFhNzk1LTA2MzctNGY0Yy04ZjY0LTJjOGZiMjRjMWJhZCU0MDEyNy4wLjAuMSUzQTEyMzQlM0ZlbmNyeXB0aW9uJTNEbm9uZSUyNnNlY3VyaXR5JTNEdGxzJTI2c25pJTNEVEcuQ01MaXVzc3NzLmxvc2V5b3VyaXAuY29tJTI2YWxsb3dJbnNlY3VyZSUzRDElMjZ0eXBlJTNEd3MlMjZob3N0JTNEVEcuQ01MaXVzc3NzLmxvc2V5b3VyaXAuY29tJTI2cGF0aCUzRCUyNTJGJTI1M0ZlZCUyNTNEMjU2MCUyM0NGbmF0CnRyb2phbiUzQSUyRiUyRmFhNmRkZDJmLWQxY2YtNGE1Mi1iYTFiLTI2NDBjNDFhNzg1NiU0MDIxOC4xOTAuMjMwLjIwNyUzQTQxMjg4JTNGc2VjdXJpdHklM0R0bHMlMjZzbmklM0RoazEyLmJpbGliaWxpLmNvbSUyNmFsbG93SW5zZWN1cmUlM0QxJTI2dHlwZSUzRHRjcCUyNmhlYWRlclR5cGUlM0Rub25lJTIzSEsKc3MlM0ElMkYlMkZZMmhoWTJoaE1qQXRhV1YwWmkxd2IyeDVNVE13TlRveVJYUlFjVzQyU0ZscVZVNWpTRzlvVEdaVmNFWlJkMjVtYWtORFVUVnRhREZ0U21SRlRVTkNkV04xVjFvNVVERjFaR3RTUzBodVZuaDFielUxYXpGTFdIb3lSbTgyYW5KbmRERTRWelkyYjNCMGVURmxOR0p0TVdwNlprTm1RbUklMjUzRCU0MDg0LjE5LjMxLjYzJTNBNTA4NDElMjNERQoKCiVFOCVBRSVBMiVFOSU5OCU4NSVFOSU5MyVCRSVFNiU4RSVBNSVFNyVBNCVCQSVFNCVCRSU4QiVFRiVCQyU4OCVFNCVCOCU4MCVFOCVBMSU4QyVFNCVCOCU4MCVFNiU5RCVBMSVFOCVBRSVBMiVFOSU5OCU4NSVFOSU5MyVCRSVFNiU4RSVBNSVFNSU4RCVCMyVFNSU4RiVBRiVFRiVCQyU4OSVFRiVCQyU5QQpodHRwcyUzQSUyRiUyRnN1Yi54Zi5mcmVlLmhyJTJGYXV0bw=='))}"
							id="content">${safeContent}</textarea>
						<div class="save-container">
							<button class="save-btn" type="button">保存</button>
							<span class="save-status" id="saveStatus"></span>
						</div>
						` : '<p>请绑定 <strong>变量名称</strong> 为 <strong>KV</strong> 的KV命名空间</p>'}
					</div>
					<br>
					################################################################<br>
					${decodeURIComponent(atob('dGVsZWdyYW0lMjAlRTQlQkElQTQlRTYlQjUlODElRTclQkUlQTQlMjAlRTYlOEElODAlRTYlOUMlQUYlRTUlQTQlQTclRTQlQkQlQUMlN0UlRTUlOUMlQTglRTclQkElQkYlRTUlOEYlOTElRTclODklOEMhJTNDYnIlM0UKJTNDYSUyMGhyZWYlM0QlMjdodHRwcyUzQSUyRiUyRnQubWUlMkZDTUxpdXNzc3MlMjclM0VodHRwcyUzQSUyRiUyRnQubWUlMkZDTUxpdXNzc3MlM0MlMkZhJTNFJTNDYnIlM0UKLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tJTNDYnIlM0UKZ2l0aHViJTIwJUU5JUExJUI5JUU3JTlCJUFFJUU1JTlDJUIwJUU1JTlEJTgwJTIwU3RhciFTdGFyIVN0YXIhISElM0NiciUzRQolM0NhJTIwaHJlZiUzRCUyN2h0dHBzJTNBJTJGJTJGZ2l0aHViLmNvbSUyRmNtbGl1JTJGQ0YtV29ya2Vycy1TVUIlMjclM0VodHRwcyUzQSUyRiUyRmdpdGh1Yi5jb20lMkZjbWxpdSUyRkNGLVdvcmtlcnMtU1VCJTNDJTJGYSUzRSUzQ2JyJTNFCi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSUzQ2JyJTNFCiUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMw=='))}
					<br><br>UA: <strong>${safeUserAgent}</strong>
					<script>
					function copyToClipboard(text, qrcode) {
						navigator.clipboard.writeText(text).then(() => {
							alert('已复制到剪贴板');
						}).catch(err => {
							console.error('复制失败:', err);
						});
						const qrcodeDiv = document.getElementById(qrcode);
						qrcodeDiv.innerHTML = '';
						new QRCode(qrcodeDiv, {
							text: text,
							width: 220, // 调整宽度
							height: 220, // 调整高度
							colorDark: "#000000", // 二维码颜色
							colorLight: "#ffffff", // 背景颜色
							correctLevel: QRCode.CorrectLevel.Q, // 设置纠错级别
							scale: 1 // 调整像素颗粒度
						});
					}
						
					if (document.querySelector('.editor')) {
						let timer;
						let saving = false;
						const textarea = document.getElementById('content');
						const saveButton = document.querySelector('.save-btn');
						let lastSavedContent = textarea.value;
		
						function replaceFullwidthColon() {
							const text = textarea.value;
							textarea.value = text.replace(/：/g, ':');
						}
						
						async function saveContent(button = saveButton) {
							if (!button || saving) return;
							try {
								const updateStatus = (message, isError = false) => {
									const statusElem = document.getElementById('saveStatus');
									if (statusElem) {
										statusElem.textContent = message;
										statusElem.style.color = isError ? 'red' : '#666';
									}
								};
								const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
								if (!isIOS) replaceFullwidthColon();
								const newContent = textarea.value || '';
								if (newContent === lastSavedContent) {
									updateStatus('内容未变化');
									return;
								}
								saving = true;
								button.textContent = '保存中...';
								button.disabled = true;
								const response = await fetch(window.location.href, {
										method: 'POST',
										body: newContent,
										headers: {
											'Content-Type': 'text/plain;charset=UTF-8'
										},
										cache: 'no-cache'
								});
								if (!response.ok) throw new Error((await response.text()) || \`HTTP \${response.status}\`);
								lastSavedContent = newContent;
								textarea.defaultValue = newContent;
								const now = new Date().toLocaleString();
								document.title = \`编辑已保存 \${now}\`;
								updateStatus(\`已保存 \${now}\`);
							} catch (error) {
								console.error('保存过程出错:', error);
								const statusElem = document.getElementById('saveStatus');
								if (statusElem) {
									statusElem.textContent = \`保存失败: \${error.message}\`;
									statusElem.style.color = 'red';
								}
							} finally {
								saving = false;
								button.textContent = '保存';
								button.disabled = false;
							}
						}

						textarea.addEventListener('blur', () => saveContent(saveButton));
						saveButton.addEventListener('click', () => saveContent(saveButton));
						textarea.addEventListener('input', () => {
							clearTimeout(timer);
							timer = setTimeout(() => saveContent(saveButton), 5000);
						});
					}

					function toggleNotice() {
						const noticeContent = document.getElementById('noticeContent');
						const noticeToggle = document.getElementById('noticeToggle');
						if (noticeContent.style.display === 'none' || noticeContent.style.display === '') {
							noticeContent.style.display = 'block';
							noticeToggle.textContent = '隐藏访客订阅∧';
						} else {
							noticeContent.style.display = 'none';
							noticeToggle.textContent = '查看访客订阅∨';
						}
					}
			
					// 初始化 noticeContent 的 display 属性
					document.addEventListener('DOMContentLoaded', () => {
						document.getElementById('noticeContent').style.display = 'none';
					});
					</script>
				</body>
			</html>
		`;

		return new Response(html, {
			headers: {
				"Content-Type": "text/html;charset=utf-8",
				"Cache-Control": "no-store",
				"X-Content-Type-Options": "nosniff",
				"X-Frame-Options": "DENY",
				"Referrer-Policy": "no-referrer",
			}
		});
	} catch (error) {
		console.error('处理请求时发生错误:', error);
		return new Response("服务器错误: " + error.message, {
			status: 500,
			headers: { "Content-Type": "text/plain;charset=utf-8" }
		});
	}
}
