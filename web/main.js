import { startLoop } from './loop.js';
import { createInput, EMPTY_INPUT } from './input.js';

const canvas = document.getElementById('screen');
const context = canvas.getContext('2d');
const input = createInput();

const fitToWindow = () => {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(canvas.clientWidth * ratio);
  canvas.height = Math.round(canvas.clientHeight * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
};

window.addEventListener('resize', fitToWindow);
fitToWindow();

const rates = { ticks: 0, frames: 0, ticksPerSecond: 0, framesPerSecond: 0, since: 0 };

const countSecond = (elapsed) => {
  rates.since += elapsed;
  if (rates.since < 1) return;
  rates.ticksPerSecond = Math.round(rates.ticks / rates.since);
  rates.framesPerSecond = Math.round(rates.frames / rates.since);
  rates.ticks = 0;
  rates.frames = 0;
  rates.since = 0;
};

let held = EMPTY_INPUT;

const tick = () => {
  held = input.read();
  rates.ticks += 1;
};

const render = (alpha, frameSeconds) => {
  rates.frames += 1;
  countSecond(frameSeconds);

  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  context.clearRect(0, 0, width, height);

  const pressed = Object.keys(held).filter((action) => held[action]);
  const lines = [
    `ticks/s ${rates.ticksPerSecond}`,
    `frames/s ${rates.framesPerSecond}`,
    `alpha ${alpha.toFixed(3)}`,
    `held ${pressed.length ? pressed.join(' ') : '-'}`,
  ];

  context.fillStyle = '#e8f5e9';
  context.font = '16px monospace';
  context.textBaseline = 'top';
  lines.forEach((line, index) => context.fillText(line, 16, 16 + index * 20));
};

startLoop({ tick, render });
