import { useEffect, useRef, useState } from "react";

interface SalwaAvatarProps {
  avatarUrl: string;
  isSpeaking: boolean;
  isLoading?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Animated Salwa avatar with:
 * - Glowing ring when speaking
 * - Audio waveform visualization
 * - Pulsing effect synchronized with voice
 * - Animated gradient background
 */
export function SalwaAvatar({ avatarUrl, isSpeaking, isLoading, size = "md", className = "" }: SalwaAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [wavePhase, setWavePhase] = useState(0);

  const sizeMap = { sm: 48, md: 80, lg: 120 };
  const px = sizeMap[size];

  // Waveform animation
  useEffect(() => {
    if (!isSpeaking && !isLoading) {
      cancelAnimationFrame(animationRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const canvasSize = px + 40; // extra space for glow
    canvas.width = canvasSize * dpr;
    canvas.height = canvasSize * dpr;
    ctx.scale(dpr, dpr);

    let phase = 0;

    function draw() {
      if (!ctx || !canvas) return;
      const canvasSize = px + 40;
      ctx.clearRect(0, 0, canvasSize, canvasSize);

      const cx = canvasSize / 2;
      const cy = canvasSize / 2;
      const radius = px / 2;

      phase += 0.06;

      if (isSpeaking) {
        // Outer glow ring
        const glowGradient = ctx.createRadialGradient(cx, cy, radius - 2, cx, cy, radius + 14);
        const glowIntensity = 0.3 + 0.2 * Math.sin(phase * 2);
        glowGradient.addColorStop(0, `rgba(245, 158, 11, ${glowIntensity})`);
        glowGradient.addColorStop(0.5, `rgba(245, 158, 11, ${glowIntensity * 0.5})`);
        glowGradient.addColorStop(1, "rgba(245, 158, 11, 0)");
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 14, 0, Math.PI * 2);
        ctx.fillStyle = glowGradient;
        ctx.fill();

        // Sound wave rings (3 expanding rings)
        for (let i = 0; i < 3; i++) {
          const ringPhase = (phase + i * 1.2) % (Math.PI * 2);
          const ringRadius = radius + 6 + (ringPhase / (Math.PI * 2)) * 20;
          const ringAlpha = Math.max(0, 0.4 - (ringPhase / (Math.PI * 2)) * 0.4);

          ctx.beginPath();
          ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(245, 158, 11, ${ringAlpha})`;
          ctx.lineWidth = 2 - (ringPhase / (Math.PI * 2)) * 1.5;
          ctx.stroke();
        }

        // Audio waveform bars around the circle
        const barCount = 24;
        for (let i = 0; i < barCount; i++) {
          const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
          const barHeight = 4 + Math.abs(Math.sin(phase * 3 + i * 0.7)) * 10;
          const barAlpha = 0.4 + Math.abs(Math.sin(phase * 2 + i * 0.5)) * 0.4;

          const x1 = cx + Math.cos(angle) * (radius + 3);
          const y1 = cy + Math.sin(angle) * (radius + 3);
          const x2 = cx + Math.cos(angle) * (radius + 3 + barHeight);
          const y2 = cy + Math.sin(angle) * (radius + 3 + barHeight);

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = `rgba(245, 158, 11, ${barAlpha})`;
          ctx.lineWidth = 2;
          ctx.lineCap = "round";
          ctx.stroke();
        }

        // Rotating highlight arc
        const arcStart = phase * 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 2, arcStart, arcStart + Math.PI * 0.6);
        ctx.strokeStyle = "rgba(255, 215, 0, 0.6)";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.stroke();

      } else if (isLoading) {
        // Loading spinner
        const arcStart = phase * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 4, arcStart, arcStart + Math.PI * 1.2);
        ctx.strokeStyle = "rgba(245, 158, 11, 0.5)";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.stroke();
      }

      setWavePhase(phase);
      animationRef.current = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [isSpeaking, isLoading, px]);

  const canvasSize = px + 40;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: canvasSize, height: canvasSize }}
    >
      {/* Canvas for animations */}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: canvasSize,
          height: canvasSize,
          pointerEvents: "none",
        }}
      />

      {/* Avatar image */}
      <div
        className={`relative rounded-full overflow-hidden transition-transform duration-300 ${
          isSpeaking ? "scale-105" : ""
        }`}
        style={{ width: px, height: px }}
      >
        <img
          src={avatarUrl}
          alt="سلوى"
          className="w-full h-full object-cover"
        />

        {/* Subtle overlay pulse when speaking */}
        {isSpeaking && (
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `radial-gradient(circle, rgba(245,158,11,${0.05 + 0.05 * Math.sin(wavePhase * 2)}) 0%, transparent 70%)`,
            }}
          />
        )}
      </div>

      {/* Status indicator */}
      <div
        className={`absolute bottom-1 right-1 rounded-full border-2 border-white transition-all duration-300 ${
          isSpeaking
            ? "w-4 h-4 bg-amber-400 animate-pulse"
            : isLoading
              ? "w-3.5 h-3.5 bg-amber-300 animate-spin"
              : "w-3 h-3 bg-emerald-400"
        }`}
        style={isSpeaking ? {
          boxShadow: "0 0 8px rgba(245,158,11,0.6)",
        } : {}}
      />

      {/* Speaking label */}
      {isSpeaking && (
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="text-[9px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-0.5">
            <span className="inline-block w-1 h-1 bg-amber-500 rounded-full animate-pulse" />
            تتحدث
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Compact speaking indicator for inline use in chat messages
 */
export function SalwaSpeakingIndicator({ isSpeaking }: { isSpeaking: boolean }) {
  if (!isSpeaking) return null;

  return (
    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 border border-amber-200">
      {/* Animated bars */}
      <div className="flex items-end gap-[2px] h-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="w-[2px] bg-amber-500 rounded-full"
            style={{
              animation: `soundBar 0.8s ease-in-out ${i * 0.1}s infinite alternate`,
              height: "30%",
            }}
          />
        ))}
      </div>
      <span className="text-[10px] text-amber-600 font-medium mr-0.5">سلوى تتحدث</span>
      <style>{`
        @keyframes soundBar {
          0% { height: 20%; }
          100% { height: 100%; }
        }
      `}</style>
    </div>
  );
}
