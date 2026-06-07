import Stripe from "stripe";

/**
 * Server-only Stripe SDK instance. Do NOT import this from any page
 * component, only from `/pages/api/**` route handlers or other
 * server-only code paths. Importing it from a page module pulls the
 * Stripe SDK into the client bundle and the constructor will throw
 * "Neither apiKey nor config.authenticator provided" because
 * STRIPE_SECRET_KEY is not exposed to the browser.
 *
 * For shared plan constants and helpers, import from `./plan` instead.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2026-05-27.dahlia",
  typescript: true,
});

export const STRIPE_PRICE_ID_PRO = process.env.STRIPE_PRICE_ID_PRO ?? "";
