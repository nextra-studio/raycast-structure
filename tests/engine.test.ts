import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/core/engine";
import { Model } from "../src/core/types";
const E = 210000,
  I = 8e7,
  A = 4000,
  L = 6000,
  q = 5,
  P = 10000;
const near = (a: number, b: number, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) < tol * Math.max(1, Math.abs(b)), `${a} != ${b}`);
function beam(
  left: [boolean, boolean, boolean] = [true, true, false],
  right: [boolean, boolean, boolean] = [false, true, false],
): Model {
  return {
    nodes: [
      { id: "A", x: 0, z: 0, restraints: left },
      { id: "B", x: L, z: 0, restraints: right },
    ],
    members: [{ id: "M", start: "A", end: "B", type: "frame", E, A, I }],
    nodalLoads: [],
    memberLoads: [
      {
        member: "M",
        kind: "udl",
        magnitude: -q,
        direction: "globalZ",
        basis: "member",
      },
    ],
    theory: "euler",
  };
}
const maxM = (r: ReturnType<typeof analyze>) =>
  Math.max(...r.members.flatMap((m) => m.stations.map((s) => s.M)));
const minV = (r: ReturnType<typeof analyze>) =>
  Math.min(...r.members.flatMap((m) => m.stations.map((s) => s.v)));
test("simply supported UDL: reactions, exact maximum moment and deflection", () => {
  const r = analyze(beam());
  near(r.reactions.A[1], (q * L) / 2);
  near(r.reactions.B[1], (q * L) / 2);
  near(maxM(r), (q * L * L) / 8);
  near(minV(r), (-5 * q * L ** 4) / (384 * E * I));
  near(r.residual, 0);
});
test("cantilever UDL and reaction moment", () => {
  const r = analyze(beam([true, true, true], [false, false, false]));
  near(r.reactions.A[1], q * L);
  near(r.reactions.A[2], (q * L * L) / 2);
  near(r.displacements.B[1], (-q * L ** 4) / (8 * E * I));
});
test("fixed-fixed UDL, nonzero internal span deflection with zero nodal displacement", () => {
  const r = analyze(beam([true, true, true], [true, true, true]));
  near(r.reactions.A[2], (q * L * L) / 12);
  near(r.reactions.B[2], (-q * L * L) / 12);
  near(maxM(r), (q * L * L) / 24);
  near(minV(r), (-q * L ** 4) / (384 * E * I));
});
test("propped cantilever reactions", () => {
  const r = analyze(beam([true, true, true]));
  near(r.reactions.A[1], (5 * q * L) / 8);
  near(r.reactions.B[1], (3 * q * L) / 8);
  near(r.reactions.A[2], (q * L * L) / 8);
});
test("central point load PL/4 and PL3/48EI", () => {
  const m = beam();
  m.memberLoads = [
    {
      member: "M",
      kind: "point",
      position: L / 2,
      magnitude: -P,
      direction: "globalZ",
      basis: "member",
    },
  ];
  const r = analyze(m);
  near(maxM(r), (P * L) / 4);
  near(minV(r), (-P * L ** 3) / (48 * E * I));
});
test("point load exactly on a support transfers directly to reaction", () => {
  const m = beam();
  m.memberLoads = [
    {
      member: "M",
      kind: "point",
      position: 0,
      magnitude: -P,
      direction: "globalZ",
      basis: "member",
    },
  ];
  const r = analyze(m);
  near(r.reactions.A[1], P);
  near(r.reactions.B[1], 0);
  near(maxM(r), 0);
});
test("two-span continuous textbook coefficients", () => {
  const m = beam();
  m.nodes.push({ id: "C", x: 2 * L, z: 0, restraints: [false, true, false] });
  m.members.push({ ...m.members[0], id: "M2", start: "B", end: "C" });
  m.memberLoads.push({ ...m.memberLoads[0], member: "M2" });
  const r = analyze(m);
  near(r.reactions.A[1], (3 * q * L) / 8);
  near(r.reactions.B[1], (5 * q * L) / 4);
  near(r.reactions.C[1], (3 * q * L) / 8);
  near(r.members[0].stations.at(-1)!.M, (-q * L * L) / 8);
});
test("five spans solve and satisfy global equilibrium", () => {
  const m = beam();
  for (let j = 2; j <= 5; j++) {
    m.nodes.push({
      id: String(j),
      x: j * L,
      z: 0,
      restraints: [false, true, false],
    });
    const last = m.members.at(-1)!;
    m.members.push({ ...last, id: "M" + j, start: last.end, end: String(j) });
    m.memberLoads.push({ ...m.memberLoads[0], member: "M" + j });
  }
  const r = analyze(m);
  near(
    Object.values(r.reactions).reduce((s, v) => s + v[1], 0),
    5 * q * L,
  );
});
test("doubling E halves deflection without changing forces for uniform stiffness scaling", () => {
  const m = beam(),
    r = analyze(m);
  m.members[0].E *= 2;
  const s = analyze(m);
  near(minV(s), minV(r) / 2);
  near(maxM(s), maxM(r));
});
test("Timoshenko UDL includes qL2/8GA shear deflection", () => {
  const m = beam();
  m.theory = "timoshenko";
  m.members[0].G = 80000;
  m.members[0].shearArea = 2000;
  const r = analyze(m);
  near(
    minV(r),
    (-5 * q * L ** 4) / (384 * E * I) - (q * L * L) / (8 * 80000 * 2000),
  );
});
test("Timoshenko fixed-ended loaded member recovers compatible displacements", () => {
  const m = beam([true, true, true], [true, true, true]);
  m.theory = "timoshenko";
  m.members[0].G = 80000;
  m.members[0].shearArea = 2000;
  assert.ok(minV(analyze(m)) < 0);
});
test("inclined global load decomposes and conserves resultant", () => {
  const m = beam([true, true, true], [false, false, false]);
  m.nodes[1].z = L;
  const r = analyze(m);
  near(r.reactions.A[0], 0);
  near(r.reactions.A[1], q * L * Math.SQRT2);
  near(r.reactions.A[2], (q * L * Math.SQRT2 * L) / 2);
  assert.ok(Math.abs(r.members[0].stations[0].N) > 0);
});
test("projected load is per horizontal metre, not slope metre", () => {
  const m = beam([true, true, true], [false, false, false]);
  m.nodes[1].z = L;
  m.memberLoads[0].basis = "projected";
  const r = analyze(m);
  near(r.reactions.A[1], q * L);
});
test("local load rotates to global components", () => {
  const m = beam([true, true, true], [false, false, false]);
  m.nodes[1].z = L;
  m.memberLoads[0].direction = "localZ";
  const r = analyze(m);
  near(r.reactions.A[0], -q * L);
  near(r.reactions.A[1], q * L);
});
test("axial truss EA/L", () => {
  const m = beam([true, true, false], [false, true, false]);
  m.members[0].type = "truss";
  m.memberLoads = [];
  m.nodalLoads = [{ node: "B", fx: P, fz: 0, moment: 0 }];
  const r = analyze(m);
  near(r.displacements.B[0], (P * L) / (E * A));
  near(r.members[0].stations[0].N, P);
});
test("true truss rejects distributed member loading", () => {
  const m = beam();
  m.members[0].type = "truss";
  assert.throws(() => analyze(m), /truss loads/);
});
test("double moment release reproduces simply supported frame", () => {
  const m = beam([true, true, true], [true, true, true]);
  m.members[0].releaseStart = true;
  m.members[0].releaseEnd = true;
  const r = analyze(m);
  near(r.reactions.A[2], 0);
  near(r.reactions.B[2], 0);
  near(maxM(r), (q * L * L) / 8);
  near(minV(r), (-5 * q * L ** 4) / (384 * E * I));
});
test("partial triangular loading total resultant and compatibility", () => {
  const m = beam();
  m.memberLoads = [
    {
      member: "M",
      kind: "udl",
      magnitude: 0,
      endMagnitude: -q,
      direction: "globalZ",
      basis: "member",
      start: L / 4,
      end: (3 * L) / 4,
    },
  ];
  const r = analyze(m);
  near(r.reactions.A[1] + r.reactions.B[1], (q * L) / 4);
  near(r.reactions.B[1], (((q * L) / 4) * 7) / 12);
});
test("unstable free beam is rejected", () => {
  assert.throws(
    () => analyze(beam([false, false, false], [false, false, false])),
    /Unstable/,
  );
});
test("out-of-member loads are rejected rather than silently ignored", () => {
  const m = beam();
  m.memberLoads = [
    {
      member: "M",
      kind: "point",
      position: L + 1,
      magnitude: -P,
      direction: "globalZ",
      basis: "member",
    },
  ];
  assert.throws(() => analyze(m), /outside/);
});
test("tip moment on cantilever", () => {
  const m = beam([true, true, true], [false, false, false]);
  m.memberLoads = [
    {
      member: "M",
      kind: "moment",
      position: L,
      magnitude: P * L,
      direction: "localZ",
      basis: "member",
    },
  ];
  const r = analyze(m);
  near(r.displacements.B[1], (P * L ** 3) / (2 * E * I));
  near(r.reactions.A[2], -P * L);
});
