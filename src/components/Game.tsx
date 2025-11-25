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
      };
    } else if (!gameOver) {
      gameStateRef.current.playerVelocity = -4; // Slower jump
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
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const CANVAS_WIDTH = 400;
    const CANVAS_HEIGHT = 600;
    const PLAYER_SIZE = 50;
    const PIPE_WIDTH = 70;
    const PIPE_GAP = 180;
    const GRAVITY = 0.25; // Slower, smoother gravity
    const PIPE_SPEED = 1.5; // Slower pipe movement

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

      // Add new pipes
      if (state.frameCount % 120 === 0) {
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
        if (!pipe.passed && pipe.x + PIPE_WIDTH < CANVAS_WIDTH / 2 - PLAYER_SIZE / 2) {
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

      // Check collisions
      const playerX = CANVAS_WIDTH / 2 - PLAYER_SIZE / 2;
      const playerTop = state.playerY;
      const playerBottom = state.playerY + PLAYER_SIZE;

      // Ground and ceiling collision
      if (playerTop <= 0 || playerBottom >= CANVAS_HEIGHT) {
        setGameOver(true);
      }

      // Pipe collision
      state.pipes.forEach((pipe) => {
        if (
          playerX + PLAYER_SIZE > pipe.x &&
          playerX < pipe.x + PIPE_WIDTH &&
          (playerTop < pipe.topHeight || playerBottom > pipe.topHeight + pipe.gap)
        ) {
          setGameOver(true);
        }
      });

      // Draw background
      if (imagesRef.current.background) {
        ctx.drawImage(imagesRef.current.background, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      } else {
        ctx.fillStyle = "#1a1a2e";
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

      // Draw player
      if (imagesRef.current.player) {
        ctx.drawImage(
          imagesRef.current.player,
          playerX,
          state.playerY,
          PLAYER_SIZE,
          PLAYER_SIZE
        );
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
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
      <div className="flex items-center gap-8 mb-2">
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1">SCORE</p>
          <p className="text-2xl font-bold">{score}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-accent mb-1">BEST</p>
          <p className="text-2xl font-bold text-accent">{bestScore}</p>
        </div>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={400}
          height={600}
          className="border-4 border-border rounded-lg shadow-2xl cursor-pointer"
          onClick={jump}
        />

        {!gameStarted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 rounded-lg">
            <h1 className="text-4xl font-bold mb-8 text-accent">YOLO BIRD</h1>
            <p className="text-sm mb-4">TAP OR PRESS SPACE</p>
            <p className="text-xs text-muted-foreground">TO START</p>
          </div>
        )}

        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-lg">
            <h2 className="text-3xl font-bold mb-4">GAME OVER</h2>
            <p className="text-lg mb-2">SCORE: {score}</p>
            <p className="text-sm text-accent mb-6">BEST: {bestScore}</p>
            <Button onClick={resetGame} className="bg-accent text-accent-foreground hover:bg-accent/90">
              RETRY
            </Button>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        CLICK OR PRESS SPACE TO FLAP
      </p>
    </div>
  );
};
