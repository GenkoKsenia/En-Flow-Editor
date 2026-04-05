using Diplom.Mappers;
using Diplom.Models;
using Diplom.Models.DTO;
using Diplom.Models.Requests;
using Diplom.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Diplom.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class DbInfoController : Controller
    {
        private ApplicationContext context;
        private readonly DynamicDbContext dynamicDbContext;
        public DbInfoController(
            ApplicationContext _context, 
            DynamicDbContext _dynamicDbContext)
        {
            context = _context;
            dynamicDbContext = _dynamicDbContext;
        }

        [HttpPost]
        public async Task<ActionResult<CodeRequest>> GetDbScheme([FromBody] DbConnectionRequest connection)
        {
            using (var dbContext = await dynamicDbContext.CreateDbContext(connection))
            {
                var fkQuery = @"
                    SELECT 
                        t.name AS TableName,
                        ep_table.value AS TableDescription,
                        c.name AS ColumnName,
                        ty.name AS DataType,
                        c.max_length AS MaxLength,
                        c.precision AS Precision,
                        c.scale AS Scale,
                        ep_column.value AS ColumnDescription,
                        -- Информация о внешнем ключе
                        fk.name AS ForeignKeyName,
                        OBJECT_NAME(fk.parent_object_id) AS ForeignKeyTable,
                        COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS ForeignKeyColumn,
                        OBJECT_NAME(fk.referenced_object_id) AS ReferencedTable,
                        COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS ReferencedColumn
                    FROM 
                        sys.tables t
                    INNER JOIN 
                        sys.columns c ON t.object_id = c.object_id
                    INNER JOIN 
                        sys.types ty ON c.user_type_id = ty.user_type_id
                    LEFT JOIN 
                        sys.extended_properties ep_table ON ep_table.major_id = t.object_id 
                                                   AND ep_table.minor_id = 0 
                                                   AND ep_table.name = 'Description'
                    LEFT JOIN 
                        sys.extended_properties ep_column ON ep_column.major_id = c.object_id 
                                                    AND ep_column.minor_id = c.column_id 
                                                    AND ep_column.name = 'Description'
                    LEFT JOIN 
                        sys.foreign_key_columns fkc ON fkc.parent_object_id = t.object_id 
                                                    AND fkc.parent_column_id = c.column_id
                    LEFT JOIN 
                        sys.foreign_keys fk ON fk.object_id = fkc.constraint_object_id
                    WHERE 
                        ty.is_user_defined = 0
                        AND t.name NOT IN ('sysdiagrams', '__EFMigrationsHistory')
                    ORDER BY 
                        t.name, c.column_id"
                        ;

                var rawData = await dbContext.Database
                    .SqlQueryRaw<TableInfoDto>(fkQuery)
                    .ToListAsync();

                List<TableInfo> result = rawData
                    .GroupBy(r => r.TableName)
                    .Select(tb => new TableInfo
                    {
                        TableName = tb.Key,
                        TableDescription = tb.First().TableDescription,
                        Columns = tb.Select(c => new ColumnInfo
                        {
                            ColumnName = c.ColumnName,
                            DataType = c.DataType,
                            MaxLength = c.MaxLength,
                            Precision = c.Precision,
                            Scale = c.Scale,
                            ColumnDescription = c.ColumnDescription,
                            ForeignKeyInfo = !string.IsNullOrEmpty(c.ForeignKeyName) ? new ForeignKeyInfo
                            {
                                ReferencedTable = c.ReferencedTable,
                                ReferencedColumn = c.ReferencedColumn
                            } : null
                        }).ToList()
                    })
                    .ToList();

                return Ok(PseudocodeMapper.MapDbInfo(result));
            }
        }
    }
}
