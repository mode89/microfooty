export const createDebugOverlay = () => {
  const rates = {
    ticks: 0,
    frames: 0,
    ticksPerSecond: 0,
    framesPerSecond: 0,
    elapsed: 0,
  };

  return {
    recordTick() {
      rates.ticks += 1;
    },
    recordFrame(wallClockSeconds) {
      rates.frames += 1;
      rates.elapsed += wallClockSeconds;
      if (rates.elapsed < 1) return;

      rates.ticksPerSecond = Math.round(rates.ticks / rates.elapsed);
      rates.framesPerSecond = Math.round(rates.frames / rates.elapsed);
      rates.ticks = 0;
      rates.frames = 0;
      rates.elapsed = 0;
    },
    draw(context, { ball, player }) {
      const lines = debugLines(rates, ball, player);
      context.fillStyle = "#e8f5e9";
      context.font = "16px monospace";
      context.textBaseline = "top";
      lines.forEach((line, index) =>
        context.fillText(line, 16, 16 + index * 20),
      );
    },
  };
};

const debugLines = (rates, ball, player) => [
  `ticks/s ${rates.ticksPerSecond}`,
  `frames/s ${rates.framesPerSecond}`,
  `ball position ${vector3(ball.position)}`,
  `ball velocity ${vector3(ball.velocity)}`,
  `player position ${vector2(player.position)}`,
  `player velocity ${vector2(player.velocity)}`,
  `player facing ${player.facing}`,
];

const vector2 = ({ x, y }) => `${x.toFixed(2)} ${y.toFixed(2)}`;
const vector3 = ({ x, y, z }) => `${vector2({ x, y })} ${z.toFixed(2)}`;
