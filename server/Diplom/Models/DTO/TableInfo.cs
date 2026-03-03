namespace Diplom.Models.DTO
{
    public class TableInfo
    {
        public string? TableName { get; set; }
        public string? TableDescription { get; set; }
        public List<ColumnInfo> Columns { get; set; }
    }
}
