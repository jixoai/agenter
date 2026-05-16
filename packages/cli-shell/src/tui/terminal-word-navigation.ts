import { measureTerminalText } from "./cell-width";

export interface TerminalWordSegment {
  word: string;
  start: number;
  end: number;
}

const createWordSegmenter = (): Intl.Segmenter => new Intl.Segmenter(undefined, { granularity: "word" });

export const findWordInTerminal = (text: string, charIndex: number): TerminalWordSegment | null => {
  const segmentInfo = createWordSegmenter().segment(text).containing(charIndex);
  if (!segmentInfo?.isWordLike) {
    return null;
  }
  return {
    word: segmentInfo.segment,
    start: segmentInfo.index,
    end: segmentInfo.index + segmentInfo.segment.length,
  };
};

export const terminalColumnToStringIndex = (line: string, targetCol: number): number => {
  let col = 0;
  let index = 0;
  for (const char of Array.from(line)) {
    const width = Math.max(1, measureTerminalText(char));
    const nextCol = col + width;
    if (targetCol < nextCol) {
      return index;
    }
    col = nextCol;
    index += char.length;
  }
  return line.length;
};

export const stringIndexToTerminalColumn = (line: string, targetIndex: number): number => {
  let col = 0;
  let index = 0;
  for (const char of Array.from(line)) {
    if (index >= targetIndex) {
      break;
    }
    col += Math.max(1, measureTerminalText(char));
    index += char.length;
  }
  return col;
};

const wordSegments = (line: string): TerminalWordSegment[] => {
  const segments: TerminalWordSegment[] = [];
  for (const segment of createWordSegmenter().segment(line)) {
    if (!segment.isWordLike) {
      continue;
    }
    segments.push({
      word: segment.segment,
      start: segment.index,
      end: segment.index + segment.segment.length,
    });
  }
  return segments;
};

export const findPreviousTerminalWordBoundary = (line: string, charIndex: number): number | null => {
  const target = Math.max(0, Math.min(line.length, charIndex));
  let previous: number | null = null;
  for (const segment of wordSegments(line)) {
    if (segment.start < target) {
      previous = segment.start;
    }
    if (segment.start >= target) {
      break;
    }
  }
  return previous;
};

export const findNextTerminalWordBoundary = (line: string, charIndex: number): number | null => {
  const target = Math.max(0, Math.min(line.length, charIndex));
  for (const segment of wordSegments(line)) {
    if (segment.end > target) {
      return segment.end;
    }
  }
  return null;
};
