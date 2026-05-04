using Microsoft.AspNetCore.Mvc;
using System.Net;
using System.DirectoryServices.AccountManagement;
using System.DirectoryServices;
using System.Security.Principal;
using Diplom.Services;
using System.Net.Http;
using Diplom.Models.DB.TestAD;
using Diplom.DBContexts;
using Microsoft.EntityFrameworkCore;

namespace Diplom.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ActiveDirectoryController : Controller
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private TestADContext context;

        public ActiveDirectoryController(TestADContext _context, IHttpClientFactory httpClientFactory)
        {
            _httpClientFactory = httpClientFactory;
            context = _context;
        }

        [HttpGet("users")]
        public async Task<IEnumerable<AdUser>> GetAllUsers()
        {
            /*
            var httpClient = _httpClientFactory.CreateClient();

            var data = await httpClient
                .GetFromJsonAsync<IEnumerable<AdUser>>("http://127.0.0.1:8000/users");

            return data;
            */
            return await context.AdUsers.ToListAsync();
        }

        [HttpGet("users/by-match/{displayName}")]
        public async Task<IEnumerable<AdUser>> GetUsersByMatch(string displayName)
        {
            /*
            var httpClient = _httpClientFactory.CreateClient();

            var data = await httpClient
                .GetFromJsonAsync<IEnumerable<AdUser>>("http://127.0.0.1:8000/users");

            return data
                .Where(d => d.Name.ToLower().Contains(displayName.ToLower()));
            */
            return await context.AdUsers
                .Where(u => u.Name.ToLower().Contains(displayName.ToLower()))
                .ToListAsync();
        }

        [HttpGet("groups")]
        public async Task<IEnumerable<AdGroup>> GetAllGroups()
        {
            /*
            var httpClient = _httpClientFactory.CreateClient();

            var data = await httpClient
                .GetFromJsonAsync<IEnumerable<AdGroup>>("http://127.0.0.1:8000/groups");

            return data;
            */
            return await context.AdGroups.ToListAsync();
        }

        [HttpGet("groups/by-match/{groupName}")]
        public async Task<IEnumerable<AdGroup>> GetGroupsByName(string groupName)
        {
            /*
            var httpClient = _httpClientFactory.CreateClient();

            var data = await httpClient
                .GetFromJsonAsync<IEnumerable<AdGroup>>("http://127.0.0.1:8000/groups");

            return data
                .Where(d => d.Name.ToLower().Contains(groupName.ToLower())).ToList();
            */
            return await context.AdGroups
                .Where(g => g.Name.ToLower().Contains(groupName.ToLower()))
                .ToListAsync();
        }

        private AdUser ConvertDirectoryEntryToAdUser(DirectoryEntry directoryEntry)
        {
            byte[] sidBytes = directoryEntry.Properties["objectSid"]?[0] as byte[];
            SecurityIdentifier sid = sidBytes != null ? new SecurityIdentifier(sidBytes, 0) : null;
            string sidStr = sid?.ToString() ?? ""; // Полученное строковое представление SID

            return new AdUser()
            {
                Sid = sidStr,
                Name = directoryEntry.Properties["cn"]?.Value?.ToString()
            };
        }
    }
}
