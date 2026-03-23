using Microsoft.AspNetCore.Mvc;
using Diplom.Models.DTO;
using System.Net;
using System.DirectoryServices.AccountManagement;
using System.DirectoryServices;
using System.Security.Principal;
using Diplom.Services;
using System.Net.Http;

namespace Diplom.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ActiveDirectoryController : Controller
    {
        private readonly IHttpClientFactory _httpClientFactory;

        public ActiveDirectoryController(IHttpClientFactory httpClientFactory)
        {
            _httpClientFactory = httpClientFactory;
        }

        [HttpGet("users")]
        public async Task<IEnumerable<AdUser>> GetAllUsers()
        {
            var httpClient = _httpClientFactory.CreateClient();

            var data = await httpClient
                .GetFromJsonAsync<IEnumerable<AdUser>>("http://127.0.0.1:8000/users");

            return data;
        }

        [HttpGet("users/by-match/{displayName}")]
        public async Task<IEnumerable<AdUser>> GetUsersByMatch(string displayName)
        {
            var httpClient = _httpClientFactory.CreateClient();

            var data = await httpClient
                .GetFromJsonAsync<IEnumerable<AdUser>>("http://127.0.0.1:8000/users");

            return data
                .Where(d => d.Name.ToLower().Contains(displayName.ToLower()));
        }

        [HttpGet("groups")]
        public async Task<IEnumerable<AdGroup>> GetAllGroups()
        {
            var httpClient = _httpClientFactory.CreateClient();

            var data = await httpClient
                .GetFromJsonAsync<IEnumerable<AdGroup>>("http://127.0.0.1:8000/groups");

            return data;
        }

        [HttpGet("groups/by-match/{groupName}")]
        public async Task<IEnumerable<AdGroup>> GetGroupsByName(string groupName)
        {
            var httpClient = _httpClientFactory.CreateClient();

            var data = await httpClient
                .GetFromJsonAsync<IEnumerable<AdGroup>>("http://127.0.0.1:8000/groups");

            return data
                .Where(d => d.Name.ToLower().Contains(groupName.ToLower())).ToList();
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
