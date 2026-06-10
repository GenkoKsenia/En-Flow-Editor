using Diplom.Models.Hub;
using Diplom.Models.UserTrackers;
using System.Collections.Concurrent;

namespace Diplom.Services.UserTrackers
{
    public static class SchemeUpdates
    {
        public static ConcurrentDictionary<int, List<TrackedUser>> CurrentConnections = new();
    }
}
