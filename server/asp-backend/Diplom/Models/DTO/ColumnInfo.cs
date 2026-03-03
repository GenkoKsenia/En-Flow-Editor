namespace Diplom.Models.DTO
{
    public class ColumnInfo
    {
        public string? ColumnName { get; set; }
        public string? ColumnDescription { get; set; }
        public string? DataType { get; set; }
        public short MaxLength { get; set; }
        public byte Precision { get; set; }
        public byte Scale { get; set; }
    }
}
