import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPortfolioRestorationPlan,
  canonicalizePortfolioHostname,
  PORTFOLIO_RESTORATION_MANIFEST,
  type PortfolioRestorationWebsite,
} from "./portfolioRestore";

function website(
  id: number,
  values: Partial<PortfolioRestorationWebsite>,
): PortfolioRestorationWebsite {
  return {
    id,
    name: values.name ?? `Unrelated ${id}`,
    url: values.url ?? `https://unrelated-${id}.example`,
    description: values.description ?? null,
    imageUrl: values.imageUrl ?? null,
    category: values.category ?? "OTHER",
    isVisible: values.isVisible ?? true,
    order: values.order ?? id,
  };
}

test("canonicalizes the approved Hagenz store alias", () => {
  assert.equal(
    canonicalizePortfolioHostname("https://Hagenz.store/"),
    "hagenz.online",
  );
});

test("plans all six restorations without financial metric inserts", () => {
  const plan = buildPortfolioRestorationPlan([]);
  const restoreChanges = plan.changes.filter((change) =>
    [
      "pc-travel-members",
      "pc-casino",
      "ai-assist",
      "boot-jean-joyner",
      "selfmadebeatz",
      "hagenz",
    ].includes(change.key),
  );
  assert.equal(restoreChanges.every((change) => change.action === "insert"), true);
  const hagenz = plan.changes.find((change) => change.key === "hagenz");
  assert.equal(hagenz?.after?.imageUrl, null);
  assert.equal(Object.hasOwn(hagenz?.after ?? {}, "marketCap"), false);
  assert.equal(Object.hasOwn(hagenz?.after ?? {}, "revenue"), false);
  assert.equal(Object.hasOwn(hagenz?.after ?? {}, "growth"), false);
  assert.match(plan.warnings.join("\n"), /Hagenz original missing/);
  assert.match(plan.warnings.join("\n"), /DNS.*hagenz\.online/);
  assert.match(
    plan.warnings.join("\n"),
    /Divine Tarots saved logo is not independently confirmed original/,
  );
});

test("matches Hagenz by its historical hostname and preserves its logo", () => {
  const plan = buildPortfolioRestorationPlan([
    website(42, {
      name: "Hagenz",
      url: "https://hagenz.store",
      imageUrl: "/logos/existing-hagenz.png",
      isVisible: false,
    }),
  ]);
  const hagenz = plan.changes.find((change) => change.key === "hagenz");
  assert.equal(hagenz?.action, "update");
  assert.equal(hagenz?.after?.url, "https://hagenz.online");
  assert.equal(hagenz?.after?.isVisible, true);
  assert.equal(hagenz?.after?.imageUrl, "/logos/existing-hagenz.png");
});

test("refuses ambiguous duplicates and never inserts logo-only records", () => {
  const plan = buildPortfolioRestorationPlan([
    website(1, { name: "Pc Casino", url: "https://pccasino.online" }),
    website(2, { name: "PC CASINO", url: "https://another.example" }),
  ]);
  const casino = plan.changes.find((change) => change.key === "pc-casino");
  const weparlay = plan.changes.find((change) => change.key === "weparlay-logo");
  assert.equal(casino?.action, "conflict");
  assert.equal(weparlay?.action, "conflict");
  assert.equal(plan.canApply, false);
  assert.match(casino?.reason ?? "", /Ambiguous duplicate/);
  assert.match(weparlay?.reason ?? "", /never inserts/);
});

test("rejects a row whose name and hostname identify different restored sites", () => {
  const plan = buildPortfolioRestorationPlan([
    website(1, { name: "Pc Casino", url: "https://hagenz.online" }),
    website(2, { name: "WeParlay", url: "https://weparlay.io" }),
    website(3, { name: "Divine Tarots", url: "https://divinetarots.com" }),
  ]);
  for (const key of ["pc-casino", "hagenz"]) {
    assert.equal(plan.changes.find(change => change.key === key)?.action, "conflict");
  }
  assert.equal(plan.canApply, false);
});

test("rejects cross-wired logo records", () => {
  const plan = buildPortfolioRestorationPlan([
    website(1, { name: "WeParlay", url: "https://divinetarots.com" }),
  ]);
  for (const key of ["weparlay-logo", "divine-tarots-logo"]) {
    assert.equal(plan.changes.find(change => change.key === key)?.action, "conflict");
  }
  assert.equal(plan.canApply, false);
});

test("is idempotent when the approved records already match", () => {
  const existing = PORTFOLIO_RESTORATION_MANIFEST.map((entry, index) =>
    website(index + 1, {
      name: entry.name,
      url: entry.url,
      imageUrl: entry.imageUrl,
      category: entry.category ?? "OTHER",
      description: entry.description ?? null,
      order: entry.order ?? index,
      isVisible: true,
    }),
  );
  const plan = buildPortfolioRestorationPlan(existing);
  assert.equal(plan.canApply, true);
  assert.equal(plan.changes.every((change) => change.action === "noop"), true);
});
