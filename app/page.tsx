'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type PlayerInput = {
  name: string;
  accel: number;
  topSpeed: number;
  stamina: number;
  cornering: number;
  weight: number;
  luck: number;
  color: string;
};

type SimPlayer = {
  dist: number;
  vel: number;
  staminaLeft: number;
};

type SimState = {
  players: SimPlayer[];
  contactCooldown: number;
  lastUiUpdate: number;
};

type Snapshot = {
  players: {
    dist: number;
    vel: number;
    staminaLeft: number;
    lap: number;
  }[];
};

const TRACK_LENGTH = 400;
const LAPS = 3;
const CONTACT_EPS = 2.4;

const STAT_FIELDS: { key: keyof PlayerInput; label: string }[] = [
  { key: 'accel', label: 'Accel' },
  { key: 'topSpeed', label: 'Top Speed' },
  { key: 'stamina', label: 'Stamina' },
  { key: 'cornering', label: 'Cornering' },
  { key: 'weight', label: 'Weight' },
  { key: 'luck', label: 'Luck' },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const createSimPlayer = (input: PlayerInput): SimPlayer => ({
  dist: 0,
  vel: 0,
  staminaLeft: input.stamina,
});

export default function Home() {
  const [players, setPlayers] = useState<PlayerInput[]>([
    {
      name: 'Player A',
      accel: 72,
      topSpeed: 78,
      stamina: 64,
      cornering: 70,
      weight: 48,
      luck: 42,
      color: '#ff6b5c',
    },
    {
      name: 'Player B',
      accel: 64,
      topSpeed: 84,
      stamina: 70,
      cornering: 62,
      weight: 52,
      luck: 55,
      color: '#4bb7ff',
    },
  ]);
  const [raceState, setRaceState] = useState<'idle' | 'running' | 'finished'>(
    'idle'
  );
  const [winner, setWinner] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>({
    players: [
      { dist: 0, vel: 0, staminaLeft: players[0].stamina, lap: 0 },
      { dist: 0, vel: 0, staminaLeft: players[1].stamina, lap: 0 },
    ],
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasSizeRef = useRef({ width: 900, height: 520, dpr: 1 });
  const simRef = useRef<SimState | null>(null);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const maxWidth = Math.min(960, parent.clientWidth);
    const width = Math.max(280, Math.floor(maxWidth));
    const height = Math.floor(width * 0.58);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvasSizeRef.current = { width, height, dpr };
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  const updatePlayer = useCallback(
    (index: number, key: keyof PlayerInput, value: number | string) => {
      setPlayers((prev) => {
        const next = [...prev];
        const nextValue =
          typeof value === 'number' ? clamp(value, 0, 100) : value;
        next[index] = {
          ...next[index],
          [key]: nextValue,
        } as PlayerInput;
        return next;
      });
    },
    []
  );

  const startRace = useCallback(() => {
    setWinner(null);
    setRaceState('running');
    simRef.current = {
      players: players.map(createSimPlayer),
      contactCooldown: 0,
      lastUiUpdate: performance.now(),
    };
    setSnapshot({
      players: players.map((player) => ({
        dist: 0,
        vel: 0,
        staminaLeft: player.stamina,
        lap: 0,
      })),
    });
  }, [players]);

  const resetRace = useCallback(() => {
    setRaceState('idle');
    setWinner(null);
    simRef.current = null;
    setSnapshot({
      players: players.map((player) => ({
        dist: 0,
        vel: 0,
        staminaLeft: player.stamina,
        lap: 0,
      })),
    });
  }, [players]);

  const stepSimulation = useCallback(
    (dt: number) => {
      const sim = simRef.current;
      if (!sim) return { finished: false, winnerIndex: null } as const;

      const next = sim.players;
      const finishLine = TRACK_LENGTH * LAPS;

      next.forEach((runner, index) => {
        const stats = players[index];
        const theta = ((runner.dist % TRACK_LENGTH) / TRACK_LENGTH) * Math.PI * 2;
        const curveIntensity = Math.abs(Math.sin(theta));
        const corneringBoost = 0.6 + (stats.cornering / 100) * 0.4;
        const curveCoeff = 1 - curveIntensity * (1 - corneringBoost);

        const vMaxBase = 30 + stats.topSpeed * 0.9;
        let vMax = vMaxBase * curveCoeff;
        let accel = 15 + stats.accel * 0.7;

        const weightPenalty = stats.weight * 0.18;
        accel = Math.max(4, accel - weightPenalty);

        const staminaDrain = 0.4 + runner.vel / 110;
        runner.staminaLeft = Math.max(
          0,
          runner.staminaLeft - staminaDrain * dt * 6
        );

        if (runner.staminaLeft < 40) {
          vMax *= 0.85;
          accel *= 0.8;
        }
        if (runner.staminaLeft < 15) {
          vMax *= 0.7;
          accel *= 0.6;
        }

        const luckNudge = (Math.random() - 0.5) * (stats.luck * 0.08);
        runner.vel = clamp(runner.vel + (accel * dt + luckNudge), 0, vMax);
        runner.dist += runner.vel * dt;
      });

      const gap = Math.abs(next[0].dist - next[1].dist);
      if (gap < CONTACT_EPS && sim.contactCooldown <= 0) {
        const curveBias = Math.abs(
          Math.sin(((next[0].dist % TRACK_LENGTH) / TRACK_LENGTH) * Math.PI * 2)
        );
        const impactA = players[0].weight + players[0].cornering * 0.4;
        const impactB = players[1].weight + players[1].cornering * 0.4;
        const heavyIndex = impactA >= impactB ? 0 : 1;
        const lightIndex = heavyIndex === 0 ? 1 : 0;
        const lightDiff = next[lightIndex].dist - next[heavyIndex].dist;
        const pushAmount = CONTACT_EPS - Math.abs(lightDiff);
        if (pushAmount > 0) {
          const direction = Math.sign(lightDiff) || 1;
          next[lightIndex].dist = Math.max(
            0,
            next[lightIndex].dist + direction * pushAmount
          );
        }
        const penalty = 0.7 - curveBias * 0.1;
        if (impactA >= impactB) {
          next[1].vel *= penalty + players[1].cornering * 0.0015;
        } else {
          next[0].vel *= penalty + players[0].cornering * 0.0015;
        }
        sim.contactCooldown = 0.35;
      }

      sim.contactCooldown = Math.max(0, sim.contactCooldown - dt);

      const winnerIndex = next.findIndex((runner) => runner.dist >= finishLine);
      return {
        finished: winnerIndex !== -1,
        winnerIndex: winnerIndex === -1 ? null : winnerIndex,
      } as const;
    },
    [players]
  );

  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const { width, height, dpr } = canvasSizeRef.current;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    const { width: layoutWidth, height: layoutHeight } = canvasSizeRef.current;
    const cx = layoutWidth / 2;
    const cy = layoutHeight / 2;
    const rx = layoutWidth * 0.36;
    const ry = layoutHeight * 0.28;

    context.save();
    context.beginPath();
    context.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    context.strokeStyle = '#2a313c';
    context.lineWidth = 30;
    context.stroke();

    context.beginPath();
    context.ellipse(cx, cy, rx - 18, ry - 18, 0, 0, Math.PI * 2);
    context.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    context.lineWidth = 3;
    context.stroke();
    context.restore();

    context.save();
    context.strokeStyle = '#f5e7da';
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(cx + rx - 12, cy - 16);
    context.lineTo(cx + rx - 12, cy + 16);
    context.stroke();
    context.restore();

    const sim = simRef.current;
    const runners = sim ? sim.players : [];

    runners.forEach((runner, index) => {
      const theta = ((runner.dist % TRACK_LENGTH) / TRACK_LENGTH) * Math.PI * 2;
      const x = cx + rx * Math.cos(theta);
      const y = cy + ry * Math.sin(theta);
      context.save();
      context.beginPath();
      context.fillStyle = players[index].color;
      context.shadowColor = players[index].color;
      context.shadowBlur = 12;
      context.arc(x, y, 10, 0, Math.PI * 2);
      context.fill();
      context.restore();
    });
  }, [players]);

  useEffect(() => {
    if (raceState !== 'running') {
      drawScene();
      return;
    }

    let raf = 0;
    let last = performance.now();
    let active = true;

    const loop = (now: number) => {
      if (!active) return;
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;

      const result = stepSimulation(delta);
      drawScene();

      const sim = simRef.current;
      if (sim && now - sim.lastUiUpdate > 120) {
        setSnapshot({
          players: sim.players.map((runner) => ({
            dist: runner.dist,
            vel: runner.vel,
            staminaLeft: runner.staminaLeft,
            lap: Math.min(LAPS, Math.floor(runner.dist / TRACK_LENGTH)),
          })),
        });
        sim.lastUiUpdate = now;
      }

      if (result.finished && result.winnerIndex !== null) {
        setRaceState('finished');
        setWinner(players[result.winnerIndex].name);
        return;
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);

    return () => {
      active = false;
      cancelAnimationFrame(raf);
    };
  }, [drawScene, players, raceState, stepSimulation]);

  useEffect(() => {
    if (raceState !== 'finished') return;
    drawScene();
  }, [drawScene, raceState]);

  return (
    <main className="page">
      <section className="hero">
        <h1 className="hero-title">PopPop Racing</h1>
        <p className="hero-subtitle">
          2人限定の観戦型2Dオートレース。数値をセットして一気に走らせよう。
        </p>
      </section>

      <section className="layout">
        <div className="panel">
          <p className="panel-title">Player Setup</p>
          <div className="player-grid">
            {players.map((player, index) => (
              <div className="player-card" key={`player-${index}`}>
                <h3 style={{ color: player.color }}>{player.name}</h3>
                <div className="field-row">
                  <label htmlFor={`name-${index}`}>Name</label>
                  <input
                    id={`name-${index}`}
                    type="text"
                    value={player.name}
                    disabled={raceState === 'running'}
                    onChange={(event) =>
                      updatePlayer(index, 'name', event.target.value)
                    }
                  />
                </div>
                {STAT_FIELDS.map((field) => (
                  <div className="field-row" key={field.key}>
                    <label>{field.label}</label>
                    <div style={{ display: 'grid', gap: 8 }}>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={player[field.key] as number}
                        disabled={raceState === 'running'}
                        onChange={(event) =>
                          updatePlayer(
                            index,
                            field.key,
                            Number(event.target.value)
                          )
                        }
                      />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={player[field.key] as number}
                        disabled={raceState === 'running'}
                        onChange={(event) =>
                          updatePlayer(
                            index,
                            field.key,
                            Number(event.target.value)
                          )
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="control-bar">
            <button
              className="button"
              onClick={startRace}
              disabled={raceState === 'running'}
            >
              {raceState === 'running' ? 'Running...' : 'レース開始'}
            </button>
            <button
              className="button secondary"
              onClick={resetRace}
              disabled={raceState === 'running'}
            >
              再走準備
            </button>
          </div>
        </div>

        <div className="panel race-panel">
          <p className="panel-title">Race View</p>
          <div className="canvas-wrap">
            <canvas className="race-canvas" ref={canvasRef} />
          </div>
          {winner && (
            <div className="winner">Winner: {winner}</div>
          )}
          <div className="status-grid">
            {snapshot.players.map((runner, index) => (
              <div className="status-card" key={`status-${index}`}>
                <h4 style={{ color: players[index].color }}>
                  {players[index].name}
                </h4>
                <p>Lap {runner.lap}/{LAPS}</p>
                <p>Dist {runner.dist.toFixed(1)}</p>
                <p>Speed {runner.vel.toFixed(1)}</p>
                <p>Stamina {runner.staminaLeft.toFixed(0)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
