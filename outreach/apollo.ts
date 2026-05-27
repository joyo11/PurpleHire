/**
 * Apollo.io API client — finds a recruiter's verified work email by name +
 * company. We use the People Match endpoint (1 credit per call).
 * Docs: https://docs.apollo.io/reference/people-match
 */

type ApolloPerson = {
  email?: string | null;
  email_status?: string | null;
  title?: string | null;
  linkedin_url?: string | null;
  organization?: { name?: string };
};

type ApolloResponse = {
  person?: ApolloPerson | null;
};

export type EnrichResult = {
  email: string | null;
  title: string | null;
  linkedinUrl: string | null;
  /** Apollo's confidence as a rough 0–100 number based on email_status. */
  confidence: number;
};

function confidenceFromStatus(status: string | null | undefined): number {
  switch ((status ?? "").toLowerCase()) {
    case "verified":
      return 95;
    case "guessed":
      return 60;
    case "unavailable":
      return 0;
    default:
      return 40;
  }
}

export async function enrichRecruiter(
  name: string,
  company: string,
): Promise<EnrichResult> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    throw new Error(
      "APOLLO_API_KEY not set — add it to outreach/.env before running enrich.",
    );
  }

  const [firstName, ...rest] = name.trim().split(/\s+/);
  const lastName = rest.join(" ");

  const res = await fetch("https://api.apollo.io/api/v1/people/match", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      first_name: firstName,
      last_name: lastName || undefined,
      organization_name: company,
      reveal_personal_emails: false,
      reveal_phone_number: false,
    }),
  });

  if (res.status === 401) {
    throw new Error("Apollo: API key rejected (401).");
  }
  if (res.status === 422) {
    return { email: null, title: null, linkedinUrl: null, confidence: 0 };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Apollo error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as ApolloResponse;
  const p = data.person;
  if (!p) return { email: null, title: null, linkedinUrl: null, confidence: 0 };

  return {
    email: p.email ?? null,
    title: p.title ?? null,
    linkedinUrl: p.linkedin_url ?? null,
    confidence: confidenceFromStatus(p.email_status),
  };
}
