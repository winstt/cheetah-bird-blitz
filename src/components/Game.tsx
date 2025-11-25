import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import yoloPlayerImg from "@/assets/yolo-player.png";
import cheetahPipeImg from "@/assets/cheetah-pipe.png";
import backgroundImg from "@/assets/background.jpg";

interface Pipe {
  x: number;
  topHeight: number;
  gap: number;
  passed: boolean;
}

export const Game = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(() => {
    const saved = localStorage.getItem("bestScore");
    return saved ? parseInt(saved) : 0;
  });

  const gameStateRef = useRef({
    playerY: 250,
    playerVelocity: 0,
    pipes: [] as Pipe[],
    frameCount: 0,
    rotation: 0,
  });

  const imagesRef = useRef({
    player: null as HTMLImageElement | null,
    pipe: null as HTMLImageElement | null,
    background: null as HTMLImageElement | null,
  });

  // Load images
  useEffect(() => {
    const playerImage = new Image();
    playerImage.src = yoloPlayerImg;
    imagesRef.current.player = playerImage;

    const pipeImage = new Image();
    pipeImage.src = cheetahPipeImg;
    imagesRef.current.pipe = pipeImage;

    const bgImage = new Image();
    bgImage.src = backgroundImg;
    imagesRef.current.background = bgImage;
  }, []);

  const jump = useCallback(() => {
    if (!gameStarted) {
      setGameStarted(true);
      setGameOver(false);
      setScore(0);
      gameStateRef.current = {
        playerY: 250,
        playerVelocity: 0,
        pipes: [],
        frameCount: 0,
        rotation: 0,
      };
    } else if (!gameOver) {
      gameStateRef.current.playerVelocity = -3; // Even slower jump
    }
  }, [gameStarted, gameOver]);

  const resetGame = () => {
    setGameStarted(false);
    setGameOver(false);
    setScore(0);
    gameStateRef.current = {
      playerY: 250,
      playerVelocity: 0,
      pipes: [],
      frameCount: 0,
      rotation: 0,
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const CANVAS_WIDTH = window.innerWidth;
    const CANVAS_HEIGHT = window.innerHeight;
    const PLAYER_SIZE = 50;
    const PIPE_WIDTH = 80;
    const PIPE_GAP = 200;
    const GRAVITY = 0.18; // Even slower, smoother gravity
    const PIPE_SPEED = 1.2; // Even slower pipe movement
    const PLAYER_X = CANVAS_WIDTH * 0.25; // Position on left quarter

    let animationFrameId: number;

    const gameLoop = () => {
      if (!gameStarted || gameOver) {
        animationFrameId = requestAnimationFrame(gameLoop);
        return;
      }

      const state = gameStateRef.current;
      state.frameCount++;

      // Update player physics
      state.playerVelocity += GRAVITY;
      state.playerY += state.playerVelocity;

      // Update rotation based on velocity
      state.rotation = Math.min(Math.max(state.playerVelocity * 5, -25), 90);

      // Add new pipes (slower spawn rate)
      if (state.frameCount % 150 === 0) {
        const topHeight = Math.random() * (CANVAS_HEIGHT - PIPE_GAP - 200) + 100;
        state.pipes.push({
          x: CANVAS_WIDTH,
          topHeight,
          gap: PIPE_GAP,
          passed: false,
        });
      }

      // Update pipes
      state.pipes.forEach((pipe) => {
        pipe.x -= PIPE_SPEED;

        // Check if player passed pipe
        if (!pipe.passed && pipe.x + PIPE_WIDTH < PLAYER_X) {
          pipe.passed = true;
          setScore((prev) => {
            const newScore = prev + 1;
            if (newScore > bestScore) {
              setBestScore(newScore);
              localStorage.setItem("bestScore", newScore.toString());
            }
            return newScore;
          });
        }
      });

      // Remove off-screen pipes
      state.pipes = state.pipes.filter((pipe) => pipe.x > -PIPE_WIDTH);

      // Check collisions with improved hitbox (smaller, more forgiving)
      const hitboxMargin = 8; // Reduce effective collision area
      const playerLeft = PLAYER_X + hitboxMargin;
      const playerRight = PLAYER_X + PLAYER_SIZE - hitboxMargin;
      const playerTop = state.playerY + hitboxMargin;
      const playerBottom = state.playerY + PLAYER_SIZE - hitboxMargin;

      // Ground and ceiling collision
      if (playerTop <= 0 || playerBottom >= CANVAS_HEIGHT) {
        setGameOver(true);
      }

      // Pipe collision with improved hitbox
      state.pipes.forEach((pipe) => {
        if (
          playerRight > pipe.x &&
          playerLeft < pipe.x + PIPE_WIDTH &&
          (playerTop < pipe.topHeight || playerBottom > pipe.topHeight + pipe.gap)
        ) {
          setGameOver(true);
        }
      });

      // Clear canvas
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw background stretched to fill
      if (imagesRef.current.background) {
        ctx.drawImage(imagesRef.current.background, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      } else {
        ctx.fillStyle = "#70c5ce";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }

      // Draw pipes with cheetah texture
      state.pipes.forEach((pipe) => {
        if (imagesRef.current.pipe) {
          // Top pipe
          const topPipeHeight = pipe.topHeight;
          const pattern = ctx.createPattern(imagesRef.current.pipe, "repeat");
          if (pattern) {
            ctx.fillStyle = pattern;
            ctx.fillRect(pipe.x, 0, PIPE_WIDTH, topPipeHeight);
          }

          // Bottom pipe
          const bottomPipeY = pipe.topHeight + pipe.gap;
          const bottomPipeHeight = CANVAS_HEIGHT - bottomPipeY;
          if (pattern) {
            ctx.fillStyle = pattern;
            ctx.fillRect(pipe.x, bottomPipeY, PIPE_WIDTH, bottomPipeHeight);
          }

          // Pipe borders
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 3;
          ctx.strokeRect(pipe.x, 0, PIPE_WIDTH, topPipeHeight);
          ctx.strokeRect(pipe.x, bottomPipeY, PIPE_WIDTH, bottomPipeHeight);
        }
      });

      // Draw player with rotation
      if (imagesRef.current.player) {
        ctx.save();
        ctx.translate(PLAYER_X + PLAYER_SIZE / 2, state.playerY + PLAYER_SIZE / 2);
        ctx.rotate((state.rotation * Math.PI) / 180);
        ctx.drawImage(
          imagesRef.current.player,
          -PLAYER_SIZE / 2,
          -PLAYER_SIZE / 2,
          PLAYER_SIZE,
          PLAYER_SIZE
        );
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        jump();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    gameLoop();

    return () => {
      window.removeEventListener("keydown", handleKeyPress);
      cancelAnimationFrame(animationFrameId);
    };
  }, [gameStarted, gameOver, jump, bestScore]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-background">
      {/* Score Display at Top */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-8 px-6 py-3 bg-black/30 rounded-lg border-2 border-accent/50">
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1">SCORE</p>
          <p className="text-3xl font-bold text-white">{score}</p>
        </div>
        <div className="h-8 w-px bg-accent/50" />
        <div className="text-center">
          <p className="text-xs text-accent mb-1">BEST</p>
          <p className="text-3xl font-bold text-accent">{bestScore}</p>
        </div>
      </div>

      {/* Fullscreen Canvas */}
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        className="cursor-pointer"
        onClick={jump}
        style={{ imageRendering: 'pixelated' }}
      />

      {/* Start Screen Overlay */}
      {!gameStarted && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
          <h1 className="text-6xl font-bold mb-8 text-accent drop-shadow-[0_0_10px_rgba(132,204,22,0.5)]">
            YOLO BIRD
          </h1>
          <p className="text-xl mb-4 text-white">TAP OR PRESS SPACE</p>
          <p className="text-sm text-muted-foreground">TO START</p>
        </div>
      )}

      {/* Game Over Overlay */}
      {gameOver && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
          <h2 className="text-5xl font-bold mb-6 text-white">GAME OVER</h2>
          <p className="text-2xl mb-2 text-white">SCORE: {score}</p>
          <p className="text-xl text-accent mb-8">BEST: {bestScore}</p>
          <Button 
            onClick={resetGame} 
            className="bg-accent text-black hover:bg-accent/90 text-lg px-8 py-6 font-bold"
          >
            RETRY
          </Button>
        </div>
      )}
    </div>
  );
};
