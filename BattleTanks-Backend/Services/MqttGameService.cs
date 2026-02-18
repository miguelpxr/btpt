using MQTTnet;
using MQTTnet.Client;
using MQTTnet.Protocol;
using System.Text.Json;

namespace BattleTanks_Backend.Services;

public class MqttGameService
{
    private IMqttClient? _client;
    private readonly ILogger<MqttGameService> _logger;
    private readonly RedisEventStore _redis;
    
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public MqttGameService(ILogger<MqttGameService> logger, RedisEventStore redis)
    {
        _logger = logger;
        _redis = redis;
    }

    public async Task ConnectAsync()
    {
        var factory = new MqttFactory();
        _client = factory.CreateMqttClient();

        var options = new MqttClientOptionsBuilder()
            .WithTcpServer("localhost", 1883)
            .WithClientId($"BattleTanks_Backend_{Guid.NewGuid()}")
            .WithCleanSession()
            .Build();

        try
        {
            await _client.ConnectAsync(options, CancellationToken.None);
            _logger.LogInformation("MQTT conectado exitosamente");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error conectando a MQTT");
            throw;
        }
    }

    public async Task PublishPowerUpAsync(string roomId, PowerUpEvent powerUp)
    {
        if (_client == null || !_client.IsConnected)
        {
            _logger.LogWarning("MQTT no conectado");
            return;
        }

        var topic = $"game/{roomId}/powerup";
        var payload = JsonSerializer.Serialize(powerUp, JsonOptions);

        var message = new MqttApplicationMessageBuilder()
            .WithTopic(topic)
            .WithPayload(payload)
            .WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtLeastOnce)
            .WithRetainFlag(false)
            .Build();

        await _client.PublishAsync(message, CancellationToken.None);
        _logger.LogInformation($"PowerUp publicado en {topic}: {powerUp.Type}");

        await _redis.StorePowerUpEventAsync(roomId, powerUp);
    }

    public async Task PublishCollisionAsync(string roomId, CollisionEvent collision)
    {
        if (_client == null || !_client.IsConnected)
        {
            _logger.LogWarning("MQTT no conectado");
            return;
        }

        var topic = $"game/{roomId}/collision";
        var payload = JsonSerializer.Serialize(collision, JsonOptions);

        var message = new MqttApplicationMessageBuilder()
            .WithTopic(topic)
            .WithPayload(payload)
            .WithQualityOfServiceLevel(MqttQualityOfServiceLevel.ExactlyOnce)
            .WithRetainFlag(false)
            .Build();

        await _client.PublishAsync(message, CancellationToken.None);
        _logger.LogInformation($"Colisión publicada en {topic}");

        await _redis.StoreCollisionEventAsync(roomId, collision);
    }

    public async Task PublishGameEndAsync(string roomId, GameEndEvent gameEnd)
    {
        if (_client == null || !_client.IsConnected)
        {
            _logger.LogWarning("MQTT no conectado");
            return;
        }

        var topic = $"game/{roomId}/gameend";
        var payload = JsonSerializer.Serialize(gameEnd, JsonOptions);

        var message = new MqttApplicationMessageBuilder()
            .WithTopic(topic)
            .WithPayload(payload)
            .WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtLeastOnce)
            .WithRetainFlag(false)
            .Build();

        await _client.PublishAsync(message, CancellationToken.None);
        _logger.LogInformation($"Fin de juego publicado en {topic}");
    }

    public async Task DisconnectAsync()
    {
        if (_client != null && _client.IsConnected)
        {
            await _client.DisconnectAsync();
            _logger.LogInformation("MQTT desconectado");
        }
    }
}

public record PowerUpEvent(
    string Type,
    double X,
    double Y,
    string Id,
    long Timestamp
);

public record CollisionEvent(
    string Player1Id,
    string Player2Id,
    double X,
    double Y,
    int Damage,
    long Timestamp
);

public record GameEndEvent(
    string WinnerId,
    string WinnerName,
    int FinalScore,
    List<PlayerResult> Results,
    long Timestamp
);

public record PlayerResult(
    string PlayerId,
    string PlayerName,
    int Score,
    int Kills,
    int Deaths
);