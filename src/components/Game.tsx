import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX } from "lucide-react";
import yoloPlayerImg from "@/assets/yolo-player.png";
import cheetahPipeImg from "@/assets/cheetah-pipe.png";
import backgroundImg from "@/assets/background.jpg";
import gameMusic from "@/assets/game-music.mp3";

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
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

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

  // Load images and setup audio
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

    // Setup audio
    if (audioRef.current) {
      audioRef.current.loop = true;
      audioRef.current.volume = 0.3;
    }
  }, []);

  // Handle audio play/pause
  useEffect(() => {
    if (audioRef.current) {
      if (gameStarted && !gameOver && !isMuted) {
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
    }
  }, [gameStarted, gameOver, isMuted]);

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

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
      gameStateRef.current.playerVelocity = -5; // Bigger jump
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
    const PLAYER_SIZE = 70;
    const PIPE_WIDTH = 120;
    const PIPE_GAP = 280;
    const GRAVITY = 0.09; // Slowed by half
    const PIPE_SPEED = 0.6; // Slowed by half
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

      // Add new pipes (much more spacing between pipes)
      if (state.frameCount % 300 === 0) {
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

      // Draw pipes using actual pipe image stretched
      state.pipes.forEach((pipe) => {
        if (imagesRef.current.pipe) {
          // Top pipe - draw image stretched and flipped
          ctx.save();
          ctx.translate(pipe.x + PIPE_WIDTH, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(
            imagesRef.current.pipe,
            0,
            0,
            PIPE_WIDTH,
            pipe.topHeight
          );
          ctx.restore();

          // Bottom pipe - draw image stretched
          const bottomPipeY = pipe.topHeight + pipe.gap;
          const bottomPipeHeight = CANVAS_HEIGHT - bottomPipeY;
          ctx.drawImage(
            imagesRef.current.pipe,
            pipe.x,
            bottomPipeY,
            PIPE_WIDTH,
            bottomPipeHeight
          );
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
      {/* Audio element */}
      <audio ref={audioRef} src={gameMusic} />
      
      {/* Mute Button - Top Left */}
      <button
        onClick={toggleMute}
        className="absolute top-8 left-8 z-10 w-12 h-12 flex items-center justify-center bg-black/50 border-2 border-white hover:bg-black/70 transition-colors"
        style={{ imageRendering: 'pixelated' }}
      >
        {isMuted ? (
          <VolumeX className="w-6 h-6 text-white" strokeWidth={3} />
        ) : (
          <Volume2 className="w-6 h-6 text-white" strokeWidth={3} />
        )}
      </button>

      {/* Score Display at Top Right - Only during gameplay */}
      {gameStarted && !gameOver && (
        <div className="absolute top-8 right-8 z-10">
          <p className="text-6xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{score}</p>
        </div>
      )}

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
