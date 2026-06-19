'use client';

import { useEffect, useRef } from 'react';
import { Renderer, Camera, Transform, Program, Mesh, Plane, Texture } from 'ogl';

interface KineticTextProps {
  text: string;
}

export default function KineticText({ text }: KineticTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // 1. Initialize WebGL Context with locked Device Pixel Ratio caps
    let renderer: Renderer;
    try {
      renderer = new Renderer({ 
        canvas, 
        alpha: true, 
        antialias: true, 
        dpr: Math.min(window.devicePixelRatio, 2),
        powerPreference: "high-performance" 
      });
    } catch (e) {
      console.error("WebGL context initialization failed", e);
      return;
    }
    
    const gl = renderer.gl;
    gl.clearColor(0.95, 0.95, 0.95, 1.0); // Clean video background color

    const camera = new Camera(gl, { fov: 45 });
    camera.position.z = 5;

    const scene = new Transform();

    // 2. Build High-Resolution Offscreen Typography Matrix
    const textCanvas = document.createElement('canvas');
    const tCtx = textCanvas.getContext('2d')!;
    const texWidth = 2048; 
    const texHeight = 2048;
    textCanvas.width = texWidth;
    textCanvas.height = texHeight;

    tCtx.fillStyle = '#111111';
    tCtx.font = 'bold 38px sans-serif'; 
    tCtx.textAlign = 'center';
    tCtx.textBaseline = 'middle';

    // Desktop wide-screen dense text matrix configurations
    const rows = 32;
    const cols = 24;
    const stepX = texWidth / cols;
    const stepY = texHeight / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const charIndex = (r * cols + c) % text.length;
        tCtx.fillText(text[charIndex], c * stepX + stepX / 2, r * stepY + stepY / 2);
      }
    }

    const texture = new Texture(gl, {
      image: textCanvas,
      generateMipmaps: false,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
    });

    // 3. GLSL Vertex Shader: Computes elastic, magnetic fabric warp
    const vertexShader = `
      attribute vec3 position;
      attribute vec2 uv;
      varying vec2 vUv;
      
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      
      uniform float uMouseX;
      uniform float uMouseY;
      uniform float uVelocityX;
      uniform float uVelocityY;
      uniform float uStrength;
      uniform float uRadius;
      uniform float uAspect;

      void main() {
        vUv = uv;
        vec3 pos = position;

        // Apply aspect ratio math to prevent wide-screen stretching circles
        vec2 correctedPos = vec2(pos.x * uAspect, pos.y);
        vec2 correctedMouse = vec2(uMouseX * uAspect, uMouseY);

        float dist = distance(correctedPos, correctedMouse);

        if (dist < uRadius && uStrength > 0.001) {
          // Sharp exponential decay curve mimicking the video presentation
          float force = (uRadius - dist) / uRadius;
          force = force * force * (3.0 - 2.0 * force); 

          vec2 dir = normalize(correctedPos - correctedMouse);
          dir.x /= uAspect; // Unscale projection mapping

          // Blend coordinates with kinetic acceleration trails
          pos.xy += dir * force * uStrength * 0.32;
          pos.xy -= vec2(uVelocityX, uVelocityY) * force * uStrength * 0.22;
        }

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `;

    // 4. GLSL Fragment Shader: Creates silky-smooth color trails
    const fragmentShader = `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tMap;
      uniform float uVelocityX;
      uniform float uVelocityY;
      uniform float uStrength;

      void main() {
        // Multi-channel chromatic offset based directly on velocity metrics
        vec2 shift = vec2(uVelocityX, uVelocityY) * uStrength * 0.08;

        // Separate red, green, and blue components elegantly
        float r = texture2D(tMap, vUv - shift * 1.2).r;
        float g = texture2D(tMap, vUv - shift * 0.5).g;
        float b = texture2D(tMap, vUv).b;

        gl_FragColor = vec4(vec3(r, g, b), 1.0);
      }
    `;

    // Strict Float Primitives definition completely removes array processing
    const program = new Program(gl, {
  vertex: vertexShader,
  fragment: fragmentShader,
  uniforms: {
    tMap: { value: texture },
    uMouseX: { value: -10.0 },
    uMouseY: { value: -10.0 },
    uVelocityX: { value: 0.0 },
    uVelocityY: { value: 0.0 },
    uStrength: { value: 0.0 },
    uRadius: { value: 0.48 }, // Changed from 0.85 to 0.48 for a crisp medium size
    uAspect: { value: 1.0 },
  },
});

    // High wireframe density segments grid
    const geometry = new Plane(gl, { width: 1, height: 1, widthSegments: 128, heightSegments: 128 });
    const mesh = new Mesh(gl, { geometry, program });
    mesh.setParent(scene);

    // Track state metrics
    let mouse = { x: -10, y: -10, targetX: -10, targetY: -10 };
    let velocity = { x: 0, y: 0 };
    let currentStrength = 0;
    let targetStrength = 0;
    let aspect = 1;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      
      // Standardize coordinates natively from -1.0 to 1.0
      mouse.targetX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.targetY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      
      // Match camera perspective mapping spaces
      mouse.targetX *= 2.45;
      mouse.targetY *= 2.45;

      targetStrength = 1.0;
    };

    const handleMouseLeave = () => {
      mouse.targetX = -10;
      mouse.targetY = -10;
      targetStrength = 0.0;
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      
      renderer.setSize(w, h);
      camera.perspective({ aspect: w / h });
      
      aspect = w / h;
      program.uniforms.uAspect.value = aspect;

      // Frame scaling adjustment matching widescreen parameters cleanly
      mesh.scale.set(aspect * 2.82, 2.82, 1);
    };
    window.addEventListener('resize', resize);
    resize();

    let animationFrameId: number;
    
    // 5. High Performance Inertia Tick Loop (Zero Arrays, Zero JavaScript Loops)
    const update = () => {
      const prevX = mouse.x;
      const prevY = mouse.y;

      // Fluid, premium tracking easing multiplier (0.12)
      mouse.x += (mouse.targetX - mouse.x) * 0.12;
      mouse.y += (mouse.targetY - mouse.y) * 0.12;

      velocity.x = mouse.x - prevX;
      velocity.y = mouse.y - prevY;

      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

      if (speed < 0.0001) {
        targetStrength = 0.0;
      }

      // Smooth dampening physics deceleration control
      currentStrength += (targetStrength * Math.min(speed * 12.0, 1.0) - currentStrength) * 0.1;

      // Pure float uniform mapping prevents any array pointer breakdown
      program.uniforms.uMouseX.value = mouse.x;
      program.uniforms.uMouseY.value = mouse.y;
      program.uniforms.uVelocityX.value = velocity.x;
      program.uniforms.uVelocityY.value = velocity.y;
      program.uniforms.uStrength.value = currentStrength;

      if (renderer && scene && camera) {
        renderer.render({ scene, camera });
      }
      
      animationFrameId = requestAnimationFrame(update);
    };

    animationFrameId = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('resize', resize);
      
      geometry.remove();
      program.remove();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [text]);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden select-none bg-[#f3f3f3]">
      <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" />
    </div>
  );
}