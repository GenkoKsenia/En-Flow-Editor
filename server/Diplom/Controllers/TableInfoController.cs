using Diplom.Models;
using Diplom.Models.DTO;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Diplom.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class TableInfoController : Controller
    {
        private ApplicationContext context;
        public TableInfoController(ApplicationContext _context)
        {
            context = _context;
        }

        [HttpGet("{tableName}")]
        public async Task<ActionResult<TableInfo>> GetTableSchema(string tableName)
        {
            var query = @"
                SELECT 
                    t.name AS TableName,
                    ep_table.value AS TableDescription,
                    c.name AS ColumnName,
                    ty.name AS DataType,
                    c.max_length AS MaxLength,
                    c.precision AS Precision,
                    c.scale AS Scale,
                    ep_column.value AS ColumnDescription
                FROM 
                    sys.tables t
                INNER JOIN 
                    sys.columns c ON t.object_id = c.object_id
                INNER JOIN 
                    sys.types ty ON c.system_type_id = ty.system_type_id
                LEFT JOIN 
                    sys.extended_properties ep_table ON ep_table.major_id = t.object_id 
                                               AND ep_table.minor_id = 0 
                                               AND ep_table.name = 'Description'
                LEFT JOIN 
                    sys.extended_properties ep_column ON ep_column.major_id = c.object_id 
                                                AND ep_column.minor_id = c.column_id 
                                                AND ep_column.name = 'Description'
                WHERE 
                    t.name = {0}
                ORDER BY 
                    c.column_id"
                    ;

            var rawData = await context.Database
                .SqlQueryRaw<TableInfoDto>(query, tableName)
                .ToListAsync();

            // Группируем данные
            var result = new TableInfo
            {
                TableName = rawData.FirstOrDefault()?.TableName,
                TableDescription = rawData.FirstOrDefault()?.TableDescription,
                Columns = rawData.Select(x => new ColumnInfo
                {
                    ColumnName = x.ColumnName,
                    DataType = x.DataType,
                    MaxLength = x.MaxLength,
                    Precision = x.Precision,
                    Scale = x.Scale,
                    ColumnDescription = x.ColumnDescription
                }).ToList()
            };

            return Ok(result);
        }
    }
}
