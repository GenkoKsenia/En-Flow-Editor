using Diplom.Models.DTO;
using Diplom.Models.Requests;

namespace Diplom.Mappers
{
    public class PseudocodeMapper
    {
        public static CodeRequest MapDbInfo(List<TableInfo> tableInfos)
        {
            float defaultBlockHeight = 60;
            float defaultBlockWidth = 150;

            float defaultTableBlockWidth = 200;

            CodeRequest pseudocode = new CodeRequest();

            //Создание блоков
            int blockCounter = 0;

            //для более простого отслеживания внутренних блоков
            Dictionary<string, List<string>> innerBlocks = new Dictionary<string, List<string>>();
            //сопоставление блока колонке таблицы
            Dictionary<string, ColumnInfo> blockToColumn = new Dictionary<string, ColumnInfo>();

            List<Block> tableBlocks = new List<Block>();

            foreach (var tableInfo in tableInfos)
            {
                ++blockCounter;

                //создаем блок с дефолтной позицией
                Block block = new Block
                {
                    Id = blockCounter.ToString(),
                    Name = tableInfo.TableName,
                    Width = defaultTableBlockWidth,
                    Height = defaultBlockHeight * (tableInfo.Columns.Count + 1) + 20,
                    Position = new Position
                    {
                        X = 10 + (blockCounter * defaultBlockHeight),
                        Y = 10
                    }
                };

                pseudocode.Blocks.Add(block);
                tableBlocks.Add(block);

                innerBlocks[block.Id] = new List<string>();

                int index = 1;

                foreach (var column in tableInfo.Columns)
                {
                    ++blockCounter;

                    //Создаем вложенные блоки- колонки
                    Block innerBlock = new Block
                    {
                        Id = blockCounter.ToString(),
                        Name = column.ColumnName,
                        Width = defaultBlockWidth,
                        Height = defaultBlockHeight,
                        Position = new Position
                        {
                            X = (defaultTableBlockWidth - defaultBlockWidth) / 2,
                            Y = index * defaultBlockHeight
                        },
                        ParentId = block.Id
                    };

                    index++;

                    pseudocode.Blocks.Add(innerBlock);

                    innerBlocks[block.Id].Add(innerBlock.Id);
                    blockToColumn[innerBlock.Id] = column;
                }
            }

            int connectionCounter = 0;

            //создание стрелок
            foreach (var key in innerBlocks.Keys)
            {
                foreach (var value in innerBlocks[key])
                {
                    Block startBlock = pseudocode
                        .Blocks.Where(b => b.Id == value)
                        .FirstOrDefault();

                    ColumnInfo blockColumn = blockToColumn[value];

                    if (blockColumn.ForeignKeyInfo == null)
                        continue;

                    //находим блок для соединения
                    //находим блок таблицы
                    Block endTableBlock = tableBlocks
                        .FirstOrDefault(tb => tb.Name == blockColumn.ForeignKeyInfo.ReferencedTable);

                    List<string> tableInnerBlocks = innerBlocks[endTableBlock.Id];

                    //находим блок колонки
                    Block endBlock = pseudocode
                        .Blocks.Where(b => b.Name == blockColumn.ForeignKeyInfo.ReferencedColumn
                            && tableInnerBlocks.Contains(b.Id))
                        .FirstOrDefault();

                    float startX = getGlobalXCoordinate(startBlock, pseudocode);
                    float startY = getGlobalYCoordinate(startBlock, pseudocode);

                    float endX = getGlobalXCoordinate(endBlock, pseudocode);
                    float endY = getGlobalYCoordinate(endBlock, pseudocode);

                    List<Breakpoint> breakpoints = new List<Breakpoint>();

                    if (startBlock.Position.Y != endBlock.Position.Y)
                    {
                        if (endBlock.Position.X > startBlock.Position.X)
                        {
                            breakpoints.Add(new Breakpoint
                            {
                                X = startX + ((endX - startX) / 2),
                                Y = startY
                            });

                            breakpoints.Add(new Breakpoint
                            {
                                X = startX + ((endX - startX) / 2),
                                Y = endY
                            });
                        }
                        else
                        {
                            breakpoints.Add(new Breakpoint
                            {
                                X = endX + ((startX - endX) / 2),
                                Y = startY
                            });

                            breakpoints.Add(new Breakpoint
                            {
                                X = endX + ((startX - endX) / 2),
                                Y = endY
                            });
                        }
                    }

                    //находим родительские блоки
                    Block startParentBlock = pseudocode.Blocks
                        .FirstOrDefault(b => b.Id == startBlock.ParentId);

                    Block endParentBlock = pseudocode.Blocks
                        .FirstOrDefault(b => b.Id == endBlock.ParentId);

                    ++connectionCounter;

                    Connection connection = new Connection
                    {
                        Id = connectionCounter.ToString(),
                        StartBlock = startBlock.Id,
                        EndBlock = endBlock.Id,
                        StartSide = startX < endX ?
                            "right"
                            : "left",
                        EndSide = startX < endX ?
                            "left"
                            : "right",
                        Label = $"{startParentBlock.Name}.{startBlock.Name} -> {endParentBlock.Name}.{endBlock.Name}",
                        Breakpoints = breakpoints
                    };

                    pseudocode.Connections.Add(connection);
                }
            }

            //корректировка расположения блоков
            List<Block> parentBlocks = pseudocode.Blocks
                .Where(b => b.ParentId == null)
                .ToList();

            foreach (Block block in parentBlocks)
            {
                fixIntersection(block, pseudocode);
            }


            return pseudocode;
        }

        private static void fixIntersection(Block block, CodeRequest pseudocode)
        {

            foreach (Connection connection in pseudocode.Connections)
            {
                Block startBlock = pseudocode.Blocks
                    .FirstOrDefault(b => b.Id == connection.StartBlock);

                Block endBlock = pseudocode.Blocks
                    .FirstOrDefault(b => b.Id == connection.EndBlock);

                if (startBlock.ParentId == block.Id
                    || endBlock.ParentId == block.Id)
                {
                    continue;
                }

                if (!getIsConnInTheSameArea(connection, block, pseudocode))
                {
                    continue;
                }

                if (connection.Breakpoints == null || connection.Breakpoints.Count == 0)
                {
                    /*стрелка без изгибов
                    Block startBlock = pseudocode.Blocks
                        .FirstOrDefault(b => b.Id == connection.StartBlock);
                    */

                    float globalStartBlockY = getGlobalYCoordinate(startBlock, pseudocode);

                    if (globalStartBlockY < block.Position.Y
                        || globalStartBlockY > (block.Position.Y + block.Height))
                    {
                        continue;
                    }

                    // перемещаем родительский блок
                    transferBlock(block, globalStartBlockY, pseudocode);
                }
                else
                {
                    //стрелка с изгибами

                    float globalStartBlockX = getGlobalXCoordinate(startBlock, pseudocode);

                    float globalEndBlockX = getGlobalXCoordinate(endBlock, pseudocode);


                    float connMiddleX = connection.Breakpoints[0].X;

                    float yCoordinate = 0;


                    //смотрим первую половину стрелки
                    if (block.Position.X > Math.Min(globalStartBlockX, connMiddleX)
                        && (block.Position.X + block.Width) < Math.Max(globalStartBlockX, connMiddleX))
                    {
                        //блок в первой половине стрелки

                        if (connection.Breakpoints[0].Y < block.Position.Y
                            || connection.Breakpoints[0].Y > (block.Position.Y + block.Height))
                        {
                            continue;
                        }

                        yCoordinate = connection.Breakpoints[0].Y;
                    }
                    else if (block.Position.X > Math.Min(globalEndBlockX, connMiddleX)
                        && (block.Position.X + block.Width) < Math.Max(globalEndBlockX, connMiddleX))
                    {
                        //блок во второй половине стрелки

                        if (connection.Breakpoints[1].Y < block.Position.Y
                            || connection.Breakpoints[1].Y > (block.Position.Y + block.Height))
                        {
                            continue;
                        }

                        yCoordinate = connection.Breakpoints[1].Y;
                    }
                    else
                    {
                        //блок находится в середине стрелки в месте ее изгибов

                        float minBreakpointY = Math.Min(connection.Breakpoints[0].Y, connection.Breakpoints[1].Y);

                        float maxBreakpointY = Math.Max(connection.Breakpoints[0].Y, connection.Breakpoints[1].Y);


                        if (minBreakpointY > (block.Position.Y + block.Height)
                            || maxBreakpointY < (block.Position.Y))
                        {
                            continue;
                        }

                        yCoordinate = maxBreakpointY;
                    }

                    // перемещаем родительский блок
                    transferBlock(block, yCoordinate, pseudocode);
                }
            }
        }

        private static void transferBlock(Block block, float yCoordinate, CodeRequest pseudocode)
        {
            var outgoingConnections = pseudocode.Connections
                .Where(c => pseudocode.Blocks.First(b => b.Id == c.StartBlock).ParentId == block.Id)
                .Select(c => new
                {
                    Type = "outgoing",
                    Connection = c
                })
                .ToList();

            var incomingConnections = pseudocode.Connections
                .Where(c => pseudocode.Blocks.First(b => b.Id == c.EndBlock).ParentId == block.Id)
                .Select(c => new
                {
                    Type = "incoming",
                    Connection = c
                })
                .ToList();

            var allConnections = outgoingConnections
                .Concat(incomingConnections)
                .ToList();

            float yDifference = yCoordinate + 50 - block.Position.Y;

            block.Position.Y = yCoordinate + 50;

            foreach (var connection in allConnections)
            {
                if (connection.Connection.Breakpoints == null
                    || connection.Connection.Breakpoints.Count == 0)
                {
                    createBreakpoints(connection.Connection, pseudocode);
                }
                else
                {
                    if (connection.Type == "outgoing")
                        connection.Connection.Breakpoints[0].Y += yDifference;
                    else
                        connection.Connection.Breakpoints[1].Y += yDifference;
                }
            }
        }

        private static void createBreakpoints(Connection connection, CodeRequest pseudocode)
        {
            Block startBlock = pseudocode.Blocks
                .FirstOrDefault(b => b.Id == connection.StartBlock);

            float globalStartY = getGlobalYCoordinate(startBlock, pseudocode);
            float globalStartX = getGlobalXCoordinate(startBlock, pseudocode);

            Block endBlock = pseudocode.Blocks
                .FirstOrDefault(b => b.Id == connection.EndBlock);

            float globalEndY = getGlobalYCoordinate(endBlock, pseudocode);
            float globalEndX = getGlobalXCoordinate(endBlock, pseudocode);

            List<Breakpoint> breakpoints = new List<Breakpoint>();

            if (globalStartY != globalEndY)
            {
                if (globalEndX > globalStartX)
                {
                    breakpoints.Add(new Breakpoint
                    {
                        X = globalStartX + ((globalEndX - globalStartX) / 2),
                        Y = globalStartY
                    });

                    breakpoints.Add(new Breakpoint
                    {
                        X = globalStartX + ((globalEndX - globalStartX) / 2),
                        Y = globalEndY
                    });
                }
                else
                {
                    breakpoints.Add(new Breakpoint
                    {
                        X = globalEndX + ((globalStartX - globalEndX) / 2),
                        Y = globalStartY
                    });

                    breakpoints.Add(new Breakpoint
                    {
                        X = globalEndX + ((globalStartX - globalEndX) / 2),
                        Y = globalEndY
                    });
                }
            }

            connection.Breakpoints = breakpoints;
        }

        private static bool getIsConnInTheSameArea(Connection connection, Block block, CodeRequest pseudocode)
        {
            Block startBlock = pseudocode.Blocks
                    .FirstOrDefault(b => b.Id == connection.StartBlock);

            float globalStartBlockY = getGlobalYCoordinate(startBlock, pseudocode);
            float globalStartBlockX = getGlobalXCoordinate(startBlock, pseudocode);

            Block endBlock = pseudocode.Blocks
                .FirstOrDefault(b => b.Id == connection.EndBlock);

            float globalEndBlockY = getGlobalYCoordinate(endBlock, pseudocode);
            float globalEndBlockX = getGlobalXCoordinate(endBlock, pseudocode);

            float maxY = Math.Max(globalStartBlockY, globalEndBlockY);
            float minY = Math.Min(globalStartBlockY, globalEndBlockY);

            float maxX = Math.Max(globalStartBlockX, globalEndBlockX);
            float minX = Math.Min(globalStartBlockX, globalEndBlockX);

            // Границы блока
            float blockLeft = block.Position.X;
            float blockRight = block.Position.X + block.Width;
            float blockTop = block.Position.Y;
            float blockBottom = block.Position.Y + block.Height;

            // Проверка пересечения двух прямоугольников
            bool xOverlap = blockRight > minX && blockLeft < maxX;
            bool yOverlap = blockBottom > minY && blockTop < maxY;

            return xOverlap && yOverlap;
        }

        private static float getGlobalXCoordinate(Block block, CodeRequest pseudocode)
        {
            Block parentBlock = pseudocode.Blocks
                .FirstOrDefault(b => b.Id == block.ParentId);

            return parentBlock.Position.X + block.Position.X;
        }

        private static float getGlobalYCoordinate(Block block, CodeRequest pseudocode)
        {
            Block parentBlock = pseudocode.Blocks
                .FirstOrDefault(b => b.Id == block.ParentId);

            return parentBlock.Position.Y + block.Position.Y;
        }
    }
}
