import { test } from "node:test";
import assert from "node:assert/strict";
import { customSection } from "../src/core/sections";
import { Shape } from "../src/core/types";
const shapes: [Shape, number[]][] = [
  ["rectangle", [100, 300]],
  ["circle", [200]],
  ["rhs", [200, 100, 6]],
  ["shs", [100, 6]],
  ["chs", [200, 8]],
  ["i", [300, 150, 8, 12]],
  ["t", [200, 150, 8, 12]],
  ["channel", [200, 100, 8, 12]],
  ["angle", [100, 80, 8, 8]],
];
for (const [shape, dims] of shapes)
  test("independent area-integration audit: " + shape, () => {
    const s = customSection(shape, dims),
      nx = 600,
      nz = 600,
      dx = s.b / nx,
      dz = s.h / nz,
      cell = dx * dz;
    const inside = (y: number, z: number) => {
      if (shape === "circle" || shape === "chs") {
        const r = Math.hypot(y - s.b / 2, z - s.h / 2);
        return r < s.d / 2 && (shape === "circle" || r > s.d / 2 - s.t);
      }
      if (shape === "rectangle") return true;
      if (shape === "rhs" || shape === "shs")
        return y < s.t || y > s.b - s.t || z < s.t || z > s.h - s.t;
      if (shape === "i")
        return z < s.tf || z > s.h - s.tf || Math.abs(y - s.b / 2) < s.tw / 2;
      if (shape === "t")
        return z > s.h - s.tf || Math.abs(y - s.b / 2) < s.tw / 2;
      if (shape === "channel") return y < s.tw || z < s.tf || z > s.h - s.tf;
      return y < s.tw || z < s.tf;
    };
    let A = 0,
      Y = 0,
      Z = 0,
      YY = 0,
      ZZ = 0,
      YZ = 0;
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < nz; j++) {
        const y = (i + 0.5) * dx,
          z = (j + 0.5) * dz;
        if (!inside(y, z)) continue;
        A += cell;
        Y += cell * y;
        Z += cell * z;
        YY += cell * y * y;
        ZZ += cell * z * z;
        YZ += cell * y * z;
      }
    const cy = Y / A,
      cz = Z / A,
      Iy = ZZ - A * cz * cz,
      Iz = YY - A * cy * cy,
      Iyz = YZ - A * cy * cz;
    for (const [a, b] of [
      [s.A, A],
      [s.cy, cy],
      [s.cz, cz],
      [s.Iy, Iy],
      [s.Iz, Iz],
    ])
      assert.ok(
        Math.abs(a - b) < 0.0015 * Math.max(1, Math.abs(b)),
        `${shape}: ${a} != ${b}`,
      );
    assert.ok(
      Math.abs(s.Iyz - Iyz) <
        Math.max(0.0015 * Math.abs(Iyz), 1e-8 * (Iy + Iz)),
    );
    assert.ok(Math.abs(s.Imajor + s.Iminor - Iy - Iz) < 0.0015 * (Iy + Iz));
  });
test("rectangular Saint-Venant approximation checked against independent Fourier series", () => {
  for (const [a, b] of [
    [100, 100],
    [300, 100],
    [200, 20],
  ]) {
    let sum = 0;
    for (let n = 1; n < 1000; n += 2)
      sum += Math.tanh((n * Math.PI * a) / (2 * b)) / n ** 5;
    const exact =
        ((a * b ** 3) / 3) * (1 - ((192 * b) / (Math.PI ** 5 * a)) * sum),
      s = customSection("rectangle", [b, a]);
    assert.ok(Math.abs(s.J! - exact) / exact < 0.005);
  }
});
