export type Piece = { name: string; width: number; height: number; rows: string[] };
export type SpriteSheet = { palette: Record<string, string>; pieces: Record<string, Piece> };
