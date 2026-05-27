import { SAMPLE_ROLES } from "./sampleRoles";

/** Hardcoded data powering the recruiter-side demo at /demo/recruiter. */

export type DemoCandidate = {
  id: string;
  letter: string;
  name: string;
  email: string;
  createdAt: string;
  score: number | null;
  verdict: string | null;
  status: "completed" | "in_progress";
  endReason: string | null;
  transcript: { role: "user" | "assistant"; content: string }[];
};

const reactRole = SAMPLE_ROLES.find((r) => r.key === "senior-react")!;

export const DEMO_ROLE = {
  slug: "demo-senior-react",
  title: reactRole.title,
  jdText: reactRole.jdText,
  createdAt: "2026-05-22T00:00:00.000Z",
};

const transcript_maya: DemoCandidate["transcript"] = [
  { role: "assistant", content: "Hey Maya — thanks for taking the time. I'm PurpleHire, the AI recruiter for the Senior React Engineer role. Ready when you are." },
  { role: "user", content: "Ready! Hi 👋" },
  { role: "assistant", content: "Great. To kick off — tell me about a React codebase you've owned where you made a meaningful architectural decision. What did you change and why?" },
  { role: "user", content: "At my last role we had a Redux app that had grown into about 40 slices. State was hard to reason about and onboarding new engineers took weeks. I led a migration to Zustand + React Query — broke state into colocated stores per feature, moved all server state to React Query. Bundle dropped ~22%, and new engineers were productive in days." },
  { role: "assistant", content: "Nice. What did you lose by moving away from Redux?" },
  { role: "user", content: "Time-travel debugging was the biggest one. Redux DevTools are unmatched for stepping through complex flows. We replaced ~60% of that with structured logging in dev + a small inspector hook. The other 40% we just… lost. Worth it on net but it wasn't free." },
  { role: "assistant", content: "Switching gears — design systems. What's the right boundary between a component library and a product UI?" },
  { role: "user", content: "If it has business logic, it belongs in the product. If it has any visual opinion, it belongs in the library. The library should be unopinionated about layout but opinionated about every other axis — color, spacing, motion, accessibility." },
  { role: "assistant", content: "Let's talk a hypothetical. A junior on your team keeps shipping CSS that breaks the system. How do you coach without crushing them?" },
  { role: "user", content: "First — assume the system is at fault. Nine times out of ten the rules aren't discoverable enough. I'd pair with them on the next PR, narrate my thought process, then write down what I noticed for the team. Public coaching beats private criticism." },
  { role: "assistant", content: "Last one — tell me about a time you were the loudest voice in the room, and you turned out to be wrong." },
  { role: "user", content: "When we evaluated tRPC vs GraphQL I lobbied hard for tRPC. We adopted it, then realized our mobile clients needed schema introspection we just didn't have. I drove the migration back to GraphQL six months later. I learned to ask 'who's not in this room' before pushing hard." },
  { role: "assistant", content: "Maya — really enjoyed this. Recruiter will follow up shortly with next steps. Have a great rest of your day." },
];

const transcript_daniel: DemoCandidate["transcript"] = [
  { role: "assistant", content: "Hi Daniel — thanks for joining. I'm PurpleHire, the AI recruiter for the Senior React Engineer role. Ready?" },
  { role: "user", content: "Yes, let's go." },
  { role: "assistant", content: "Tell me about the most ambitious React project you've architected." },
  { role: "user", content: "I led the rewrite of an internal admin tool serving 4,000 ops users. We split it into a federated micro-frontend setup — three teams, three deploy cadences, one shell. Build times dropped 80% per team. Most rewarding part was getting the contracts between teams right." },
  { role: "assistant", content: "What's the failure mode you most often see with micro-frontends?" },
  { role: "user", content: "Coupling sneaks back through shared global state or shared CSS. The teams say they're independent but they're really not. We aggressively code-reviewed every PR that touched the shell, and forced versioning at module boundaries." },
  { role: "assistant", content: "Have you been hands-on writing code in the last 6 months?" },
  { role: "user", content: "Less than I'd like — maybe 20%. Most of my time is design reviews and unblocking. I miss it." },
  { role: "assistant", content: "Got it. How would you set up a design system from scratch for a 3-person product team that needs to ship in 6 weeks?" },
  { role: "user", content: "I wouldn't. I'd lift Radix + Tailwind, pick 5 tokens to standardize (color, spacing, font, radius, shadow), and document what's off-limits. Ship the product. Revisit in month 3 once you know what hurts." },
  { role: "assistant", content: "Daniel — thanks for the chat. Recruiter will review and reach out with next steps." },
];

const transcript_priya: DemoCandidate["transcript"] = [
  { role: "assistant", content: "Hi Priya, thanks for joining the interview for the Senior React Engineer role. Ready when you are." },
  { role: "user", content: "Ready!" },
  { role: "assistant", content: "Tell me about your most recent React work." },
  { role: "user", content: "Most of the last 3 years has been React Native — a consumer mobile app for a payments startup. I led the perf workstream, brought cold-start from 4.2s to 1.6s by killing two synchronous DB calls at boot and moving to Hermes." },
  { role: "assistant", content: "Have you done much production web React in that time?" },
  { role: "user", content: "Less recently — our web app is mostly a marketing surface. I built it but it's not heavy logic." },
  { role: "assistant", content: "How would you approach SSR in Next.js for a dashboard with lots of personalized data?" },
  { role: "user", content: "Honestly, I'd have to dig in. I know the App Router exists and is push-towards-RSC, but I haven't shipped it. I'd probably start by reading the streaming docs and prototyping on a small slice." },
  { role: "assistant", content: "Fair. Last one — design systems. Have you owned one?" },
  { role: "user", content: "On RN — yes, full system with theming. On web — I've consumed them, not built them." },
  { role: "assistant", content: "Thanks Priya — appreciate the candor. Recruiter will follow up on next steps." },
];

export const DEMO_CANDIDATES: DemoCandidate[] = [
  {
    id: "maya",
    letter: "M",
    name: "Maya R.",
    email: "maya.r@gmail.com",
    createdAt: "2026-05-24T14:22:00.000Z",
    score: 9.4,
    verdict:
      "Strong React fundamentals and unusually clear thinking about design system boundaries. Recruiter should advance.",
    status: "completed",
    endReason: "completed",
    transcript: transcript_maya,
  },
  {
    id: "daniel",
    letter: "D",
    name: "Daniel K.",
    email: "dan.k@hey.com",
    createdAt: "2026-05-24T11:08:00.000Z",
    score: 9.1,
    verdict:
      "Excellent on architecture and would lead the FE org well. Less hands-on in the last 6 months — worth probing.",
    status: "completed",
    endReason: "completed",
    transcript: transcript_daniel,
  },
  {
    id: "priya",
    letter: "P",
    name: "Priya S.",
    email: "priya@protonmail.com",
    createdAt: "2026-05-23T16:45:00.000Z",
    score: 8.7,
    verdict:
      "Deep on React Native + perf. Weaker on recent web React and Next.js SSR specifics; closeable gap with onboarding.",
    status: "completed",
    endReason: "completed",
    transcript: transcript_priya,
  },
  {
    id: "jordan",
    letter: "J",
    name: "Jordan T.",
    email: "jordan@hooli.io",
    createdAt: "2026-05-23T10:12:00.000Z",
    score: 7.8,
    verdict:
      "Solid mid-level signal; needs senior-level system thinking. Would advance for a tighter loop, not a hire decision.",
    status: "completed",
    endReason: "completed",
    transcript: [
      { role: "assistant", content: "Hi Jordan, thanks for joining. Tell me about a React project you've owned." },
      { role: "user", content: "I led the rebuild of our marketing pages — moved from a static site generator to Next.js so we could do A/B testing client-side." },
      { role: "assistant", content: "What was the trickiest architectural call?" },
      { role: "user", content: "Probably picking server components vs client. We landed on server-first with islands of interactivity. Worked well." },
      { role: "assistant", content: "Have you led design system work?" },
      { role: "user", content: "I've contributed to one but not led the architecture." },
      { role: "assistant", content: "Thanks Jordan — recruiter will follow up." },
    ],
  },
  {
    id: "liam",
    letter: "L",
    name: "Liam O.",
    email: "liam.olson@gmail.com",
    createdAt: "2026-05-23T09:30:00.000Z",
    score: 7.4,
    verdict:
      "Strong product sense and shipping discipline; light on TypeScript depth. Pair-program before a hire decision.",
    status: "completed",
    endReason: "completed",
    transcript: [
      { role: "assistant", content: "Hi Liam — ready to start?" },
      { role: "user", content: "Yes!" },
      { role: "assistant", content: "Tell me about a project you're proud of." },
      { role: "user", content: "I shipped a checkout flow that lifted conversion 14%. Used Stripe Elements, React Hook Form, light state management." },
      { role: "assistant", content: "How comfortable are you with TypeScript generics?" },
      { role: "user", content: "Less so — I can read them but writing complex ones is something I'd lean on the team for." },
      { role: "assistant", content: "Thanks Liam, recruiter will be in touch." },
    ],
  },
  {
    id: "aisha",
    letter: "A",
    name: "Aisha M.",
    email: "aisha.m@gmail.com",
    createdAt: "2026-05-22T18:55:00.000Z",
    score: 6.9,
    verdict:
      "Pleasant conversation but answers stayed generic on system design and tradeoffs. Probably not at senior bar for this team.",
    status: "completed",
    endReason: "completed",
    transcript: [
      { role: "assistant", content: "Hi Aisha — ready to start?" },
      { role: "user", content: "Ready." },
      { role: "assistant", content: "Tell me about a meaningful architectural decision you've made." },
      { role: "user", content: "I think every project has tradeoffs and you have to balance them based on the team." },
      { role: "assistant", content: "Could you walk me through one specific decision?" },
      { role: "user", content: "Sure — we picked React over Vue because the team was more familiar with it." },
      { role: "assistant", content: "Got it. Thanks Aisha — recruiter will review." },
    ],
  },
  {
    id: "rafa",
    letter: "R",
    name: "Rafa C.",
    email: "rafa.c@gmail.com",
    createdAt: "2026-05-22T15:20:00.000Z",
    score: 5.5,
    verdict:
      "Not yet at the senior bar — strong fundamentals on JavaScript but no real production React. Not a fit for this role.",
    status: "completed",
    endReason: "missing_must_have",
    transcript: [
      { role: "assistant", content: "Hi Rafa — tell me about your React experience." },
      { role: "user", content: "I've been building side projects in React for about a year. Tutorials, small apps." },
      { role: "assistant", content: "Have you shipped React to production?" },
      { role: "user", content: "Not yet — my day job is mostly backend." },
      { role: "assistant", content: "Got it. This role is asking for 6+ years of production React, so it might not be a fit on that axis. Want me to share more about what they're looking for, or wrap up here?" },
      { role: "user", content: "Let's wrap up — appreciate the honesty." },
      { role: "assistant", content: "Thanks Rafa — best of luck on the search." },
    ],
  },
  {
    id: "sami",
    letter: "S",
    name: "Sami D.",
    email: "sami@dev.local",
    createdAt: "2026-05-25T08:14:00.000Z",
    score: null,
    verdict: null,
    status: "in_progress",
    endReason: null,
    transcript: [
      { role: "assistant", content: "Hi Sami — ready to start?" },
      { role: "user", content: "Yes, let's go." },
      { role: "assistant", content: "Tell me about a React codebase you've owned." },
      { role: "user", content: "Currently leading the rebuild of an internal CRM at a Series A startup. About 80k lines, 9 engineers contributing." },
      { role: "assistant", content: "What did you change architecturally when you came in?" },
    ],
  },
];

export function getDemoCandidate(id: string): DemoCandidate | undefined {
  return DEMO_CANDIDATES.find((c) => c.id === id);
}
