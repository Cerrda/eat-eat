#version 100
precision mediump float;

/** @resolution */
uniform vec2 u_resolution;

/** @time */
uniform float u_time;

/** @backdrop */
uniform sampler2D u_backdrop;

/**
 * @label Ink
 * @color
 * @default #792B3E
 */
uniform vec3 u_ink;

void main() {
  vec2 res = max(u_resolution, vec2(1.0));
  vec2 uv = gl_FragCoord.xy / res;
  vec3 paper = texture2D(u_backdrop, uv).rgb;

  vec2 p = (gl_FragCoord.xy - 0.5 * res) / min(res.x, res.y);
  float ang = atan(p.y, p.x);
  float wob = sin(ang * 2.0 + 0.7) * 0.014 + sin(ang * 5.0 + 1.4) * 0.005;
  float d = abs(length(p) - (0.36 + wob));

  float along = fract((ang - u_time * 4.2) / 6.2831853 + 0.62);
  float on = smoothstep(0.0, 0.05, along) * (1.0 - smoothstep(0.7, 0.84, along));
  float width = 0.03 * mix(0.35, 1.0, on);
  float ink = (1.0 - smoothstep(width * 0.15, width, d)) * on;

  gl_FragColor = vec4(mix(paper, u_ink, clamp(ink, 0.0, 1.0)), 1.0);
}
