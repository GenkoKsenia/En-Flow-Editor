using Microsoft.Extensions.Primitives;
using System.Text.Json.Serialization;

namespace Diplom.Models.Requests
{
    public class DbConnectionRequest
    {
        [JsonPropertyName("server")]
        public string Server { get; set; } = "";
        [JsonPropertyName("database")]
        public string Database { get; set; } = "";
        [JsonPropertyName("username")]
        public string Username { get; set; } = "";
        [JsonPropertyName("password")]
        public string Password { get; set; } = "";
        [JsonPropertyName("authenticationType")]
        public string AuthenticationType { get; set; } = "sql";
    }
}
