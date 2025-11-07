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
  geometry?: EdgeGeometry //Геометрия стрелки
}

export interface Segment {
  id: string           // Уникальный идентификатор сегмента
  type: 'line' | 'curve' // Тип сегмента
  start: Position      // Начальная точка сегмента {x, y}
  end: Position        // Конечная точка сегмента {x, y}
}

export interface EdgeGeometry {
  segments: Segment[]      // Массив всех сегментов стрелки
  totalLength: number      // Общая длина всей стрелки (сумма длин всех сегментов)
  boundingBox: {           // Ограничивающий прямоугольник всей стрелки
    minX: number           // Минимальная X-координата
    minY: number           // Минимальная Y-координата  
    maxX: number           // Максимальная X-координата
    maxY: number           // Максимальная Y-координата
    width: number          // Ширина bounding box (maxX - minX)
    height: number         // Высота bounding box (maxY - minY)
  }
}