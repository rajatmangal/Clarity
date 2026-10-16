import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import "dayjs/locale/fr.js";
import "dayjs/locale/de.js";
import "dayjs/locale/es.js";
import "dayjs/locale/it.js";
import "dayjs/locale/pt.js";
import "dayjs/locale/nl.js";
dayjs.extend(customParseFormat);
export const dateModes = [
  ["AUTO", "Automatic · named months, ISO, unambiguous numbers"],
  ["DMY", "Day first · 13/10/2026 or 13/10/26"],
  ["MDY", "Month first · 10/13/2026 or 10/13/26"],
  ["YMD", "Year first · 2026/10/13 or 26/10/13"],
  ["EXCEL", "Excel / Sheets serial · 46308"],
  ["EXCEL1904", "Excel serial · 1904 date system"],
  ["UNIX", "Unix timestamp · seconds (UTC)"],
  ["UNIX_MS", "Unix timestamp · milliseconds (UTC)"],
  ["CUSTOM", "Custom format · Day.js tokens"],
];
export const dateLocales = [
  ["en", "English"],
  ["fr", "French"],
  ["de", "German"],
  ["es", "Spanish"],
  ["it", "Italian"],
  ["pt", "Portuguese"],
  ["nl", "Dutch"],
];
export function validDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T12:00:00Z");
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}
const fold = (s) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\./g, "");
const monthCache = new Map();
const weekdayCache = new Map();
function monthMap(locale) {
  if (monthCache.has(locale)) return monthCache.get(locale);
  const map = new Map();
  for (let m = 0; m < 12; m++)
    for (const style of ["long", "short"]) {
      const text = new Intl.DateTimeFormat(locale, {
        month: style,
        timeZone: "UTC",
      }).format(new Date(Date.UTC(2026, m, 1)));
      map.set(fold(text), m + 1);
    }
  if (locale === "en") map.set("sept", 9);
  monthCache.set(locale, map);
  return map;
}
function calendar(y, m, d) {
  y = String(y);
  if (y.length === 2) y = String(+y <= 68 ? 2000 + +y : 1900 + +y);
  if (!/^\d{4}$/.test(y))
    throw Error("A date needs a four-digit or two-digit year.");
  const result = `${y}-${String(+m).padStart(2, "0")}-${String(+d).padStart(2, "0")}`;
  if (!validDate(result)) throw Error("Not a real calendar date");
  return result;
}
function removeTime(s) {
  const match = s.match(
    /(?:T|\s+)(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,]\d{1,9})?)?\s*(AM|PM)?\s*(Z|[+-]\d{2}:?\d{2}|UTC|GMT)?$/i,
  );
  if (!match) return s;
  const [, h, m, sec, ampm, zone] = match;
  if (+m > 59 || +(sec || 0) > 59 || +h > (ampm ? 12 : 23) || (ampm && +h < 1))
    throw Error("Invalid time in date");
  if (zone && /^[+-]/.test(zone)) {
    const z = zone.replace(":", "");
    if (+z.slice(1, 3) > 23 || +z.slice(3) > 59)
      throw Error("Invalid timezone offset");
  }
  return s.slice(0, match.index).trim();
}
export function parseDate(raw, format = "AUTO", options = {}) {
  const original = String(raw ?? "").trim();
  if (!original) throw Error("Missing date");
  const locale = options.dateLocale || "en";
  try {
    if (format === "CUSTOM") {
      const pattern = options.customDateFormat?.trim();
      if (!pattern || !/(Y{2}|Y{4})/.test(pattern))
        throw Error("Custom format must include YY or YYYY");
      const d = dayjs(original, pattern, locale, true);
      if (!d.isValid()) throw Error(`Does not match ${pattern}`);
      return d.format("YYYY-MM-DD");
    }
    if (["EXCEL", "EXCEL1904"].includes(format)) {
      if (!/^\d+(\.\d+)?$/.test(original))
        throw Error("Expected a spreadsheet date serial");
      const serial = Math.floor(+original);
      if (serial < 1 || serial > 2958465)
        throw Error("Spreadsheet serial is out of range");
      if (format === "EXCEL" && serial === 60)
        throw Error("Excel serial 60 represents the nonexistent 1900-02-29");
      const days =
        format === "EXCEL1904" ? serial : serial - (serial > 60 ? 1 : 0);
      const epoch =
        format === "EXCEL1904" ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 31);
      const result = new Date(epoch + days * 86400000)
        .toISOString()
        .slice(0, 10);
      if (!validDate(result)) throw Error("Spreadsheet date out of range");
      return result;
    }
    if (["UNIX", "UNIX_MS"].includes(format)) {
      if (!/^-?\d+(\.\d+)?$/.test(original))
        throw Error("Expected a numeric Unix timestamp");
      const d = new Date(+original * (format === "UNIX" ? 1000 : 1));
      if (!Number.isFinite(d.getTime())) throw Error("Timestamp out of range");
      const result = d.toISOString().slice(0, 10);
      if (!validDate(result)) throw Error("Timestamp out of range");
      return result;
    }
    let s = removeTime(original.replace(/\u00a0/g, " ").replace(/\s+/g, " "));
    // Weekday labels are decoration; the numeric calendar date remains authoritative.
    let weekdays = weekdayCache.get(locale);
    if (!weekdays) {
      weekdays = new Set();
      for (let i = 0; i < 7; i++)
        for (const style of ["long", "short"])
          weekdays.add(
            fold(
              new Intl.DateTimeFormat(locale, {
                weekday: style,
                timeZone: "UTC",
              }).format(new Date(Date.UTC(2026, 0, 4 + i))),
            ),
          );
      weekdayCache.set(locale, weekdays);
    }
    const lead = s.match(/^([\p{L}.]+)[,\s]+/u);
    if (lead && weekdays.has(fold(lead[1]))) s = s.slice(lead[0].length);
    s = s
      .replace(/(\d)(st|nd|rd|th|er|e|º|ª)\b/gi, "$1")
      .replace(/\bde\b/gi, " ")
      .replace(/,/g, " ")
      .trim();
    if (/^\d{8}$/.test(s)) {
      if (format === "YMD" || (format === "AUTO" && /^(19|20|21)\d{2}/.test(s)))
        return calendar(s.slice(0, 4), s.slice(4, 6), s.slice(6, 8));
      if (format === "DMY")
        return calendar(s.slice(4), s.slice(2, 4), s.slice(0, 2));
      if (format === "MDY")
        return calendar(s.slice(4), s.slice(0, 2), s.slice(2, 4));
      throw Error("Choose a date order for compact numeric dates");
    }
    if (/^\d{6}$/.test(s) && format !== "AUTO") {
      if (format === "YMD")
        return calendar(s.slice(0, 2), s.slice(2, 4), s.slice(4));
      if (format === "DMY")
        return calendar(s.slice(4), s.slice(2, 4), s.slice(0, 2));
      if (format === "MDY")
        return calendar(s.slice(4), s.slice(0, 2), s.slice(2, 4));
    }
    s = s
      .replace(/(\d)([\p{L}])/gu, "$1 $2")
      .replace(/([\p{L}])(\d)/gu, "$1 $2");
    const parts = s.split(/[\s/._-]+/).filter(Boolean);
    const months = monthMap(locale);
    const monthIndex = parts.findIndex((p) => months.has(fold(p)));
    if (monthIndex >= 0) {
      const m = months.get(fold(parts[monthIndex]));
      if (parts.length === 2) {
        if (!/^\d{4}$/.test(String(options.statementYear || "")))
          throw Error("This date has no year. Enter the statement year.");
        return calendar(
          options.statementYear,
          m,
          parts[monthIndex === 0 ? 1 : 0],
        );
      }
      if (parts.length !== 3)
        throw Error("Expected a day, month name and year");
      if (monthIndex === 0) return calendar(parts[2], m, parts[1]);
      if (monthIndex === 1) {
        if (parts[0].length === 4) return calendar(parts[0], m, parts[2]);
        return calendar(parts[2], m, parts[0]);
      }
      if (monthIndex === 2 && parts[0].length === 4)
        return calendar(parts[0], m, parts[1]);
      throw Error("Unsupported month-name order");
    }
    if (parts.some((p) => !/^\d+$/.test(p)))
      throw Error(
        "Unrecognized month or date format. Check the language or use a custom format.",
      );
    if (parts.length === 2) {
      if (!/^\d{4}$/.test(String(options.statementYear || "")))
        throw Error("This date has no year. Enter the statement year.");
      parts.push(String(options.statementYear));
    }
    if (parts.length !== 3) throw Error("Expected a day, month and year");
    const [a, b, c] = parts;
    if (a.length === 4) return calendar(a, b, c);
    if (format === "DMY") return calendar(c, b, a);
    if (format === "MDY") return calendar(c, a, b);
    if (format === "YMD") return calendar(a, b, c);
    if (+a > 12) return calendar(c, b, a);
    if (+b > 12) return calendar(c, a, b);
    if (a === b || +a === +b) return calendar(c, b, a);
    throw Error("Ambiguous date. Choose Day first or Month first.");
  } catch (e) {
    throw Error(`Date "${original}": ${e.message}`);
  }
}

export function inferDateOrder(values) {
  const evidence = new Map();
  for (const raw of values) {
    const value = String(raw || "").trim();
    const m = value.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/);
    if (!m) continue;
    const a = +m[1],
      b = +m[2];
    const order = a > 12 && b <= 12 ? "DMY" : b > 12 && a <= 12 ? "MDY" : null;
    if (!order) continue;
    try {
      parseDate(value, order);
      evidence.set(order, value);
    } catch {}
  }
  if (evidence.size === 1) {
    const [format, example] = [...evidence][0];
    return { format, example };
  }
  return evidence.size > 1 ? { conflict: true } : null;
}
