import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import yoloPlayerImg from "@/assets/yolo-player.png";
import cheetahPipeImg from "@/assets/cheetah-pipe.png";
import cheetahTopPipeImg from "@/assets/cheetah-top-pipe.png";
import backgroundImg from "@/assets/background.jpg";
import gameMusic from "@/assets/game-music.mp3";
import audioOnImg from "@/assets/audio-on.png";
import audioOffImg from "@/assets/audio-off.png";
import weedCollectibleImg from "@/assets/weed-collectible.png";
import redflagCollectibleImg from "@/assets/redflag-collectible.png";
import winSound from "@/assets/win-sound.mp3";
import errorSound from "@/assets/error-sound.mp3";

interface Pipe {
  x: number;
  topHeight: number;
  gap: number;
  passed: boolean;
}

interface Weed {
  x: number;
  y: number;
  collected: boolean;
}

interface Redflag {
  x: number;
  y: number;
  collected: boolean;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  opacity: number;
  startTime: number;
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
  const [worstScore, setWorstScore] = useState(() => {
    const saved = localStorage.getItem("worstScore");
    return saved ? parseInt(saved) : 0;
  });
  const [isMuted, setIsMuted] = useState(false);
  const [weedCount, setWeedCount] = useState(0);
  const [redflagCount, setRedflagCount] = useState(0);
  const [hueShift, setHueShift] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const winSoundRef = useRef<HTMLAudioElement>(null);
  const errorSoundRef = useRef<HTMLAudioElement>(null);

  const gameStateRef = useRef({
    playerY: 250,
    playerVelocity: 0,
    pipes: [] as Pipe[],
    weeds: [] as Weed[],
    redflags: [] as Redflag[],
    floatingTexts: [] as FloatingText[],
    frameCount: 0,
    rotation: 0,
  });

  const imagesRef = useRef({
    player: null as HTMLImageElement | null,
    pipe: null as HTMLImageElement | null,
    topPipe: null as HTMLImageElement | null,
    background: null as HTMLImageElement | null,
    weed: null as HTMLImageElement | null,
    redflag: null as HTMLImageElement | null,
    audioOn: null as HTMLImageElement | null,
    audioOff: null as HTMLImageElement | null,
  });

  // Load images and setup audio
  useEffect(() => {
    const playerImage = new Image();
    playerImage.src = yoloPlayerImg;
    imagesRef.current.player = playerImage;

    const pipeImage = new Image();
    pipeImage.src = cheetahPipeImg;
    imagesRef.current.pipe = pipeImage;

    const topPipeImage = new Image();
    topPipeImage.src = cheetahTopPipeImg;
    imagesRef.current.topPipe = topPipeImage;

    const bgImage = new Image();
    bgImage.src = backgroundImg;
    imagesRef.current.background = bgImage;

    const weedImage = new Image();
    weedImage.src = weedCollectibleImg;
    imagesRef.current.weed = weedImage;

    const redflagImage = new Image();
    redflagImage.src = redflagCollectibleImg;
    imagesRef.current.redflag = redflagImage;

    const audioOnImage = new Image();
    audioOnImage.src = audioOnImg;
    imagesRef.current.audioOn = audioOnImage;

    const audioOffImage = new Image();
    audioOffImage.src = audioOffImg;
    imagesRef.current.audioOff = audioOffImage;

    // Setup audio
    if (audioRef.current) {
      audioRef.current.loop = true;
      audioRef.current.volume = 0.3;
    }
    if (winSoundRef.current) {
      winSoundRef.current.volume = 0.5;
    }
    if (errorSoundRef.current) {
      errorSoundRef.current.volume = 0.5;
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
      setWeedCount(0);
      setRedflagCount(0);
    gameStateRef.current = {
      playerY: 250,
      playerVelocity: 0,
      pipes: [],
      weeds: [],
      redflags: [],
      floatingTexts: [],
      frameCount: 150, // Start closer to first pipe spawn
      rotation: 0,
    };
    } else if (!gameOver) {
      gameStateRef.current.playerVelocity = -12; // Bigger jump for faster gravity
    }
  }, [gameStarted, gameOver]);

  const resetGame = () => {
    setGameStarted(false);
    setGameOver(false);
    setScore(0);
    setWeedCount(0);
    setRedflagCount(0);
    gameStateRef.current = {
      playerY: 250,
      playerVelocity: 0,
      pipes: [],
      weeds: [],
      redflags: [],
      floatingTexts: [],
      frameCount: 150, // Start closer to first pipe spawn
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
    const isMobile = window.innerWidth <= 768;
    const scale = isMobile ? 0.5 : 1;
    const PLAYER_SIZE = 70 * scale;
    const PIPE_WIDTH = 120 * scale;
    const GRAVITY = 0.7;
    const PIPE_SPEED = 12;
    const PLAYER_X = CANVAS_WIDTH * 0.25;
    const WEED_SIZE = 75 * scale;

    let animationFrameId: number;

    const gameLoop = () => {
      if (!gameStarted || gameOver) {
        animationFrameId = requestAnimationFrame(gameLoop);
        return;
      }

      const state = gameStateRef.current;
      state.frameCount++;

      // Progressive difficulty: start easier, get harder
      const difficultyFactor = Math.min(score / 20, 1); // Max difficulty at score 20
      const PIPE_GAP = 400 - difficultyFactor * 100; // Start at 400, minimum 300
      const PIPE_SPAWN_RATE = 200 - difficultyFactor * 50; // Start at 200, minimum 150

      // Update player physics
      state.playerVelocity += GRAVITY;
      state.playerY += state.playerVelocity;

      // Update rotation based on velocity
      state.rotation = Math.min(Math.max(state.playerVelocity * 5, -25), 90);

      // Add new pipes with progressive difficulty
      if (state.frameCount % PIPE_SPAWN_RATE === 0) {
        const topHeight = Math.random() * (CANVAS_HEIGHT - PIPE_GAP - 200) + 100;
        state.pipes.push({
          x: CANVAS_WIDTH,
          topHeight,
          gap: PIPE_GAP,
          passed: false,
        });

        // Spawn weed or durex collectible at 60% rate
        const rand = Math.random();
        if (rand < 0.4) {
          // Position collectible closer to pipes (top or bottom of gap)
          const nearPipe = Math.random() < 0.5;
          const collectibleY = nearPipe 
            ? topHeight + 20 // Near top pipe
            : topHeight + PIPE_GAP - WEED_SIZE - 20; // Near bottom pipe
          state.weeds.push({
            x: CANVAS_WIDTH + PIPE_WIDTH / 2 - WEED_SIZE / 2,
            y: collectibleY,
            collected: false,
          });
        } else if (rand < 0.6) {
          // Position collectible closer to pipes (top or bottom of gap)
          const nearPipe = Math.random() < 0.5;
          const collectibleY = nearPipe 
            ? topHeight + 20 // Near top pipe
            : topHeight + PIPE_GAP - WEED_SIZE - 20; // Near bottom pipe
          state.redflags.push({
            x: CANVAS_WIDTH + PIPE_WIDTH / 2 - WEED_SIZE / 2,
            y: collectibleY,
            collected: false,
          });
        }
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

      // Update weeds
      state.weeds.forEach((weed) => {
        weed.x -= PIPE_SPEED;
      });

      // Update redflags
      state.redflags.forEach((redflag) => {
        redflag.x -= PIPE_SPEED;
      });

      // Update floating texts
      const currentTime = Date.now();
      state.floatingTexts = state.floatingTexts.filter((text) => {
        const elapsed = currentTime - text.startTime;
        const duration = 1000; // 1 second animation
        if (elapsed < duration) {
          text.y -= 0.5; // Move up
          text.opacity = 1 - elapsed / duration; // Fade out
          return true;
        }
        return false;
      });

      // Remove off-screen pipes, weeds, and redflags
      state.pipes = state.pipes.filter((pipe) => pipe.x > -PIPE_WIDTH);
      state.weeds = state.weeds.filter((weed) => weed.x > -WEED_SIZE);
      state.redflags = state.redflags.filter((redflag) => redflag.x > -WEED_SIZE);

      // Check collisions with improved hitbox (more forgiving)
      const hitboxMargin = 12; // More forgiving collision
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
        // More forgiving pipe collision - only check the inner part of pipes
        const pipeLeftEdge = pipe.x + 20; // Ignore outer edges
        const pipeRightEdge = pipe.x + PIPE_WIDTH - 20;
        
        if (
          playerRight > pipeLeftEdge &&
          playerLeft < pipeRightEdge &&
          (playerTop < pipe.topHeight || playerBottom > pipe.topHeight + pipe.gap)
        ) {
          setGameOver(true);
        }
      });

      // Weed collection
      state.weeds.forEach((weed) => {
        if (!weed.collected) {
          const weedLeft = weed.x;
          const weedRight = weed.x + WEED_SIZE;
          const weedTop = weed.y;
          const weedBottom = weed.y + WEED_SIZE;

          if (
            playerRight > weedLeft &&
            playerLeft < weedRight &&
            playerBottom > weedTop &&
            playerTop < weedBottom
          ) {
            weed.collected = true;
            setWeedCount(prev => prev + 1);
            // Play win sound
            if (winSoundRef.current) {
              winSoundRef.current.currentTime = 0;
              winSoundRef.current.play().catch(() => {});
            }
            // Add floating text
            state.floatingTexts.push({
              x: PLAYER_X + PLAYER_SIZE + 10,
              y: state.playerY + PLAYER_SIZE / 2,
              text: "+67€",
              opacity: 1,
              startTime: Date.now(),
            });
            setScore((prev) => {
              const newScore = prev + 67;
              if (newScore > bestScore) {
                setBestScore(newScore);
                localStorage.setItem("bestScore", newScore.toString());
              }
              if (newScore < worstScore) {
                setWorstScore(newScore);
                localStorage.setItem("worstScore", newScore.toString());
              }
              // Trigger hue shift at 300 points
              if (newScore >= 300 && prev < 300) {
                setHueShift(true);
                setTimeout(() => setHueShift(false), 10000);
              }
              return newScore;
            });
          }
        }
      });

      // Redflag collection (negative)
      state.redflags.forEach((redflag) => {
        if (!redflag.collected) {
          const redflagLeft = redflag.x;
          const redflagRight = redflag.x + WEED_SIZE;
          const redflagTop = redflag.y;
          const redflagBottom = redflag.y + WEED_SIZE;

          if (
            playerRight > redflagLeft &&
            playerLeft < redflagRight &&
            playerBottom > redflagTop &&
            playerTop < redflagBottom
          ) {
            redflag.collected = true;
            setRedflagCount(prev => prev + 1);
            // Play error sound
            if (errorSoundRef.current) {
              errorSoundRef.current.currentTime = 0;
              errorSoundRef.current.play().catch(() => {});
            }
            // Add floating text
            state.floatingTexts.push({
              x: PLAYER_X + PLAYER_SIZE + 10,
              y: state.playerY + PLAYER_SIZE / 2,
              text: "-67€",
              opacity: 1,
              startTime: Date.now(),
            });
            setScore((prev) => {
              const newScore = prev - 67;
              if (newScore < worstScore) {
                setWorstScore(newScore);
                localStorage.setItem("worstScore", newScore.toString());
              }
              return newScore;
            });
          }
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

      // Draw pipes using actual pipe image without stretching - "cut off" at desired length
      state.pipes.forEach((pipe) => {
        if (imagesRef.current.topPipe && imagesRef.current.pipe) {
          const topPipeImg = imagesRef.current.topPipe;
          const pipeImg = imagesRef.current.pipe;
          const pipeAspectRatio = pipeImg.width / pipeImg.height;
          const renderedWidth = PIPE_WIDTH;
          const renderedHeight = renderedWidth / pipeAspectRatio;
          
          // Top pipe - facing upward (no rotation)
          const topPipeHeight = pipe.topHeight;
          const topPipeSourceHeight = (topPipeHeight / renderedWidth) * topPipeImg.width;
          ctx.drawImage(
            topPipeImg,
            0,
            Math.max(0, topPipeImg.height - topPipeSourceHeight),
            topPipeImg.width,
            Math.min(topPipeImg.height, topPipeSourceHeight),
            pipe.x,
            0,
            PIPE_WIDTH,
            topPipeHeight
          );

          // Bottom pipe - normal orientation facing up
          const bottomPipeY = pipe.topHeight + pipe.gap;
          const bottomPipeHeight = CANVAS_HEIGHT - bottomPipeY;
          const bottomPipeSourceHeight = (bottomPipeHeight / renderedWidth) * pipeImg.width;
          ctx.drawImage(
            imagesRef.current.pipe,
            0,
            0,
            pipeImg.width,
            Math.min(pipeImg.height, bottomPipeSourceHeight),
            pipe.x,
            bottomPipeY,
            PIPE_WIDTH,
            bottomPipeHeight
          );
        }
      });

      // Draw weeds with bounce animation
      const bounceOffset = Math.sin(state.frameCount * 0.05) * 5;
      state.weeds.forEach((weed) => {
        if (!weed.collected && imagesRef.current.weed) {
          ctx.drawImage(
            imagesRef.current.weed,
            weed.x,
            weed.y + bounceOffset,
            WEED_SIZE,
            WEED_SIZE
          );
        }
      });

      // Draw redflags with bounce animation
      state.redflags.forEach((redflag) => {
        if (!redflag.collected && imagesRef.current.redflag) {
          ctx.drawImage(
            imagesRef.current.redflag,
            redflag.x,
            redflag.y + bounceOffset,
            WEED_SIZE,
            WEED_SIZE
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

      // Draw floating texts
      state.floatingTexts.forEach((text) => {
        ctx.save();
        ctx.globalAlpha = text.opacity;
        ctx.font = `bold ${60 * scale}px 'VT323', monospace`;
        const isPositive = text.text.startsWith("+");
        ctx.fillStyle = isPositive ? "#84cc16" : "#ef4444";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 4 * scale;
        ctx.strokeText(text.text, text.x, text.y);
        ctx.fillText(text.text, text.x, text.y);
        ctx.restore();
      });

      // Draw scrolling text at bottom - First line
      const scrollSpeed = 2.0; // Twice as fast
      const scrollText1 = "YOLO OUT NOW!!!!!!!!        "; // More spacing
      ctx.font = `bold ${40 * scale}px 'VT323', monospace`; // Set font before measuring
      const textMetrics1 = ctx.measureText(scrollText1);
      const textWidth1 = textMetrics1.width;
      const scrollOffset1 = (state.frameCount * scrollSpeed) % textWidth1;
      
      ctx.save();
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      
      // Create drastic strobe effect
      const strobeAlpha = 0.4 + Math.sin(state.frameCount * 0.2) * 0.6;
      ctx.globalAlpha = strobeAlpha;
      
      // Draw first text multiple times to fill the width
      const repeats1 = Math.ceil(CANVAS_WIDTH / textWidth1) + 1;
      for (let i = 0; i < repeats1; i++) {
        ctx.fillText(scrollText1, i * textWidth1 - scrollOffset1, CANVAS_HEIGHT - (80 * scale));
      }
      ctx.restore();

      // Draw scrolling text at bottom - Second line
      const scrollText2 = "YOLO 4 EVER        "; // More spacing
      const textMetrics2 = ctx.measureText(scrollText2);
      const textWidth2 = textMetrics2.width;
      const scrollOffset2 = (state.frameCount * scrollSpeed * 1.5) % textWidth2; // Different speed
      
      ctx.save();
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      
      // Create drastic strobe effect
      ctx.globalAlpha = strobeAlpha;
      
      // Draw second text multiple times to fill the width
      const repeats2 = Math.ceil(CANVAS_WIDTH / textWidth2) + 1;
      for (let i = 0; i < repeats2; i++) {
        ctx.fillText(scrollText2, i * textWidth2 - scrollOffset2, CANVAS_HEIGHT - (40 * scale));
      }
      ctx.restore();

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
    <div 
      className="fixed inset-0 overflow-hidden bg-background transition-all duration-1000"
      style={hueShift ? {
        animation: 'hue-rotate 10s linear',
        filter: `hue-rotate(${Date.now() % 360}deg)`
      } : score < 0 ? {
        filter: 'invert(1)'
      } : {}}
    >
      <style>
        {`
          @keyframes hue-rotate {
            0% { filter: hue-rotate(0deg); }
            100% { filter: hue-rotate(360deg); }
          }
        `}
      </style>
      {/* Audio elements */}
      <audio ref={audioRef} src={gameMusic} />
      <audio ref={winSoundRef} src={winSound} />
      <audio ref={errorSoundRef} src={errorSound} />
      
      {/* Mute Button - Top Left with Pixelated Graphics */}
      <button
        onClick={toggleMute}
        className="absolute top-4 left-4 md:top-8 md:left-8 z-10 w-[38px] h-[38px] md:w-[76px] md:h-[76px] flex items-center justify-center hover:scale-110 transition-transform"
        style={{ imageRendering: 'pixelated' }}
      >
        <img 
          src={isMuted ? audioOffImg : audioOnImg} 
          alt={isMuted ? "Audio Off" : "Audio On"}
          className="w-full h-full"
          style={{ imageRendering: 'pixelated' }}
        />
      </button>

      {/* Collectible Counters - Top Left under audio button */}
      {gameStarted && !gameOver && (
        <div className="absolute top-16 left-4 md:top-32 md:left-8 z-10 flex flex-col gap-2 md:gap-4">
          <div className="flex items-center gap-2 md:gap-4">
            <img 
              src={weedCollectibleImg} 
              alt="Weed" 
              className="w-[30px] h-[30px] md:w-[60px] md:h-[60px]"
              style={{ imageRendering: 'pixelated' }}
            />
            <p className="text-[25px] md:text-[50px] font-bold text-white drop-shadow-[0_5px_10px_rgba(0,0,0,0.8)]" style={{ fontFamily: "'VT323', monospace", imageRendering: 'pixelated' }}>
              {weedCount}
            </p>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <img 
              src={redflagCollectibleImg} 
              alt="Red Flag" 
              className="w-[30px] h-[30px] md:w-[60px] md:h-[60px]"
              style={{ imageRendering: 'pixelated' }}
            />
            <p className="text-[25px] md:text-[50px] font-bold text-white drop-shadow-[0_5px_10px_rgba(0,0,0,0.8)]" style={{ fontFamily: "'VT323', monospace", imageRendering: 'pixelated' }}>
              {redflagCount}
            </p>
          </div>
        </div>
      )}

      {/* Score Display at Top Right - Only during gameplay */}
      {gameStarted && !gameOver && (
        <div className="absolute top-4 right-4 md:top-8 md:right-8 z-10">
          <p className="text-[38px] md:text-[75px] font-bold text-white drop-shadow-[0_5px_10px_rgba(0,0,0,0.8)]" style={{ fontFamily: "'VT323', monospace", imageRendering: 'pixelated' }}>{score}€</p>
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
        <div 
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm cursor-pointer"
          onClick={jump}
        >
          <h1 className="text-[38px] md:text-[75px] font-bold mb-4 md:mb-8 text-accent drop-shadow-[0_0_20px_rgba(132,204,22,0.7)]" style={{ fontFamily: "'VT323', monospace", imageRendering: 'pixelated' }}>
            YOLO BIRD
          </h1>
          <p className="text-[13px] md:text-[26px] mb-2 md:mb-4 text-white" style={{ fontFamily: "'VT323', monospace", imageRendering: 'pixelated' }}>TAP OR PRESS SPACE</p>
          <p className="text-[8px] md:text-[16px] text-muted-foreground" style={{ fontFamily: "'VT323', monospace", imageRendering: 'pixelated' }}>TO START</p>
        </div>
      )}

      {/* Game Over Overlay */}
      {gameOver && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
          <h2 className="text-[31px] md:text-[62px] font-bold mb-3 md:mb-6 text-white" style={{ fontFamily: "'VT323', monospace", imageRendering: 'pixelated' }}>GAME OVER</h2>
          <p className="text-[15px] md:text-[30px] mb-1 md:mb-2 text-white" style={{ fontFamily: "'VT323', monospace", imageRendering: 'pixelated' }}>SCORE: {score}€</p>
          <p className="text-[13px] md:text-[26px] text-accent mb-1 md:mb-2" style={{ fontFamily: "'VT323', monospace", imageRendering: 'pixelated' }}>BEST: {bestScore}€</p>
          <p className="text-[13px] md:text-[26px] text-red-500 mb-4 md:mb-8" style={{ fontFamily: "'VT323', monospace", imageRendering: 'pixelated' }}>WORST: {worstScore}€</p>
          <Button 
            onClick={resetGame} 
            className="bg-accent text-black hover:bg-accent/90 text-sm md:text-lg px-4 py-3 md:px-8 md:py-6 font-bold"
            style={{ fontFamily: "'VT323', monospace" }}
          >
            RETRY
          </Button>
        </div>
      )}
    </div>
  );
};
