using Diplom.Hubs;
using Diplom.Models.DB;
using Diplom.Models.Hub;
using Microsoft.AspNetCore.SignalR;

namespace Diplom.Services.UserTrackers
{
    public interface IUserTracker
    {
        void AddClient(int schemeId, string ConnectionId);
        void DeleteClient(int schemeId, string ConnectionId);
        void DeleteClientEverywhere(string ConnectionId);
        Task<HubCodeRequest> GetUpdates(int schemeId);
        Task SetUpdatesSending(int schemeId, string ConnetcionId);
        Task SetUserUpdates(int schemeId, string ConnectionId, HubCodeRequest codeRequest);
    }
}
