using Diplom.Models.Hub;

namespace Diplom.Models.UserTrackers
{
    public class TrackedUser
    {
        public string ConnectionID { get; set; }
        public bool IsUpdatesSended { get; set; } = false;
        public DateTime DateTime { get; set; } = DateTime.UtcNow;
        public HubCodeRequest Updates { get; set; }
    }
}
