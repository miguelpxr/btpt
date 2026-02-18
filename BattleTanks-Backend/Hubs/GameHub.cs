using Microsoft.AspNetCore.SignalR;
using BattleTanks_Backend.Models;
using BattleTanks_Backend.Data;
using Microsoft.EntityFrameworkCore;
using BattleTanks_Backend.Services;

namespace BattleTanks_Backend.Hubs
{
    [Microsoft.AspNetCore.Authorization.Authorize] 
    public class GameHub : Hub
    {
        private readonly BattleTanksDbContext _db;
        private readonly MqttGameService _mqttService;
        private readonly RedisEventStore _redis;

        public GameHub(BattleTanksDbContext db, MqttGameService mqttService, RedisEventStore redis)
        {
            _db = db;
            _mqttService = mqttService;
            _redis = redis;
        }

        public async Task JoinRoomGroup(string roomId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, roomId);

            try
            {
                var chatHistory = await _redis.GetChatHistoryAsync(roomId, 50);
                await Clients.Caller.SendAsync("ReceiveChatHistory", chatHistory);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error recuperando historial: {ex.Message}");
            }
        }

        public async Task LeaveRoomGroup(string roomId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, roomId);
            Console.WriteLine($"[GameHub] {Context.ConnectionId} salió del grupo {roomId}");
        }

        public async Task PlayerMove(string roomId, PlayerMoveEvent move)
        {
            await Clients.OthersInGroup(roomId).SendAsync("playerMoved", move);
        }

        public async Task SendChatMessage(string roomId, ChatMessage msg)
        {
            await Clients.Group(roomId).SendAsync("chatMessage", msg);
            await _redis.StoreChatMessageAsync(roomId, msg);
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var playerId = Context.User?
                .FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?
                .Value;
        
            if (!string.IsNullOrEmpty(playerId))
            {
                var room = await _db.GameSessions
                    .FirstOrDefaultAsync(r => r.ConnectedPlayers.Contains(playerId));
        
                if (room != null)
                {
                    room.ConnectedPlayers.Remove(playerId);
                    _db.Entry(room).Property(r => r.ConnectedPlayers).IsModified = true;
        
                    if (room.ConnectedPlayers.Count < 2)
                        room.State = GameSessionState.Waiting;
        
                    await _db.SaveChangesAsync();
                }
            }
        
            await base.OnDisconnectedAsync(exception);
        }
   
        public async Task TriggerPowerUp(string roomId, string type, double x, double y)
        {
            var powerUp = new PowerUpEvent(
                Type: type,
                X: x,
                Y: y,
                Id: Guid.NewGuid().ToString(),
                Timestamp: DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            );

            await _mqttService.PublishPowerUpAsync(roomId, powerUp);
        }

        public async Task TriggerCollision(
            string roomId, 
            string player1Id, 
            string player2Id, 
            double x, 
            double y, 
            int damage)
        {
            var collision = new CollisionEvent(
                Player1Id: player1Id,
                Player2Id: player2Id,
                X: x,
                Y: y,
                Damage: damage,
                Timestamp: DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            );

            await _mqttService.PublishCollisionAsync(roomId, collision);
        }

        public async Task EndGame(
            string roomId, 
            string winnerId, 
            string winnerName, 
            int finalScore, 
            List<PlayerResult> results)
        {
            var gameEnd = new GameEndEvent(
                WinnerId: winnerId,
                WinnerName: winnerName,
                FinalScore: finalScore,
                Results: results,
                Timestamp: DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            );

            await _mqttService.PublishGameEndAsync(roomId, gameEnd);
        }
    }
}