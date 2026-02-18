using StackExchange.Redis;
using System.Text.Json;
using BattleTanks_Backend.Models;


namespace BattleTanks_Backend.Services;

/// <summary>
/// Servicio para almacenar y recuperar eventos del juego en Redis
/// Actividad 3: Integración MQTT + Redis
/// </summary>
public class RedisEventStore
{
    private readonly IConnectionMultiplexer _redis;
    private readonly IDatabase _db;
    private readonly ILogger<RedisEventStore> _logger;

    // Configuración de serialización camelCase
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public RedisEventStore(IConnectionMultiplexer redis, ILogger<RedisEventStore> logger)
    {
        _redis = redis;
        _db = redis.GetDatabase();
        _logger = logger;
    }

    /// <summary>
    /// Almacenar evento de power-up en Redis
    /// Key format: events:{roomId}:powerups
    /// </summary>
    public async Task StorePowerUpEventAsync(string roomId, PowerUpEvent powerUp)
    {
        try
        {
            var key = $"events:{roomId}:powerups";
            var json = JsonSerializer.Serialize(powerUp, JsonOptions);
            
            await _db.ListLeftPushAsync(key, json);
            
            // Mantener solo los últimos 100 eventos
            await _db.ListTrimAsync(key, 0, 99);
            
            // Expirar después de 24 horas
            await _db.KeyExpireAsync(key, TimeSpan.FromHours(24));
            
            _logger.LogInformation($"📦 PowerUp almacenado en Redis: {key}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error almacenando power-up en Redis");
        }
    }

    /// <summary>
    /// Almacenar evento de colisión en Redis
    /// </summary>
    public async Task StoreCollisionEventAsync(string roomId, CollisionEvent collision)
    {
        try
        {
            var key = $"events:{roomId}:collisions";
            var json = JsonSerializer.Serialize(collision, JsonOptions);
            
            await _db.ListLeftPushAsync(key, json);
            await _db.ListTrimAsync(key, 0, 99);
            await _db.KeyExpireAsync(key, TimeSpan.FromHours(24));
            
            _logger.LogInformation($"💥 Colisión almacenada en Redis: {key}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error almacenando colisión en Redis");
        }
    }

    /// <summary>
    /// Almacenar mensaje de chat en Redis
    /// </summary>
    public async Task StoreChatMessageAsync(string roomId, ChatMessage message)
    {
        try
        {
            var key = $"events:{roomId}:chat";
            var json = JsonSerializer.Serialize(message, JsonOptions);
            
            await _db.ListLeftPushAsync(key, json);
            await _db.ListTrimAsync(key, 0, 99); // Últimos 100 mensajes
            await _db.KeyExpireAsync(key, TimeSpan.FromHours(24));
            
            _logger.LogInformation($"💬 Chat almacenado en Redis: {key}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error almacenando chat en Redis");
        }
    }

    /// <summary>
    /// Recuperar historial de power-ups
    /// </summary>
    public async Task<List<PowerUpEvent>> GetPowerUpHistoryAsync(string roomId, int count = 50)
    {
        try
        {
            var key = $"events:{roomId}:powerups";
            var values = await _db.ListRangeAsync(key, 0, count - 1);
            
            var events = new List<PowerUpEvent>();
            foreach (var value in values)
            {
                if (!value.IsNullOrEmpty)
                {
                    var powerUp = JsonSerializer.Deserialize<PowerUpEvent>(value.ToString(), JsonOptions);
                    if (powerUp != null)
                        events.Add(powerUp);
                }
            }
            
            // Invertir para orden cronológico (más antiguo primero)
            events.Reverse();
            
            _logger.LogInformation($"📖 Recuperados {events.Count} power-ups de Redis");
            return events;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error recuperando power-ups de Redis");
            return new List<PowerUpEvent>();
        }
    }

    /// <summary>
    /// Recuperar historial de colisiones
    /// </summary>
    public async Task<List<CollisionEvent>> GetCollisionHistoryAsync(string roomId, int count = 50)
    {
        try
        {
            var key = $"events:{roomId}:collisions";
            var values = await _db.ListRangeAsync(key, 0, count - 1);
            
            var events = new List<CollisionEvent>();
            foreach (var value in values)
            {
                if (!value.IsNullOrEmpty)
                {
                    var collision = JsonSerializer.Deserialize<CollisionEvent>(value.ToString(), JsonOptions);
                    if (collision != null)
                        events.Add(collision);
                }
            }
            
            events.Reverse();
            
            _logger.LogInformation($"📖 Recuperadas {events.Count} colisiones de Redis");
            return events;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error recuperando colisiones de Redis");
            return new List<CollisionEvent>();
        }
    }

    /// <summary>
    /// Recuperar historial de chat
    /// </summary>
    public async Task<List<ChatMessage>> GetChatHistoryAsync(string roomId, int count = 50)
    {
        try
        {
            var key = $"events:{roomId}:chat";
            var values = await _db.ListRangeAsync(key, 0, count - 1);
            
            var messages = new List<ChatMessage>();
            foreach (var value in values)
            {
                if (!value.IsNullOrEmpty)
                {
                    var msg = JsonSerializer.Deserialize<ChatMessage>(value.ToString(), JsonOptions);
                    if (msg != null)
                        messages.Add(msg);
                }
            }
            
            messages.Reverse();
            
            _logger.LogInformation($"📖 Recuperados {messages.Count} mensajes de chat de Redis");
            return messages;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error recuperando chat de Redis");
            return new List<ChatMessage>();
        }
    }

    /// <summary>
    /// Obtener todo el historial de eventos de una sala
    /// </summary>
    public async Task<RoomEventHistory> GetRoomHistoryAsync(string roomId)
    {
        var powerUps = await GetPowerUpHistoryAsync(roomId);
        var collisions = await GetCollisionHistoryAsync(roomId);
        var chatMessages = await GetChatHistoryAsync(roomId);
        
        return new RoomEventHistory
        {
            RoomId = roomId,
            PowerUps = powerUps,
            Collisions = collisions,
            ChatMessages = chatMessages,
            RetrievedAt = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Obtener estadísticas de eventos de una sala
    /// </summary>
    public async Task<RoomEventStats> GetRoomStatsAsync(string roomId)
    {
        try
        {
            var powerUpsCount = await _db.ListLengthAsync($"events:{roomId}:powerups");
            var collisionsCount = await _db.ListLengthAsync($"events:{roomId}:collisions");
            var chatCount = await _db.ListLengthAsync($"events:{roomId}:chat");
            
            return new RoomEventStats
            {
                RoomId = roomId,
                PowerUpsCount = (int)powerUpsCount,
                CollisionsCount = (int)collisionsCount,
                ChatMessagesCount = (int)chatCount
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error obteniendo estadísticas de Redis");
            return new RoomEventStats { RoomId = roomId };
        }
    }
}

// ===== MODELOS =====

public class RoomEventHistory
{
    public string RoomId { get; set; } = string.Empty;
    public List<PowerUpEvent> PowerUps { get; set; } = new();
    public List<CollisionEvent> Collisions { get; set; } = new();
    public List<ChatMessage> ChatMessages { get; set; } = new();
    public DateTime RetrievedAt { get; set; }
}

public class RoomEventStats
{
    public string RoomId { get; set; } = string.Empty;
    public int PowerUpsCount { get; set; }
    public int CollisionsCount { get; set; }
    public int ChatMessagesCount { get; set; }
}
