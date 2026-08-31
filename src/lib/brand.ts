/**
 * White-label switch. The bakery stack (shop.wholesomebar.in) serves the same
 * app as app.msgbuddy.com from a different build — with identical chrome, a
 * merchant logging into the wrong one can't tell, and concludes their data
 * vanished. Setting NEXT_PUBLIC_BRAND_NAME at build time rebrands the
 * dashboard chrome (sidebar, login, titles); unset, everything stays MsgBuddy.
 */
export const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME || "MsgBuddy";
export const IS_WHITELABEL = Boolean(process.env.NEXT_PUBLIC_BRAND_NAME);
