// A kit is a palette swap of the same three frames. The sets are baked into
// offscreen canvases at load rather than recoloured per frame, so a kit costs
// nothing to draw.
import { SPRITE_SCALE, cutPlayerSprites, loadPlayerSheet } from "./sprites.js";

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
