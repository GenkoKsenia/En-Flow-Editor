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

            float spaceBetweenBlocks = 250;

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
                    Width = defaultBlockWidth, 
                    Height = defaultBlockHeight * ( tableInfo.Columns.Count + 1 ), 
                    Position = new Position
                    {
                        X = 10 + ( blockCounter * defaultBlockHeight ),
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
                            X = 10,
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


                    List<Breakpoint> breakpoints = new List<Breakpoint>();

                    if (startBlock.Position.Y != endBlock.Position.Y)
                    {
                        if (endBlock.Position.X > startBlock.Position.X)
                        {
                            breakpoints.Add(new Breakpoint
                            {
                                X = (endBlock.Position.X - startBlock.Position.X) / 2,
                                Y = startBlock.Position.Y
                            });

                            breakpoints.Add(new Breakpoint
                            {
                                X = (endBlock.Position.X - startBlock.Position.X) / 2,
                                Y = endBlock.Position.Y
                            });
                        }
                    }

                    ++connectionCounter;

                    Connection connection = new Connection
                    {
                        Id = connectionCounter.ToString(),
                        StartBlock = startBlock.Id,
                        EndBlock = endBlock.Id,
                        StartSide = startBlock.Position.X < endBlock.Position.X ?
                            "right"
                            : "left",
                        EndSide = startBlock.Position.X < endBlock.Position.X ?
                            "left"
                            : "right",
                        Label = $"{startBlock.Name} -> {endBlock.Name}",
                        Breakpoints = breakpoints
                    };

                    pseudocode.Connections.Add(connection);
                }
            }

            /*корректировка расположения блоков
            foreach (Block block in pseudocode.Blocks)
            {
                var connection = checkIntersection(block, pseudocode);
                if (connection != null)
                {

                }
                
            }
            */

            return pseudocode;
        }

        private static void TransferBlock(Block block, Connection connection, CodeRequest pseudoCode)
        {

        }
        /*
        private static Connection? fixIntersection(Block block, CodeRequest pseudocode)
        {
            bool result = false;

            foreach (Connection connection in pseudocode.Connections)
            {
                if (connection.Breakpoints == null || connection.Breakpoints.Count == 0)
                {
                    //стрелка без изгибов
                    Block startBlock = pseudocode.Blocks
                        .FirstOrDefault(b => b.Id == connection.StartBlock);

                    float yCoordinate = startBlock.Position.Y;

                    if (yCoordinate > block.Position.Y 
                        && yCoordinate < ( block.Position.Y + block.Height))
                    {
                        return connection;
                    }
                    return connection;
                }
                else
                {
                    //стрелка с изгибами
                    Block startBlock = pseudocode.Blocks
                        .FirstOrDefault(b => b.Id == connection.StartBlock);

                    Block endBlock = pseudocode.Blocks
                        .FirstOrDefault(b => b.Id == connection.EndBlock);

                    float higherYCoordinate = Math
                        .Max(startBlock.Position.Y, endBlock.Position.Y);

                    float lowerYCoordinate = Math
                        .Min(startBlock.Position.Y, endBlock.Position.Y);

                    if (higherYCoordinate < block.Position.Y
                        && lowerYCoordinate > (block.Position.Y + block.Height))
                    {
                        return connection;
                    }
                }
            }

            return null;
        }
        */
    }
}
