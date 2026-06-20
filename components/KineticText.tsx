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

    // 1. Initialize WebGL Context
    let renderer: Renderer;
    try {
      renderer = new Renderer({ 
        canvas, 
        alpha: false, 
        antialias: true, 
        dpr: Math.min(window.devicePixelRatio, 2),
        powerPreference: "high-performance" 
      });
    } catch (e) {
      console.error("WebGL context initialization failed", e);
      return;
    }
    
    const gl = renderer.gl;
    gl.clearColor(0.96, 0.96, 0.96, 1.0); // Clean background tone

    // Fix: Orthographic-style perspective settings to allow exact full-viewport mapping
    const camera = new Camera(gl, { fov: 45 });
    camera.position.z = 5;

    const scene = new Transform();

    // 2. High-Contrast Typography Grid Atlas
    const textCanvas = document.createElement('canvas');
    const tCtx = textCanvas.getContext('2d')!;
    const texWidth = 2048; 
    const texHeight = 2048;
    textCanvas.width = texWidth;
    textCanvas.height = texHeight;

    tCtx.fillStyle = '#ffffff';
    tCtx.fillRect(0, 0, texWidth, texHeight);

    tCtx.fillStyle = '#000000'; 
    tCtx.font = 'bold 42px sans-serif'; 
    tCtx.textAlign = 'center';
    tCtx.textBaseline = 'middle';

    const rows = 24;
    const cols = 12;
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

    // 3. GLSL Shaders: Pure liquid UV coordinate distortion
    const vertexShader = `
      attribute vec3 position;
      attribute vec2 uv;
      varying vec2 vUv;

      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      precision highp float;
      varying vec2 vUv;
      
      uniform sampler2D tMap;
      uniform vec2 uMouse;
      uniform vec2 uVelocity;
      uniform float uStrength;
      uniform float uRadius;
      uniform float uAspect;

      void main() {
        // Handle widescreen tracking scales natively
        vec2 correctedUv = vec2(vUv.x * uAspect, vUv.y);
        vec2 correctedMouse = vec2(uMouse.x * uAspect, uMouse.y);

        float dist = distance(correctedUv, correctedMouse);
        vec2 uvOffset = vec2(0.0);

        if (dist < uRadius) {
          float force = (uRadius - dist) / uRadius;
          force = force * force * (3.0 - 2.0 * force); // Fluid ease curve

          vec2 dir = normalize(correctedUv - correctedMouse);
          dir.x /= uAspect; 

          uvOffset += dir * force * uStrength * 0.04;
          uvOffset -= uVelocity * force * uStrength * 0.06;
        }

        // Chromatic Aberration liquid color displacement channels
        vec2 shift = uvOffset * 1.5;
        float r = texture2D(tMap, vUv - shift * 1.4).r;
        float g = texture2D(tMap, vUv - shift * 0.6).g;
        float b = texture2D(tMap, vUv + shift * 0.4).b;

        gl_FragColor = vec4(r, g, b, 1.0);
      }
    `;

    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        tMap: { value: texture },
        uMouse: { value: new Float32Array([0.5, 0.5]) }, 
        uVelocity: { value: new Float32Array([0, 0]) },
        uStrength: { value: 0.0 },
        uRadius: { value: 0.25 }, // Increased radius to account for full screen layouts
        uAspect: { value: 1.0 },
      },
    });

    // 4. Exact Viewport Geometry Calculations
    const geometry = new Plane(gl, { width: 1, height: 1 });
    const mesh = new Mesh(gl, { geometry, program });
    mesh.setParent(scene);

    let mouse = { x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5 };
    let velocity = { x: 0, y: 0 };
    let currentStrength = 0;
    let targetStrength = 0;
    let aspect = 1;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.targetX = (e.clientX - rect.left) / rect.width;
      mouse.targetY = 1.0 - ((e.clientY - rect.top) / rect.height);
      targetStrength = 1.0;
    };

    const handleMouseLeave = () => {
      targetStrength = 0.0;
    };

    container.addEventListener('mousemove', handleMouseMove, { passive: true });
    container.addEventListener('mouseleave', handleMouseLeave, { passive: true });

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      
      renderer.setSize(w, h);
      camera.perspective({ aspect: w / h });
      
      aspect = w / h;
      program.uniforms.uAspect.value = aspect;

      // Fix: Math equation that maps the WebGL plane plane perfectly to the camera frustum limits
      const distance = camera.position.z;
      const vFov = (camera.fov * Math.PI) / 180;
      const planeHeight = 2 * Math.tan(vFov / 2) * distance;
      const planeWidth = planeHeight * aspect;

      mesh.scale.set(planeWidth, planeHeight, 1);
    };
    window.addEventListener('resize', resize);
    resize();

    let animationFrameId: number;
    
    const update = () => {
      const prevX = mouse.x;
      const prevY = mouse.y;

      mouse.x += (mouse.targetX - mouse.x) * 0.08;
      mouse.y += (mouse.targetY - mouse.y) * 0.08;

      velocity.x = mouse.x - prevX;
      velocity.y = mouse.y - prevY;

      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

      if (speed < 0.0001) {
        targetStrength = 0.0;
      }

      currentStrength += (targetStrength * Math.min(speed * 15.0, 1.0) - currentStrength) * 0.08;

      program.uniforms.uMouse.value[0] = mouse.x;
      program.uniforms.uMouse.value[1] = mouse.y;
      program.uniforms.uVelocity.value[0] = velocity.x;
      program.uniforms.uVelocity.value[1] = velocity.y;
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
    <div ref={containerRef} className="fixed inset-0 w-screen h-screen overflow-hidden select-none bg-[#f5f5f5] z-0">
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}