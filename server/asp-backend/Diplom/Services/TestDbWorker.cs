using Diplom.Models.DTO;
using System.Net.Http;

namespace Diplom.Services
{
    public class TestDbWorker : IDomainWorker
    {
        private readonly IHttpClientFactory _httpClientFactory;
        public TestDbWorker(IHttpClientFactory httpClientFactory)
        {
            _httpClientFactory = httpClientFactory;
        }

        public List<AdGroup> GetGroups()
        {
            throw new NotImplementedException();
        }

        public List<AdGroup> GetGroupsByMatch(string text)
        {
            throw new NotImplementedException();
        }

        /*
        public List<AdUser> GetUsers()
        {
            var httpClient = _httpClientFactory.CreateClient();

            try
            {
                var response = await httpClient.GetAsync("https://api.example.com/data");

                if (response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync();
                    return Ok(content);
                }

                return StatusCode((int)response.StatusCode, response.ReasonPhrase);
            }
            catch (HttpRequestException ex)
            {
                return StatusCode(500, $"Ошибка при запросе: {ex.Message}");
            }
        }
        */

        public List<AdUser> GetUsersByMatch(string text)
        {
            throw new NotImplementedException();
        }
    }
}
