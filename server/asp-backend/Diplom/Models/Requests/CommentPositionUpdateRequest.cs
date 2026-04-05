namespace Diplom.Models.Requests
{
    public class CommentPositionUpdateRequest
    {
        public int VersionId { get; set; }
        public string? ElementId { get; set; }
        public float X { get; set; }
        public float Y { get; set; }
    }
}
