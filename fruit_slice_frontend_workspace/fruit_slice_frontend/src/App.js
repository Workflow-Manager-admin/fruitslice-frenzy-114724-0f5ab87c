import React, { useRef, useState, useEffect, useCallback } from "react";
import "./App.css";
import fruitIcon from "./fruit_icon.svg";

// Sounds (placeholders, to be replaced with real assets when building for prod)
const SLICE_SOUND_URL =
  "https://cdn.pixabay.com/audio/2022/11/16/audio_12f4dbb6a8.mp3";
const MISS_SOUND_URL =
  "https://cdn.pixabay.com/audio/2022/07/26/audio_12359e1a80.mp3";
const GAMEOVER_SOUND_URL =
  "https://cdn.pixabay.com/audio/2022/11/16/audio_12f4dbb6a8.mp3";

const FRUIT_TYPES = [
  {
    name: "apple",
    color: "#D32F2F",
    radius: 28,
    score: 1,
    emoji: "🍎"
  },
  {
    name: "banana",
    color: "#FBC02D",
    radius: 25,
    score: 2,
    emoji: "🍌"
  },
  {
    name: "watermelon",
    color: "#43A047",
    radius: 35,
    score: 3,
    emoji: "🍉"
  },
  {
    name: "orange",
    color: "#F57C00",
    radius: 27,
    score: 2,
    emoji: "🍊"
  },
  {
    name: "lemon",
    color: "#FFF176",
    radius: 22,
    score: 1,
    emoji: "🍋"
  }
];

// Helper to load sound
function useSound(src, volume = 1.0) {
  const audio = useRef(null);
  useEffect(() => {
    audio.current = new window.Audio(src);
    audio.current.volume = volume;
  }, [src, volume]);
  return () => {
    if (audio.current) {
      audio.current.currentTime = 0;
      audio.current.play();
    }
  };
}

// Returns a random value in [min, max]
function randBetween(min, max) {
  return Math.random() * (max - min) + min;
}

// Fruit object generator
function createFruit(canvasWidth, canvasHeight) {
  const fruit = FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
  const x = randBetween(40, canvasWidth - 40);
  const radius = fruit.radius;
  const y = -radius;
  const speed = randBetween(2.5, 5.8); // px/frame (can adjust)
  const rot = randBetween(0, 360);
  const rotSpeed = randBetween(-2, 2);
  return {
    ...fruit,
    id: `${Date.now()}_${Math.random()}`,
    x,
    y,
    radius,
    speed,
    rot,
    rotSpeed,
    sliced: false,
    sliceAnim: 0
  };
}

/**
 * PUBLIC_INTERFACE
 * Fruit Slice Game Root Component
 */
function App() {
  // Game state
  const [fruits, setFruits] = useState([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameState, setGameState] = useState("start"); // start, running, over
  const [isMuted, setIsMuted] = useState(false);
  const [theme, setTheme] = useState("dark");
  const gameAreaRef = useRef(null);
  const requestRef = useRef();
  const spawnTimerRef = useRef();
  const prevFrameTimeRef = useRef();

  // Touch/mouse slicing path
  const [slicePath, setSlicePath] = useState([]);
  const [showSliceTrail, setShowSliceTrail] = useState(false);
  const sliceTrailTimeout = useRef();

  // Sounds
  const playSlice = useSound(SLICE_SOUND_URL, isMuted ? 0 : 0.18);
  const playMiss = useSound(MISS_SOUND_URL, isMuted ? 0 : 0.13);
  const playGameOver = useSound(GAMEOVER_SOUND_URL, isMuted ? 0 : 0.15);

  // Responsive canvas size
  const [canvasSize, setCanvasSize] = useState({ width: 360, height: 540 });
  // Adjust on mount and resize
  useEffect(() => {
    const updateSize = () => {
      const container = gameAreaRef.current;
      if (container) {
        let w = container.offsetWidth;
        let h = container.offsetHeight;
        // Maintain aspect ratio (2:3)
        if (w / h > 0.6667) { w = h * 0.6667; }
        else { h = w / 0.6667; }
        setCanvasSize({
          width: Math.round(w),
          height: Math.round(h)
        });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Spawn fruit interval (faster as you play)
  const startFruitSpawner = useCallback(() => {
    stopFruitSpawner();
    function spawn() {
      setFruits((prev) => [
        ...prev,
        createFruit(canvasSize.width, canvasSize.height)
      ]);
      spawnTimerRef.current = setTimeout(
        spawn,
        randBetween(530, 1100)
      );
    }
    spawnTimerRef.current = setTimeout(
      spawn,
      randBetween(600, 1350)
    );
  }, [canvasSize]);

  function stopFruitSpawner() {
    if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current);
    spawnTimerRef.current = null;
  }

  // Game main loop
  const gameLoop = useCallback(
    (timestamp) => {
      setFruits((prevFruits) => {
        const res = prevFruits
          .map((fruit) => {
            // Animate position & rotation if not sliced
            if (!fruit.sliced) {
              return {
                ...fruit,
                y: fruit.y + fruit.speed,
                rot: (fruit.rot + fruit.rotSpeed) % 360
              };
            } else if (fruit.sliceAnim < 1) {
              // Animate slice (outward fall)
              return {
                ...fruit,
                sliceAnim: fruit.sliceAnim + 0.13
              };
            } else {
              return { ...fruit }; // sliced and finished animating, will be filtered below
            }
          })
          .filter((fruit) => {
            // Remove sliced fruits after animation, and missed fruits after falling
            if (fruit.sliced && fruit.sliceAnim >= 1) return false;
            if (!fruit.sliced && fruit.y - fruit.radius > canvasSize.height)
              return false;
            return true;
          });
        return res;
      });

      prevFrameTimeRef.current = timestamp;
      requestRef.current = requestAnimationFrame(gameLoop);
    },
    [canvasSize.height]
  );

  // Run game loop if running
  useEffect(() => {
    if (gameState === "running") {
      requestRef.current = requestAnimationFrame(gameLoop);
      return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
      };
    }
  }, [gameState, gameLoop]);

  // Spawn fruits only when running
  useEffect(() => {
    if (gameState === "running") {
      startFruitSpawner();
      return () => stopFruitSpawner();
    }
  }, [gameState, startFruitSpawner]);

  // Handle missed fruits (subtract lives, play sound)
  useEffect(() => {
    if (gameState === "running" && fruits.length) {
      setFruits((prev) => {
        let missed = 0;
        const filtered = prev.filter((fruit) => {
          if (
            !fruit.sliced &&
            fruit.y - fruit.radius > canvasSize.height
          ) {
            missed++;
            return false;
          }
          return true;
        });
        if (missed > 0) {
          setLives((l) => Math.max(l - missed, 0));
          if (!isMuted) playMiss();
        }
        return filtered;
      });
    }
    // eslint-disable-next-line
  }, [fruits, gameState, canvasSize.height, isMuted]);

  // End game - game over
  useEffect(() => {
    if (lives <= 0 && gameState === "running") {
      setGameState("over");
      playGameOver();
      stopFruitSpawner();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    // eslint-disable-next-line
  }, [lives, gameState]);

  // Reset game state
  function startGame() {
    setScore(0);
    setLives(3);
    setFruits([]);
    setGameState("running");
  }

  // Slicing interaction

  // PUBLIC_INTERFACE
  function handleSlice(point) {
    if (gameState !== "running") return;
    let slicedAny = false;
    setFruits((prevFruits) =>
      prevFruits.map((fruit) => {
        if (
          !fruit.sliced &&
          Math.hypot(point.x - fruit.x, point.y - fruit.y) <= fruit.radius + 6
        ) {
          slicedAny = true;
          setScore((s) => s + fruit.score);
          setTimeout(() => playSlice(), 0);
          return {
            ...fruit,
            sliced: true,
            sliceAnim: 0
          };
        }
        return fruit;
      })
    );
    // Show slicing trail
    if (slicedAny) {
      setShowSliceTrail(true);
      if (sliceTrailTimeout.current) clearTimeout(sliceTrailTimeout.current);
      sliceTrailTimeout.current = setTimeout(() => {
        setShowSliceTrail(false);
      }, 250);
    }
  }

  // Touch & mouse event handling
  // For both, map relative to canvas
  function eventToPos(evt) {
    const rect = gameAreaRef.current.getBoundingClientRect();
    let x, y;
    if (evt.touches && evt.touches.length) {
      x = evt.touches[0].clientX - rect.left;
      y = evt.touches[0].clientY - rect.top;
    } else {
      x = evt.clientX - rect.left;
      y = evt.clientY - rect.top;
    }
    // Clamp to boundaries
    x = Math.min(Math.max(x, 0), canvasSize.width);
    y = Math.min(Math.max(y, 0), canvasSize.height);
    return { x, y };
  }

  // For trail: keep last 8 points
  function addPathPoint(pt) {
    setSlicePath((prev) => [...prev.slice(-7), pt]);
  }

  // For mouse/touch
  function handlePointerDown(evt) {
    if (gameState !== "running") return; // No interactions if not running
    setSlicePath([]);
    addPathPoint(eventToPos(evt));
    setShowSliceTrail(true);
  }
  function handlePointerMove(evt) {
    if (gameState !== "running" || (!evt.buttons && !evt.touches)) return;
    const pt = eventToPos(evt);
    addPathPoint(pt);
    handleSlice(pt);
  }
  function handlePointerUp() {
    setShowSliceTrail(false);
    setSlicePath([]);
  }

  // Keyboard controls: space or R restarts at game over
  useEffect(() => {
    function onKeyDown(e) {
      if (gameState === "over" && (e.code === "Space" || e.code === "KeyR")) {
        startGame();
      }
      if (e.code === "KeyM") setIsMuted((m) => !m);
      if (e.code === "KeyT") setTheme((t) => (t === "dark" ? "light" : "dark"));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line
  }, [gameState]);

  // PUBLIC_INTERFACE
  function toggleMute() {
    setIsMuted((m) => !m);
  }

  // PUBLIC_INTERFACE
  function toggleTheme() {
    setTheme((theme) => (theme === "dark" ? "light" : "dark"));
  }

  // Draw game on canvas
  function drawFruits(ctx) {
    // Animate all fruits
    fruits.forEach((fruit) => {
      ctx.save();
      ctx.translate(fruit.x, fruit.y);
      ctx.rotate((fruit.rot * Math.PI) / 180);
      if (!fruit.sliced) {
        // Draw as a circle + emoji for now (can use SVG/PNG as needed)
        ctx.beginPath();
        ctx.arc(0, 0, fruit.radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = fruit.color;
        ctx.shadowColor = fruit.color;
        ctx.shadowBlur = 14;
        ctx.globalAlpha = 0.98;
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
        ctx.font = `${fruit.radius * 1.15}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeStyle = "#120d11";
        ctx.lineWidth = 2;
        ctx.strokeText(fruit.emoji, 0, 2);
        ctx.fillText(fruit.emoji, 0, 2);
      } else {
        // Sliced: quick split halves trail
        let halfOffset = fruit.sliceAnim * 22 + 16;
        ctx.save();
        ctx.translate(-halfOffset, -fruit.sliceAnim * 10);
        ctx.beginPath();
        ctx.arc(0, 0, fruit.radius, Math.PI * 1.13, Math.PI * 2.13, false);
        ctx.fillStyle = "#fafafa";
        ctx.globalAlpha = 0.82;
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = fruit.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = fruit.color;
        ctx.globalAlpha = 0.90;
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.textAlign = "center";
        ctx.font = `${fruit.radius * 1.04}px serif`;
        ctx.fillText(fruit.emoji, 0, 2);
        ctx.restore();

        ctx.save();
        ctx.translate(halfOffset, fruit.sliceAnim * 10);
        ctx.beginPath();
        ctx.arc(0, 0, fruit.radius, Math.PI * 0.13, Math.PI * 1.13, false);
        ctx.fillStyle = "#eee";
        ctx.globalAlpha = 0.62;
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = fruit.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = fruit.color;
        ctx.globalAlpha = 0.9;
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.textAlign = "center";
        ctx.font = `${fruit.radius * 1.04}px serif`;
        ctx.fillText(fruit.emoji, 0, 2);
        ctx.restore();
      }
      ctx.restore();
    });
  }

  // Draw slice trail (white with accent glow, mimics blade)
  function drawSliceTrail(ctx) {
    if (!showSliceTrail || slicePath.length < 2) return;
    ctx.save();
    ctx.strokeStyle = "#fff";
    ctx.shadowColor = "#FBC02D";
    ctx.shadowBlur = 15;
    ctx.lineWidth = 7.5;
    ctx.globalAlpha = 0.52;
    ctx.beginPath();
    ctx.moveTo(slicePath[0].x, slicePath[0].y);
    for (let i = 1; i < slicePath.length; ++i) {
      ctx.lineTo(slicePath[i].x, slicePath[i].y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#D32F2F";
    ctx.beginPath();
    ctx.moveTo(slicePath[0].x, slicePath[0].y);
    for (let i = 1; i < slicePath.length; ++i) {
      ctx.lineTo(slicePath[i].x, slicePath[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Use canvas for main game area
  const canvasRef = useRef();
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    // Clear
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
    drawFruits(ctx);
    drawSliceTrail(ctx);
    // UI overlays etc can be drawn here if desired
  });

  // Main render
  return (
    <div className="fruit-slice-app">
      <main className="fruit-main">
        <header className="fruit-header">
          <div className="brand">
            <img src={fruitIcon} alt="logo" className="fruit-logo" />
            <span>Fruit Slice</span>
          </div>
          <div className="score-lives">
            <span
              className="lives"
              title="Lives"
              aria-label={`Lives: ${lives}`}
            >
              {"❤️".repeat(Math.max(0, lives))}
            </span>
            <span className="score" aria-label={`Score: ${score}`}>
              <span>Score: </span>
              <b>{score}</b>
            </span>
          </div>
          <div className="settings-bar">
            <button
              className="btn-round theme-btn"
              aria-label="Toggle color theme"
              onClick={toggleTheme}
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <button
              className="btn-round sound-btn"
              onClick={toggleMute}
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? "🔇" : "🔊"}
            </button>
          </div>
        </header>
        <section
          className="game-area-wrapper"
          ref={gameAreaRef}
          style={{
            aspectRatio: "2/3",
            width: "min(95vw, 420px)",
            height: "min(140vw, 630px)",
            margin: "0 auto",
            position: "relative"
          }}
        >
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            role="presentation"
            className="fruit-canvas"
            tabIndex={0}
            aria-label="Fruit Slice game area"
            // Mouse events
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            // Touch events
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
            style={{
              borderRadius: 18,
              background:
                "radial-gradient(circle at 65% 30%, #222 70%, #161616 100%)",
              display: "block",
              margin: "0 auto",
              touchAction: "none"
            }}
          />
          {/* Overlay UI */}
          {gameState === "start" && (
            <div className="game-overlay">
              <div className="overlay-main">
                <h1>Fruit Slice 🍉</h1>
                <p>
                  Swipe (touch) or drag (mouse) to slice fruits.<br />
                  <span className="overlay-hint">
                    <span>Space/R to restart • M to mute • T to theme</span>
                  </span>
                </p>
                <button className="start-btn" onClick={startGame}>
                  Start Game
                </button>
              </div>
            </div>
          )}
          {gameState === "over" && (
            <div className="game-overlay">
              <div className="overlay-main">
                <h2>Game Over</h2>
                <div className="final-score">
                  <span>Your Score: </span>
                  <b>{score}</b>
                </div>
                <button className="restart-btn" onClick={startGame}>
                  Restart
                </button>
                <div className="overlay-hint">
                  <span>
                    Press <b>Space</b> or <b>R</b> to restart
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>
        <footer className="fruit-footer">
          <span>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Source
            </a>{" "}
            | Fruit Slice Game | Built with React
          </span>
        </footer>
      </main>
    </div>
  );
}

export default App;
