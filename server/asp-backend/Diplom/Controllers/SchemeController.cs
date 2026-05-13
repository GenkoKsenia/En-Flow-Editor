using Azure.Core;
using Diplom.Mappers;
using Diplom.Models.DTO;
using Diplom.Models.Requests;
using Diplom.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Security.Principal;
using System.Text.Json;
using System.Text.RegularExpressions;
using KellermanSoftware.CompareNetObjects;
using Diplom.DBContexts;
using Diplom.Models.DB.Main;

namespace Diplom.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class SchemeController : Controller
    {
        private ApplicationContext context;
        private IUserContextService userContextService;
        public SchemeController(ApplicationContext _context, IUserContextService _userContextService)
        {
            context = _context;
            userContextService = _userContextService;
        }

        /*
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Scheme>>> GetAll()
        {
            return Ok(await context.Schemes
                .Include(s => s.Versions)
                .Include(s => s.Access_User_Schema_Rights)
                .Include(s => s.Access_Group_Schema_Rights)
                .ToListAsync());
        }
        */

        [HttpGet("{id}")]
        public async Task<SchemeResponseDto> GetById(int id)
        {
            string Sid = userContextService.GetCurrentUserSid();
            var groups = userContextService.GetCurrentUserGroups();

            Scheme scheme = await context.Schemes
                .Include(s => s.Versions.OrderByDescending(v => v.Date).Take(1))
                .Include(s => s.FavoriteSchemes.Where(f => f.UserID == Sid))
                .Include(s => s.Access_User_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Include(s => s.Access_Group_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Where(s => s.UserID == Sid ||
                    s.Access_User_Schema_Rights.Any(r => r.UserID == Sid) ||
                    s.Access_Group_Schema_Rights.Any(r => groups.Contains(r.GroupID)))
                .FirstOrDefaultAsync(s => s.ID == id);

            /*
            if (scheme == null)
                return Unauthorized();
            */

            return SchemeToDtoMapper.Map(scheme, scheme.FavoriteSchemes.Any());
        }

        // TODO: в списке схем выводить основную инфу, а в выводе конкретной схемы выводить полную
        [HttpGet]
        public async Task<ActionResult<IEnumerable<SchemeResponseDto>>> GetSchemesByUser()
        {
            string Sid = userContextService.GetCurrentUserSid();
            var groups = userContextService.GetCurrentUserGroups();

            /*
            var schemes = await context.Schemes
                //.Include(s => s.Versions)
                .Include(s => s.FavoriteSchemes.Where(f => f.UserID == Sid))
                .Include(s => s.Access_User_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Include(s => s.Access_Group_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Where(s => s.UserID == Sid ||
                s.Access_User_Schema_Rights.Any(r => r.UserID == Sid) ||
                s.Access_Group_Schema_Rights.Any(r => groups.Contains(r.GroupID)))
                .Distinct()
                .ToListAsync();
            */

            var schemes = await context.Schemes
                .Include(s => s.Versions.OrderByDescending(v => v.Date).Take(1))
                .Include(s => s.FavoriteSchemes.Where(f => f.UserID == Sid))
                .Include(s => s.Access_User_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Include(s => s.Access_Group_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Where(s => s.UserID == Sid ||
                    s.Access_User_Schema_Rights.Any(r => r.UserID == Sid) ||
                    s.Access_Group_Schema_Rights.Any(r => groups.Contains(r.GroupID)))
                .Distinct()
                .ToListAsync();

            /*
            foreach (var scheme in schemes)
            {
                if (scheme.Versions != null && scheme.Versions.Any())
                {
                    var latestVersion = scheme.Versions.OrderByDescending(v => v.Date).First();
                    scheme.Versions = new List<Models.Version> { latestVersion };
                }
            }
            */

            return Ok(schemes.Select(s => SchemeToDtoMapper.Map(s, s.FavoriteSchemes.Any())));
        }

        [HttpPost("post")]
        public async Task<SchemeResponseDto> Post([FromBody] string name)
        {
            string Sid = userContextService.GetCurrentUserSid();

            Scheme scheme = new Scheme { Name = name, UserID = Sid };

            context.Schemes.Add(scheme);
            await context.SaveChangesAsync();

            CodeRequest code = new CodeRequest();

            string pseudoCode = JsonSerializer.Serialize(code);

            Models.DB.Main.Version version = new Models.DB.Main.Version { Code = pseudoCode, SchemeID = scheme.ID };

            context.Versions.Add(version);
            await context.SaveChangesAsync();

            //return scheme;
            return SchemeToDtoMapper.Map(scheme, false);
        }

        [HttpPatch("patch/{id}")]
        public async Task<ActionResult<SchemeResponseDto>> Patch(int id, [FromBody] string name)
        {
            string Sid = userContextService.GetCurrentUserSid();

            Scheme scheme = await context.Schemes
                .Include(s => s.FavoriteSchemes.Where(f => f.UserID == Sid))
                .FirstOrDefaultAsync(s => s.ID == id);

            if (scheme.UserID != Sid)
                return Unauthorized();

            scheme.Name = name;
            await context.SaveChangesAsync();

            //return scheme;
            return SchemeToDtoMapper.Map(scheme, scheme.FavoriteSchemes.Any());
        }

        [HttpDelete("delete/{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            string Sid = userContextService.GetCurrentUserSid();

            Scheme scheme = await context.Schemes.FirstOrDefaultAsync(s => s.ID == id);

            if (scheme.UserID != Sid)
                return Unauthorized();

            context.Schemes.Remove(scheme);
            await context.SaveChangesAsync();

            return Ok();
        }

        [HttpGet("last-changes/{schemeID}")]
        public async Task<IEnumerable<CodeDifference>> GetLastChanges(int schemeID)
        {
            string Sid = userContextService.GetCurrentUserSid();
            var groups = userContextService.GetCurrentUserGroups();

            Scheme scheme = await context.Schemes
                .Include(s => s.Versions
                    .OrderByDescending(v => v.Date)
                    .Take(2))
                .Include(s => s.Access_User_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Include(s => s.Access_Group_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Where(s => s.UserID == Sid ||
                s.Access_User_Schema_Rights.Any(r => r.UserID == Sid) ||
                s.Access_Group_Schema_Rights.Any(r => groups.Contains(r.GroupID)))
                .FirstOrDefaultAsync(s => s.ID == schemeID);

            if (scheme == null)
                throw new UnauthorizedAccessException("Scheme is not available");

            if (scheme.Versions == null
                || !scheme.Versions.Any()
                || scheme.Versions.Count < 2)
            {
                return new List<CodeDifference>();
            }

            var latestVersion = scheme.Versions.First();

            var secondToLatestVersion = scheme.Versions.Skip(1).First();
            

            return CompareVersions(latestVersion, secondToLatestVersion);
        }

        [HttpGet("changes/{schemeId}-{versionId}")]
        public async Task<IEnumerable<CodeDifference>> GetLastChanges(int schemeId, int versionId)
        {
            string Sid = userContextService.GetCurrentUserSid();
            var groups = userContextService.GetCurrentUserGroups();

            Scheme scheme = await context.Schemes
                .Include(s => s.Versions
                    .OrderByDescending(v => v.Date)
                    .Take(1))
                .Include(s => s.Access_User_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Include(s => s.Access_Group_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Where(s => s.UserID == Sid ||
                    s.Access_User_Schema_Rights.Any(r => r.UserID == Sid) ||
                    s.Access_Group_Schema_Rights.Any(r => groups.Contains(r.GroupID)))
                .FirstOrDefaultAsync(s => s.ID == schemeId);

            if (scheme == null)
                throw new UnauthorizedAccessException("Scheme is not available");

            Models.DB.Main.Version latestVersion = scheme.Versions.First();
            Models.DB.Main.Version versionToCompare = await context.Versions
                .FirstOrDefaultAsync(v => v.Id == versionId);

            if (versionToCompare == null)
                throw new Exception("Verrsion not found");

            return CompareVersions(versionToCompare, latestVersion);
        }

        private static List<CodeDifference> CompareVersions(Models.DB.Main.Version versionToCompare, Models.DB.Main.Version secondVersionToCompare)
        {
            var versionToCompareDto = VersionToDtoMapper.Map(versionToCompare);
            var secondVersionToCompareDto = VersionToDtoMapper.Map(secondVersionToCompare);

            CompareLogic compareLogic = new CompareLogic();

            compareLogic.Config.MaxDifferences = 100;
            compareLogic.Config.IgnoreCollectionOrder = true;

            compareLogic.Config.TreatStringEmptyAndNullTheSame = false;

            compareLogic.Config.CollectionMatchingSpec = new Dictionary<Type, IEnumerable<string>>
                {
                    { typeof(Block), new List<string> { "Id" } },
                    { typeof(DataFlow), new List<string> { "DataKey" } },
                    { typeof(Connection), new List<string> { "Id" } },
                    { typeof(BlockStyle), new List<string> { "ElementId" } },
                    { typeof(ConnectionStyle), new List<string> { "ElementId" } }
                };

            ComparisonResult result = compareLogic.Compare(
                versionToCompareDto.Code,
                secondVersionToCompareDto.Code);

            List<CodeDifference> differences = new List<CodeDifference>();

            if (result.AreEqual)
            {
                return differences;
            }

            foreach (var difference in result.Differences)
            {
                var propertyName = difference.PropertyName;

                if (propertyName == "Blocks" ||
                    propertyName == "DataFlows" ||
                    propertyName == "Connections" ||
                    propertyName == "Styles")
                {
                    continue;
                }

                var codeDiffernce = new CodeDifference
                {
                    PropertyName = difference.PropertyName,
                    FirstObjectValue = difference.Object1, 
                    SecondObjectValue = difference.Object2
                    //FirstObjectValue = difference.Object1Value,
                    //SecondObjectValue = difference.Object2Value
                };

                differences.Add(codeDiffernce);
            }

            return differences;
        }
    }
}
