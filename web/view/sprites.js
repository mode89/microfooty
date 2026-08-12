// Source art turned into ready-to-draw images: the sheet is cut into frames,
// scaled up, and baked into one offscreen canvas set per kit at load, so a kit
// costs nothing to draw.
export const SPRITE_SCALE = 8;
export const SHEET_FRAMES = Object.freeze(["down", "right", "up"]);

const PLAYER_FRAME_SIZE = 8;

// The sheet paints its background in this colour instead of carrying an alpha
// channel, so it is removed when the frames are cut.
const COLOUR_KEY = Object.freeze({ red: 255, green: 0, blue: 255 });

const BALL_PIXELS = Object.freeze(["#.#", "...", ".#."]);
const BALL_COLOURS = Object.freeze({ ".": "#fdfdfd", "#": "#1a1a1a" });

export async function loadPlayerSheet(url) {
  const sheet = await loadImage(url);
  validatePlayerSheet(sheet.width, sheet.height);
  return sheet;
}

// Cuts the sheet into frames and pre-scales each one with nearest-neighbour, so
// per-frame drawing can keep smoothing on at fractional positions and still
// show chunky pixels. The left frame is the mirror of the right one. One
// loaded sheet is cut once per kit, repainted differently each time.
export function cutPlayerSprites(
  sheet,
  scale = SPRITE_SCALE,
  repaint = (pixels) => pixels,
) {
  const cuts = sliceFrames(sheet.width, sheet.height, SHEET_FRAMES.length);
  const sprites = Object.fromEntries(
    SHEET_FRAMES.map((frame, index) => [
      frame,
      prescaleFrame(sheet, cuts[index], scale, repaint),
    ]),
  );
  return Object.freeze({ ...sprites, left: mirrorSprite(sprites.right) });
}

export function createBallSprite(scale = SPRITE_SCALE) {
  const size = BALL_PIXELS.length;
  const drawn = createCanvas(size, size);
  BALL_PIXELS.forEach((row, y) =>
    [...row].forEach((pixel, x) => {
      drawn.context.fillStyle = BALL_COLOURS[pixel];
      drawn.context.fillRect(x, y, 1, 1);
    }),
  );
  return scaleSprite(drawn.canvas, size * scale, size * scale);
}

export function drawSprite(context, sprite, centre, width, height) {
  return context.drawImage(
    sprite,
    centre.x - width / 2,
    centre.y - height / 2,
    width,
    height,
  );
}

export function validatePlayerSheet(sheetWidth, sheetHeight) {
  const expectedWidth = PLAYER_FRAME_SIZE * SHEET_FRAMES.length;
  if (sheetWidth !== expectedWidth || sheetHeight !== PLAYER_FRAME_SIZE)
    throw new Error(
      `player sheet must be ${expectedWidth} x ${PLAYER_FRAME_SIZE} px (three square 8 x 8 frames), got ${sheetWidth} x ${sheetHeight} px`,
    );
}

export function sliceFrames(sheetWidth, sheetHeight, frameCount) {
  const width = sheetWidth / frameCount;
  if (!Number.isInteger(width))
    throw new Error(
      `a sheet ${sheetWidth} px wide does not split into ${frameCount} frames`,
    );
  return Array.from({ length: frameCount }, (unused, index) => ({
    x: index * width,
    y: 0,
    width,
    height: sheetHeight,
  }));
}

export function keyColour(pixels, key = COLOUR_KEY) {
  const keyed = new Uint8ClampedArray(pixels);
  for (let byte = 0; byte < keyed.length; byte += 4) {
    if (
      keyed[byte] === key.red &&
      keyed[byte + 1] === key.green &&
      keyed[byte + 2] === key.blue
    )
      keyed[byte + 3] = 0;
  }
  return keyed;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`cannot load ${url}`));
    image.src = url;
  });
}

function prescaleFrame(sheet, frame, scale, repaint) {
  const cut = createCanvas(frame.width, frame.height);
  cut.context.drawImage(
    sheet,
    frame.x,
    frame.y,
    frame.width,
    frame.height,
    0,
    0,
    frame.width,
    frame.height,
  );
  const painted = cut.context.getImageData(0, 0, frame.width, frame.height);
  // Repainted first, then keyed: a kit colour equal to the key would be made
  // transparent, so kits keep off the magenta.
  const recoloured = repaint(painted.data);
  cut.context.putImageData(
    new ImageData(keyColour(recoloured), frame.width, frame.height),
    0,
    0,
  );
  return scaleSprite(cut.canvas, frame.width * scale, frame.height * scale);
}

function scaleSprite(source, width, height) {
  const scaled = createCanvas(width, height);
  scaled.context.imageSmoothingEnabled = false;
  scaled.context.drawImage(source, 0, 0, width, height);
  return scaled.canvas;
}

function mirrorSprite(sprite) {
  const mirrored = createCanvas(sprite.width, sprite.height);
  mirrored.context.translate(sprite.width, 0);
  mirrored.context.scale(-1, 1);
  mirrored.context.drawImage(sprite, 0, 0);
  return mirrored.canvas;
}

function createCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return { canvas, context: canvas.getContext("2d") };
}

// The two colours the source art stripes the shirt in.
const SOURCE_COLOURS = Object.freeze({
  shirt: Object.freeze({ red: 0, green: 112, blue: 255 }),
  stripe: Object.freeze({ red: 255, green: 255, blue: 255 }),
});

export async function loadKitSprites(url, kits, scale = SPRITE_SCALE) {
  const sheet = await loadPlayerSheet(url);
  return Object.freeze(
    Object.fromEntries(
      kits.map((kit) => [
        kit.name,
        cutPlayerSprites(sheet, scale, (pixels) => paintKit(pixels, kit)),
      ]),
    ),
  );
}

export function paintKit(pixels, kit, source = SOURCE_COLOURS) {
  const painted = new Uint8ClampedArray(pixels);
  for (let byte = 0; byte < painted.length; byte += 4) {
    if (isColour(painted, byte, source.shirt))
      paintPixel(painted, byte, kit.shirt);
    else if (isColour(painted, byte, source.stripe))
      paintPixel(painted, byte, kit.stripe);
  }
  return painted;
}

function isColour(pixels, byte, colour) {
  return (
    pixels[byte] === colour.red &&
    pixels[byte + 1] === colour.green &&
    pixels[byte + 2] === colour.blue
  );
}

function paintPixel(pixels, byte, colour) {
  pixels[byte] = colour.red;
  pixels[byte + 1] = colour.green;
  pixels[byte + 2] = colour.blue;
}
