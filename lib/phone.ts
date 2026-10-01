/** Country calling codes for the countries ChurchX targets first. */
const CALLING_CODES: Record<string, string> = {
  nigeria: "234",
  ng: "234",
  ghana: "233",
  gh: "233",
  kenya: "254",
  ke: "254",
  "south africa": "27",
  za: "27",
  uganda: "256",
  "united kingdom": "44",
  uk: "44",
  gb: "44",
  "united states": "1",
  usa: "1",
  us: "1",
  canada: "1",
};

export function callingCode(country?: string | null) {
  return CALLING_CODES[(country ?? "nigeria").trim().toLowerCase()] ?? "234";
}

/**
 * Normalises a phone number to E.164-like "+<digits>". Local numbers with a
 * leading 0 (e.g. 0803 123 4567) get the church country's calling code.
 * Returns null for empty input and undefined for invalid input.
 */
export function normalizePhone(raw: string | null | undefined, country?: string | null): string | null | undefined {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const hasPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");
  if (hasPlus) {
    // already international
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    digits = callingCode(country) + digits.slice(1);
  } else if (digits.length <= 10) {
    digits = callingCode(country) + digits;
  }
  if (digits.length < 7 || digits.length > 15) return undefined;
  return `+${digits}`;
}

/** wa.me link (opens WhatsApp; does NOT send anything by itself). */
export function whatsappLink(phone: string | null | undefined, text?: string) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function telLink(phone: string | null | undefined) {
  return phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : null;
}

export function smsLink(phone: string | null | undefined) {
  return phone ? `sms:${phone.replace(/[^\d+]/g, "")}` : null;
}
