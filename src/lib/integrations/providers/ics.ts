import "server-only";
import { lookup } from "node:dns";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import type { CalendarProvider, Creds } from "../types";
import { ApiError } from "../types";
import { parseIcs } from "./ics-parse";

// Apple Calendar, and any app that shares a calendar as an iCal (.ics) link. The link is the
// credential: iCloud's public calendar links carry their own secret.

const MAX_BYTES = 5_000_000;

// Addresses a fetch from the server must never reach: loopback, private networks, link-local
// (cloud metadata), and the rest of the reserved ranges.
const blocked = new BlockList();
for (const [net, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3],
] as const)
  blocked.addSubnet(net, bits, "ipv4");
// IPv4-mapped IPv6 (::ffff:a.b.c.d) is checked against the IPv4 rules above; a ::ffff:0:0/96
// rule here would match every IPv4 address
for (const [net, bits] of [
  ["::", 127],
  ["64:ff9b::", 96],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const)
  blocked.addSubnet(net, bits, "ipv6");

const isBlocked = (address: string) => {
  const family = isIP(address);
  return family === 0 || blocked.check(address, family === 6 ? "ipv6" : "ipv4");
};

/** DNS lookup that refuses private addresses, so the check covers the address actually used. */
const safeLookup: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "");
    if (!addresses.length || addresses.some((a) => isBlocked(a.address))) {
      return callback(Object.assign(new Error(`${hostname} isn't a public address`), { code: "EBLOCKED" }), "");
    }
    if (options.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  });
};

/** "webcal://…" → "https://…"; null when it isn't a web link. */
export function icsUrl(input: string): URL | null {
  try {
    const url = new URL(input.trim().replace(/^webcals?:\/\//i, "https://"));
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

function get(url: URL, redirects = 3): Promise<string> {
  if (isIP(url.hostname.replace(/^\[|\]$/g, "")) && isBlocked(url.hostname.replace(/^\[|\]$/g, ""))) {
    return Promise.reject(new ApiError(400, "That link points to a private address"));
  }
  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.get(
      url,
      {
        lookup: safeLookup,
        timeout: 15_000,
        headers: { accept: "text/calendar, */*;q=0.5", "user-agent": "Timeo (+https://timeo.ordinity.com)" },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          const next = icsUrl(new URL(res.headers.location, url).toString());
          if (!next || redirects <= 0) return reject(new ApiError(400, "The link redirects too often"));
          return resolve(get(next, redirects - 1));
        }
        if (status < 200 || status >= 300) {
          res.resume();
          return reject(new ApiError(status, `${url.host} ${status}`));
        }
        let size = 0;
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            req.destroy();
            reject(new ApiError(413, "The calendar is too large"));
          } else chunks.push(chunk);
        });
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(Object.assign(new Error("timeout"), { name: "TimeoutError" })));
    req.on("error", reject);
  });
}

async function load(creds: Creds, timezone: string) {
  const url = icsUrl(String(creds.url ?? ""));
  if (!url) throw new ApiError(400, "Not a calendar link");
  const text = await get(url);
  if (!text.includes("BEGIN:VCALENDAR")) throw new ApiError(422, "That link isn't an iCal calendar");
  return parseIcs(text, timezone);
}

export const appleCalendar: CalendarProvider = {
  id: "apple-calendar",
  kind: "calendar",
  token: {
    fields: [{ name: "url", label: "Calendar link", placeholder: "webcal://p01-caldav.icloud.com/…", type: "url" }],
    help: "In Calendar on iPhone, tap Calendars, tap ⓘ next to a calendar, turn on Public Calendar, then Share Link and copy it.",
    helpUrl: "https://support.apple.com/guide/icloud/share-a-calendar-mm6b1a9479/icloud",
    creds(values) {
      const url = icsUrl(values.url ?? "");
      return url ? { accessToken: "", url: url.toString() } : "Paste a link that starts with webcal:// or https://";
    },
  },

  async account(ctx) {
    const cal = await load(ctx.creds, ctx.timezone);
    return { label: cal.name ?? new URL(String(ctx.creds.url)).hostname, creds: { name: cal.name } };
  },

  async calendars(ctx) {
    return [{ id: "ics", name: String(ctx.creds.name ?? "Calendar"), on: true }];
  },

  async events(ctx, calendarIds, from, to) {
    if (!calendarIds.includes("ics")) return [];
    const cal = await load(ctx.creds, ctx.timezone);
    return cal.events(from, to).map((e) => ({ ...e, calendarId: "ics" }));
  },
};
