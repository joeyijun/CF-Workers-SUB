// 部署完成后在网址后面加上这个，获取自建节点和机场聚合节点，/?token=auto或/auto或

let mytoken = 'auto';
let guestToken = ''; //可以随便取，或者uuid生成，https://1024tools.com/uuid
let BotToken = ''; //可以为空，或者@BotFather中输入/start，/newbot，并关注机器人
let ChatID = ''; //可以为空，或者@userinfobot中获取，/start
let TG = 0; //小白勿动， 开发者专用，1 为推送所有的访问信息，0 为不推送订阅转换后端的访问信息与异常访问
let FileName = 'CF-Workers-SUB';
let SUBUpdateTime = 6; //自定义订阅更新时间，单位小时
let total = 99;//TB
let timestamp = 4102329600000;//2099-12-31

//节点链接 + 订阅链接
let MainData = `
https://cfxr.eu.org/getSub
`;

let urls = [];
let subConverter = "SUBAPI.cmliussss.net"; //在线订阅转换后端，目前使用CM的订阅转换功能。支持自建psub 可自行搭建https://github.com/bulianglin/psub
let subConfig = "https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/config/ACL4SSR_Online_MultiCountry.ini"; //订阅配置文件
let sbConfig = ""; // sing-box JSON 模板地址
let subProtocol = 'https';

export default {
	async fetch(request, env) {
		const userAgentHeader = request.headers.get('User-Agent');
		const userAgent = userAgentHeader ? userAgentHeader.toLowerCase() : "null";
		const url = new URL(request.url);
		const token = url.searchParams.get('token');
		mytoken = env.TOKEN || mytoken;
		BotToken = env.TGTOKEN || BotToken;
		ChatID = env.TGID || ChatID;
		TG = env.TG || TG;
		subConverter = env.SUBAPI || subConverter;
		if (subConverter.includes("http://")) {
			subConverter = subConverter.split("//")[1];
			subProtocol = 'http';
		} else {
			subConverter = subConverter.split("//")[1] || subConverter;
		}
		subConfig = env.SUBCONFIG || subConfig;
		sbConfig = env.SBCONFIG || sbConfig;
		FileName = env.SUBNAME || FileName;

		const currentDate = new Date();
		currentDate.setHours(0, 0, 0, 0);
		const timeTemp = Math.ceil(currentDate.getTime() / 1000);
		const fakeToken = await MD5MD5(`${mytoken}${timeTemp}`);
		guestToken = env.GUESTTOKEN || env.GUEST || guestToken;
		if (!guestToken) guestToken = await MD5MD5(mytoken);
		const 访客订阅 = guestToken;
		//console.log(`${fakeUserID}\n${fakeHostName}`); // 打印fakeID

		let UD = Math.floor(((timestamp - Date.now()) / timestamp * total * 1099511627776) / 2);
		total = total * 1099511627776;
		let expire = Math.floor(timestamp / 1000);
		SUBUpdateTime = env.SUBUPTIME || SUBUpdateTime;

		if (!([mytoken, fakeToken, 访客订阅].includes(token) || url.pathname == ("/" + mytoken) || url.pathname.includes("/" + mytoken + "?"))) {
			if (TG == 1 && url.pathname !== "/" && url.pathname !== "/favicon.ico") await sendMessage(`#异常访问 ${FileName}`, request.headers.get('CF-Connecting-IP'), `UA: ${userAgent}</tg-spoiler>\n域名: ${url.hostname}\n<tg-spoiler>入口: ${url.pathname + url.search}</tg-spoiler>`);
			if (env.URL302) return Response.redirect(env.URL302, 302);
			else if (env.URL) return await proxyURL(env.URL, url);
			else return new Response(await nginx(), {
				status: 200,
				headers: {
					'Content-Type': 'text/html; charset=UTF-8',
				},
			});
		} else {
			if (env.KV) {
				await 迁移地址列表(env, 'LINK.txt');
				if (userAgent.includes('mozilla') && !url.search) {
					await sendMessage(`#编辑订阅 ${FileName}`, request.headers.get('CF-Connecting-IP'), `UA: ${userAgentHeader}</tg-spoiler>\n域名: ${url.hostname}\n<tg-spoiler>入口: ${url.pathname + url.search}</tg-spoiler>`);
					return await KV(request, env, 'LINK.txt', 访客订阅);
				} else {
					MainData = await env.KV.get('LINK.txt') || MainData;
				}
			} else {
				MainData = env.LINK || MainData;
				if (env.LINKSUB) urls = await ADD(env.LINKSUB);
			}
			let 重新汇总所有链接 = await ADD(MainData + '\n' + urls.join('\n'));
			let 自建节点 = "";
			let 订阅链接 = "";
			for (let x of 重新汇总所有链接) {
				if (x.toLowerCase().startsWith('http')) {
					订阅链接 += x + '\n';
				} else {
					自建节点 += x + '\n';
				}
			}
			MainData = 自建节点;
			urls = await ADD(订阅链接);
			await sendMessage(`#获取订阅 ${FileName}`, request.headers.get('CF-Connecting-IP'), `UA: ${userAgentHeader}</tg-spoiler>\n域名: ${url.hostname}\n<tg-spoiler>入口: ${url.pathname + url.search}</tg-spoiler>`);
			const isSubConverterRequest = request.headers.get('subconverter-request') || request.headers.get('subconverter-version') || userAgent.includes('subconverter');
			let 订阅格式 = 'base64';
			if (!(userAgent.includes('null') || isSubConverterRequest || userAgent.includes('nekobox') || userAgent.includes(('CF-Workers-SUB').toLowerCase()))) {
				if (userAgent.includes('sing-box') || userAgent.includes('singbox') || url.searchParams.has('sb') || url.searchParams.has('singbox')) {
					if (url.searchParams.has('sbconfig')) sbConfig = decodeURIComponent(url.searchParams.get('sbconfig'));
					订阅格式 = 'singbox';
				} else if (userAgent.includes('surge') || url.searchParams.has('surge')) {
					订阅格式 = 'surge';
				} else if (userAgent.includes('quantumult') || url.searchParams.has('quanx')) {
					订阅格式 = 'quanx';
				} else if (userAgent.includes('loon') || url.searchParams.has('loon')) {
					订阅格式 = 'loon';
				} else if (userAgent.includes('clash') || userAgent.includes('meta') || userAgent.includes('mihomo') || url.searchParams.has('clash')) {
					订阅格式 = 'clash';
				}
			}

			let subConverterUrl;
			let 订阅转换URL = `${url.origin}/${await MD5MD5(fakeToken)}?token=${fakeToken}`;
			//console.log(订阅转换URL);
			let req_data = MainData;

			let 追加UA = 'v2rayn';
			if (url.searchParams.has('b64') || url.searchParams.has('base64')) 订阅格式 = 'base64';
			else if (url.searchParams.has('clash')) 追加UA = 'clash';
			else if (url.searchParams.has('singbox')) 追加UA = 'singbox';
			else if (url.searchParams.has('surge')) 追加UA = 'surge';
			else if (url.searchParams.has('quanx')) 追加UA = 'Quantumult%20X';
			else if (url.searchParams.has('loon')) 追加UA = 'Loon';

			const 订阅链接数组 = [...new Set(urls)].filter(item => item?.trim?.()); // 去重
			if (订阅链接数组.length > 0) {
				const 请求订阅响应内容 = await getSUB(订阅链接数组, request, 追加UA, userAgentHeader);
				console.log(请求订阅响应内容);
				req_data += 请求订阅响应内容[0].join('\n');
				订阅转换URL += "|" + 请求订阅响应内容[1];
				if (订阅格式 == 'base64' && !isSubConverterRequest && 请求订阅响应内容[1].includes('://')) {
					subConverterUrl = `${subProtocol}://${subConverter}/sub?target=mixed&url=${encodeURIComponent(请求订阅响应内容[1])}&insert=false&config=${encodeURIComponent(subConfig)}&emoji=true&list=false&tfo=false&scv=true&fdn=false&sort=false&new_name=true`;
					try {
						const subConverterResponse = await fetch(subConverterUrl, { headers: { 'User-Agent': 'v2rayN/CF-Workers-SUB  (https://github.com/cmliu/CF-Workers-SUB)' } });
						if (subConverterResponse.ok) {
							const subConverterContent = await subConverterResponse.text();
							req_data += '\n' + atob(subConverterContent);
						}
					} catch (error) {
						console.log('订阅转换请回base64失败，检查订阅转换后端是否正常运行');
					}
				}
			}

			if (env.WARP) 订阅转换URL += "|" + (await ADD(env.WARP)).join("|");
			//修复中文错误
			const utf8Encoder = new TextEncoder();
			const encodedData = utf8Encoder.encode(req_data);
			//const text = String.fromCharCode.apply(null, encodedData);
			const utf8Decoder = new TextDecoder();
			const text = utf8Decoder.decode(encodedData);

			//去重
			const uniqueLines = new Set(text.split('\n'));
			const result = [...uniqueLines].join('\n');
			//console.log(result);

			let base64Data;
			try {
				base64Data = btoa(result);
			} catch (e) {
				function encodeBase64(data) {
					const binary = new TextEncoder().encode(data);
					let base64 = '';
					const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

					for (let i = 0; i < binary.length; i += 3) {
						const byte1 = binary[i];
						const byte2 = binary[i + 1] || 0;
						const byte3 = binary[i + 2] || 0;

						base64 += chars[byte1 >> 2];
						base64 += chars[((byte1 & 3) << 4) | (byte2 >> 4)];
						base64 += chars[((byte2 & 15) << 2) | (byte3 >> 6)];
						base64 += chars[byte3 & 63];
					}

					const padding = 3 - (binary.length % 3 || 3);
					return base64.slice(0, base64.length - padding) + '=='.slice(0, padding);
				}

				base64Data = encodeBase64(result)
			}

			// 构建响应头对象
			const responseHeaders = {
				"content-type": "text/plain; charset=utf-8",
				"Profile-Update-Interval": `${SUBUpdateTime}`,
				"Profile-web-page-url": request.url.includes('?') ? request.url.split('?')[0] : request.url,
				//"Subscription-Userinfo": `upload=${UD}; download=${UD}; total=${total}; expire=${expire}`,
			};

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
				const subConverterResponse = await fetch(subConverterUrl, { headers: { 'User-Agent': userAgentHeader } });//订阅转换
				if (!subConverterResponse.ok) return new Response(base64Data, { headers: responseHeaders });
				let subConverterContent = await subConverterResponse.text();
				if (订阅格式 == 'clash') {
					subConverterContent = await clashFix(subConverterContent);
					// 恢复被 subconverter 去掉的 emoji 国旗
					try {
						subConverterContent = restoreEmoji(subConverterContent, result);
						// emoji 恢复后再清幽灵引用（此时节点名已含 emoji，匹配才准确）
						subConverterContent = removeGhostProxyRefs(subConverterContent);
						// 根据恢复的 emoji 重新分配节点到对应国家组
						subConverterContent = fixProxyGroups(subConverterContent);
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
						const rulesets = await parseSubConfig(subConfig);
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
							const tmplResp = await fetch(sbConfig);
							if (tmplResp.ok) {
								const tmplText = await tmplResp.text();
								subConverterContent = singboxInjectNodes(subConverterContent, tmplText);
							}
						} catch (e) {
							console.log('singbox 模板注入失败: ' + e.message);
						}
					}
				}
				// 只有非浏览器订阅才会返回SUBNAME
				if (!userAgent.includes('mozilla')) responseHeaders["Content-Disposition"] = `attachment; filename*=utf-8''${encodeURIComponent(FileName)}`;
				return new Response(subConverterContent, { headers: responseHeaders });
			} catch (error) {
				return new Response(base64Data, { headers: responseHeaders });
			}
		}
	}
};

async function ADD(envadd) {
	var addtext = envadd.replace(/[	"'|\r\n]+/g, '\n').replace(/\n+/g, '\n');	// 替换为换行
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

async function sendMessage(type, ip, add_data = "") {
	if (BotToken !== '' && ChatID !== '') {
		let msg = "";
		const response = await fetch(`http://ip-api.com/json/${ip}?lang=zh-CN`);
		if (response.status == 200) {
			const ipInfo = await response.json();
			msg = `${type}\nIP: ${ip}\n国家: ${ipInfo.country}\n<tg-spoiler>城市: ${ipInfo.city}\n组织: ${ipInfo.org}\nASN: ${ipInfo.as}\n${add_data}`;
		} else {
			msg = `${type}\nIP: ${ip}\n<tg-spoiler>${add_data}`;
		}

		let url = "https://api.telegram.org/bot" + BotToken + "/sendMessage?chat_id=" + ChatID + "&parse_mode=HTML&text=" + encodeURIComponent(msg);
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
	const bytes = new Uint8Array(atob(str).split('').map(c => c.charCodeAt(0)));
	const decoder = new TextDecoder('utf-8');
	return decoder.decode(bytes);
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
async function parseSubConfig(configUrl) {
	try {
		const response = await fetch(configUrl);
		if (!response.ok) return [];
		const text = await response.text();
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
	let providerIndex = 0;

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
			let providerName = ruleset.url.split('/').pop().replace(/\.list$|\.yaml$|\.txt$/i, '').toLowerCase();
			if (ruleProviders[providerName]) {
				providerName = providerName + '_' + providerIndex;
			}
			providerIndex++;
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
	if (!content.includes('\nrules:')) {
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
	let providerIndex = 0;

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
			let providerName = url.split('/').pop().replace(/\.list$|\.yaml$|\.txt$/i, '').toLowerCase();
			// 确保名称唯一
			if (ruleProviders[providerName]) {
				providerName = providerName + '_' + providerIndex;
			}
			providerIndex++;

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

// 恢复 Clash 配置中被 subconverter 去掉的 emoji 国旗
function restoreEmoji(content, nodeText) {
	const emojiMap = extractEmojiMap(nodeText);
	if (Object.keys(emojiMap).length === 0) return content;

	const lineBreak = content.includes('\r\n') ? '\r\n' : '\n';

	// 按 baseName 长度降序排列，避免短名称部分匹配长名称
	const entries = Object.entries(emojiMap).sort((a, b) => b[0].length - a[0].length);

	for (const [baseName, emoji] of entries) {
		const withEmoji = `${emoji} ${baseName}`;

		// 如果配置中已经有这个 emoji+名称，跳过
		if (content.includes(withEmoji)) continue;
		// 如果 baseName 不在配置中，跳过
		if (!content.includes(baseName)) continue;

		// 替换代理定义中的 name 字段: name: baseName,
		content = content.replaceAll(`name: ${baseName},`, `name: ${withEmoji},`);
		// 替换代理列表引用: - baseName (行尾)
		content = content.replaceAll(`- ${baseName}${lineBreak}`, `- ${withEmoji}${lineBreak}`);

		// 处理编号副本: baseName 2, baseName 3, ...
		for (let i = 2; i <= 50; i++) {
			const numbered = `${baseName} ${i}`;
			const numberedWithEmoji = `${emoji} ${numbered}`;
			if (content.includes(numberedWithEmoji)) continue;
			if (!content.includes(numbered)) break;

			content = content.replaceAll(`name: ${numbered},`, `name: ${numberedWithEmoji},`);
			content = content.replaceAll(`- ${numbered}${lineBreak}`, `- ${numberedWithEmoji}${lineBreak}`);
		}
	}

	return content;
}


// 根据代理名称中的 emoji 国旗，重新分配节点到对应的国家代理组
function fixProxyGroups(content) {
	const lineBreak = content.includes('\r\n') ? '\r\n' : '\n';
	const lines = content.split(lineBreak);
	const TOP = /^[a-zA-Z][a-zA-Z0-9_-]*:/;

	// 第1步：只扫顶级 proxies: 段，提取节点名
	const allProxyNames = [];
	let section = '';
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (TOP.test(line)) {
			section = line.split(':')[0].trim();
			continue;
		}
		if (section === 'proxies') {
			const nameMatch = line.match(/name:\s*"?([^",}\r\n]+)"?\s*[,}]/);
			if (nameMatch) allProxyNames.push(nameMatch[1].trim());
		}
	}

	// 第2步：按关键词正则分组（支持旗帜不一致的情况，如组名 🇺🇲 但节点名 🇺🇸）
	const regionPatterns = {
		'HK': /港|🇭🇰|HK|hk|Hong Kong|HongKong|hongkong/,
		'JP': /日本|川日|东京|大阪|泉日|埼玉|沪日|深日|🇯🇵|JP|Japan/,
		'SG': /新加坡|坡|狮城|🇸🇬|SG|Singapore/,
		'US': /美|🇺🇸|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|San Jose|San jose|Portland|Dallas|Oregon|Phoenix|Fremont|Silicon Valley|Los Angeles|Seattle|Chicago|US|United States/,
	};
	const regionGroupPatterns = {
		'HK': /港|🇭🇰|香港/,
		'JP': /日本|🇯🇵/,
		'SG': /新加坡|狮城|🇸🇬/,
		'US': /美国|🇺🇲|🇺🇸/,
	};
	// 节点按地区分类
	const regionToProxies = { HK: [], JP: [], SG: [], US: [] };
	for (const name of allProxyNames) {
		for (const [region, pattern] of Object.entries(regionPatterns)) {
			if (pattern.test(name)) {
				regionToProxies[region].push(name);
				break;
			}
		}
	}
	if (Object.values(regionToProxies).every(arr => arr.length === 0)) return content;

	// 第3步：逐行处理，仅在 proxy-groups 段内、且当前组是国家组时替换其 proxies 列表
	const result = [];
	let topSection = '';
	let currentGroupRegion = null;
	let inGroupProxiesList = false;
	let proxiesIndent = '';
	let addedNewProxies = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		if (TOP.test(line)) {
			topSection = line.split(':')[0].trim();
			currentGroupFlag = null;
			inGroupProxiesList = false;
			addedNewProxies = false;
			result.push(line);
			continue;
		}

		if (topSection !== 'proxy-groups') {
			result.push(line);
			continue;
		}

		// 检测新 group 开始
		if (/^\s+- name:/.test(line) || /^\s+- \{name:/.test(line)) {
			inGroupProxiesList = false;
			addedNewProxies = false;
			currentGroupRegion = null;
			// 用关键词正则判断当前组是哪个地区组
			const nameMatch = line.match(/name:\s*"?([^"\r\n,}]+)/);
			if (nameMatch) {
				const groupName = nameMatch[1].trim();
				for (const [region, pattern] of Object.entries(regionGroupPatterns)) {
					if (pattern.test(groupName) && regionToProxies[region].length > 0) {
						currentGroupRegion = region;
						break;
					}
				}
			}
			result.push(line);
			continue;
		}

		// 检测国家组内有缩进的 proxies: 子段（排除顶级 proxies:）
		if (currentGroupRegion && trimmed === 'proxies:' && line !== 'proxies:' && line !== 'proxies:\r') {
			inGroupProxiesList = true;
			proxiesIndent = line.match(/^(\s*)/)[1];
			result.push(line);
			for (const proxyName of regionToProxies[currentGroupRegion]) {
				result.push(`${proxiesIndent}  - ${proxyName}`);
			}
			addedNewProxies = true;
			continue;
		}

		// 跳过国家组的旧代理列表行
		if (inGroupProxiesList && addedNewProxies) {
			const lineIndent = line.match(/^(\s*)/)[1].length;
			const expectedIndent = proxiesIndent.length + 2;
			if (lineIndent >= expectedIndent && trimmed.startsWith('-')) {
				continue;
			} else {
				inGroupProxiesList = false;
				addedNewProxies = false;
				if (/^\s+- name:/.test(line) || /^\s+- \{name:/.test(line)) {
					currentGroupRegion = null;
					const nameMatch2 = line.match(/name:\s*"?([^"\r\n,}]+)/);
					if (nameMatch2) {
						const groupName2 = nameMatch2[1].trim();
						for (const [region, pattern] of Object.entries(regionGroupPatterns)) {
							if (pattern.test(groupName2) && regionToProxies[region].length > 0) {
								currentGroupRegion = region;
								break;
							}
						}
					}
				}
				result.push(line);
				continue;
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
			const m = line.match(/name:\s*"?([^",}\r\n]+)"?\s*[,}]/);
			if (m) realNames.add(m[1].trim());
		}
	}

	// 第2步：收集 proxy-groups 段所有 group 名
	const groupNames = new Set();
	section = '';
	for (const line of lines) {
		if (TOP.test(line)) { section = line.split(':')[0].trim(); continue; }
		if (section === 'proxy-groups') {
			// 匹配 "  - name: xxx" 或 "  - {name: xxx,"
			const m = line.match(/^\s+- (?:name:|{name:)\s*"?([^",}\r\n]+)"?/);
			if (m) groupNames.add(m[1].trim());
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
				const refName = trimmed.substring(2).trim();
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

	const lines = (rawNodeText || '').split('\n');

	// 构建 server:port → fullName 的映射（处理同名节点）
	const portMap = {};
	// 构建 裸名 → fullName 的映射（处理不同名节点的 fallback）
	const nameMap = {};

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed.startsWith('vless://') && !trimmed.startsWith('trojan://') &&
		    !trimmed.startsWith('vmess://') && !trimmed.startsWith('ss://')) continue;
		const hashIdx = trimmed.lastIndexOf('#');
		if (hashIdx === -1) continue;
		try {
			const fullName = decodeURIComponent(trimmed.slice(hashIdx + 1)).trim();
			const bareName = fullName.replace(/^[\u{1F1E0}-\u{1F1FF}\u{1F300}-\u{1F9FF}\s]+/u, '').trim();
			if (!bareName || fullName === bareName) continue;

			// 提取 server:port
			const atIdx = trimmed.indexOf('@');
			const qIdx = trimmed.indexOf('?');
			if (atIdx > -1) {
				const hostPort = trimmed.slice(atIdx + 1, qIdx > -1 ? qIdx : hashIdx);
				if (!portMap[hostPort]) portMap[hostPort] = fullName;
			}
			// 裸名映射（只存第一个，同名后续会被序号区分）
			if (!nameMap[bareName]) nameMap[bareName] = fullName;
		} catch (_) {}
	}

	// subconverter 给同名节点加序号的规律：第一个保持原名，后续加 " 2"、" 3"...
	// 按 server:port 重建序号映射
	// 统计每个裸名出现几次，建立 "裸名 N" → fullName 的映射
	const bareCount = {};
	const seqMap = {}; // "wanxy 2" → "🇯🇵 wanxy"（带旗帜）

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed.startsWith('vless://') && !trimmed.startsWith('trojan://') &&
		    !trimmed.startsWith('vmess://') && !trimmed.startsWith('ss://')) continue;
		const hashIdx = trimmed.lastIndexOf('#');
		if (hashIdx === -1) continue;
		try {
			const fullName = decodeURIComponent(trimmed.slice(hashIdx + 1)).trim();
			const bareName = fullName.replace(/^[\u{1F1E0}-\u{1F1FF}\u{1F300}-\u{1F9FF}\s]+/u, '').trim();
			if (!bareName || fullName === bareName) continue;

			bareCount[bareName] = (bareCount[bareName] || 0) + 1;
			const seq = bareCount[bareName];
			const seqKey = seq === 1 ? bareName : `${bareName} ${seq}`;
			seqMap[seqKey] = fullName;
		} catch (_) {}
	}

	// 替换 outbounds 里的节点名
	let restored = 0;
	config.outbounds = config.outbounds.map(ob => {
		if (!ob.tag) return ob;
		const key = `${ob.server}:${ob.server_port}`;

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
	let nodes, template;
	try {
		nodes = JSON.parse(nodesJson);
		template = JSON.parse(templateJson);
	} catch (e) {
		console.log('[singboxInjectNodes] JSON 解析失败: ' + e.message);
		return nodesJson;
	}

	// 从节点列表里提取真实代理节点（排除 selector/urltest/direct/block/dns 等功能性 outbound）
	const proxyTypes = new Set(['vless', 'vmess', 'trojan', 'shadowsocks', 'ss', 'hysteria', 'hysteria2', 'tuic', 'wireguard']);
	const proxyNodes = (nodes.outbounds || []).filter(ob => proxyTypes.has(ob.type));

	if (proxyNodes.length === 0) {
		console.log('[singboxInjectNodes] 没有找到代理节点');
		return nodesJson;
	}

	// 国家/地区关键词映射
	const regionPatterns = {
		'🇭🇰': /港|🇭🇰|HK|hk|Hong Kong|HongKong|hongkong/,
		'🇯🇵': /日本|川日|东京|大阪|泉日|埼玉|沪日|深日|🇯🇵|JP|Japan/,
		'🇸🇬': /新加坡|坡|狮城|🇸🇬|SG|Singapore/,
		'🇺🇲': /美|🇺🇸|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|San Jose|San jose|Portland|Dallas|Oregon|Phoenix|Fremont|Silicon Valley|Los Angeles|Seattle|Chicago|US|United States/,
	};

	// 按地区分类节点
	const regionNodes = {};
	for (const flag of Object.keys(regionPatterns)) regionNodes[flag] = [];
	const allNodeTags = proxyNodes.map(n => n.tag);

	for (const node of proxyNodes) {
		for (const [flag, pattern] of Object.entries(regionPatterns)) {
			if (pattern.test(node.tag)) {
				regionNodes[flag].push(node.tag);
				break;
			}
		}
	}

	// 把节点加入模板的 outbounds
	// 先把代理节点插入模板（放在 DIRECT 之前）
	const directIdx = template.outbounds.findIndex(ob => ob.type === 'direct');
	if (directIdx > -1) {
		template.outbounds.splice(directIdx, 0, ...proxyNodes);
	} else {
		template.outbounds.push(...proxyNodes);
	}

	// 遍历模板 outbounds，按 tag 名称注入节点列表
	for (const ob of template.outbounds) {
		if (!Array.isArray(ob.outbounds)) continue;

		// 全部节点的分组（自动选择、负载均衡）
		if (ob.type === 'urltest' && ob.tag === '♻️ 自动选择') {
			ob.outbounds = allNodeTags;
			continue;
		}
		if (ob.type === 'urltest' && ob.tag === '⚖️ 负载均衡') {
			ob.outbounds = allNodeTags;
			continue;
		}

		// 国家分组：有匹配节点则注入，没有则用全部节点兜底（避免空数组报错）
		for (const [flag, pattern] of Object.entries(regionPatterns)) {
			if (pattern.test(ob.tag)) {
				ob.outbounds = regionNodes[flag].length > 0 ? regionNodes[flag] : allNodeTags;
				break;
			}
		}

		// 主选择器：把原有的功能性 outbound 保留，在最前面插入地区分组
		if (ob.type === 'selector' && ob.tag === '🚀 节点选择') {
			// 保留原有非节点项（自动选择、负载均衡、地区组、DIRECT 等）
			// 已经在模板里定义好了，不需要改动
		}
	}

	console.log(`[singboxInjectNodes] 注入 ${proxyNodes.length} 个节点到模板`);
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
			const atIdx = trimmed.indexOf('@');
			if (atIdx === -1) continue;
			const hashIdx = trimmed.lastIndexOf('#');
			const urlPart = hashIdx > -1 ? trimmed.slice(0, hashIdx) : trimmed;
			const qIdx = urlPart.indexOf('?');
			if (qIdx === -1) continue;
			const hostPort = urlPart.slice(atIdx + 1, qIdx);
			const params = new URLSearchParams(urlPart.slice(qIdx + 1));
			if (params.get('security') !== 'reality') continue;
			const pbk = params.get('pbk');
			const sid = params.get('sid') || '';
			const sni = params.get('sni') || '';
			const fp = params.get('fp') || 'chrome';
			if (pbk) realityMap[hostPort] = { public_key: pbk, short_id: sid, server_name: sni, fingerprint: fp };
		} catch (_) {}
	}

	// 从原始节点链接构建 xhttp 路径映射：server:port -> {path, host, mode}
	const xhttpMap = {};
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed.startsWith('vless://') && !trimmed.startsWith('trojan://')) continue;
		try {
			const atIdx = trimmed.indexOf('@');
			if (atIdx === -1) continue;
			const hashIdx = trimmed.lastIndexOf('#');
			const urlPart = hashIdx > -1 ? trimmed.slice(0, hashIdx) : trimmed;
			const qIdx = urlPart.indexOf('?');
			if (qIdx === -1) continue;
			const hostPort = urlPart.slice(atIdx + 1, qIdx);
			const params = new URLSearchParams(urlPart.slice(qIdx + 1));
			if (params.get('type') !== 'xhttp') continue;
			xhttpMap[hostPort] = {
				path: params.get('path') || '/',
				host: params.get('host') || params.get('sni') || '',
				mode: params.get('mode') || 'auto',
			};
		} catch (_) {}
	}

	// 修复2：过滤掉 xhttp 误转的 httpupgrade 节点（sing-box 不支持 xhttp）
	config.outbounds = config.outbounds.filter(ob => {
		const key = `${ob.server}:${ob.server_port}`;
		if (ob.transport && ob.transport.type === 'httpupgrade' && xhttpMap[key]) {
			console.log(`[singboxFix] 过滤 xhttp 节点: ${ob.tag}`);
			return false;
		}
		return true;
	});

	config.outbounds = config.outbounds.map(ob => {
		const key = `${ob.server}:${ob.server_port}`;

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

function fixMissingGrpcOpts(content) {
	const lineBreak = content.includes('\r\n') ? '\r\n' : '\n';
	const lines = content.split(lineBreak);
	const result = [];

	for (const line of lines) {
		// 只处理 proxies 段的单行节点（以 "  - {" 开头，含 network: grpc，不含 grpc-opts）
		if (line.trim().startsWith('- {') &&
			line.includes('network: grpc') &&
			!line.includes('grpc-opts')) {
			// 在行尾 } 前插入 grpc-opts
			const fixed = line.replace(/,?\s*\}$/, ', grpc-opts: {grpc-mode: gun, grpc-service-name: ""}}');
			result.push(fixed);
		} else {
			result.push(line);
		}
	}
	return result.join(lineBreak);
}

function clashFix(content) {
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
	content = removeXhttpProxies(content);

	// ===== 修复2：gRPC service-name 为空时被错误写成 "/" 的问题 =====
	// 原始节点 serviceName= 为空，转换后应为 "" 而非 "/"
	content = content.replace(/grpc-service-name:\s*["']?\/["']?(\s*[,}])/g, 'grpc-service-name: ""$1');

	// ===== 修复3：为 network: grpc 但缺少 grpc-opts 的节点补上 grpc-opts =====
	// subconverter 转换 Trojan+gRPC 时有时会丢失 grpc-opts，Mihomo 需要此字段
	content = fixMissingGrpcOpts(content);

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

// 从 proxies 段中移除使用 h2 network 且名称来自 xhttp 转换的节点
// 判断依据：subconverter 将 xhttp 错误映射为 network: h2，同时带有 reality-opts
// 真正的 h2+reality 节点极少见，为安全起见仅移除同时满足以下条件的：
//   1. network: h2（或 network: h2,）
//   2. 带有 reality-opts
//   3. h2-opts 中存在 path 字段（xhttp 有 path，纯 h2 极少带 path+reality 组合）
// 从顶级 proxies: 段中移除 xhttp 误转节点（network: h2 + reality-opts + h2-opts path 同时存在）
// 只处理顶级 proxies: 段，不碰 proxy-groups
function removeXhttpProxies(content) {
	const lineBreak = content.includes('\r\n') ? '\r\n' : '\n';
	const lines = content.split(lineBreak);
	const TOP = /^[a-zA-Z][a-zA-Z0-9_-]*:/;
	const result = [];
	let topSection = '';
	let blockLines = [];

	const flushBlock = () => {
		if (!blockLines.length) return;
		const blockStr = blockLines.join(lineBreak);
		// xhttp 误转为 h2 的节点（Mihomo 不支持 xhttp）
		const isXhttp = /network:\s*h2/.test(blockStr)
			&& /reality-opts/.test(blockStr)
			&& /h2-opts/.test(blockStr)
			&& /path:/.test(blockStr);

		// gRPC + REALITY 节点（Mihomo 有已知 bug，timeout，过滤掉）
		const isGrpcReality = /network:\s*grpc/.test(blockStr)
			&& /reality-opts/.test(blockStr);

		if (!isXhttp && !isGrpcReality) {
			result.push(...blockLines);
		} else {
			const reason = isXhttp ? 'xhttp 误转节点' : 'gRPC+REALITY（Mihomo 不兼容）';
			console.log(`[removeXhttpProxies] 已移除 ${reason}: ${blockStr.match(/name:\s*["']?([^"',}\r\n]+)/)?.[1] || ''}`);
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

async function getSUB(api, request, 追加UA, userAgentHeader) {
	if (!api || api.length === 0) {
		return [];
	} else api = [...new Set(api)]; // 去重
	let newapi = "";
	let 订阅转换URLs = "";
	let 异常订阅 = "";
	const controller = new AbortController(); // 创建一个AbortController实例，用于取消请求
	const timeout = setTimeout(() => {
		controller.abort(); // 2秒后取消所有请求
	}, 2000);

	try {
		// 使用Promise.allSettled等待所有API请求完成，无论成功或失败
		const responses = await Promise.allSettled(api.map(apiUrl => getUrl(request, apiUrl, 追加UA, userAgentHeader).then(response => response.ok ? response.text() : Promise.reject(response))));

		// 遍历所有响应
		const modifiedResponses = responses.map((response, index) => {
			// 检查是否请求成功
			if (response.status === 'rejected') {
				const reason = response.reason;
				if (reason && reason.name === 'AbortError') {
					return {
						status: '超时',
						value: null,
						apiUrl: api[index] // 将原始的apiUrl添加到返回对象中
					};
				}
				console.error(`请求失败: ${api[index]}, 错误信息: ${reason.status} ${reason.statusText}`);
				return {
					status: '请求失败',
					value: null,
					apiUrl: api[index] // 将原始的apiUrl添加到返回对象中
				};
			}
			return {
				status: response.status,
				value: response.value,
				apiUrl: api[index] // 将原始的apiUrl添加到返回对象中
			};
		});

		console.log(modifiedResponses); // 输出修改后的响应数组

		for (const response of modifiedResponses) {
			// 检查响应状态是否为'fulfilled'
			if (response.status === 'fulfilled') {
				const content = await response.value || 'null'; // 获取响应的内容
				if (content.includes('proxies:')) {
					//console.log('Clash订阅: ' + response.apiUrl);
					订阅转换URLs += "|" + response.apiUrl; // Clash 配置
				} else if (content.includes('outbounds"') && content.includes('inbounds"')) {
					//console.log('Singbox订阅: ' + response.apiUrl);
					订阅转换URLs += "|" + response.apiUrl; // Singbox 配置
				} else if (content.includes('://')) {
					//console.log('明文订阅: ' + response.apiUrl);
					newapi += content + '\n'; // 追加内容
				} else if (isValidBase64(content)) {
					//console.log('Base64订阅: ' + response.apiUrl);
					newapi += base64Decode(content) + '\n'; // 解码并追加内容
				} else {
					const 异常订阅LINK = `trojan://CMLiussss@127.0.0.1:8888?security=tls&allowInsecure=1&type=tcp&headerType=none#%E5%BC%82%E5%B8%B8%E8%AE%A2%E9%98%85%20${response.apiUrl.split('://')[1].split('/')[0]}`;
					console.log('异常订阅: ' + 异常订阅LINK);
					异常订阅 += `${异常订阅LINK}\n`;
				}
			}
		}
	} catch (error) {
		console.error(error); // 捕获并输出错误信息
	} finally {
		clearTimeout(timeout); // 清除定时器
	}

	const 订阅内容 = await ADD(newapi + 异常订阅); // 将处理后的内容转换为数组
	// 返回处理后的结果
	return [订阅内容, 订阅转换URLs];
}

async function getUrl(request, targetUrl, 追加UA, userAgentHeader) {
	// 设置自定义 User-Agent
	const newHeaders = new Headers(request.headers);
	newHeaders.set("User-Agent", `${atob('djJyYXlOLzYuNDU=')} cmliu/CF-Workers-SUB ${追加UA}(${userAgentHeader})`);

	// 构建新的请求对象
	const modifiedRequest = new Request(targetUrl, {
		method: request.method,
		headers: newHeaders,
		body: request.method === "GET" ? null : request.body,
		redirect: "follow",
		cf: {
			// 忽略SSL证书验证
			insecureSkipVerify: true,
			// 允许自签名证书
			allowUntrusted: true,
			// 禁用证书验证
			validateCertificate: false
		}
	});

	// 输出请求的详细信息
	console.log(`请求URL: ${targetUrl}`);
	console.log(`请求头: ${JSON.stringify([...newHeaders])}`);
	console.log(`请求方法: ${request.method}`);
	console.log(`请求体: ${request.method === "GET" ? null : request.body}`);

	// 发送请求并返回响应
	return fetch(modifiedRequest);
}

function isValidBase64(str) {
	// 先移除所有空白字符(空格、换行、回车等)
	const cleanStr = str.replace(/\s/g, '');
	const base64Regex = /^[A-Za-z0-9+/=]+$/;
	return base64Regex.test(cleanStr);
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

async function KV(request, env, txt = 'ADD.txt', guest) {
	const url = new URL(request.url);
	try {
		// POST请求处理
		if (request.method === "POST") {
			if (!env.KV) return new Response("未绑定KV空间", { status: 400 });
			try {
				const content = await request.text();
				await env.KV.put(txt, content);
				return new Response("保存成功");
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

		const html = `
			<!DOCTYPE html>
			<html>
				<head>
					<title>${FileName} 订阅编辑</title>
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
					<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/${mytoken}?sub','qrcode_0')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/${mytoken}</a><br>
					<div id="qrcode_0" style="margin: 10px 10px 10px 10px;"></div>
					Base64订阅地址:<br>
					<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/${mytoken}?b64','qrcode_1')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/${mytoken}?b64</a><br>
					<div id="qrcode_1" style="margin: 10px 10px 10px 10px;"></div>
					clash订阅地址:<br>
					<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/${mytoken}?clash','qrcode_2')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/${mytoken}?clash</a><br>
					<div id="qrcode_2" style="margin: 10px 10px 10px 10px;"></div>
					singbox订阅地址:<br>
					<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/${mytoken}?sb','qrcode_3')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/${mytoken}?sb</a><br>
					<div id="qrcode_3" style="margin: 10px 10px 10px 10px;"></div>
					${sbConfig ? `singbox订阅地址（含模板）:<br>
					<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/${mytoken}?sb&sbconfig=${encodeURIComponent(sbConfig)}','qrcode_3t')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/${mytoken}?sb&sbconfig=${encodeURIComponent(sbConfig)}</a><br>
					<div id="qrcode_3t" style="margin: 10px 10px 10px 10px;"></div>` : ''}
					surge订阅地址:<br>
					<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/${mytoken}?surge','qrcode_4')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/${mytoken}?surge</a><br>
					<div id="qrcode_4" style="margin: 10px 10px 10px 10px;"></div>
					loon订阅地址:<br>
					<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/${mytoken}?loon','qrcode_5')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/${mytoken}?loon</a><br>
					<div id="qrcode_5" style="margin: 10px 10px 10px 10px;"></div>
					&nbsp;&nbsp;<strong><a href="javascript:void(0);" id="noticeToggle" onclick="toggleNotice()">查看访客订阅∨</a></strong><br>
					<div id="noticeContent" class="notice-content" style="display: none;">
						---------------------------------------------------------------<br>
						访客订阅只能使用订阅功能，无法查看配置页！<br>
						GUEST（访客订阅TOKEN）: <strong>${guest}</strong><br>
						---------------------------------------------------------------<br>
						自适应订阅地址:<br>
						<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/sub?token=${guest}','guest_0')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/sub?token=${guest}</a><br>
						<div id="guest_0" style="margin: 10px 10px 10px 10px;"></div>
						Base64订阅地址:<br>
						<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/sub?token=${guest}&b64','guest_1')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/sub?token=${guest}&b64</a><br>
						<div id="guest_1" style="margin: 10px 10px 10px 10px;"></div>
						clash订阅地址:<br>
						<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/sub?token=${guest}&clash','guest_2')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/sub?token=${guest}&clash</a><br>
						<div id="guest_2" style="margin: 10px 10px 10px 10px;"></div>
						singbox订阅地址:<br>
						<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/sub?token=${guest}&sb','guest_3')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/sub?token=${guest}&sb</a><br>
						<div id="guest_3" style="margin: 10px 10px 10px 10px;"></div>
						surge订阅地址:<br>
						<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/sub?token=${guest}&surge','guest_4')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/sub?token=${guest}&surge</a><br>
						<div id="guest_4" style="margin: 10px 10px 10px 10px;"></div>
						loon订阅地址:<br>
						<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/sub?token=${guest}&loon','guest_5')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/sub?token=${guest}&loon</a><br>
						<div id="guest_5" style="margin: 10px 10px 10px 10px;"></div>
					</div>
					---------------------------------------------------------------<br>
					################################################################<br>
					订阅转换配置<br>
					---------------------------------------------------------------<br>
					SUBAPI（订阅转换后端）: <strong>${subProtocol}://${subConverter}</strong><br>
					SUBCONFIG（订阅转换配置文件）: <strong>${subConfig}</strong><br>
					SBCONFIG（sing-box JSON模板）: <strong>${sbConfig || '未设置'}</strong><br>
					---------------------------------------------------------------<br>
					################################################################<br>
					${FileName} 汇聚订阅编辑: 
					<div class="editor-container">
						${hasKV ? `
						<textarea class="editor" 
							placeholder="${decodeURIComponent(atob('TElOSyVFNyVBNCVCQSVFNCVCRSU4QiVFRiVCQyU4OCVFNCVCOCU4MCVFOCVBMSU4QyVFNCVCOCU4MCVFNCVCOCVBQSVFOCU4QSU4MiVFNyU4MiVCOSVFOSU5MyVCRSVFNiU4RSVBNSVFNSU4RCVCMyVFNSU4RiVBRiVFRiVCQyU4OSVFRiVCQyU5QQp2bGVzcyUzQSUyRiUyRjI0NmFhNzk1LTA2MzctNGY0Yy04ZjY0LTJjOGZiMjRjMWJhZCU0MDEyNy4wLjAuMSUzQTEyMzQlM0ZlbmNyeXB0aW9uJTNEbm9uZSUyNnNlY3VyaXR5JTNEdGxzJTI2c25pJTNEVEcuQ01MaXVzc3NzLmxvc2V5b3VyaXAuY29tJTI2YWxsb3dJbnNlY3VyZSUzRDElMjZ0eXBlJTNEd3MlMjZob3N0JTNEVEcuQ01MaXVzc3NzLmxvc2V5b3VyaXAuY29tJTI2cGF0aCUzRCUyNTJGJTI1M0ZlZCUyNTNEMjU2MCUyM0NGbmF0CnRyb2phbiUzQSUyRiUyRmFhNmRkZDJmLWQxY2YtNGE1Mi1iYTFiLTI2NDBjNDFhNzg1NiU0MDIxOC4xOTAuMjMwLjIwNyUzQTQxMjg4JTNGc2VjdXJpdHklM0R0bHMlMjZzbmklM0RoazEyLmJpbGliaWxpLmNvbSUyNmFsbG93SW5zZWN1cmUlM0QxJTI2dHlwZSUzRHRjcCUyNmhlYWRlclR5cGUlM0Rub25lJTIzSEsKc3MlM0ElMkYlMkZZMmhoWTJoaE1qQXRhV1YwWmkxd2IyeDVNVE13TlRveVJYUlFjVzQyU0ZscVZVNWpTRzlvVEdaVmNFWlJkMjVtYWtORFVUVnRhREZ0U21SRlRVTkNkV04xVjFvNVVERjFaR3RTUzBodVZuaDFielUxYXpGTFdIb3lSbTgyYW5KbmRERTRWelkyYjNCMGVURmxOR0p0TVdwNlprTm1RbUklMjUzRCU0MDg0LjE5LjMxLjYzJTNBNTA4NDElMjNERQoKCiVFOCVBRSVBMiVFOSU5OCU4NSVFOSU5MyVCRSVFNiU4RSVBNSVFNyVBNCVCQSVFNCVCRSU4QiVFRiVCQyU4OCVFNCVCOCU4MCVFOCVBMSU4QyVFNCVCOCU4MCVFNiU5RCVBMSVFOCVBRSVBMiVFOSU5OCU4NSVFOSU5MyVCRSVFNiU4RSVBNSVFNSU4RCVCMyVFNSU4RiVBRiVFRiVCQyU4OSVFRiVCQyU5QQpodHRwcyUzQSUyRiUyRnN1Yi54Zi5mcmVlLmhyJTJGYXV0bw=='))}"
							id="content">${content}</textarea>
						<div class="save-container">
							<button class="save-btn" onclick="saveContent(this)">保存</button>
							<span class="save-status" id="saveStatus"></span>
						</div>
						` : '<p>请绑定 <strong>变量名称</strong> 为 <strong>KV</strong> 的KV命名空间</p>'}
					</div>
					<br>
					################################################################<br>
					${decodeURIComponent(atob('dGVsZWdyYW0lMjAlRTQlQkElQTQlRTYlQjUlODElRTclQkUlQTQlMjAlRTYlOEElODAlRTYlOUMlQUYlRTUlQTQlQTclRTQlQkQlQUMlN0UlRTUlOUMlQTglRTclQkElQkYlRTUlOEYlOTElRTclODklOEMhJTNDYnIlM0UKJTNDYSUyMGhyZWYlM0QlMjdodHRwcyUzQSUyRiUyRnQubWUlMkZDTUxpdXNzc3MlMjclM0VodHRwcyUzQSUyRiUyRnQubWUlMkZDTUxpdXNzc3MlM0MlMkZhJTNFJTNDYnIlM0UKLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tJTNDYnIlM0UKZ2l0aHViJTIwJUU5JUExJUI5JUU3JTlCJUFFJUU1JTlDJUIwJUU1JTlEJTgwJTIwU3RhciFTdGFyIVN0YXIhISElM0NiciUzRQolM0NhJTIwaHJlZiUzRCUyN2h0dHBzJTNBJTJGJTJGZ2l0aHViLmNvbSUyRmNtbGl1JTJGQ0YtV29ya2Vycy1TVUIlMjclM0VodHRwcyUzQSUyRiUyRmdpdGh1Yi5jb20lMkZjbWxpdSUyRkNGLVdvcmtlcnMtU1VCJTNDJTJGYSUzRSUzQ2JyJTNFCi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSUzQ2JyJTNFCiUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMw=='))}
					<br><br>UA: <strong>${request.headers.get('User-Agent')}</strong>
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
						const textarea = document.getElementById('content');
						const originalContent = textarea.value;
		
						function goBack() {
							const currentUrl = window.location.href;
							const parentUrl = currentUrl.substring(0, currentUrl.lastIndexOf('/'));
							window.location.href = parentUrl;
						}
		
						function replaceFullwidthColon() {
							const text = textarea.value;
							textarea.value = text.replace(/：/g, ':');
						}
						
						function saveContent(button) {
							try {
								const updateButtonText = (step) => {
									button.textContent = \`保存中: \${step}\`;
								};
								// 检测是否为iOS设备
								const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
								
								// 仅在非iOS设备上执行replaceFullwidthColon
								if (!isIOS) {
									replaceFullwidthColon();
								}
								updateButtonText('开始保存');
								button.disabled = true;

								// 获取textarea内容和原始内容
								const textarea = document.getElementById('content');
								if (!textarea) {
									throw new Error('找不到文本编辑区域');
								}

								updateButtonText('获取内容');
								let newContent;
								let originalContent;
								try {
									newContent = textarea.value || '';
									originalContent = textarea.defaultValue || '';
								} catch (e) {
									console.error('获取内容错误:', e);
									throw new Error('无法获取编辑内容');
								}

								updateButtonText('准备状态更新函数');
								const updateStatus = (message, isError = false) => {
									const statusElem = document.getElementById('saveStatus');
									if (statusElem) {
										statusElem.textContent = message;
										statusElem.style.color = isError ? 'red' : '#666';
									}
								};

								updateButtonText('准备按钮重置函数');
								const resetButton = () => {
									button.textContent = '保存';
									button.disabled = false;
								};

								if (newContent !== originalContent) {
									updateButtonText('发送保存请求');
									fetch(window.location.href, {
										method: 'POST',
										body: newContent,
										headers: {
											'Content-Type': 'text/plain;charset=UTF-8'
										},
										cache: 'no-cache'
									})
									.then(response => {
										updateButtonText('检查响应状态');
										if (!response.ok) {
											throw new Error(\`HTTP error! status: \${response.status}\`);
										}
										updateButtonText('更新保存状态');
										const now = new Date().toLocaleString();
										document.title = \`编辑已保存 \${now}\`;
										updateStatus(\`已保存 \${now}\`);
									})
									.catch(error => {
										updateButtonText('处理错误');
										console.error('Save error:', error);
										updateStatus(\`保存失败: \${error.message}\`, true);
									})
									.finally(() => {
										resetButton();
									});
								} else {
									updateButtonText('检查内容变化');
									updateStatus('内容未变化');
									resetButton();
								}
							} catch (error) {
								console.error('保存过程出错:', error);
								button.textContent = '保存';
								button.disabled = false;
								const statusElem = document.getElementById('saveStatus');
								if (statusElem) {
									statusElem.textContent = \`错误: \${error.message}\`;
									statusElem.style.color = 'red';
								}
							}
						}
		
						textarea.addEventListener('blur', saveContent);
						textarea.addEventListener('input', () => {
							clearTimeout(timer);
							timer = setTimeout(saveContent, 5000);
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
			headers: { "Content-Type": "text/html;charset=utf-8" }
		});
	} catch (error) {
		console.error('处理请求时发生错误:', error);
		return new Response("服务器错误: " + error.message, {
			status: 500,
			headers: { "Content-Type": "text/plain;charset=utf-8" }
		});
	}
}
