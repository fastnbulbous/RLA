// GLSL source for instanced SDF rendering of polygon/circle/capsule/dot shapes.
// sides == 0 → circle, sides == 2 → capsule/digon, sides == 1 → dot, sides >= 3 → regular polygon

export const VERT_SRC = /* glsl */`#version 300 es
precision highp float;

// Unit quad: two triangles covering [-1,1]^2
const vec2 QUAD[4] = vec2[4](
  vec2(-1.0, -1.0),
  vec2( 1.0, -1.0),
  vec2(-1.0,  1.0),
  vec2( 1.0,  1.0)
);

// Per-instance attributes
in vec2  a_centre;        // world-space centre
in float a_radius;        // circumradius in world units
in float a_rotation;      // radians
in vec3  a_colour;        // linear RGB (fill colour)
in float a_alpha;
in float a_strokePx;      // stroke width in pixels (0 = fill only)
in float a_fillMix;       // 0 = outline only, 1 = fill only, 0.5 = both
in uint  a_sides;         // 0=circle, 1=dot, 2=capsule, >=3=polygon
in float a_dotRadius;     // end-dot radius in world units (0 = no dot)
in vec3  a_outlineColour; // separate outline colour (used in fillMode 5)
in float a_depth;         // normalized layer depth 0..1 (for depth-fade)
in float a_emboss;
in float a_pattern;
in float a_seed;

// Uniforms
uniform vec2  u_pan;       // world offset
uniform float u_zoom;      // world units per pixel (inverse scale)
uniform float u_globalRot; // radians
uniform vec2  u_viewport;  // canvas size in CSS pixels
uniform int   u_fillMode;  // 0=both,1=fill,2=outline,3=neon,4=gradient,5=outline≠fill,6=depth-fade

// Varyings
out vec2  v_local;        // local coordinates (radius = 1 space)
out vec3  v_colour;
out vec3  v_outlineCol;
out float v_depth;
out float v_alpha;
out float v_strokeWorld;  // stroke in local (radius=1) units
out float v_fillMix;
out vec2  v_worldCentre;
out vec2  v_worldPos;
flat out uint  v_sides;
flat out float v_dotRadius; // dot radius in local units
flat out int   v_fillMode;
flat out float v_emboss;
flat out float v_pattern;
flat out float v_seed;
flat out float v_radius;
flat out vec2  v_centre;

void main() {
  vec2 q = QUAD[gl_VertexID];

  // Rotate the whole structure: apply globalRot to both centre position and shape orientation
  float gc = cos(u_globalRot), gs = sin(u_globalRot);
  vec2 centre = vec2(gc * a_centre.x - gs * a_centre.y,
                     gs * a_centre.x + gc * a_centre.y);
  float rot = a_rotation + u_globalRot;

  float pxPad = 1.0 / (a_radius / u_zoom);
  float halfSz = 1.0 + pxPad + a_strokePx / (a_radius / u_zoom) * 0.5 + 0.02;

  v_local = q * halfSz;

  vec2 localWorld = v_local * a_radius;
  float c = cos(rot), s = sin(rot);
  vec2 rotated = vec2(c * localWorld.x - s * localWorld.y,
                      s * localWorld.x + c * localWorld.y);

  // Apply pan and zoom using rotated centre
  vec2 worldPos = centre + rotated + u_pan;
  vec2 ndc = worldPos / (u_viewport * 0.5 * u_zoom);
  // Flip Y: canvas Y-down, NDC Y-up
  ndc.y = -ndc.y;

  gl_Position = vec4(ndc, 0.0, 1.0);

  v_colour      = a_colour;
  v_outlineCol  = a_outlineColour;
  v_depth       = a_depth;
  v_alpha       = a_alpha;
  v_strokeWorld = a_strokePx * u_zoom / a_radius;
  v_fillMix     = a_fillMix;
  v_worldCentre = centre;
  v_worldPos    = centre + rotated;
  v_sides       = a_sides;
  v_dotRadius   = a_dotRadius / a_radius;
  v_fillMode    = u_fillMode;
  v_emboss  = a_emboss;
  v_pattern = a_pattern;
  v_seed    = a_seed;
  v_radius  = a_radius;
  v_centre  = a_centre;
}
`;

export const FRAG_SRC = /* glsl */`#version 300 es
precision highp float;

in vec2  v_local;
in vec3  v_colour;
in vec3  v_outlineCol;
in float v_depth;
in float v_alpha;
in float v_strokeWorld;
in float v_fillMix;
in vec2  v_worldCentre;
in vec2  v_worldPos;
flat in uint  v_sides;
flat in float v_dotRadius;
flat in int   v_fillMode;
flat in float v_emboss;
flat in float v_pattern;
flat in float v_seed;
flat in float v_radius;
flat in vec2  v_centre;

uniform float u_emissive;
uniform float u_embossOn;
uniform float u_embossStrength;
uniform float u_spotlightOn;
uniform vec2  u_lightPos;
uniform float u_spotFalloff;
uniform float u_time;
uniform vec2  u_pan;
uniform float u_textureOn;
uniform int   u_textureStyle;
uniform int   u_textureSwimMode;

out vec4 fragColour;

// ── SDF primitives (Inigo Quilez) ─────────────────────────────────────────

float sdCircle(vec2 p, float r) {
  return length(p) - r;
}

float sdRegularPolygon(vec2 p, float r, int n) {
  float ang = 6.28318530718 / float(n);
  float a = atan(p.y, p.x) - 1.5707963;
  a = mod(a, ang) - 0.5 * ang;
  return length(p) * cos(a) - r * cos(3.14159265359 / float(n));
}



// ── Procedural patterns ────────────────────────────────────────────────────

float hash1(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash1(i), hash1(i + vec2(1,0)), f.x),
             mix(hash1(i + vec2(0,1)), hash1(i + vec2(1,1)), f.x), f.y);
}

float voronoi(vec2 p) {
  vec2 n = floor(p);
  vec2 f = fract(p);
  float minDist = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = vec2(hash1(n + g), hash1(n + g + vec2(31.7, 57.3)));
      vec2 r = g + o - f;
      minDist = min(minDist, dot(r, r));
    }
  }
  return sqrt(minDist);
}

float stripePattern(vec2 p) {
  return 0.5 + 0.5 * sin((p.x + p.y) * 6.0);
}

float samplePattern(vec2 uv, float prime, int style, float radius) {
  vec2 p;
  if (u_textureSwimMode == 1 || u_textureSwimMode == 3) {
    // Uniform world-space coordinates for seamless sheet alignment, plus camera-pan parallax
    p = v_worldPos * 0.005 + u_pan * 0.003;
    if (u_textureSwimMode == 1) {
      // Uniform scroll
      p += vec2(u_time * 0.05, u_time * 0.03);
    }
  } else {
    // Shape-local coordinates: prime seed gives each shape a unique Voronoi pattern.
    // v_centre (spawn position) offsets further so same-prime shapes at different locations differ.
    // textureSwimMode==0 (static): uses spawn position — stable even during spin/pulse.
    // textureSwimMode==2 (seeded drift): adds time-based drift on top.
    float scale = clamp(radius * 1.05, 0.9, 4.5);
    p = uv * scale + vec2(prime * 13.7, prime * 5.3);
    if (u_textureSwimMode != 4) {
      // Add world-position offset for per-instance variety (toggle off with swimMode==4)
      p += v_centre * 0.15;
    }
    if (u_textureSwimMode == 2) {
      // Seeded drift
      p += vec2(sin(prime * 1.7), cos(prime * 1.3)) * u_time * 0.06;
    }
  }
  if (style == 1) return clamp(voronoi(p) * 1.2, 0.0, 1.0);
  if (style == 2) return stripePattern(p);
  return valueNoise(p);
}

// ── Main ──────────────────────────────────────────────────────────────────

void main() {
  float d;
  vec2 p = v_local;

  if (v_sides == 0u) {
    // Circle
    d = sdCircle(p, 1.0);
  } else if (v_sides == 1u) {
    // Prime sphere — full circle, shaded as a 3D ball below
    d = sdCircle(p, 1.0);
  } else if (v_sides == 2u) {
    if (v_dotRadius > 0.0) {
      d = sdCircle(p, v_dotRadius);
    } else {
      // Dumbbell SDF: two spheres at ±0.82 blended with a thin shaft via smin.
      float shaft = length(vec2(p.x, p.y - clamp(p.y, -0.93, 0.93))) - 0.05;
      float bulb1 = length(p - vec2(0.0,  0.89)) - 0.11;
      float bulb2 = length(p - vec2(0.0, -0.89)) - 0.11;
      d = min(shaft, min(bulb1, bulb2));
    }
  } else {
    // Regular polygon, sides >= 3
    d = sdRegularPolygon(p, 1.0, int(v_sides));
  }

  float fw   = fwidth(d) * 1.0;
  float fill = 1.0 - smoothstep(-fw, fw, d);
  float outline = (v_strokeWorld > 0.001)
    ? 1.0 - smoothstep(-fw, fw, abs(d + v_strokeWorld * 0.5) - v_strokeWorld * 0.5)
    : fill;

  float coverage;
  vec3  shapeCol;

  if (v_fillMode == 3) {
    // Neon/emissive-only: glow edge, no solid fill
    coverage = outline * 0.5;
    shapeCol = v_colour;
  } else if (v_fillMode == 4) {
    // Gradient/soft fill: radial falloff inside shape
    float radial = 1.0 - smoothstep(0.3, 1.0, length(v_local));
    coverage = fill * radial * 0.92 + outline * 0.08;
    shapeCol = v_colour;
  } else if (v_fillMode == 5) {
    // Outline ≠ fill colour
    coverage = mix(outline, fill, v_fillMix);
    shapeCol = mix(v_outlineCol, v_colour, fill * v_fillMix);
  } else if (v_fillMode == 6) {
    // Depth fade: deeper layers are dimmer
    float brightness = 1.0 - v_depth * 0.7;
    coverage = mix(outline, fill, v_fillMix);
    shapeCol = v_colour * brightness;
  } else {
    // Default: both (fillMode 0/1/2 handled via v_fillMix baked in instanceBuilder)
    coverage = mix(outline, fill, v_fillMix);
    shapeCol = v_colour;
  }

  // DESIGN DECISION (WHY):
  // - Finite-Difference Normal Generation:
  //   Instead of baking normals or computing analytical derivatives for each different primitive type,
  //   we calculate pixel-perfect normal vectors in the fragment shader using partial screen derivatives
  //   of the SDF distance 'dFdx(d)' and 'dFdy(d)'. This yields smooth normals along any curved SDF edge,
  //   independent of shape type, enabling real-time embossing and dynamic spotlight specular highlights.
  vec3 N = vec3(0.0, 0.0, 1.0);
  if ((u_embossOn > 0.5 && u_embossStrength > 0.001) || v_emboss > 0.5 || u_spotlightOn > 0.5) {
    vec2 grd = vec2(dFdx(d), dFdy(d));
    float glen = length(grd);
    if (glen > 0.0001) N = normalize(vec3(-grd / glen, 0.5));
  }

  float effectiveEmboss = (v_emboss > 0.5) ? u_embossStrength
                        : (v_emboss < -0.5) ? 0.0
                        : (u_embossOn > 0.5 ? u_embossStrength : 0.0);
  if (effectiveEmboss > 0.001) {
    vec3 lightDir = normalize(vec3(0.5, 0.8, 1.0));
    float lambert = clamp(dot(N, lightDir), 0.0, 1.0);
    float rim = pow(1.0 - clamp(N.z, 0.0, 1.0), 3.0);
    shapeCol = mix(shapeCol, shapeCol * (0.4 + 0.8 * lambert) + vec3(rim * 0.25), effectiveEmboss);
  }

  // DESIGN DECISION (WHY):
  // - World-Space Spotlight Shading:
  //   To create a highly dramatic focus effect, the spotlight falloff and diffuse shading are computed
  //   relative to the actual world-space coordinate of the fragment ('v_worldPos'). This ensures that
  //   as the camera zooms or pans, the spotlight remains stably positioned in space, and specular
  //   glints react properly to the instance rotations.
  if (u_spotlightOn > 0.5) {
    vec2 toLight = u_lightPos - v_worldPos;
    float dist = length(toLight);
    vec3 spotDir = normalize(vec3(toLight / max(dist, 0.001), 1.5));
    float spotDot = clamp(dot(N, spotDir), 0.0, 1.0);
    float falloff = 1.0 / (1.0 + u_spotFalloff * dist * dist);
    shapeCol += v_colour * spotDot * falloff * 1.2;
  }

  // Prime sphere: fake 3D ball shading using local position as surface normal
  if (v_sides == 1u) {
    vec3 sphN = normalize(vec3(p * 0.8, sqrt(max(0.0, 1.0 - dot(p * 0.8, p * 0.8)))));
    vec3 lightDir = normalize(vec3(0.45, 0.7, 1.0));
    float lambert = clamp(dot(sphN, lightDir), 0.0, 1.0);
    float spec = pow(clamp(dot(reflect(-lightDir, sphN), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 18.0);
    shapeCol = shapeCol * (0.3 + 0.7 * lambert) + vec3(spec * 0.6);
  }

  {
    float texOn = (v_pattern > 0.5) ? 1.0
                : (v_pattern < -0.5) ? 0.0
                : u_textureOn;
    int texStyle = (v_pattern > 0.5) ? int(v_pattern + 0.5) - 1 : u_textureStyle;
    if (texOn > 0.5 && v_sides != 1u) {
      float pat = samplePattern(v_local, v_seed, texStyle, v_radius);
      shapeCol *= 0.8 + 0.2 * pat;
    }
  }

  float totalAlpha = coverage * v_alpha;
  if (totalAlpha < 0.002) discard;
  fragColour = vec4(shapeCol * u_emissive * totalAlpha, totalAlpha);
}
`;

export const BG_VERT_SRC = /* glsl */`#version 300 es
precision highp float;

const vec2 QUAD[4] = vec2[4](
  vec2(-1.0, -1.0),
  vec2( 1.0, -1.0),
  vec2(-1.0,  1.0),
  vec2( 1.0,  1.0)
);

out vec2 v_uv;

void main() {
  vec2 p = QUAD[gl_VertexID];
  v_uv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}
`;

export const BG_FRAG_SRC = /* glsl */`#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColour;

uniform vec3  u_colourTop;
uniform vec3  u_colourBot;
uniform float u_time;
uniform float u_noiseAmt;

// Simple value noise
float hash(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
}

void main() {
  vec3 grad = mix(u_colourBot, u_colourTop, v_uv.y);
  float n = noise(v_uv * 80.0 + u_time * 0.05) * u_noiseAmt;
  fragColour = vec4(grad + n, 1.0);
}
`;
