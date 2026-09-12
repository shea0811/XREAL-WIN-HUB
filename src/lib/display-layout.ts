import type { DisplayLayoutItem } from '../types';

const POSITION_LIMIT = 32_000;
const SNAP_DISTANCE = 70;
const GRID_SIZE = 20;

export function validateDisplayLayout(displays: DisplayLayoutItem[]) {
  if (!displays.length) return 'At least one display is required.';
  if (displays.length > 16) return 'A maximum of 16 displays is supported.';
  if (new Set(displays.map((display) => display.id)).size !== displays.length) {
    return 'Display identifiers must be unique.';
  }
  if (displays.filter((display) => display.primary).length !== 1) {
    return 'Exactly one primary display is required.';
  }
  for (const display of displays) {
    if (!Number.isInteger(display.x) || !Number.isInteger(display.y)) {
      return 'Display positions must use whole pixels.';
    }
    if (Math.abs(display.x) > POSITION_LIMIT || Math.abs(display.y) > POSITION_LIMIT) {
      return 'Display positions are outside the supported desktop range.';
    }
    if (display.width < 320 || display.height < 200) {
      return 'A display reported an invalid resolution.';
    }
  }
  return null;
}

function nearest(value: number, candidates: number[], distance = SNAP_DISTANCE) {
  let match: number | null = null;
  let delta = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const candidateDelta = Math.abs(candidate - value);
    if (candidateDelta < delta && candidateDelta <= distance) {
      match = candidate;
      delta = candidateDelta;
    }
  }
  return match ?? Math.round(value / GRID_SIZE) * GRID_SIZE;
}

export function moveDisplay(
  displays: DisplayLayoutItem[],
  id: string,
  requestedX: number,
  requestedY: number,
) {
  const moving = displays.find((display) => display.id === id);
  if (!moving) return displays;
  const others = displays.filter((display) => display.id !== id);
  const xCandidates = others.flatMap((display) => [
    display.x,
    display.x + display.width,
    display.x - moving.width,
    display.x + display.width - moving.width,
  ]);
  const yCandidates = others.flatMap((display) => [
    display.y,
    display.y + display.height,
    display.y - moving.height,
    display.y + display.height - moving.height,
  ]);
  const x = nearest(Math.round(requestedX), xCandidates);
  const y = nearest(Math.round(requestedY), yCandidates);
  return displays.map((display) => display.id === id ? { ...display, x, y } : display);
}

export function setPrimaryDisplay(displays: DisplayLayoutItem[], id: string) {
  const primary = displays.find((display) => display.id === id);
  if (!primary) return displays;
  return displays.map((display) => ({
    ...display,
    primary: display.id === id,
    x: display.x - primary.x,
    y: display.y - primary.y,
  }));
}

export interface LayoutFrame {
  scale: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

export function fitDisplayLayout(
  displays: DisplayLayoutItem[],
  stageWidth: number,
  stageHeight: number,
  padding = 55,
): LayoutFrame {
  if (!displays.length) return { scale: 1, offsetX: padding, offsetY: padding, width: 0, height: 0 };
  const minX = Math.min(...displays.map((display) => display.x));
  const minY = Math.min(...displays.map((display) => display.y));
  const maxX = Math.max(...displays.map((display) => display.x + display.width));
  const maxY = Math.max(...displays.map((display) => display.y + display.height));
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const availableWidth = Math.max(100, stageWidth - padding * 2);
  const availableHeight = Math.max(100, stageHeight - padding * 2);
  const scale = Math.min(availableWidth / width, availableHeight / height, 0.24);
  return {
    scale,
    offsetX: (stageWidth - width * scale) / 2 - minX * scale,
    offsetY: (stageHeight - height * scale) / 2 - minY * scale,
    width,
    height,
  };
}

export function layoutsEqual(left: DisplayLayoutItem[], right: DisplayLayoutItem[]) {
  if (left.length !== right.length) return false;
  return left.every((display) => {
    const other = right.find((candidate) => candidate.id === display.id);
    return Boolean(
      other
      && other.x === display.x
      && other.y === display.y
      && other.primary === display.primary,
    );
  });
}
