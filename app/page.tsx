// 1St One

// export default function Home() {
//   return (
//     <main className="flex min-h-screen flex-col items-center justify-center p-24">
//       <h1 className="text-4xl font-light tracking-widest mb-8 select-none">
//         MOVE YOUR MOUSE
//       </h1>
      
//       {/* Adding .interactive-target instructs the cursor to expand on hover */}
//       <button className="interactive-target px-8 py-4 border-2 border-[#00ffcc] text-[#00ffcc] font-bold tracking-wider uppercase rounded transition-colors duration-300 hover:bg-[rgba(0,255,204,0.1)]">
//         Hover Over Me
//       </button>
//     </main>
//   );
// }

import KineticText from '@/components/KineticText';

export default function Home() {
  // Exact typography copy content structure displayed across Aristide Benoist's presentation
  const videoTextContent = "POWELL STUDIO POWELL STUDIO";

  return (
    <main className="relative min-h-screen w-screen bg-[#f3f3f3] overflow-hidden m-0 p-0">
      
      {/* Complete Full-Screen Kinetic WebGL Canvas Display */}
      <div className="absolute inset-0 w-full h-full z-0">
        <KineticText text={videoTextContent} />
      </div>

      {/* Interface Layout Metadata Overlays (Pointer events set to none allows background tracking) */}
      <div className="absolute inset-0 flex flex-col justify-between p-10 pointer-events-none z-10 select-none mix-blend-difference text-black">
        <header className="flex justify-between items-center w-full">
          <span className="font-sans text-xs font-bold tracking-widest">MTSDF-PASS 02</span>
          <span className="font-sans text-xs tracking-wider">LAB EXPERIMENT // 2026</span>
        </header>

        <div className="max-w-xs">
          <p className="font-mono text-[10px] tracking-widest text-neutral-500 leading-relaxed uppercase">
            Output is highly optimized and plugs directly into standard instanced glyph rendering layouts.
          </p>
        </div>
      </div>

    </main>
  );
}