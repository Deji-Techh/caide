export interface CollaborationTextChange {
  rangeOffset: number;
  rangeLength: number;
  text: string;
}

export function applyTextChanges(
  content: string,
  changes: CollaborationTextChange[],
  maxFileBytes = 2 * 1024 * 1024,
): string {
  const ordered = [...changes].sort((a, b) => b.rangeOffset - a.rangeOffset);
  let next = content;
  for (const change of ordered) {
    const end = change.rangeOffset + change.rangeLength;
    if (change.rangeOffset > next.length || end > next.length) {
      throw Object.assign(
        new Error("Text edit range is outside the current file"),
        { status: 409 },
      );
    }
    next = next.slice(0, change.rangeOffset) + change.text + next.slice(end);
  }
  if (Buffer.byteLength(next) > maxFileBytes) {
    throw Object.assign(
      new Error("Collaborative file exceeds the size limit"),
      { status: 413 },
    );
  }
  return next;
}
