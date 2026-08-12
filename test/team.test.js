import test from "node:test";
import assert from "node:assert/strict";
import { FORMATION_442, TEAMS, allKits, kitOf } from "../web/team.js";

const [rovers, athletic] = TEAMS;
const keeper = FORMATION_442.find((role) => role.keeper);
const outfielder = FORMATION_442.find((role) => !role.keeper);

test("the two sides attack opposite ends", () => {
  assert.equal(rovers.attackingDirection, -athletic.attackingDirection);
});

test("an outfielder wears a plain shirt of the team colour", () => {
  const kit = kitOf(rovers, outfielder);
  assert.deepEqual(kit.stripe, kit.shirt);
  assert.notDeepEqual(kit.shirt, kitOf(athletic, outfielder).shirt);
});

test("a keeper wears the team colour striped with black", () => {
  const kit = kitOf(rovers, keeper);
  assert.deepEqual(kit.shirt, rovers.kit.shirt);
  assert.deepEqual(kit.stripe, { red: 0, green: 0, blue: 0 });
});

test("every kit worn on the pitch is baked once, under its own name", () => {
  const kits = allKits();
  const names = kits.map((kit) => kit.name);
  assert.equal(new Set(names).size, names.length);
  TEAMS.forEach((team) =>
    FORMATION_442.forEach((role) =>
      assert.ok(kits.includes(kitOf(team, role))),
    ),
  );
});
