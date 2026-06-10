namespace Diplom.Models.DTO
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

        public string? ForeignKeyName { get; set; }
        public string? ForeignKeyTable { get; set; }
        public string? ForeignKeyColumn { get; set; }
        public string? ReferencedTable { get; set; }
        public string? ReferencedColumn { get; set; }
    }
}
