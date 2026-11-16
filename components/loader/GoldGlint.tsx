'use client';

import React, { useEffect, useRef } from 'react';

/*
 * Light running through the gold filigree of the opening card, driven by a packed effect map
 * (altin.webp, same framing as kart.webp):
 *   R = where the gold is (filigree mask; the ribbon area is blurred out to a mid value)
 *   G = the order the light reaches each spot (bright = first, so it travels bottom → top)
 *   B = sparkle points that twinkle as the light passes
 * Drawn as a WebGL overlay with `mix-blend-mode: screen`, so it only ever brightens the card.
 */

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uMap;
uniform float uT;     // 0 → 1 progress of the sweep
uniform float uTime;  // seconds, for the twinkle

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec4 m = texture2D(uMap, vUv);
  float gold = smoothstep(0.55, 0.85, m.r);

  // Sweep front in G space. The map's gold runs from G ≈ 0.98 (bottom) to ≈ 0.3 (top), so the
  // front starts just past the bottom and finishes just past the top
  float front = mix(1.08, 0.18, uT);
  float d = m.g - front;                         // > 0 → the light has already passed here
  float band = exp(-(d * d) / 0.010);
  float trail = d > 0.0 ? exp(-d * 6.0) * 0.32 : 0.0;

  // Fade in quickly, fade out over the last fifth
  float env = smoothstep(0.0, 0.08, uT) * (1.0 - smoothstep(0.8, 1.0, uT));

  float cell = hash(floor(vUv * vec2(150.0, 265.0)));
  float twinkle = 0.55 + 0.45 * sin(uTime * 16.0 + cell * 6.2831);
  float spark = m.b * band * twinkle * 1.3;

  float k = (gold * (band * 0.9 + trail) + spark) * env;
  vec3 col = vec3(0.9451, 0.8353, 0.4235) * k + vec3(0.9804, 0.9529, 0.8706) * pow(k, 2.5) * 0.85;
  gl_FragColor = vec4(col, 1.0);
}`;

interface GoldGlintProps {
  src: string;
  /** Flip to true to play the sweep once */
  active: boolean;
  durationMs: number;
  /** Only set up (and download the map) when this media query matches */
  media?: string;
  className?: string;
  /** Called when WebGL or the map can't be used — show a CSS fallback instead */
  onUnavailable: () => void;
}

interface GlState {
  gl: WebGLRenderingContext;
  uT: WebGLUniformLocation | null;
  uTime: WebGLUniformLocation | null;
  ready: boolean;
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export const GoldGlint: React.FC<GoldGlintProps> = ({ src, active, durationMs, media, className, onUnavailable }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GlState | null>(null);
  const unavailableRef = useRef(onUnavailable);
  useEffect(() => {
    unavailableRef.current = onUnavailable;
  });

  // Set up the GL program and upload the map once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (media && !window.matchMedia(media).matches) return;
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) {
      unavailableRef.current();
      return;
    }

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram();
    if (!vs || !fs || !prog) {
      unavailableRef.current();
      return;
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      unavailableRef.current();
      return;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const state: GlState = {
      gl,
      uT: gl.getUniformLocation(prog, 'uT'),
      uTime: gl.getUniformLocation(prog, 'uTime'),
      ready: false,
    };
    stateRef.current = state;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    let cancelled = false;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (cancelled) return;
      // Half resolution is plenty for a soft glow and keeps the fill cheap on phones
      canvas.width = Math.max(1, Math.round(img.naturalWidth / 2));
      canvas.height = Math.max(1, Math.round(img.naturalHeight / 2));
      gl.viewport(0, 0, canvas.width, canvas.height);
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.clear(gl.COLOR_BUFFER_BIT);
      state.ready = true;
    };
    img.onerror = () => {
      if (!cancelled) unavailableRef.current();
    };
    // Only needed after the tap: fetch it once the page has finished loading (and the browser is
    // idle) so it never competes with the card art for bandwidth on first load
    let idle = 0;
    const startLoad = () => {
      if (cancelled) return;
      if ('requestIdleCallback' in window) {
        idle = window.requestIdleCallback(() => { if (!cancelled) img.src = src; }, { timeout: 2000 });
      } else {
        img.src = src;
      }
    };
    if (document.readyState === 'complete') startLoad();
    else window.addEventListener('load', startLoad, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener('load', startLoad);
      if (idle) window.cancelIdleCallback(idle);
      stateRef.current = null;
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [src, media]);

  // Play the sweep once when activated
  useEffect(() => {
    if (!active) return;
    const state = stateRef.current;
    if (!state || !state.ready) {
      unavailableRef.current();
      return;
    }
    const { gl, uT, uTime } = state;
    const start = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      gl.uniform1f(uT, t);
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (t < 1) {
        raf = requestAnimationFrame(frame);
      } else {
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [active, durationMs]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
};
