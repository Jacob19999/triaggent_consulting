// Full-text privacy scan of everything the app publishes from data/ and public/data/.
// Fails on sponsor or licensed field names, local paths, or observed months at or
// after the forecast target. Run: npm run privacy
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath, not URL.pathname: on Windows the pathname is "/C:/..." and resolves to "C:\C:\...".
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targets = ["data", "public/data"].map((d) => path.join(root, d));
const forbidden = [
  /"site_key"/,
  /"block_geoid"/,
  /INTPT/i,
  /"fi_rate"/,
  /"fi_persons"/,
  /"child_fi_rate"/,
  /"cost_per_meal"/,
  /"pct_fi_above_snap_threshold"/,
  /"visits_per_fi_person"/,
  /"meal_gap_coverage"/,
  /"sites_in_tract"/,
  /"has_site"/,
  // Researched site addresses (D-060): data/organization Location/ never reaches a bundle.
  /"Matched_Address"/,
  /"Geocoded_Address"/,
  /"Matched_Organization_Name"/,
  /\/Users\//,
  /[A-Za-z]:\\\\Users/,
];
let failed = false;
for (const dir of targets) {
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name);
    if (!statSync(file).isFile() || !name.endsWith(".json")) continue;
    const text = readFileSync(file, "utf8");
    for (const re of forbidden) {
      if (re.test(text)) {
        console.error(`FAIL ${path.relative(root, file)}: matches ${re}`);
        failed = true;
      }
    }
    if (name === "sites.json") {
      // D-063: site points carry location, type and precision only, never activity or identity.
      const b = JSON.parse(text);
      const rows = Object.values(b.counties).flat();
      if (b.meta.fields.join() !== "lon,lat,type,approx" || rows.some((r) => r.length !== 4 || r.some((v) => typeof v !== "number"))) {
        console.error("FAIL sites.json: rows must be [lon, lat, type, approx] numbers only");
        failed = true;
      }
    }
    if (name === "deck.json") {
      const target = JSON.parse(readFileSync(path.join(root, "data", "research.json"), "utf8")).meta.forecast_target;
      const late = JSON.parse(text).q4_prices.filter((p) => p.month >= target);
      if (late.length) {
        console.error(`FAIL deck.json: price series reaches ${late[0].month}`);
        failed = true;
      }
    }
    if (name === "research.json") {
      const b = JSON.parse(text);
      const late = b.history.filter((h) => h.month >= b.meta.forecast_target);
      if (late.length) {
        console.error(`FAIL research.json: observed history reaches ${late[0].month}`);
        failed = true;
      }
    }
    console.log(`ok   ${path.relative(root, file)} (${(text.length / 1e6).toFixed(2)} MB)`);
  }
}
process.exit(failed ? 1 : 0);
