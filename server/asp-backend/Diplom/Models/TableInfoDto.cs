namespace Diplom.Models
{
    public class TableInfoDto
    {
        public string? TableName { get; set; }
        public string? TableDescription { get; set; }
        public string? ColumnName { get; set; }
        public string? DataType { get; set; }
        public short MaxLength { get; set; }
        public byte Precision { get; set; }
        public byte Scale { get; set; }
        public string? ColumnDescription { get; set; }
    }
}
