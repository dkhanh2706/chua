import * as THREE from "three";
import { createAvatarMotion } from "./avatar-motion.mjs";

// Human proportions and garments are independent of the cartoon characters.
// Bone lengths are also consumed by the shared animation / hand IK solver.
export const HUMAN_RIG = Object.freeze({
  hipHeight: 0.86,
  armUpper: 0.34,
  armLower: 0.29,
  legUpper: 0.4,
  legLower: 0.38,
  seatOffset: 0.73,
});

const { smoothstep: smooth, lerp, clamp } = THREE.MathUtils;
const DEG = Math.PI / 180;
const cubic = (a, b, c, d, u) =>
  0.5 *
  (2 * b +
    (c - a) * u +
    (2 * a - 5 * b + 4 * c - d) * u * u +
    (3 * b - a - 3 * c + d) * u * u * u);

// The skull is an ellipsoid whose jaw narrows towards the chin. Hair and face
// details are placed with the same function, so they always meet the skin.
const SKULL = Object.freeze({ x: 0.262, y: 0.305, z: 0.25 });
const jawTaper = (Y, jaw) => 1 - jaw * smooth(-Y, 0.2, 1);
export function skullPoint(
  theta,
  phi,
  jaw = 0.1,
  target = new THREE.Vector3(),
) {
  const Y = Math.cos(theta),
    r = Math.sin(theta);
  return target.set(
    SKULL.x * jawTaper(Y, jaw) * r * Math.sin(phi),
    SKULL.y * Y,
    SKULL.z * r * Math.cos(phi),
  );
}
const skullNormal = (p, target) =>
  target
    .set(p.x / SKULL.x ** 2, p.y / SKULL.y ** 2, p.z / SKULL.z ** 2)
    .normalize();

// Natural hairline, as the polar angle from the crown for each direction around
// the head (0 = forehead, 90 = ear, 180 = nape). Every hairstyle covers at least
// this region, so no style can leave a bald patch.
const HAIRLINE = [
  [0, 0.8],
  [25, 0.83],
  [46, 0.98],
  [60, 1.36],
  [72, 1.64],
  [82, 1.62],
  [91, 1.42],
  [100, 1.62],
  [110, 1.95],
  [125, 2.12],
  [150, 2.22],
  [180, 2.26],
];
export function hairlineAngle(phi) {
  const d = Math.abs(Math.atan2(Math.sin(phi), Math.cos(phi))) / DEG,
    last = HAIRLINE.length - 1;
  let i = 0;
  while (i < last - 1 && HAIRLINE[i + 1][0] < d) i++;
  const u = clamp(
    (d - HAIRLINE[i][0]) / (HAIRLINE[i + 1][0] - HAIRLINE[i][0]),
    0,
    1,
  );
  return cubic(
    HAIRLINE[Math.max(0, i - 1)][1],
    HAIRLINE[i][1],
    HAIRLINE[i + 1][1],
    HAIRLINE[Math.min(last, i + 2)][1],
    u,
  );
}

export function createHumanAvatar(appearance) {
  const a = appearance,
    c = a.colors,
    female = a.gender === "female",
    rig = HUMAN_RIG;
  const root = new THREE.Group(),
    geometries = new Map(),
    materials = new Map();
  root.name = "human-avatar";
  const tones = new THREE.DataTexture(
    new Uint8Array([104, 168, 218, 255]),
    4,
    1,
    THREE.RedFormat,
  );
  tones.minFilter = tones.magFilter = THREE.LinearFilter;
  tones.needsUpdate = true;
  const tint = (color, amount) =>
    "#" + new THREE.Color(color).multiplyScalar(amount).getHexString();
  const mix = (color, other, amount) =>
    "#" +
    new THREE.Color(color).lerp(new THREE.Color(other), amount).getHexString();
  // flags: v = per-vertex shading, d = visible from both sides.
  function mat(color, kind = "cloth", flags = "") {
    const key = `${kind}:${color}:${flags}`;
    if (!materials.has(key)) {
      const m =
        kind === "metal"
          ? new THREE.MeshStandardMaterial({
              color,
              roughness: 0.4,
              metalness: 0.35,
            })
          : new THREE.MeshToonMaterial({ color, gradientMap: tones });
      if (flags.includes("v")) m.vertexColors = true;
      if (flags.includes("d")) m.side = THREE.DoubleSide;
      materials.set(key, m);
    }
    return materials.get(key);
  }
  const sphere = new THREE.SphereGeometry(1, 24, 18);
  geometries.set("sphere", sphere);
  const group = (p, x = 0, y = 0, z = 0) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    p.add(g);
    return g;
  };
  const bone = (p, x = 0, y = 0, z = 0) => {
    const b = new THREE.Bone();
    b.position.set(x, y, z);
    p.add(b);
    return b;
  };
  function mesh(p, geo, color, kind = "cloth", name = "", flags = "") {
    const m = new THREE.Mesh(geo, mat(color, kind, flags));
    m.name = name;
    m.castShadow = true;
    m.receiveShadow = true;
    p.add(m);
    return m;
  }
  function ellipsoid(p, x, y, z, rx, ry, rz, color, kind = "cloth", name = "") {
    const m = mesh(p, sphere, color, kind, name);
    m.position.set(x, y, z);
    m.scale.set(rx, ry, rz);
    return m;
  }
  function line(
    p,
    points,
    color,
    r = 0.003,
    kind = "cloth",
    name = "",
    closed = false,
  ) {
    const curve = new THREE.CatmullRomCurve3(
      points.map((v) => new THREE.Vector3(...v)),
      closed,
    );
    return mesh(
      p,
      new THREE.TubeGeometry(
        curve,
        Math.max(12, points.length * 5),
        r,
        6,
        closed,
      ),
      color,
      kind,
      name,
    );
  }
  // A rectangular patch of vertices. `point(i,j)` returns [x,y,z,shade?].
  function grid(
    rows,
    cols,
    point,
    { flip = false, colors = false, closed = false } = {},
  ) {
    const positions = [],
      shades = [],
      indices = [];
    for (let i = 0; i <= rows; i++)
      for (let j = 0; j <= cols; j++) {
        const p = point(i, j);
        positions.push(p[0], p[1], p[2]);
        if (colors) {
          const s = p[3] ?? 1;
          shades.push(s, s, s);
        }
        if (i < rows && j < cols) {
          const n = i * (cols + 1) + j,
            b = n + cols + 1;
          if (flip) indices.push(n, b, n + 1, b, b + 1, n + 1);
          else indices.push(n, n + 1, b, b, n + 1, b + 1);
        }
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    if (colors)
      geo.setAttribute("color", new THREE.Float32BufferAttribute(shades, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    if (closed) {
      // Blend the normals where the surface wraps around, hiding the seam.
      const normals = geo.attributes.normal,
        first = new THREE.Vector3(),
        other = new THREE.Vector3();
      for (let i = 0; i <= rows; i++) {
        const n = i * (cols + 1),
          m = n + cols;
        first
          .fromBufferAttribute(normals, n)
          .add(other.fromBufferAttribute(normals, m))
          .normalize();
        normals.setXYZ(n, first.x, first.y, first.z);
        normals.setXYZ(m, first.x, first.y, first.z);
      }
    }
    return geo;
  }
  const resample = (rows, count) => {
    const out = [],
      n = rows.length - 1;
    for (let k = 0; k <= count; k++) {
      const f = (k / count) * n,
        i = Math.min(n - 1, Math.floor(f)),
        u = f - i,
        p0 = rows[Math.max(0, i - 1)],
        p1 = rows[i],
        p2 = rows[i + 1],
        p3 = rows[Math.min(n, i + 2)];
      out.push(p1.map((_, d) => cubic(p0[d], p1[d], p2[d], p3[d], u)));
    }
    return out;
  };
  // Tailored cross sections [y, half width, back depth, front depth]. The
  // slightly squared outline gives a chest and back instead of a round tube.
  const boxy = (v) => Math.sign(v) * Math.abs(v) ** 0.86;
  const sectionPoint = ([y, rx, back, front], t, grow = 0) => {
    const s = Math.sin(t);
    return [
      (rx + grow) * boxy(Math.cos(t)),
      y,
      ((s > 0 ? front : back) + grow) * boxy(s),
    ];
  };
  const tailored = (sections, cols = 44) =>
    grid(
      sections.length - 1,
      cols,
      (i, j) => sectionPoint(sections[i], (j / cols) * Math.PI * 2),
      { closed: true },
    );
  const ring = (section, grow = 0, count = 48) =>
    Array.from({ length: count }, (_, i) =>
      sectionPoint(section, (i / count) * Math.PI * 2, grow),
    );
  // Stacked outlines for shoes and feet: narrow heel, wider ball, rounded toe.
  const footRing = (y, half, heel, toe) => ({ y, half, heel, toe });
  function loft(rings, cols = 32) {
    return grid(
      rings.length - 1,
      cols,
      (i, j) => {
        const r = rings[i],
          t = (j / cols) * Math.PI * 2,
          s = Math.sin(t);
        return [
          r.half * Math.cos(t) * (1 + 0.15 * s),
          r.y,
          (r.heel + r.toe) / 2 + ((r.toe - r.heel) / 2) * s,
        ];
      },
      { closed: true },
    );
  }
  const closedRing = (y, z) => footRing(y, 0, z, z);

  const body = group(root, 0, rig.hipHeight, 0),
    shirt = group(body),
    hair = new THREE.Group();
  const shoulder = female ? 0.268 : 0.3,
    hip = female ? 0.246 : 0.238,
    slim = female ? 0.9 : 1;
  const tunic = a.shirt === "tunic",
    short = a.shirt === "short";

  // ---------------------------------------------------------------- torso
  const shirtRows = resample(
    female
      ? [
          [0.812, 0.092, 0.078, 0.082],
          [0.785, 0.135, 0.092, 0.098],
          [0.745, 0.232, 0.108, 0.116],
          [0.69, 0.252, 0.122, 0.14],
          [0.58, 0.24, 0.128, 0.158],
          [0.46, 0.218, 0.12, 0.14],
          [0.33, 0.206, 0.116, 0.126],
          [0.17, 0.238, 0.132, 0.138],
          [0.055, 0.25, 0.142, 0.146],
          ...(tunic
            ? [
                [-0.04, 0.262, 0.148, 0.152],
                [-0.13, 0.276, 0.152, 0.158],
              ]
            : []),
        ]
      : [
          [0.812, 0.1, 0.082, 0.086],
          [0.785, 0.15, 0.098, 0.102],
          [0.745, 0.262, 0.118, 0.122],
          [0.69, 0.285, 0.135, 0.142],
          [0.58, 0.272, 0.142, 0.152],
          [0.44, 0.25, 0.135, 0.142],
          [0.3, 0.24, 0.13, 0.138],
          [0.15, 0.24, 0.135, 0.142],
          [0.055, 0.245, 0.14, 0.146],
          ...(tunic
            ? [
                [-0.04, 0.255, 0.146, 0.152],
                [-0.13, 0.266, 0.15, 0.156],
              ]
            : []),
        ],
    64,
  );
  const shirtRow = (y) => {
    let i = 0;
    while (i < shirtRows.length - 2 && shirtRows[i + 1][0] > y) i++;
    const p = shirtRows[i],
      q = shirtRows[i + 1],
      u = clamp((p[0] - y) / (p[0] - q[0]), 0, 1);
    return p.map((v, d) => lerp(v, q[d], u));
  };
  // Point on the front of the garment, lifted slightly off the cloth.
  const onShirt = (x, y, lift = 0.003) => {
    const r = shirtRow(y),
      w = clamp(Math.abs(x) / r[1], 0, 0.999);
    return [x, y, r[3] * Math.sqrt(1 - w ** 2.3) ** 0.86 + lift];
  };
  const garment = mesh(
    shirt,
    tailored(shirtRows),
    c.shirt,
    "cloth",
    "tailored-shirt",
  );
  const seam = tint(c.shirt, 0.8),
    edge = mix(c.shirt, "#f4ecdc", 0.3),
    button = "#f1ecdf";
  const hemRow = shirtRows.at(-1);
  line(shirt, ring(hemRow, 0.002), seam, 0.0045, "cloth", "shirt-hem", true);
  if (tunic) {
    // Áo lam: stand collar, cloth knot buttons, two patch pockets and side vents.
    const collar = mesh(
      shirt,
      tailored([
        [0.868, 0.086, 0.076, 0.079],
        [0.84, 0.092, 0.08, 0.084],
        [0.8, 0.106, 0.088, 0.094],
      ]),
      edge,
      "cloth",
      "stand-collar",
    );
    collar.userData.garment = "tunic";
    line(
      shirt,
      [
        [0, 0.866, 0.079],
        [0, 0.835, 0.086],
        [0, 0.805, 0.095],
      ],
      seam,
      0.0035,
    );
    const placket = [];
    for (let y = 0.795; y > hemRow[0]; y -= 0.06) placket.push(onShirt(0, y));
    placket.push(onShirt(0, hemRow[0]));
    line(shirt, placket, edge, 0.0045, "cloth", "placket");
    for (let i = 0; i < 5; i++) {
      const y = 0.73 - i * 0.12;
      line(
        shirt,
        [
          onShirt(-0.04, y, 0.004),
          onShirt(0, y, 0.006),
          onShirt(0.04, y, 0.004),
        ],
        edge,
        0.0038,
        "cloth",
        "frog-loop",
      );
      ellipsoid(
        shirt,
        ...onShirt(0, y, 0.008),
        0.0105,
        0.0105,
        0.007,
        seam,
        "cloth",
        "knot-button",
      );
    }
    for (const side of [-1, 1]) {
      const x1 = side * 0.075,
        x2 = side * 0.185,
        y1 = -0.005,
        y2 = 0.115;
      line(
        shirt,
        [
          onShirt(x1, y2),
          onShirt(x1, y1 + 0.01),
          onShirt((x1 + x2) / 2, y1),
          onShirt(x2, y1 + 0.01),
          onShirt(x2, y2),
        ],
        seam,
        0.003,
        "cloth",
        "patch-pocket",
      );
      line(
        shirt,
        [onShirt(x1, y2), onShirt((x1 + x2) / 2, y2), onShirt(x2, y2)],
        edge,
        0.0045,
      );
      line(
        shirt,
        [
          [side * (hemRow[1] + 0.002), hemRow[0], 0],
          [side * (shirtRow(-0.07)[1] + 0.003), -0.07, 0],
          [side * (shirtRow(-0.02)[1] + 0.002), -0.02, 0],
        ],
        tint(c.shirt, 0.62),
        0.005,
        "cloth",
        "side-vent",
      );
    }
  } else if (short) {
    // T-shirt: ribbed crew neck that dips at the front.
    const neck = [];
    for (let i = 0; i < 48; i++) {
      const t = (i / 48) * Math.PI * 2,
        s = Math.sin(t);
      neck.push([
        Math.cos(t) * (female ? 0.1 : 0.108),
        0.812 - Math.max(0, s) ** 1.5 * 0.034,
        s * (s > 0 ? (female ? 0.094 : 0.099) : 0.086),
      ]);
    }
    line(shirt, neck, edge, 0.0115, "cloth", "neckline", true);
  } else {
    // Shirt: collar stand with two wings, button placket and a breast pocket.
    mesh(
      shirt,
      tailored([
        [0.85, 0.088, 0.077, 0.08],
        [0.8, 0.106, 0.088, 0.094],
      ]),
      edge,
      "cloth",
      "collar-stand",
    );
    for (const side of [-1, 1]) {
      const tip = onShirt(side * 0.07, 0.716, 0.012),
        front = onShirt(side * 0.007, 0.795, 0.011),
        outer = [side * 0.122, 0.795, 0.05];
      const points = [
        [side * 0.004, 0.846, 0.082],
        front,
        tip,
        outer,
        [side * 0.104, 0.842, 0.004],
      ];
      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(points.flat(), 3),
      );
      geo.setIndex(
        side > 0 ? [0, 1, 2, 0, 2, 3, 0, 3, 4] : [0, 2, 1, 0, 3, 2, 0, 4, 3],
      );
      geo.computeVertexNormals();
      mesh(shirt, geo, edge, "cloth", "collar-wing", "d");
      line(shirt, [front, tip], seam, 0.0026);
      line(shirt, [tip, outer], seam, 0.0026);
    }
    const placket = [];
    for (let y = 0.8; y > hemRow[0]; y -= 0.06) placket.push(onShirt(0, y));
    placket.push(onShirt(0, hemRow[0]));
    line(shirt, placket, edge, 0.008, "cloth", "placket");
    for (let i = 0; i < 6; i++)
      ellipsoid(
        shirt,
        ...onShirt(0, 0.72 - i * 0.118, 0.009),
        0.0085,
        0.0085,
        0.004,
        button,
        "cloth",
        "button",
      );
    const px = female ? -0.115 : -0.13;
    line(
      shirt,
      [
        onShirt(px - 0.05, 0.6),
        onShirt(px - 0.05, 0.5),
        onShirt(px, 0.482),
        onShirt(px + 0.05, 0.5),
        onShirt(px + 0.05, 0.6),
      ],
      seam,
      0.0028,
      "cloth",
      "breast-pocket",
    );
    line(
      shirt,
      [onShirt(px - 0.05, 0.6), onShirt(px, 0.6), onShirt(px + 0.05, 0.6)],
      edge,
      0.0042,
    );
  }
  mesh(
    body,
    tailored(
      [
        [0.94, 0.066 * slim, 0.066 * slim, 0.066 * slim],
        [0.86, 0.068 * slim, 0.068 * slim, 0.068 * slim],
        [0.8, 0.074 * slim, 0.072 * slim, 0.072 * slim],
        [0.765, 0.09 * slim, 0.078 * slim, 0.078 * slim],
      ],
      28,
    ),
    c.skin,
    "skin",
    "neck",
  );

  // ----------------------------------------------------------------- head
  const jaw = female ? 0.15 : 0.1,
    headScale = 0.94;
  const head = group(body, 0, 1.145, 0);
  head.name = "human-head";
  head.scale.setScalar(headScale);
  const faceGeometry = new THREE.SphereGeometry(1, 48, 36),
    facePositions = faceGeometry.attributes.position;
  for (let i = 0; i < facePositions.count; i++) {
    const x = facePositions.getX(i),
      y = facePositions.getY(i),
      z = facePositions.getZ(i);
    facePositions.setXYZ(
      i,
      x * SKULL.x * jawTaper(y, jaw),
      y * SKULL.y,
      z * SKULL.z,
    );
  }
  faceGeometry.computeVertexNormals();
  mesh(head, faceGeometry, c.skin, "skin", "face");
  const faceZ = (x, y) => {
    const Y = y / SKULL.y,
      X = x / (SKULL.x * jawTaper(Y, jaw));
    return SKULL.z * Math.sqrt(Math.max(0, 1 - X * X - Y * Y));
  };
  const onFace = (x, y, lift = 0.003) => [x, y, faceZ(x, y) + lift];
  const forward = new THREE.Vector3(0, 0, 1);
  // A group resting on the face and turned to follow its curvature.
  function faceGroup(x, y, lift = 0) {
    const e = 0.004,
      n = new THREE.Vector3(
        -(faceZ(x + e, y) - faceZ(x - e, y)) / (2 * e),
        -(faceZ(x, y + e) - faceZ(x, y - e)) / (2 * e),
        1,
      ).normalize();
    const g = group(
      head,
      x + n.x * lift,
      y + n.y * lift,
      faceZ(x, y) + n.z * lift,
    );
    g.quaternion.setFromUnitVectors(forward, n);
    return g;
  }
  const lash = mix(c.hair, "#1c1512", 0.6),
    brow = mix(c.hair, c.skin, 0.12),
    iris = "#4a3324",
    blush = mix(c.skin, "#ec8e8b", female ? 0.42 : 0.26);
  const eyes = [];
  for (const side of [-1, 1]) {
    const ear = ellipsoid(
      head,
      side * 0.254,
      -0.03,
      -0.006,
      0.027,
      0.052,
      0.024,
      c.skin,
      "skin",
      "ear",
    );
    ear.rotation.z = -side * 0.1;
    ellipsoid(
      head,
      side * 0.268,
      -0.032,
      0.004,
      0.011,
      0.03,
      0.012,
      mix(c.skin, "#b8755f", 0.3),
      "skin",
    );
    // Only the inner group is squashed to blink; the closed lid line beneath
    // it stays put and shows once the eye has shut.
    const socket = faceGroup(side * 0.098, -0.008, 0.001),
      eye = group(socket);
    eyes.push(eye);
    line(
      socket,
      [
        [-0.035, 0.003, 0.0015],
        [0, -0.007, 0.0025],
        [0.035, 0.003, 0.0015],
      ],
      lash,
      0.0032,
      "hair",
      "closed-lid",
    );
    ellipsoid(
      eye,
      0,
      0,
      0,
      0.041,
      0.045,
      0.008,
      "#fffaf0",
      "skin",
      "eye-white",
    );
    ellipsoid(
      eye,
      -side * 0.003,
      -0.002,
      0.0055,
      0.028,
      0.035,
      0.006,
      iris,
      "hair",
      "iris",
    );
    ellipsoid(
      eye,
      -side * 0.003,
      -0.003,
      0.0095,
      0.0155,
      0.021,
      0.004,
      "#1c1512",
      "hair",
    );
    ellipsoid(
      eye,
      -0.011,
      0.015,
      0.013,
      0.0085,
      0.0105,
      0.003,
      "#ffffff",
      "skin",
    );
    ellipsoid(
      eye,
      0.009,
      -0.015,
      0.013,
      0.0042,
      0.0052,
      0.002,
      "#f1e9da",
      "skin",
    );
    line(
      eye,
      [
        [-side * 0.045, 0.008, 0.004],
        [-side * 0.03, 0.036, 0.009],
        [-side * 0.004, 0.048, 0.011],
        [side * 0.026, 0.039, 0.01],
        [side * 0.046, 0.014, 0.005],
      ],
      lash,
      female ? 0.0058 : 0.0042,
      "hair",
      "upper-lash",
    );
    if (female) {
      line(
        eye,
        [
          [side * 0.04, 0.024, 0.006],
          [side * 0.052, 0.034, 0.005],
          [side * 0.062, 0.047, 0.003],
        ],
        lash,
        0.0036,
        "hair",
      );
      line(
        eye,
        [
          [side * 0.012, -0.043, 0.006],
          [side * 0.03, -0.035, 0.006],
          [side * 0.043, -0.02, 0.005],
        ],
        mix(c.skin, lash, 0.45),
        0.002,
        "hair",
      );
    }
    // Eyebrows follow the brow ridge; fuller and straighter for the man.
    const arch = female
      ? [0.092, 0.112, 0.117, 0.098]
      : [0.094, 0.108, 0.11, 0.096];
    line(
      head,
      [0.05, 0.085, 0.122, 0.156].map((x, i) =>
        onFace(side * x, arch[i], 0.004),
      ),
      brow,
      female ? 0.0052 : 0.0075,
      "hair",
      "eyebrow",
    );
    const cheek = faceGroup(side * 0.152, -0.092, 0.002);
    ellipsoid(cheek, 0, 0, 0, 0.036, 0.022, 0.003, blush, "skin", "blush");
  }
  ellipsoid(
    head,
    0,
    -0.078,
    faceZ(0, -0.078) + 0.001,
    0.0165,
    0.0135,
    0.015,
    mix(c.skin, "#b47a62", 0.16),
    "skin",
    "nose",
  );
  const lip = mix(c.skin, female ? "#b8505c" : "#9a5a52", female ? 0.78 : 0.7);
  line(
    head,
    [
      [-0.036, -0.15],
      [-0.019, -0.16],
      [0, -0.163],
      [0.019, -0.16],
      [0.036, -0.15],
    ].map(([x, y]) => onFace(x, y)),
    lip,
    female ? 0.0042 : 0.0038,
    "skin",
    "mouth",
  );
  if (female)
    ellipsoid(
      head,
      0,
      -0.171,
      faceZ(0, -0.171) + 0.001,
      0.019,
      0.0075,
      0.005,
      mix(c.skin, "#d86f7c", 0.55),
      "skin",
      "lower-lip",
    );
  head.add(hair);
  hair.name = "hair";

  // ----------------------------------------------------------------- hair
  // Every style starts with one continuous scalp shell that follows the
  // hairline around forehead, temples, ears and nape. Bob and long hair let the
  // same shell fall past the jaw; fringes are separate locks laid over it.
  const hairColor = c.hair,
    point = new THREE.Vector3(),
    normal = new THREE.Vector3();
  const strands = (phi, theta) =>
    1 +
    0.09 * Math.sin(13 * phi + 1) +
    0.06 * Math.sin(29 * phi + 2.3) +
    0.04 * Math.sin(47 * phi + 0.7) +
    0.2 *
      Math.exp(-(((theta - 0.58) / 0.15) ** 2)) *
      (0.6 + 0.4 * Math.sin(9 * phi + 0.5));
  const around = (phi) =>
    Math.abs(Math.atan2(Math.sin(phi), Math.cos(phi))) / DEG;
  function scalp({
    thick,
    edge = hairlineAngle,
    curtain,
    bottom,
    flare,
    drift,
  }) {
    const cols = 96,
      upper = 28,
      lower = curtain ? 16 : 0,
      leave = 1.46;
    return grid(
      upper + lower,
      cols,
      (i, j) => {
        const phi = -Math.PI + (j / cols) * Math.PI * 2,
          fall = curtain ? curtain(phi) : 0,
          k = Math.min(1, i / upper);
        const theta = Math.max(
          0.0001,
          lerp(edge(phi), Math.max(leave, edge(phi)), fall) * k,
        );
        skullPoint(theta, phi, jaw, point);
        skullNormal(point, normal);
        point.addScaledVector(
          normal,
          0.0035 + thick(phi, theta) * lerp(1 - smooth(k, 0.76, 1), 1, fall),
        );
        let shade = strands(phi, theta);
        if (i > upper) {
          const s = (i - upper) / lower,
            f = 1 + flare(s, phi) * fall;
          point.set(
            point.x * f,
            lerp(point.y, lerp(point.y, bottom(phi), fall), s),
            point.z * f + drift(s, phi) * fall,
          );
          shade *= 1 - 0.14 * s;
        }
        return [point.x, point.y, point.z, shade];
      },
      { flip: true, colors: true, closed: true },
    );
  }
  // A lock of hair lying on the head. Its path is [degrees around, angle from
  // the crown, height above the skin]; the tip tapers to a soft point.
  function lock(path, width, seed = 0) {
    const curve = new THREE.CatmullRomCurve3(
      path.map(([d, t, lift]) => new THREE.Vector3(d * DEG, t, lift)),
    );
    const geo = grid(
      20,
      8,
      (i, j) => {
        const s = i / 20,
          u = (j / 8) * 2 - 1,
          q = curve.getPoint(s),
          d = curve.getTangent(s),
          st = Math.max(0.25, Math.sin(q.y));
        const dx = d.x * st,
          dy = d.y,
          length = Math.hypot(dx, dy) || 1,
          w = width * (1 - s ** 1.8) ** 0.8 * smooth(s, -0.05, 0.22);
        skullPoint(
          q.y + (u * w * dx) / length,
          q.x - (u * w * dy) / length / st,
          jaw,
          point,
        );
        skullNormal(point, normal);
        point.addScaledVector(
          normal,
          q.z + (0.016 * Math.sqrt(1 - u * u * 0.98) * w) / width,
        );
        return [
          point.x,
          point.y,
          point.z,
          (1.05 + 0.09 * Math.sin(u * 6 + seed * 2.1) - 0.1 * u * u) *
            (1 + 0.16 * Math.exp(-(((q.y - 0.6) / 0.16) ** 2))),
        ];
      },
      { colors: true },
    );
    return mesh(hair, geo, hairColor, "hair", "hair-lock", "vd");
  }
  // A tapering bundle of hair along a path: ponytails and loose ends.
  function tail(points, width, depth, name) {
    const curve = new THREE.CatmullRomCurve3(
        points.map((p) => new THREE.Vector3(...p)),
      ),
      steps = 40,
      sides = 16,
      frames = curve.computeFrenetFrames(steps, false);
    const geo = grid(
      steps,
      sides,
      (i, j) => {
        const t = i / steps,
          p = curve.getPointAt(t),
          size =
            lerp(0.62, 1, smooth(t, 0, 0.25)) *
            lerp(1, 0.5, smooth(t, 0.5, 0.95)) *
            Math.sqrt(Math.max(0.02, 1 - smooth(t, 0.9, 1) ** 2)),
          phi = (j / sides) * Math.PI * 2;
        p.addScaledVector(
          frames.normals[i],
          Math.cos(phi) * width * size,
        ).addScaledVector(frames.binormals[i], Math.sin(phi) * depth * size);
        return [
          p.x,
          p.y,
          p.z,
          1 +
            0.1 * Math.sin(phi * 5 + 1) +
            0.06 * Math.sin(phi * 11 + 2) -
            0.1 * t,
        ];
      },
      { colors: true, closed: true },
    );
    return mesh(hair, geo, hairColor, "hair", name, "vd");
  }
  if (a.hair !== "bald") {
    const T = {
      short: 0.036,
      side: 0.04,
      bob: 0.042,
      ponytail: 0.025,
      braids: 0.03,
      long: 0.038,
    }[a.hair];
    const part = (phi, theta, at, front = true) =>
      1 -
      0.5 *
        Math.exp(-(((phi - at) / 0.06) ** 2)) *
        (1 - smooth(theta, 0.5, 0.82)) *
        (front ? 1 : 0);
    let style;
    if (a.hair === "short")
      style = {
        thick: (phi, theta) =>
          T *
          (1 +
            0.32 *
              smooth(Math.cos(phi), -0.2, 1) *
              (1 - smooth(theta, 0.5, 1.1))),
      };
    if (a.hair === "side")
      style = {
        thick: (phi, theta) =>
          T *
          (1 +
            0.26 *
              smooth(Math.sin(phi + 0.3), -0.3, 1) *
              (1 - smooth(theta, 0.6, 1.3))) *
          part(phi, theta, -38 * DEG),
      };
    if (a.hair === "ponytail")
      style = {
        thick: (phi, theta) =>
          T *
          (1 +
            0.3 *
              smooth(-Math.cos(phi), 0, 1) *
              Math.exp(-(((theta - 1.2) / 0.4) ** 2))),
      };
    if (a.hair === "braids")
      style = { thick: (phi, theta) => T * part(phi, theta, 0) };
    if (a.hair === "bob")
      style = {
        thick: () => T,
        edge: (phi) => Math.max(hairlineAngle(phi), 1),
        curtain: (phi) => smooth(around(phi), 50, 68),
        bottom: () => -0.272,
        flare: (s) =>
          0.07 * Math.sin(Math.PI * s * 0.85) - 0.07 * smooth(s, 0.6, 1),
        drift: () => 0,
      };
    if (a.hair === "long")
      style = {
        thick: (phi, theta) => T * part(phi, theta, 0),
        curtain: (phi) => smooth(around(phi), 46, 64),
        bottom: (phi) => lerp(-0.41, -0.8, smooth(around(phi), 72, 128)),
        flare: (s, phi) =>
          0.05 * Math.sin(Math.PI * s) -
          0.06 * smooth(s, 0.7, 1) * smooth(around(phi), 100, 150),
        drift: (s, phi) => -0.09 * s * (1 - smooth(around(phi), 100, 150)),
      };
    mesh(hair, scalp(style), hairColor, "hair", "hair-scalp", "vd");
    if (a.hair === "short")
      for (let k = -3; k <= 3; k++) {
        // A short textured fringe brushed up and a little to one side.
        const f = k * 15,
          odd = Math.abs(k % 2);
        lock(
          [
            [f * 0.45 - 8, 0.3, T - 0.022],
            [f * 0.8 - 2, 0.58, T + 0.004],
            [f + 6, 0.84 + 0.05 * odd, 0.032],
            [f * 1.05 + 11, 0.98 - 0.02 * Math.abs(k) + 0.04 * odd, 0.022],
          ],
          0.17,
          k,
        );
      }
    if (a.hair === "side") {
      // Parted on one side, with the long side swept across the forehead.
      lock(
        [
          [-34, 0.3, T - 0.02],
          [-14, 0.52, T + 0.01],
          [14, 0.8, 0.036],
          [40, 1.02, 0.02],
        ],
        0.2,
        0,
      );
      lock(
        [
          [-36, 0.48, T - 0.02],
          [-20, 0.7, T + 0.01],
          [4, 0.93, 0.032],
          [28, 1.1, 0.018],
        ],
        0.2,
        1,
      );
      lock(
        [
          [-37, 0.64, T - 0.02],
          [-27, 0.84, T + 0.006],
          [-12, 1.02, 0.026],
          [6, 1.14, 0.016],
        ],
        0.16,
        2,
      );
      lock(
        [
          [-42, 0.4, T - 0.02],
          [-50, 0.7, T + 0.002],
          [-56, 0.98, 0.016],
        ],
        0.12,
        3,
      );
    }
    if (a.hair === "bob")
      for (let k = -4; k <= 4; k++) {
        // Full fringe resting just above the eyebrows.
        const f = k * 11;
        lock(
          [
            [f * 0.4, 0.3, T - 0.022],
            [f * 0.8, 0.64, T + 0.004],
            [f, 1.0, 0.026],
            [f * 1.02, 1.13 + 0.015 * Math.abs(k % 2), 0.016],
          ],
          0.16,
          k,
        );
      }
    if (a.hair === "long" || a.hair === "braids")
      for (const side of [-1, 1]) {
        // Centre parting with curtain bangs framing the face.
        const l = a.hair === "long";
        lock(
          [
            [side * 5, 0.3, T - 0.022],
            [side * 21, 0.54, T + 0.01],
            [side * 43, 0.87, 0.03],
            [side * 57, l ? 1.25 : 1.18, 0.024],
            ...(l ? [[side * 60, 1.6, 0.03]] : []),
          ],
          0.2,
          side,
        );
        lock(
          [
            [side * 8, 0.42, T - 0.02],
            [side * 30, 0.72, T + 0.006],
            [side * 50, 1.08, 0.022],
          ],
          0.14,
          side * 2,
        );
      }
    if (a.hair === "ponytail") {
      // Hair drawn back into a high ponytail; a soft fringe and two wisps remain.
      lock(
        [
          [-12, 0.42, T - 0.018],
          [4, 0.66, T + 0.008],
          [26, 0.9, 0.022],
          [44, 1.06, 0.014],
        ],
        0.17,
        0,
      );
      lock(
        [
          [-14, 0.56, T - 0.018],
          [-6, 0.76, T + 0.006],
          [8, 0.96, 0.02],
          [20, 1.08, 0.012],
        ],
        0.13,
        1,
      );
      lock(
        [
          [-20, 0.5, T - 0.018],
          [-34, 0.74, T + 0.004],
          [-46, 0.98, 0.014],
        ],
        0.1,
        2,
      );
      for (const side of [-1, 1])
        lock(
          [
            [side * 66, 1.34, 0.012],
            [side * 68, 1.62, 0.014],
            [side * 65, 1.93, 0.012],
          ],
          0.045,
          side,
        );
      ellipsoid(
        hair,
        0,
        0.115,
        -0.262,
        0.07,
        0.068,
        0.05,
        hairColor,
        "hair",
        "ponytail-knot",
      );
      tail(
        [
          [0, 0.115, -0.25],
          [0, 0.15, -0.345],
          [0, 0.04, -0.43],
          [0, -0.15, -0.44],
          [0.008, -0.32, -0.405],
          [0.016, -0.44, -0.375],
        ],
        0.088,
        0.078,
        "ponytail",
      );
      const tie = mesh(
        hair,
        new THREE.TorusGeometry(0.05, 0.013, 8, 24),
        c.hairTie,
        "cloth",
        "hair-tie",
      );
      tie.position.set(0, 0.138, -0.31);
      tie.rotation.x = 0.4;
    }
    if (a.hair === "braids")
      for (const side of [-1, 1]) {
        // Two plaits start behind the ears and rest on the front of the shoulders.
        const curve = new THREE.CatmullRomCurve3(
          [
            [0.212, -0.12, -0.1],
            [0.238, -0.25, -0.035],
            [0.218, -0.37, 0.085],
            [0.202, -0.5, 0.16],
            [0.196, -0.66, 0.176],
          ].map(([x, y, z]) => new THREE.Vector3(side * x, y, z)),
        );
        const knots = 26;
        for (let k = 0; k < knots; k++) {
          // Overlapping lobes leaning left and right form the plaited pattern.
          const t = (k / knots) * 0.9,
            p = curve.getPointAt(t),
            sway = k % 2 ? 1 : -1,
            size = 1 - 0.3 * t;
          const knot = ellipsoid(
            hair,
            p.x + sway * 0.014 * size,
            p.y,
            p.z,
            0.024 * size,
            0.037 * size,
            0.031 * size,
            hairColor,
            "hair",
            "braid-plait",
          );
          knot.rotation.z = sway * 0.75;
        }
        const end = curve.getPointAt(0.92),
          tip = curve.getPointAt(1);
        const tie = mesh(
          hair,
          new THREE.TorusGeometry(0.021, 0.009, 8, 20),
          c.hairTie,
          "cloth",
          "hair-tie",
        );
        tie.position.copy(end);
        tie.rotation.x = Math.PI / 2 - 0.2;
        ellipsoid(
          hair,
          tip.x,
          tip.y - 0.012,
          tip.z,
          0.02,
          0.04,
          0.02,
          hairColor,
          "hair",
          "braid-end",
        );
      }
  }
  if (female && a.hairAccessory !== "none") {
    skullPoint(0.86, 52 * DEG, jaw, point);
    skullNormal(point, normal);
    point.addScaledVector(normal, a.hair === "bald" ? 0.01 : 0.048);
    const accessory = group(head, point.x, point.y, point.z);
    accessory.name = "hair-accessory";
    accessory.quaternion
      .setFromUnitVectors(forward, normal)
      .multiply(new THREE.Quaternion().setFromAxisAngle(forward, -0.5));
    if (a.hairAccessory === "bow") {
      for (const side of [-1, 1]) {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.bezierCurveTo(
          side * 0.04,
          0.031,
          side * 0.096,
          0.059,
          side * 0.1,
          0.023,
        );
        shape.bezierCurveTo(side * 0.105, -0.023, side * 0.057, -0.044, 0, 0);
        mesh(
          accessory,
          new THREE.ExtrudeGeometry(shape, {
            depth: 0.012,
            bevelEnabled: true,
            bevelSize: 0.003,
            bevelThickness: 0.003,
            bevelSegments: 2,
            steps: 1,
          }),
          c.hairAccessory,
        );
        line(
          accessory,
          [
            [side * 0.014, -0.009, 0.006],
            [side * 0.026, -0.05, 0.009],
            [side * 0.048, -0.089, 0.005],
          ],
          c.hairAccessory,
          0.012,
        );
      }
      ellipsoid(
        accessory,
        0,
        0,
        0.012,
        0.019,
        0.021,
        0.017,
        tint(c.hairAccessory, 0.9),
      );
    } else {
      line(
        accessory,
        [
          [-0.055, 0, 0],
          [0, 0.006, 0.009],
          [0.055, 0, 0],
        ],
        c.hairAccessory,
        0.012,
        "cloth",
        "barrette",
      );
      for (let i = 0; i < 3; i++)
        ellipsoid(
          accessory,
          -0.028 + i * 0.028,
          0.004,
          0.017,
          0.007,
          0.007,
          0.005,
          mix(c.hairAccessory, "#ffffff", 0.6),
          "cloth",
        );
    }
  }
  if (a.necklace) {
    // The chain drapes over the chest and passes behind the neck.
    const points = [],
      reach = 0.08 * slim;
    for (let i = 0; i <= 24; i++) {
      const u = (i / 24) * 2 - 1;
      points.push(onShirt(u * reach, 0.805 - 0.2 * (1 - u * u) ** 0.75, 0.005));
    }
    const join = points[0][2];
    for (let i = 1; i < 16; i++) {
      const t = (i / 16) * Math.PI;
      points.push([
        reach * Math.cos(t),
        0.812,
        join - (join + 0.07) * Math.sin(t),
      ]);
    }
    line(body, points, c.necklace, 0.0034, "metal", "necklace", true);
    const pendant = mesh(
      body,
      new THREE.TorusGeometry(0.019, 0.005, 8, 24),
      c.necklace,
      "metal",
      "pendant",
    );
    pendant.position.set(...onShirt(0, 0.587, 0.01));
  }
  // The long hem of the tunic folds up over the lap when sitting.
  const garments = [];
  if (tunic)
    shirt.traverse((piece) => {
      if (!piece.isMesh || piece.geometry === sphere) return;
      piece.geometry.computeBoundingBox();
      if (piece.geometry.boundingBox.min.y >= 0.18) return;
      const seated = piece.geometry.attributes.position.clone();
      for (let i = 0; i < seated.count; i++) {
        const y = seated.getY(i),
          fold = smooth(0.18 - y, 0, 0.4);
        seated.setXYZ(
          i,
          seated.getX(i) * (1 + fold * 0.18),
          y + fold * 0.27,
          seated.getZ(i) * (1 + fold * 0.15),
        );
      }
      piece.geometry.morphAttributes.position = [seated];
      piece.updateMorphTargets();
      garments.push(piece);
    });

  // ---------------------------------------------------------------- limbs
  // Continuous skinned surfaces: no gaps at the elbow, knee or garment cuff.
  // `profile` lists [distance from the joint, radius, bare skin from here?].
  function limb(parent, bones, lengths, profile, color, name, flat = 0.88) {
    const [start, joint, end] = bones,
      [upper, lower] = lengths,
      total = upper + lower,
      cap = profile[0][1] * 0.96,
      sides = 24;
    const stops = [];
    for (let k = 0; k < 6; k++)
      stops.push(-cap * Math.cos(((k / 6) * Math.PI) / 2));
    for (let k = 0; k <= 44; k++) stops.push((k / 44) * total);
    for (const [d] of profile) stops.push(d);
    stops.push(total + 0.012, total + 0.02);
    stops.sort((p, q) => p - q);
    const rows = stops.filter((d, i) => i === 0 || d - stops[i - 1] > 1e-5);
    const at = (d) => {
      let i = 0;
      while (i < profile.length - 2 && profile[i + 1][0] <= d) i++;
      const p = profile[i],
        q = profile[i + 1];
      return {
        radius: lerp(p[1], q[1], clamp((d - p[0]) / (q[0] - p[0]), 0, 1)),
        bare: !!(d >= q[0] ? q[2] : p[2]),
      };
    };
    const skinIndices = [],
      weights = [];
    const geo = grid(
      rows.length - 1,
      sides,
      (i, j) => {
        const d = rows[i],
          phi = (j / sides) * Math.PI * 2;
        const tip =
            d < 0
              ? Math.sqrt(Math.max(0, 1 - (d / cap) ** 2))
              : d > total
                ? Math.sqrt(Math.max(0.01, 1 - ((d - total) / 0.021) ** 2))
                : 1,
          radius = at(Math.max(0, d)).radius * tip;
        let index = 0,
          blend = smooth(d, upper - 0.075, upper + 0.075);
        if (d > total - 0.06) {
          index = 1;
          blend = smooth(d, total - 0.06, total + 0.015);
        }
        skinIndices.push(index, index + 1, 0, 0);
        weights.push(1 - blend, blend, 0, 0);
        return [
          start.position.x + Math.cos(phi) * radius,
          start.position.y - d,
          start.position.z + Math.sin(phi) * radius * flat,
        ];
      },
      { closed: true },
    );
    // One draw group per stretch of cloth or skin.
    let from = 0,
      bare = false;
    for (let i = 0; i < rows.length - 1; i++) {
      const next = at(Math.max(0, (rows[i] + rows[i + 1]) / 2)).bare;
      if (next !== bare) {
        if (i > from)
          geo.addGroup(from * sides * 6, (i - from) * sides * 6, bare ? 1 : 0);
        from = i;
        bare = next;
      }
    }
    geo.addGroup(
      from * sides * 6,
      (rows.length - 1 - from) * sides * 6,
      bare ? 1 : 0,
    );
    geo.setAttribute(
      "skinIndex",
      new THREE.Uint16BufferAttribute(skinIndices, 4),
    );
    geo.setAttribute(
      "skinWeight",
      new THREE.Float32BufferAttribute(weights, 4),
    );
    const m = new THREE.SkinnedMesh(geo, [mat(color), mat(c.skin, "skin")]);
    m.name = name;
    parent.add(m);
    root.updateMatrixWorld(true);
    m.bind(new THREE.Skeleton([start, joint, end]));
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    return m;
  }
  const band = (y1, y2, r, flat = 0.88) =>
    tailored(
      [
        [y1, r, r * flat, r * flat],
        [y2, r, r * flat, r * flat],
      ],
      24,
    );
  const arms = [],
    elbows = [],
    wrists = [];
  for (const side of [-1, 1]) {
    const arm = bone(body, side * shoulder, 0.655, 0),
      elbow = bone(arm, 0, -rig.armUpper, 0),
      wrist = bone(elbow, 0, -rig.armLower, 0),
      k = slim;
    const sleeve = short
      ? [
          [0, 0.079 * k, 0],
          [0.07, 0.09 * k, 0],
          [0.2, 0.088 * k, 0],
          [0.2005, 0.058 * k, 1],
          [0.34, 0.053 * k, 1],
          [0.44, 0.052 * k, 1],
          [0.63, 0.038 * k, 1],
        ]
      : tunic
        ? [
            [0, 0.079 * k, 0],
            [0.07, 0.089 * k, 0],
            [0.17, 0.084 * k, 0],
            [0.34, 0.078 * k, 0],
            [0.5, 0.075 * k, 0],
            [0.63, 0.074 * k, 0],
          ]
        : [
            [0, 0.078 * k, 0],
            [0.07, 0.087 * k, 0],
            [0.17, 0.08 * k, 0],
            [0.34, 0.071 * k, 0],
            [0.5, 0.064 * k, 0],
            [0.63, 0.058 * k, 0],
          ];
    limb(
      body,
      [arm, elbow, wrist],
      [rig.armUpper, rig.armLower],
      sleeve,
      c.shirt,
      "sleeve-and-arm",
    );
    // Cuffs ride on the bones, so they follow walking and prayer poses.
    if (short)
      mesh(
        arm,
        band(-0.178, -0.2, 0.0895 * k),
        seam,
        "cloth",
        "short-sleeve-hem",
      );
    else if (tunic)
      mesh(wrist, band(0.03, 0.004, 0.0755 * k), seam, "cloth", "sleeve-cuff");
    else {
      mesh(wrist, band(0.05, 0.004, 0.0605 * k), edge, "cloth", "sleeve-cuff");
      ellipsoid(
        wrist,
        side * 0.058 * k,
        0.027,
        0.012,
        0.007,
        0.007,
        0.004,
        button,
        "cloth",
        "cuff-button",
      );
    }
    ellipsoid(
      wrist,
      0,
      -0.05,
      0.01,
      0.042 * k,
      0.064 * k,
      0.025,
      c.skin,
      "skin",
      "hand",
    );
    ellipsoid(
      wrist,
      0,
      -0.098 * k,
      0.012,
      0.034 * k,
      0.03 * k,
      0.02,
      c.skin,
      "skin",
      "fingers",
    );
    const thumb = ellipsoid(
      wrist,
      -side * 0.038 * k,
      -0.04,
      0.024,
      0.015,
      0.036,
      0.018,
      c.skin,
      "skin",
      "thumb",
    );
    thumb.rotation.z = -side * 0.35;
    arms.push(arm);
    elbows.push(elbow);
    wrists.push(wrist);
  }
  const pelvis = [
    [0.075, hip - 0.004, 0.134, 0.14],
    [0.01, hip, 0.138, 0.142],
    [-0.06, 0.226, 0.116, 0.118],
    [-0.105, 0.16, 0.072, 0.076],
    [-0.126, 0.02, 0.01, 0.01],
  ].map(([y, ...rest]) => [rig.hipHeight + y, ...rest]);
  mesh(root, tailored(resample(pelvis, 24)), c.pants, "cloth", "trouser-waist");
  const waistband = mesh(
    root,
    tailored([
      [rig.hipHeight + 0.076, hip - 0.002, 0.136, 0.142],
      [rig.hipHeight + 0.044, hip + 0.002, 0.14, 0.145],
    ]),
    tint(c.pants, 0.86),
  );
  waistband.name = "waistband";
  const legs = [],
    knees = [],
    ankles = [],
    footMeshes = [];
  const wide = a.pants === "wide",
    shorts = a.pants === "shorts",
    cuff = tint(c.pants, 0.8);
  for (const side of [-1, 1]) {
    const leg = bone(root, side * 0.125, rig.hipHeight, 0),
      knee = bone(leg, 0, -rig.legUpper, 0),
      ankle = bone(knee, 0, -rig.legLower, 0);
    const trouser = wide
      ? [
          [0, 0.114, 0],
          [0.2, 0.12, 0],
          [0.4, 0.127, 0],
          [0.6, 0.134, 0],
          [0.725, 0.138, 0],
          [0.7255, 0.05, 1],
          [0.78, 0.044, 1],
        ]
      : shorts
        ? [
            [0, 0.112, 0],
            [0.2, 0.108, 0],
            [0.4, 0.101, 0],
            [0.5, 0.099, 0],
            [0.5005, 0.064, 1],
            [0.58, 0.067, 1],
            [0.7, 0.05, 1],
            [0.78, 0.044, 1],
          ]
        : [
            [0, 0.112, 0],
            [0.2, 0.105, 0],
            [0.4, 0.093, 0],
            [0.6, 0.084, 0],
            [0.78, 0.077, 0],
          ];
    limb(
      root,
      [leg, knee, ankle],
      [rig.legUpper, rig.legLower],
      trouser,
      c.pants,
      "trouser-leg",
      wide ? 0.94 : 0.88,
    );
    if (wide)
      mesh(knee, band(-0.3, -0.326, 0.139, 0.94), cuff, "cloth", "trouser-hem");
    else if (shorts)
      mesh(knee, band(-0.076, -0.101, 0.1005), cuff, "cloth", "shorts-hem");
    else mesh(ankle, band(0.052, 0.02, 0.0785), cuff, "cloth", "trouser-hem");
    // The invisible analytic ellipsoid is used only by the ground solver; the
    // visible shoe has its own sole, toe box and collar.
    const support = ellipsoid(
      ankle,
      0,
      -0.025,
      0.052,
      0.086,
      0.055,
      0.137,
      c.shoes,
    );
    support.visible = false;
    footMeshes.push(support);
    const heel = -0.084,
      toe = 0.188,
      sneakers = a.shoes === "sneakers",
      sandals = a.shoes === "sandals";
    const soleTop = sneakers ? -0.046 : sandals ? -0.057 : -0.058,
      soleColor = sneakers ? c.shoeTrim : tint(c.shoes, 0.58);
    const sole = mesh(
      ankle,
      loft([
        closedRing(soleTop, 0.052),
        footRing(soleTop, 0.081, heel - 0.002, toe + 0.002),
        footRing(soleTop - 0.01, 0.084, heel - 0.004, toe + 0.004),
        footRing(-0.079, 0.081, heel - 0.002, toe + 0.002),
        closedRing(-0.08, 0.052),
      ]),
      soleColor,
      "sole",
      "shoe-outsole",
    );
    if (sandals) {
      // Dép quai: bare foot with toes on a flat footbed, held by three straps.
      mesh(
        ankle,
        loft([
          closedRing(soleTop + 0.006, 0.052),
          footRing(soleTop + 0.006, 0.076, heel + 0.004, toe - 0.004),
          footRing(soleTop, 0.079, heel, toe),
        ]),
        c.shoes,
        "shoe",
        "sandal-footbed",
      );
      mesh(
        ankle,
        loft([
          footRing(0.03, 0.045, -0.058, 0.036),
          footRing(0.012, 0.05, -0.066, 0.062),
          footRing(-0.01, 0.058, -0.07, 0.104),
          footRing(-0.032, 0.066, -0.073, 0.128),
          footRing(-0.052, 0.064, -0.07, 0.124),
        ]),
        c.skin,
        "skin",
        "sandal-foot",
      );
      for (let k = 0; k < 5; k++) {
        // Big toe on the inside of each foot.
        ellipsoid(
          ankle,
          -side * (0.046 - k * 0.0235),
          -0.04 + k * 0.0012,
          0.139 - k * 0.0085,
          0.0185 - k * 0.002,
          0.0145 - k * 0.0014,
          0.03 - k * 0.003,
          c.skin,
          "skin",
          "toe",
        );
      }
      for (const [z, top] of [
        [0.1, -0.006],
        [0.03, 0.027],
      ]) {
        const strap = line(
          ankle,
          [
            [-0.079, -0.057, 0],
            [-0.068, -0.026 + top * 0.3, 0],
            [-0.04, top - 0.012, 0],
            [0, top + 0.004, 0],
            [0.04, top - 0.012, 0],
            [0.068, -0.026 + top * 0.3, 0],
            [0.079, -0.057, 0],
          ],
          c.shoes,
          0.0075,
          "shoe",
          "sandal-strap",
        );
        strap.position.z = z;
        strap.scale.z = 2.7;
      }
      line(
        ankle,
        [
          [-0.064, -0.006, 0.022],
          [-0.058, 0.006, -0.045],
          [0, 0.012, -0.079],
          [0.058, 0.006, -0.045],
          [0.064, -0.006, 0.022],
        ],
        c.shoes,
        0.0085,
        "shoe",
        "sandal-heel-strap",
      );
      ellipsoid(
        ankle,
        side * 0.07,
        -0.012,
        0.03,
        0.008,
        0.014,
        0.012,
        c.necklace,
        "metal",
        "sandal-buckle",
      );
    } else {
      const collar = sneakers ? 0.06 : 0.044,
        top = soleTop - 0.002;
      mesh(
        ankle,
        loft([
          footRing(collar, 0.052, heel + 0.012, sneakers ? 0.04 : 0.03),
          footRing(collar - 0.016, 0.058, heel + 0.007, 0.066),
          footRing(top + 0.066, 0.066, heel + 0.003, 0.118),
          footRing(top + 0.046, 0.074, heel, toe - 0.03),
          footRing(top + 0.022, 0.081, heel - 0.001, toe - 0.005),
          footRing(top, 0.08, heel, toe),
        ]),
        c.shoes,
        "shoe",
        "shoe-upper",
      );
      ellipsoid(
        ankle,
        0,
        collar - 0.012,
        (heel + 0.012 + (sneakers ? 0.04 : 0.03)) / 2,
        0.047,
        0.008,
        0.052,
        tint(c.shoes, 0.45),
        "shoe",
        "shoe-lining",
      );
      const rim = [];
      for (let j = 0; j < 32; j++) {
        const t = (j / 32) * Math.PI * 2,
          s = Math.sin(t),
          z0 = heel + 0.012,
          z1 = sneakers ? 0.04 : 0.03;
        rim.push([
          0.052 * Math.cos(t) * (1 + 0.15 * s),
          collar,
          (z0 + z1) / 2 + ((z1 - z0) / 2) * s,
        ]);
      }
      line(
        ankle,
        rim,
        tint(c.shoes, 0.7),
        sneakers ? 0.0065 : 0.0045,
        "shoe",
        "shoe-opening",
        true,
      );
      if (sneakers) {
        // Rubber toe cap, laces, a side stripe and a heel tab.
        mesh(
          ankle,
          loft([
            closedRing(top + 0.042, 0.166),
            footRing(top + 0.04, 0.056, 0.142, toe - 0.03),
            footRing(top + 0.02, 0.078, 0.13, toe - 0.004),
            footRing(top, 0.083, 0.124, toe + 0.002),
          ]),
          c.shoeTrim,
          "sole",
          "toe-cap",
        );
        for (let i = 0; i < 4; i++) {
          const z = 0.04 + i * 0.022,
            y = top + 0.092 - i * 0.011;
          line(
            ankle,
            [
              [-0.036, y - 0.008, z],
              [0, y + 0.002, z + 0.004],
              [0.036, y - 0.008, z],
            ],
            c.shoeTrim,
            0.0038,
            "cloth",
            "shoelace",
          );
        }
        for (const s of [-1, 1])
          line(
            ankle,
            [
              [s * 0.068, top + 0.05, -0.03],
              [s * 0.079, top + 0.026, 0.03],
              [s * 0.083, top + 0.016, 0.09],
            ],
            c.shoeTrim,
            0.0045,
            "shoe",
            "shoe-stripe",
          );
        ellipsoid(
          ankle,
          0,
          collar - 0.024,
          heel + 0.009,
          0.012,
          0.02,
          0.005,
          c.shoeTrim,
          "shoe",
          "heel-tab",
        );
      } else {
        // Cloth shoe: elastic gussets beside the throat and a stitched vamp.
        for (const s of [-1, 1])
          line(
            ankle,
            [
              [s * 0.05, collar - 0.002, 0.018],
              [s * 0.061, collar - 0.02, 0.04],
              [s * 0.064, collar - 0.034, 0.066],
            ],
            tint(c.shoes, 0.6),
            0.0042,
            "shoe",
            "elastic-gusset",
          );
        line(
          ankle,
          [
            [-0.066, top + 0.03, 0.1],
            [-0.04, top + 0.052, 0.122],
            [0, top + 0.06, 0.13],
            [0.04, top + 0.052, 0.122],
            [0.066, top + 0.03, 0.1],
          ],
          mix(c.shoes, c.shoeTrim, 0.22),
          0.0026,
          "shoe",
          "shoe-stitching",
        );
      }
    }
    sole.userData.shoeStyle = a.shoes;
    legs.push(leg);
    knees.push(knee);
    ankles.push(ankle);
  }
  const heldIncense = group(body, 0, 0.65, 0.58);
  heldIncense.name = "held-incense";
  const stick = mesh(
    heldIncense,
    new THREE.CylinderGeometry(0.006, 0.006, 0.52, 8),
    "#ab7852",
  );
  stick.position.y = 0.24;
  ellipsoid(heldIncense, 0, 0.505, 0, 0.01, 0.016, 0.01, "#e8a062");
  heldIncense.visible = false;
  const pixels = new Uint8Array(32 * 32 * 4);
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const r = Math.hypot((x - 15.5) / 16, (y - 15.5) / 16),
        i = (y * 32 + x) * 4;
      pixels[i] = 58;
      pixels[i + 1] = 62;
      pixels[i + 2] = 43;
      pixels[i + 3] = Math.round(Math.max(0, 1 - r) ** 2 * 140);
    }
  const map = new THREE.DataTexture(pixels, 32, 32, THREE.RGBAFormat);
  map.needsUpdate = true;
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.86, 0.6),
    new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  root.add(shadow);
  const down = new THREE.Vector3(0, -1, 0);
  const seatedLegs = [-1, 1].map((side) => {
    const upper = new THREE.Quaternion().setFromUnitVectors(
      down,
      new THREE.Vector3(side * 0.7, -0.12, 0.7).normalize(),
    );
    const lower = new THREE.Quaternion().setFromUnitVectors(
      down,
      new THREE.Vector3(-side * 0.98, -0.1, 0.15).normalize(),
    );
    const foot = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      -side * 1.3,
    );
    return {
      upper,
      knee: upper.clone().invert().multiply(lower),
      ankle: lower.clone().invert().multiply(foot),
    };
  });
  const seatedArms = [-1, 1].map((side) => {
    const upper = new THREE.Quaternion().setFromUnitVectors(
      down,
      new THREE.Vector3(side * 0.1, -0.3, 0.64).normalize(),
    );
    const lower = new THREE.Quaternion().setFromUnitVectors(
      down,
      new THREE.Vector3(-side * 0.95, side * 0.16, 0.27).normalize(),
    );
    return { upper, elbow: upper.clone().invert().multiply(lower) };
  });
  const sofaLegs = [-1, 1].map((side) => {
    const upper = new THREE.Quaternion().setFromUnitVectors(
      down,
      new THREE.Vector3(side * 0.08, -0.1, 0.99).normalize(),
    );
    return {
      upper,
      knee: upper.clone().invert(),
      ankle: new THREE.Quaternion(),
    };
  });
  const sofaArms = [-1, 1].map((side) => ({
    upper: new THREE.Quaternion().setFromEuler(
      new THREE.Euler(-0.22, 0, -side * 0.5),
    ),
    elbow: new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.15, 0, 0)),
  }));
  const seed = JSON.stringify(a)
    .split("")
    .reduce((s, char) => (s * 31 + char.charCodeAt(0)) % 2147483647, 19);
  return {
    root,
    body,
    head,
    shirt,
    garment,
    garments,
    hair,
    eyes,
    tail: null,
    arms,
    elbows,
    wrists,
    legs,
    knees,
    ankles,
    seatedLegs,
    seatedArms,
    sofaLegs,
    sofaArms,
    footMeshes,
    footMatrix: new THREE.Matrix4(),
    inverseRoot: new THREE.Matrix4(),
    heldIncense,
    shadow,
    motion: createAvatarMotion(seed),
    appearance: a,
    signature: JSON.stringify(a),
    heading: Math.PI,
    geometries,
    materials,
    rig,
  };
}

export function drawHumanPortrait(ctx, a) {
  const c = a.colors,
    haired = a.hair !== "bald",
    female = a.gender === "female";
  const fill = (color, path) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    path();
    ctx.fill();
  };
  const shade = (color, other, amount) =>
    new THREE.Color(color).lerp(new THREE.Color(other), amount).getStyle();
  // Hair that falls behind the head and shoulders.
  if (a.hair === "long")
    fill(c.hair, () => {
      ctx.moveTo(14, 26);
      ctx.bezierCurveTo(12, 6, 48, 6, 46, 26);
      ctx.bezierCurveTo(49, 44, 50, 58, 50, 68);
      ctx.lineTo(10, 68);
      ctx.bezierCurveTo(10, 58, 11, 44, 14, 26);
    });
  if (a.hair === "bob")
    fill(c.hair, () => {
      ctx.moveTo(14, 26);
      ctx.bezierCurveTo(12, 6, 48, 6, 46, 26);
      ctx.bezierCurveTo(49, 36, 48, 44, 43, 46);
      ctx.lineTo(17, 46);
      ctx.bezierCurveTo(12, 44, 11, 36, 14, 26);
    });
  if (a.hair === "ponytail")
    fill(c.hair, () => {
      ctx.moveTo(40, 12);
      ctx.bezierCurveTo(54, 8, 56, 26, 50, 42);
      ctx.bezierCurveTo(50, 30, 46, 22, 40, 18);
    });
  fill(c.shirt, () => {
    ctx.moveTo(6, 72);
    ctx.lineTo(9, 58);
    ctx.quadraticCurveTo(11, 52, 24, 49);
    ctx.lineTo(36, 49);
    ctx.quadraticCurveTo(49, 52, 51, 58);
    ctx.lineTo(54, 72);
  });
  fill(c.skin, () => ctx.roundRect(25.5, 40, 9, 13, 3));
  if (a.shirt === "tunic")
    fill(shade(c.shirt, "#f4ecdc", 0.3), () => {
      ctx.moveTo(24, 47);
      ctx.lineTo(36, 47);
      ctx.lineTo(36.5, 51);
      ctx.lineTo(23.5, 51);
    });
  // Face with a softly tapered jaw.
  fill(c.skin, () => {
    ctx.moveTo(16, 26);
    ctx.bezierCurveTo(15, 8, 45, 8, 44, 26);
    ctx.bezierCurveTo(44, 38, 37, 46, 30, 46);
    ctx.bezierCurveTo(23, 46, 16, 38, 16, 26);
  });
  for (const x of [15.5, 44.5])
    fill(c.skin, () => ctx.ellipse(x, 29, 1.8, 3, 0, 0, Math.PI * 2));
  if (haired) {
    const fringe = {
      short: () => {
        ctx.lineTo(42, 19);
        ctx.quadraticCurveTo(36, 22, 31, 17);
        ctx.quadraticCurveTo(25, 23, 18, 20);
      },
      side: () => {
        ctx.lineTo(43, 24);
        ctx.quadraticCurveTo(34, 24, 24, 13);
        ctx.quadraticCurveTo(21, 18, 17, 21);
      },
      bob: () => {
        ctx.lineTo(44, 24);
        ctx.quadraticCurveTo(30, 21, 16, 24);
      },
      ponytail: () => {
        ctx.lineTo(43, 21);
        ctx.quadraticCurveTo(34, 21, 26, 14);
        ctx.quadraticCurveTo(21, 18, 17, 22);
      },
      braids: () => {
        ctx.lineTo(44, 25);
        ctx.quadraticCurveTo(36, 20, 30, 11);
        ctx.quadraticCurveTo(24, 20, 16, 25);
      },
      long: () => {
        ctx.lineTo(45, 30);
        ctx.quadraticCurveTo(37, 21, 30, 11);
        ctx.quadraticCurveTo(23, 21, 15, 30);
      },
    }[a.hair];
    fill(c.hair, () => {
      ctx.moveTo(15, 27);
      ctx.bezierCurveTo(11, 3, 49, 3, 45, 27);
      fringe();
      ctx.closePath();
    });
    ctx.strokeStyle = shade(c.hair, "#cdbba3", 0.22);
    ctx.lineWidth = 0.6;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(24 + i * 4, 10.5);
      ctx.quadraticCurveTo(22 + i * 5, 13.5, 20 + i * 6, 17);
      ctx.stroke();
    }
    if (a.hair === "braids")
      for (const x of [15, 45]) {
        for (let i = 0; i < 5; i++)
          fill(c.hair, () =>
            ctx.ellipse(
              x + (i % 2 ? 0.8 : -0.8),
              34 + i * 5,
              2.6,
              3.2,
              0,
              0,
              Math.PI * 2,
            ),
          );
        fill(c.hairTie, () => ctx.roundRect(x - 2.2, 57, 4.4, 2, 1));
      }
    if (a.hair === "ponytail")
      fill(c.hairTie, () =>
        ctx.ellipse(43, 14, 1.6, 2.4, -0.6, 0, Math.PI * 2),
      );
  }
  for (const x of [23.5, 36.5]) {
    fill("#fffaf0", () => ctx.ellipse(x, 29.5, 2.7, 3.1, 0, 0, Math.PI * 2));
    fill("#4a3324", () => ctx.ellipse(x, 29.7, 1.9, 2.5, 0, 0, Math.PI * 2));
    fill("#1c1512", () => ctx.ellipse(x, 29.8, 1, 1.4, 0, 0, Math.PI * 2));
    fill("#ffffff", () =>
      ctx.ellipse(x - 0.7, 28.6, 0.65, 0.8, 0, 0, Math.PI * 2),
    );
    ctx.strokeStyle = shade(c.hair, "#1c1512", 0.6);
    ctx.lineWidth = female ? 0.9 : 0.7;
    ctx.beginPath();
    ctx.moveTo(x - 2.9, 28.6);
    ctx.quadraticCurveTo(x, 25.2, x + 2.9, 28.6);
    ctx.stroke();
    ctx.strokeStyle = c.hair;
    ctx.lineWidth = female ? 0.75 : 1;
    ctx.beginPath();
    ctx.moveTo(x - 3, 23.6);
    ctx.quadraticCurveTo(x, female ? 21.8 : 22.6, x + 3, 23.4);
    ctx.stroke();
    fill(shade(c.skin, "#ec8e8b", female ? 0.42 : 0.26), () =>
      ctx.ellipse(x + (x < 30 ? -2.6 : 2.6), 34.2, 2.3, 1.3, 0, 0, Math.PI * 2),
    );
  }
  fill(shade(c.skin, "#b47a62", 0.3), () =>
    ctx.ellipse(30, 34.3, 1, 0.75, 0, 0, Math.PI * 2),
  );
  ctx.strokeStyle = shade(c.skin, female ? "#b8505c" : "#9a5a52", 0.75);
  ctx.lineWidth = 0.85;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(27, 38.3);
  ctx.quadraticCurveTo(30, 40.2, 33, 38.3);
  ctx.stroke();
  ctx.strokeStyle = shade(c.shirt, "#f4ecdc", 0.35);
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (a.shirt === "short") {
    ctx.moveTo(24, 49.5);
    ctx.quadraticCurveTo(30, 55, 36, 49.5);
  } else if (a.shirt === "long") {
    ctx.moveTo(24.5, 49);
    ctx.lineTo(30, 55);
    ctx.lineTo(35.5, 49);
    ctx.moveTo(30, 55);
    ctx.lineTo(30, 72);
  } else {
    ctx.moveTo(30, 51);
    ctx.lineTo(30, 72);
    for (const y of [56, 63]) ctx.rect(28, y, 4, 0.2);
  }
  ctx.stroke();
  if (female && a.hairAccessory !== "none") {
    fill(c.hairAccessory, () => {
      if (a.hairAccessory === "clip") ctx.roundRect(37, 14, 8, 2.6, 1);
      else {
        ctx.moveTo(41, 15);
        ctx.lineTo(36, 11);
        ctx.lineTo(36, 19);
        ctx.lineTo(46, 11);
        ctx.lineTo(46, 19);
        ctx.closePath();
      }
    });
  }
  if (a.necklace) {
    ctx.strokeStyle = c.necklace;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(24.5, 51);
    ctx.quadraticCurveTo(30, 62, 35.5, 51);
    ctx.stroke();
  }
}
