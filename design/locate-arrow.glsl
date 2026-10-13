#version 100
precision mediump float;

/** @resolution */
uniform vec2 u_resolution;

/** @time */
uniform float u_time;

/**
 * @label Ink
 * @color
 * @default #792B3E
 */
uniform vec3 u_ink;

vec2 curve(float t) {
  vec2 c1 = vec2(108.0, 156.0);
  vec2 c2 = vec2(108.0, 102.0);
  float r = 22.0;
  if (t < 0.08) {
    return mix(vec2(108.0, 192.0), c1 + vec2(0.0, r), t / 0.08);
  }
  if (t < 0.40) {
    float a = (t - 0.08) / 0.32 * 6.2831853 + 1.5707963;
    return c1 + r * vec2(cos(a), sin(a));
  }
  if (t < 0.48) {
    return mix(c1 + vec2(0.0, -r), c2 + vec2(0.0, r), (t - 0.40) / 0.08);
  }
  if (t < 0.80) {
    float a = (t - 0.48) / 0.32 * 6.2831853 + 1.5707963;
    return c2 + r * vec2(cos(a), sin(a));
  }
  float u = (t - 0.80) / 0.20;
  float o = 1.0 - u;
  vec2 a0 = c2 + vec2(0.0, -r);
  vec2 b0 = vec2(50.0, 36.0);
  vec2 c0 = vec2(14.0, 9.0);
  return o * o * a0 + 2.0 * o * u * b0 + u * u * c0;
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
  float travel = fract(u_time * 0.32);
  float a = 0.0;
  for (int i = 0; i < 10; i++) {
    float tt = travel - float(i) * 0.014;
    if (tt < 0.0) tt += 1.0;
    float w = 1.0 - float(i) / 10.0;
    a = max(a, smoothstep(9.0, 1.4, length(frag - curve(tt))) * w);
  }
  vec3 col = mix(u_ink, vec3(1.0, 0.973, 0.957), 0.85);
  gl_FragColor = vec4(col * a, a);
}
