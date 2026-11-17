import type { IncomingMessage } from 'http';
import type { Request } from 'express';

interface IpGeoCacheEntry {
  location: string;
  updatedAt: number;
}

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const ipGeoCache = new Map<string, IpGeoCacheEntry>();
const inFlightRequests = new Map<string, Promise<string>>();

/**
 * Normalize an IP address string (strip ::ffff:, port numbers, whitespace, etc.)
 */
export function normalizeIp(raw?: string | string[] | null): string {
  if (!raw) return '';
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (!first || typeof first !== 'string') return '';

  let ip = first.split(',')[0].trim();
  if (!ip) return '';

  if (ip.startsWith('::ffff:')) {
    ip = ip.slice(7);
  }
  if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') {
    return '127.0.0.1';
  }

  // Strip port from bracketed IPv6 e.g. [::1]:8080
  if (ip.startsWith('[') && ip.includes(']:')) {
    ip = ip.slice(1, ip.indexOf(']:'));
  } else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(ip)) {
    // Strip port from IPv4:port
    ip = ip.split(':')[0];
  }

  return ip.trim();
}

/**
 * Check if an IP is loopback, LAN, or link-local
 */
export function isPrivateOrLoopbackIp(ip?: string | null): boolean {
  if (!ip) return true;
  const clean = normalizeIp(ip).toLowerCase();
  if (!clean) return true;

  if (
    clean === '127.0.0.1' ||
    clean === '::1' ||
    clean === 'localhost' ||
    clean === '0.0.0.0' ||
    clean.startsWith('127.') ||
    clean.startsWith('10.') ||
    clean.startsWith('192.168.') ||
    clean.startsWith('169.254.') ||
    clean.startsWith('fc') ||
    clean.startsWith('fd') ||
    clean.startsWith('fe80:')
  ) {
    return true;
  }

  // 172.16.0.0 - 172.31.255.255
  if (clean.startsWith('172.')) {
    const parts = clean.split('.');
    const second = parseInt(parts[1], 10);
    if (second >= 16 && second <= 31) {
      return true;
    }
  }

  return false;
}

/**
 * Extract client IP from Express Request or HTTP Upgrade IncomingMessage
 */
export function extractClientIp(req: IncomingMessage | Request): string {
  const headers = req.headers || {};

  const candidates: string[] = [];

  const headerKeys = [
    'cf-connecting-ip',
    'true-client-ip',
    'x-real-ip',
    'x-client-ip',
    'x-forwarded-for',
  ];

  for (const key of headerKeys) {
    const val = headers[key];
    if (!val) continue;
    const rawStr = Array.isArray(val) ? val.join(',') : val;
    const parts = rawStr.split(',').map((s) => normalizeIp(s)).filter(Boolean);
    candidates.push(...parts);
  }

  if (req.socket?.remoteAddress) {
    const sockIp = normalizeIp(req.socket.remoteAddress);
    if (sockIp) candidates.push(sockIp);
  }

  // Prefer the first public IP in the chain
  const publicIp = candidates.find((ip) => !isPrivateOrLoopbackIp(ip));
  if (publicIp) return publicIp;

  return candidates[0] || '127.0.0.1';
}

function formatIsp(rawIsp?: string): string {
  if (!rawIsp) return '';
  const lower = rawIsp.toLowerCase();
  if (lower.includes('telecom') || lower.includes('chinanet') || rawIsp.includes('电信')) return '电信';
  if (lower.includes('unicom') || rawIsp.includes('联通')) return '联通';
  if (lower.includes('mobile') || rawIsp.includes('移动')) return '移动';
  if (lower.includes('铁通')) return '铁通';
  if (lower.includes('广电') || lower.includes('cbn')) return '广电';
  if (lower.includes('教育网') || lower.includes('cernet')) return '教育网';
  if (lower.includes('google')) return 'Google Cloud';
  if (lower.includes('cloudflare')) return 'Cloudflare';
  if (lower.includes('amazon') || lower.includes('aws')) return 'AWS';
  if (lower.includes('alibaba') || lower.includes('aliyun') || rawIsp.includes('阿里云')) return '阿里云';
  if (lower.includes('tencent') || rawIsp.includes('腾讯云')) return '腾讯云';
  return rawIsp.length <= 16 ? rawIsp : '';
}

function deduplicateRegionCity(region: string, city: string): string {
  const r = (region || '').trim();
  const c = (city || '').trim();
  if (!r && !c) return '';
  if (!r) return c;
  if (!c || r === c || r.startsWith(c) || c.startsWith(r.replace(/省|市|自治区|特别行政区/g, ''))) {
    return c.length >= r.length ? c : r;
  }
  return `${r}${c}`;
}

async function fetchWithTimeout(url: string, timeoutMs = 2500): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Get cached IP location synchronously if already resolved
 */
export function getCachedIpLocation(ip?: string, fallbackLocation?: string): string {
  const cleanIp = normalizeIp(ip);
  if (!cleanIp) return fallbackLocation || '未知归属地';

  const cached = ipGeoCache.get(cleanIp);
  if (cached && Date.now() - cached.updatedAt < CACHE_TTL_MS) {
    return cached.location;
  }

  if (isPrivateOrLoopbackIp(cleanIp)) {
    if (fallbackLocation) return fallbackLocation;
    return cleanIp === '127.0.0.1' ? '本机环回地址' : '局域网 / 内网';
  }

  return fallbackLocation || '解析中...';
}

/**
 * Resolve IP geolocation with multi-provider fallback and in-memory caching
 */
export async function resolveIpLocation(ip?: string, fallbackLocation?: string): Promise<string> {
  const cleanIp = normalizeIp(ip);
  if (!cleanIp) return fallbackLocation || '未知归属地';

  if (isPrivateOrLoopbackIp(cleanIp)) {
    if (fallbackLocation && fallbackLocation !== '解析中...') {
      return fallbackLocation;
    }
    return cleanIp === '127.0.0.1' ? '本机环回地址' : '局域网 / 内网';
  }

  const cached = ipGeoCache.get(cleanIp);
  if (cached && Date.now() - cached.updatedAt < CACHE_TTL_MS) {
    return cached.location;
  }

  const existingPromise = inFlightRequests.get(cleanIp);
  if (existingPromise) {
    return existingPromise;
  }

  const lookupPromise = (async (): Promise<string> => {
    // 1. Try PCOnline (Best accuracy for domestic Chinese province/city/ISP)
    try {
      const res = await fetchWithTimeout(
        `https://whois.pconline.com.cn/ipJson.jsp?ip=${encodeURIComponent(cleanIp)}&json=true`,
        2200
      );
      if (res.ok) {
        const buf = await res.arrayBuffer();
        const text = new TextDecoder('gbk').decode(buf);
        const data = JSON.parse(text);
        if (data && data.pro && !data.err) {
          const addr = String(data.addr || '').trim().replace(/\s+/g, ' · ');
          const loc = addr || deduplicateRegionCity(data.pro, data.city);
          if (loc) {
            ipGeoCache.set(cleanIp, { location: loc, updatedAt: Date.now() });
            return loc;
          }
        }
      }
    } catch {
      // Fallback to next provider
    }

    // 2. Try ip-api.com (Great for both domestic and international IPs in Chinese)
    try {
      const res = await fetchWithTimeout(
        `http://ip-api.com/json/${encodeURIComponent(cleanIp)}?lang=zh-CN&fields=status,country,regionName,city,isp`,
        2500
      );
      if (res.ok) {
        const data: any = await res.json();
        if (data && data.status === 'success') {
          const country = (data.country || '').trim();
          const regionCity = deduplicateRegionCity(data.regionName || '', data.city || '');
          const isp = formatIsp(data.isp);
          let loc = '';
          if (country === '中国') {
            loc = regionCity || country;
          } else {
            loc = [country, regionCity].filter(Boolean).join(' ');
          }
          if (isp) {
            loc = loc ? `${loc} · ${isp}` : isp;
          }
          if (loc) {
            ipGeoCache.set(cleanIp, { location: loc, updatedAt: Date.now() });
            return loc;
          }
        }
      }
    } catch {
      // Fallback to next provider
    }

    // 3. Try ipwho.is (HTTPS international & domestic fallback)
    try {
      const res = await fetchWithTimeout(
        `https://ipwho.is/${encodeURIComponent(cleanIp)}?lang=zh-CN`,
        2500
      );
      if (res.ok) {
        const data: any = await res.json();
        if (data && data.success) {
          const country = (data.country || '').trim();
          const regionCity = deduplicateRegionCity(data.region || '', data.city || '');
          const isp = formatIsp(data.connection?.isp || data.connection?.org);
          let loc = '';
          if (country === '中国') {
            loc = regionCity || country;
          } else {
            loc = [country, regionCity].filter(Boolean).join(' ');
          }
          if (isp) {
            loc = loc ? `${loc} · ${isp}` : isp;
          }
          if (loc) {
            ipGeoCache.set(cleanIp, { location: loc, updatedAt: Date.now() });
            return loc;
          }
        }
      }
    } catch {
      // Ignore
    }

    if (fallbackLocation && fallbackLocation !== '解析中...') {
      ipGeoCache.set(cleanIp, { location: fallbackLocation, updatedAt: Date.now() });
      return fallbackLocation;
    }

    return '未知归属地';
  })();

  inFlightRequests.set(cleanIp, lookupPromise);
  try {
    return await lookupPromise;
  } finally {
    inFlightRequests.delete(cleanIp);
  }
}
