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

export type ConnectionSide = 'top' | 'right' | 'bottom' | 'left'

export interface Edge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceSide: ConnectionSide;  // Сторона исходного узла
  targetSide: ConnectionSide;  // Сторона целевого узла
  // Точки излома для стрелок из 3 отрезков
  breakpointX?: number;  // Для вертикального среднего отрезка
  breakpointY?: number;  // Для горизонтального среднего отрезка
}