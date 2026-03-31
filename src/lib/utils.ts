import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface Point {
  x: number;
  y: number;
}

export function getPerspectiveTransform(src: Point[], width: number, height: number) {
  // Simple perspective transform math
  // For a more robust solution, we'd use a full matrix, but for 4 points to a rectangle:
  // We'll use a basic implementation or just return the points for the canvas to use.
  // Actually, implementing perspective transform in JS without a library is tricky.
  // I'll use a CSS transform approach for the preview if possible, 
  // or a canvas-based drawImage with 4 points if I can find a snippet.
  
  // Since we want to "flatten" the card, we'll use a canvas to draw the transformed image.
}

export const CARD_RATIO = 2.5 / 3.5; // Standard trading card ratio
