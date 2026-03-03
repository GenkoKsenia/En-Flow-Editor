using Diplom.Models.Hub;
using Diplom.Models.Requests;

namespace Diplom.Hubs
{
    public class CodeUpdater
    {
        public static void Update(CodeRequest currentCode, HubCodeRequest updates)
        {
            OrderUpdates(updates);

            //update
            UpdateBlocks(currentCode.Blocks, updates.Blocks);
            UpdateDataFlows(currentCode.DataFlows, updates.DataFlows);
            UpdateConnections(currentCode.Connections, updates.Connections);
            UpdateStyles(currentCode.Styles, updates.HubStyles);
        }

        private static void OrderUpdates(HubCodeRequest updates)
        {
            if (updates.Blocks != null)
                updates.Blocks.OrderBy(b => b.DateTime);

            if (updates.DataFlows != null)
                updates.DataFlows.OrderBy(df => df.DateTime);

            if (updates.Connections != null)
                updates.Connections.OrderBy(c => c.DateTime);

            if (updates.HubStyles != null)
            {
                if (updates.HubStyles.Blocks != null)
                    updates.HubStyles.Blocks.OrderBy(bs => bs.DateTime);

                if (updates.HubStyles.Connections != null)
                    updates.HubStyles.Connections.OrderBy(cs => cs.DateTime);
            }
        }

        private static void UpdateBlocks(List<Block> currentBlocks, List<HubBlock>? newBlocks)
        {
            if (newBlocks != null)
            {
                foreach (var requestBlock in newBlocks)
                {

                    switch (requestBlock.ActionType)
                    {
                        case ActionType.Create:
                            currentBlocks.Add(requestBlock.Block);
                            break;

                        case ActionType.Update:
                            var blockToUpdate = currentBlocks.FirstOrDefault(b => b.Id == requestBlock.Block.Id);

                            if (blockToUpdate != null)
                            {
                                blockToUpdate.Name = requestBlock.Block.Name;
                                blockToUpdate.Information = requestBlock.Block.Information;
                                blockToUpdate.Position = requestBlock.Block.Position;
                                blockToUpdate.Width = requestBlock.Block.Width;
                                blockToUpdate.Height = requestBlock.Block.Height;
                                blockToUpdate.ParentId = requestBlock.Block.ParentId;
                            }
                            break;
                        case ActionType.Delete:

                            currentBlocks.RemoveAll(b => b.Id == requestBlock.Block.Id);
                            break;
                        default:
                            return;
                    }
                }
            }
        }

        private static void UpdateDataFlows(List<DataFlow> currentDataFlows, List<HubDataFlow>? newDataFlows)
        {
            if (newDataFlows != null)
            {

                foreach (var requestDataFlow in newDataFlows)
                {

                    switch (requestDataFlow.ActionType)
                    {
                        case ActionType.Create:
                            currentDataFlows.Add(requestDataFlow.DataFlow);
                            break;

                        case ActionType.Update:
                            var dataFlowToUpdate = currentDataFlows
                                .FirstOrDefault(df => df.DataKey == requestDataFlow.DataFlow.DataKey);

                            if (dataFlowToUpdate != null)
                            {
                                dataFlowToUpdate.DataName = requestDataFlow.DataFlow.DataName;
                                dataFlowToUpdate.StartBlock = requestDataFlow.DataFlow.StartBlock;
                                dataFlowToUpdate.FinishBlocks = requestDataFlow.DataFlow.FinishBlocks;
                            }
                            break;
                        case ActionType.Delete:

                            currentDataFlows
                                .RemoveAll(df => df.DataKey == requestDataFlow.DataFlow.DataKey);
                            break;
                        default:
                            return;
                    }
                }
            }
        }

        private static void UpdateConnections(List<Connection> currentConnections, List<HubConnection>? newConnections)
        {
            if (newConnections != null)
            {
                foreach (var requestConnection in newConnections)
                {
                    switch (requestConnection.ActionType)
                    {
                        case ActionType.Create:
                            currentConnections.Add(requestConnection.Connection);
                            break;

                        case ActionType.Update:
                            var connectionToUpdate = currentConnections
                                .FirstOrDefault(c => c.Id == requestConnection.Connection.Id);

                            if (connectionToUpdate != null)
                            {
                                connectionToUpdate.StartBlock = requestConnection.Connection.StartBlock;
                                connectionToUpdate.EndBlock = requestConnection.Connection.EndBlock;

                                connectionToUpdate.StartSide = requestConnection.Connection.StartSide;
                                connectionToUpdate.EndSide = requestConnection.Connection.EndSide;

                                connectionToUpdate.Label = requestConnection.Connection.Label;
                                connectionToUpdate.DataKeys = requestConnection.Connection.DataKeys;
                                connectionToUpdate.Through = requestConnection.Connection.Through;
                                connectionToUpdate.Breakpoints = requestConnection.Connection.Breakpoints;
                            }
                            break;
                        case ActionType.Delete:

                            currentConnections.
                                RemoveAll(c => c.Id == requestConnection.Connection.Id);
                            break;
                        default:
                            return;
                    }
                }
            }
        }

        private static void UpdateStyles(Styles currentStyles, HubStyles? newStyles)
        {
            if (newStyles != null)
            {

                //BlockStyles
                UpdateBlockStyles(currentStyles.Blocks, newStyles.Blocks);

                //ConnectionStyles
                UpdateConnectionStyles(currentStyles.Connections, newStyles.Connections);
            }
        }

        private static void UpdateBlockStyles(List<BlockStyle> currentBlockStyles, List<HubBlockStyle> newBlockStyles)
        {
            if (newBlockStyles != null)
            {
                foreach (var requestBlockStyle in newBlockStyles)
                {
                    switch (requestBlockStyle.ActionType)
                    {
                        case ActionType.Create:
                            currentBlockStyles.Add(requestBlockStyle.BlockStyle);
                            break;

                        case ActionType.Update:
                            var blockStyleToUpdate = currentBlockStyles
                                .FirstOrDefault(bs => bs.ElementId == requestBlockStyle.BlockStyle.ElementId);

                            if (blockStyleToUpdate != null)
                            {
                                blockStyleToUpdate.Color = requestBlockStyle.BlockStyle.Color;
                                blockStyleToUpdate.BorderColor = requestBlockStyle.BlockStyle.BorderColor;
                                blockStyleToUpdate.BorderWidth = requestBlockStyle.BlockStyle.BorderWidth;
                                blockStyleToUpdate.BorderStyle = requestBlockStyle.BlockStyle.BorderStyle;
                            }
                            break;
                        case ActionType.Delete:

                            currentBlockStyles.
                                RemoveAll(bs => bs.ElementId == requestBlockStyle.BlockStyle.ElementId);
                            break;
                        default:
                            return;
                    }
                }
            }
        }

        private static void UpdateConnectionStyles(List<ConnectionStyle> currentConnStyles, List<HubConnectionStyle> newConnStyles)
        {
            if (newConnStyles != null)
            {
                foreach (var requestConnectionStyle in newConnStyles)
                {
                    switch (requestConnectionStyle.ActionType)
                    {
                        case ActionType.Create:
                            currentConnStyles.Add(requestConnectionStyle.ConnectionStyle);
                            break;

                        case ActionType.Update:
                            var connStyleToUpdate = currentConnStyles
                                .FirstOrDefault(cs => cs.ElementId == requestConnectionStyle.ConnectionStyle.ElementId);

                            if (connStyleToUpdate != null)
                            {
                                connStyleToUpdate.Color = requestConnectionStyle.ConnectionStyle.Color;
                                connStyleToUpdate.Width = requestConnectionStyle.ConnectionStyle.Width;
                                connStyleToUpdate.Type = requestConnectionStyle.ConnectionStyle.Type;
                            }
                            break;
                        case ActionType.Delete:

                            currentConnStyles.
                                RemoveAll(cs => cs.ElementId == requestConnectionStyle.ConnectionStyle.ElementId);
                            break;
                        default:
                            return;
                    }
                }
            }
        }
    }
}
