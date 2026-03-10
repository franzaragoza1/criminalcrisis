import { useEffect, useRef, useCallback } from 'react';

const FACE_IMAGES = [
  '/img/iconos/icono_enfadado1_criminalCrisis.png',
  '/img/iconos/icono_indiferente1_criminalCrisis.png',
  '/img/iconos/icono_triste1_criminalCrisis.png',
  '/img/iconos/icono_feliz1_criminalCrisis.png',
  '/img/iconos/icono_feliz2_criminalCrisis.png',
  '/img/iconos/icono_triste2_criminalCrisis.png',
];

const ROWS = 3;
const COLS = 6;
const INV_W = 54;
const INV_H = 54;
const GAP_X = 90;
const GAP_Y = 74;
const POINTS_PER_ROW = [30, 20, 10]; // top row = more points

interface Props {
  onExit: () => void;
}

export default function SpaceInvaders({ onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // ── Load images ────────────────────────────────────────────────────
    const imgs: HTMLImageElement[] = [];
    let loaded = 0;
    FACE_IMAGES.forEach((src, i) => {
      const img = new Image();
      img.onload = img.onerror = () => { loaded++; if (loaded === FACE_IMAGES.length) init(); };
      img.src = src;
      imgs[i] = img;
    });

    // ── State ──────────────────────────────────────────────────────────
    let running = false;
    let over = false;
    let score = 0;
    let lives = 3;
    let rafId = 0;
    let lastShot = 0;
    let invDir = 1;
    let invSpeed = 1.3;
    let invShootTimer = 0;
    let invShootInterval = 95;

    type Bullet = { x: number; y: number; vy: number };
    type Invader = { x: number; y: number; row: number; imgIdx: number; alive: boolean; flash: number };

    let player = { x: 0, y: 0 };
    let invaders: Invader[] = [];
    let pBullets: Bullet[] = [];
    let eBullets: Bullet[] = [];
    const keys: Record<string, boolean> = {};
    let mouseX = -1;

    // ── Setup ──────────────────────────────────────────────────────────
    function init() {
      score = 0; lives = 3; over = false;
      invDir = 1; invSpeed = 1.3;
      invShootTimer = 0; invShootInterval = 95;
      pBullets = []; eBullets = [];
      mouseX = canvas.width / 2;

      player = { x: canvas.width / 2, y: canvas.height - 70 };

      invaders = [];
      const totalW = (COLS - 1) * GAP_X;
      const startX = (canvas.width - totalW) / 2;
      const startY = 100;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          invaders.push({
            x: startX + c * GAP_X,
            y: startY + r * GAP_Y,
            row: r,
            imgIdx: r % FACE_IMAGES.length,
            alive: true,
            flash: 0,
          });
        }
      }

      running = true;
      rafId = requestAnimationFrame(loop);
    }

    // ── Game loop ──────────────────────────────────────────────────────
    function loop() {
      if (!running) return;
      update();
      draw();
      rafId = requestAnimationFrame(loop);
    }

    function update() {
      // Player movement
      const spd = 7;
      if (keys['ArrowLeft'] || keys['KeyA']) player.x -= spd;
      if (keys['ArrowRight'] || keys['KeyD']) player.x += spd;
      if (mouseX >= 0) player.x += (mouseX - player.x) * 0.1;
      player.x = Math.max(24, Math.min(canvas.width - 24, player.x));

      // Player bullets
      pBullets.forEach(b => { b.y -= 14; });
      pBullets = pBullets.filter(b => b.y > -20);

      // Enemy bullets
      eBullets.forEach(b => { b.y += 5; });
      eBullets = eBullets.filter(b => b.y < canvas.height + 20);

      // Invaders
      const alive = invaders.filter(i => i.alive);
      if (alive.length === 0) { endGame(true); return; }

      let wall = false;
      alive.forEach(inv => {
        inv.x += invSpeed * invDir;
        if (inv.x + INV_W / 2 > canvas.width - 8 || inv.x - INV_W / 2 < 8) wall = true;
      });
      if (wall) {
        invDir *= -1;
        alive.forEach(inv => { inv.y += 24; });
        invSpeed = Math.min(invSpeed + 0.3, 8);
      }

      // Invaders reached player → game over
      if (alive.some(inv => inv.y + INV_H / 2 > player.y - 16)) { endGame(false); return; }

      // Enemy shooting
      invShootTimer++;
      if (invShootTimer >= invShootInterval) {
        invShootTimer = 0;
        const shooter = alive[Math.floor(Math.random() * alive.length)];
        eBullets.push({ x: shooter.x, y: shooter.y + INV_H / 2, vy: 0 });
        invShootInterval = Math.max(28, 95 - (ROWS * COLS - alive.length) * 3);
      }

      // Player bullet ↔ invader
      pBullets.forEach(b => {
        invaders.forEach(inv => {
          if (!inv.alive) return;
          if (b.x > inv.x - INV_W / 2 && b.x < inv.x + INV_W / 2 &&
              b.y > inv.y - INV_H / 2 && b.y < inv.y + INV_H / 2) {
            inv.alive = false;
            inv.flash = 8;
            b.y = -9999;
            score += POINTS_PER_ROW[inv.row] ?? 10;
          }
        });
      });

      // Enemy bullet ↔ player
      eBullets.forEach(b => {
        if (Math.abs(b.x - player.x) < 20 && Math.abs(b.y - player.y) < 18) {
          b.y = 99999;
          lives--;
          if (lives <= 0) { endGame(false); }
        }
      });

      invaders.forEach(inv => { if (inv.flash > 0) inv.flash--; });
    }

    function shoot() {
      const now = Date.now();
      if (pBullets.length < 3 && now - lastShot > 180) {
        lastShot = now;
        pBullets.push({ x: player.x, y: player.y - 20, vy: 0 });
      }
    }

    // ── Draw ───────────────────────────────────────────────────────────
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#FAFAFA';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // HUD
      ctx.fillStyle = '#111';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`SCORE  ${String(score).padStart(5, '0')}`, 24, 46);
      ctx.textAlign = 'right';
      const lifeStr = '▲ '.repeat(Math.max(0, lives)).trim();
      ctx.fillText(`LIVES  ${lifeStr}`, canvas.width - 24, 46);

      // Ground line
      ctx.strokeStyle = '#E0E0E0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height - 36);
      ctx.lineTo(canvas.width, canvas.height - 36);
      ctx.stroke();

      // Player (upward triangle)
      const pw = 44, ph = 28;
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.moveTo(player.x, player.y - ph / 2);
      ctx.lineTo(player.x - pw / 2, player.y + ph / 2);
      ctx.lineTo(player.x + pw / 2, player.y + ph / 2);
      ctx.closePath();
      ctx.fill();

      // Player bullets
      ctx.fillStyle = '#111';
      pBullets.forEach(b => ctx.fillRect(b.x - 1.5, b.y, 3, 14));

      // Enemy bullets
      ctx.fillStyle = '#C0BABC';
      eBullets.forEach(b => ctx.fillRect(b.x - 2, b.y, 4, 10));

      // Invaders
      invaders.forEach(inv => {
        if (!inv.alive) return;
        ctx.save();
        if (inv.flash > 0) ctx.filter = 'invert(1)';
        ctx.drawImage(imgs[inv.imgIdx], inv.x - INV_W / 2, inv.y - INV_H / 2, INV_W, INV_H);
        ctx.restore();
      });

    }

    function endGame(win: boolean) {
      running = false;
      over = true;
      ctx.fillStyle = '#FAFAFA';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#111';
      ctx.font = 'bold 40px monospace';
      ctx.fillText(win ? 'ALL FACES DESTROYED' : 'GAME OVER', canvas.width / 2, canvas.height / 2 - 28);

      ctx.font = '15px monospace';
      ctx.fillStyle = '#555';
      ctx.fillText(`SCORE: ${score}`, canvas.width / 2, canvas.height / 2 + 14);

      ctx.font = '11px monospace';
      ctx.fillStyle = '#C0BABC';
      ctx.fillText('CLICK O PULSA EXIT PARA SALIR', canvas.width / 2, canvas.height / 2 + 50);
      ctx.textAlign = 'left';
    }

    // ── Input ──────────────────────────────────────────────────────────
    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.code] = true;
      if (e.code === 'Space') { e.preventDefault(); if (!over) shoot(); }
      if (e.code === 'Escape') onExit();
    };
    const onKeyUp = (e: KeyboardEvent) => { delete keys[e.code]; };
    const onMouseMove = (e: MouseEvent) => { mouseX = e.clientX; };
    const onClick = () => { if (over) { onExit(); } else { shoot(); } };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('click', onClick);

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('click', onClick);
    };
  }, [onExit]);

  const handleExit = useCallback(() => onExit(), [onExit]);

  return (
    <div className="fixed inset-0 z-[200]">
      <canvas ref={canvasRef} className="w-full h-full cursor-crosshair" />
      <button
        onClick={handleExit}
        className="absolute top-4 left-1/2 -translate-x-1/2 font-mono text-xs font-bold tracking-[0.25em] uppercase border border-[#111] px-4 py-2 text-[#111] bg-[#FAFAFA] hover:bg-[#111] hover:text-[#FAFAFA] transition-colors cursor-pointer"
      >
        EXIT
      </button>
    </div>
  );
}
