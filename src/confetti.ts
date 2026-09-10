// High-performance, zero-dependency canvas confetti engine for Hot Streak
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
}

let activeCanvas: HTMLCanvasElement | null = null;
let animationId: number | null = null;
let particles: Particle[] = [];

const COLORS = [
  "#f39c12", // Gold
  "#e74c3c", // Red
  "#2ecc71", // Green
  "#3498db", // Blue
  "#9b59b6", // Purple
  "#fb8500", // Orange
  "#00f5d4", // Mint
];

export function fireConfetti(durationMs: number = 2500) {
  if (!activeCanvas) {
    activeCanvas = document.createElement("canvas");
    activeCanvas.id = "hot-streak-confetti-canvas";
    activeCanvas.style.position = "fixed";
    activeCanvas.style.top = "0";
    activeCanvas.style.left = "0";
    activeCanvas.style.width = "100vw";
    activeCanvas.style.height = "100vh";
    activeCanvas.style.pointerEvents = "none";
    activeCanvas.style.zIndex = "999999";
    document.body.appendChild(activeCanvas);
  }

  const canvas = activeCanvas;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = (canvas.width = window.innerWidth);
  const height = (canvas.height = window.innerHeight);

  // Spawn new burst of particles
  const count = 75;
  const newParticles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    // Launch from bottom corners and bottom center
    const originX = i % 2 === 0 ? width * 0.2 : width * 0.8;
    const angle = i % 2 === 0 ? (Math.PI / 180) * (50 + Math.random() * 40) : (Math.PI / 180) * (90 + Math.random() * 40);
    const speed = 12 + Math.random() * 14;

    newParticles.push({
      x: originX,
      y: height - 20,
      vx: Math.cos(angle) * speed * (i % 2 === 0 ? 1 : -1),
      vy: -Math.abs(Math.sin(angle) * speed),
      w: 8 + Math.random() * 8,
      h: 5 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 12,
      opacity: 1,
    });
  }

  particles = [...particles, ...newParticles];

  const startTime = performance.now();

  function animate(now: number) {
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, width, height);

    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / durationMs);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.45; // gravity
      p.vx *= 0.98; // air drag
      p.rotation += p.rotationSpeed;
      p.opacity = Math.max(0, 1 - progress);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();

      if (p.y > height + 20 || p.opacity <= 0) {
        particles.splice(i, 1);
      }
    }

    if (particles.length > 0 && progress < 1) {
      animationId = requestAnimationFrame(animate);
    } else {
      ctx.clearRect(0, 0, width, height);
      if (activeCanvas && activeCanvas.parentNode) {
        activeCanvas.parentNode.removeChild(activeCanvas);
        activeCanvas = null;
      }
      particles = [];
      animationId = null;
    }
  }

  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  animationId = requestAnimationFrame(animate);
}
