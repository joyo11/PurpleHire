import type { InterviewPlan } from "./jdAnalyzer";

export type SampleRole = {
  key: string;
  title: string;
  blurb: string;
  jdText: string;
  plan: InterviewPlan;
};

export const SAMPLE_ROLES: SampleRole[] = [
  {
    key: "senior-react",
    title: "Senior React Engineer",
    blurb: "Frontend role at a Series B fintech. Owns the design system + dashboard.",
    jdText: `# Senior React Engineer
**Company:** Series B fintech (~$34M raised)
**Location:** Remote (US)

We're hiring a Senior React Engineer to lead the front-end of a fast-growing fintech product.

## What you'll do
- Own our design system and ship customer-facing features end-to-end
- Mentor 2–3 engineers
- Partner with design on the next-generation dashboard

## Must haves
- 6+ years production React
- Strong TypeScript
- Design systems experience
- Comfort in a fast-moving, ambiguous environment

## Nice to haves
- GraphQL or tRPC
- Performance work (Core Web Vitals, RUM)
- Prior fintech or consumer-finance domain`,
    plan: {
      summary:
        "Senior React Engineer who can own a design system and lead the front-end of a fintech product.",
      must_haves: [
        "6+ years of production React",
        "Strong TypeScript",
        "Has shipped a non-trivial design system",
        "Has owned customer-facing features end-to-end",
      ],
      nice_to_haves: [
        "GraphQL or tRPC",
        "Performance / Core Web Vitals work",
        "Fintech or consumer-finance domain",
      ],
      skills_to_probe: [
        "Architectural decisions on a React codebase they've owned",
        "How they think about design system boundaries",
        "State management opinions and tradeoffs",
        "Coaching juniors / handling system violations",
        "Times they were wrong as a loud voice in the room",
      ],
      red_flags: [
        "Only contributed to React, never led",
        "Cannot articulate any tradeoff in past decisions",
        "Dismissive of TypeScript or testing",
      ],
    },
  },
  {
    key: "ml-engineer",
    title: "ML Engineer",
    blurb: "Owns models in production at a recsys/fraud-heavy fintech.",
    jdText: `# Machine Learning Engineer
**Team:** Risk & ranking
**Location:** Hybrid (NYC, 2 days/week)

You'll own ML models in production — from training pipeline to serving and monitoring.

## What you'll do
- Build and maintain models for fraud detection and recommendation
- Design CI/CD for training and rollout (canary, shadow mode)
- Wire up monitoring for drift, latency, and business KPIs

## Must haves
- 4+ years deploying ML to production
- Comfort with MLOps tooling (one of: Kubeflow, Airflow, MLflow, etc.)
- Strong Python and SQL
- Has shipped a model that handles real business decisions

## Nice to haves
- LLM / RAG experience
- Causal inference background
- Prior fintech or marketplace`,
    plan: {
      summary:
        "ML engineer who can own production models end-to-end, not just notebook research.",
      must_haves: [
        "4+ years of production ML deployment",
        "Knows MLOps (CI/CD for models, monitoring)",
        "Strong Python and SQL",
        "Has owned a model used in real business decisions",
      ],
      nice_to_haves: [
        "LLM / RAG experience",
        "Causal inference",
        "Fintech or marketplace domain",
      ],
      skills_to_probe: [
        "A specific production model deployment they led",
        "MLOps: training pipeline, rollout strategy, monitoring",
        "How they collaborate with data scientists and product",
        "Their take on online vs offline evaluation",
        "LLM / RAG production experience (if any)",
      ],
      red_flags: [
        "Only research / notebook experience, no production",
        "Cannot describe a real monitoring setup",
        "Lazy answers about evaluation metrics",
      ],
    },
  },
  {
    key: "product-designer",
    title: "Staff Product Designer",
    blurb: "End-to-end design for a B2B SaaS dashboard. Strong DS chops.",
    jdText: `# Staff Product Designer
**Team:** Core product
**Location:** Remote (US/Canada)

You'll be the design lead for our core dashboard — owning end-to-end design, the design system, and partnering closely with engineering.

## What you'll do
- Lead 0→1 and 1→n product work on the core dashboard
- Evolve the design system in lockstep with the front-end team
- Run weekly critiques, mentor 1–2 mid-level designers

## Must haves
- 7+ years product design, at least 2 at a B2B SaaS
- Has owned and evolved a design system
- Strong systems thinking (not just screens)
- Comfortable shipping with engineers, not throwing-over-wall

## Nice to haves
- Motion / interaction design
- Code literacy (HTML/CSS, maybe React)
- B2B + data-heavy product experience`,
    plan: {
      summary:
        "Senior B2B SaaS product designer who can lead 0→1 and evolve a design system.",
      must_haves: [
        "7+ years of product design",
        "Has owned and evolved a design system",
        "Has shipped 0→1 product work end-to-end",
        "Has mentored other designers",
      ],
      nice_to_haves: [
        "Motion / interaction design",
        "Code literacy (HTML/CSS or React)",
        "Data-heavy B2B product domain",
      ],
      skills_to_probe: [
        "A specific 0→1 project they led from research to ship",
        "How they evolve a design system without breaking the product",
        "How they collaborate with engineering on tradeoffs",
        "How they run critique without crushing junior designers",
        "A time they pushed back on a PM and were right (or wrong)",
      ],
      red_flags: [
        "Pixel-pushing only, no systems thinking",
        "Has never worked closely with engineers",
        "Cannot describe a real critique they ran",
      ],
    },
  },
];

export function getSampleRole(key: string): SampleRole | undefined {
  return SAMPLE_ROLES.find((r) => r.key === key);
}
