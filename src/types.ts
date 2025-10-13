export interface Position {
  x: number;
  y: number;
}

export interface Node {
  id: string;
  position: Position;
  text: string;
  width: number;
  height: number;
}
//список нод, родитель, дети

export interface Edge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
}