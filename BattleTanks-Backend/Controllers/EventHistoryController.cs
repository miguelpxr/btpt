using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using BattleTanks_Backend.Services;
using BattleTanks_Backend.Models;


namespace BattleTanks_Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class EventHistoryController : ControllerBase
{
    private readonly RedisEventStore _redis;
    private readonly ILogger<EventHistoryController> _logger;

    public EventHistoryController(RedisEventStore redis, ILogger<EventHistoryController> logger)
    {
        _redis = redis;
        _logger = logger;
    }

    [HttpGet("{roomId}")]
    public async Task<ActionResult<RoomEventHistory>> GetRoomHistory(string roomId)
    {
        try
        {
            var history = await _redis.GetRoomHistoryAsync(roomId);
            return Ok(history);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error recuperando historial de sala {RoomId}", roomId);
            return StatusCode(500, "Error recuperando historial");
        }
    }

    [HttpGet("{roomId}/powerups")]
    public async Task<ActionResult<List<PowerUpEvent>>> GetPowerUpHistory(
        string roomId, 
        [FromQuery] int count = 50)
    {
        try
        {
            var powerUps = await _redis.GetPowerUpHistoryAsync(roomId, count);
            return Ok(powerUps);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error recuperando power-ups");
            return StatusCode(500, "Error recuperando power-ups");
        }
    }

    [HttpGet("{roomId}/collisions")]
    public async Task<ActionResult<List<CollisionEvent>>> GetCollisionHistory(
        string roomId, 
        [FromQuery] int count = 50)
    {
        try
        {
            var collisions = await _redis.GetCollisionHistoryAsync(roomId, count);
            return Ok(collisions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error recuperando colisiones");
            return StatusCode(500, "Error recuperando colisiones");
        }
    }

    [HttpGet("{roomId}/chat")]
    public async Task<ActionResult<List<ChatMessage>>> GetChatHistory(
        string roomId, 
        [FromQuery] int count = 50)
    {
        try
        {
            var messages = await _redis.GetChatHistoryAsync(roomId, count);
            return Ok(messages);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error recuperando chat");
            return StatusCode(500, "Error recuperando chat");
        }
    }

    [HttpGet("{roomId}/stats")]
    public async Task<ActionResult<RoomEventStats>> GetRoomStats(string roomId)
    {
        try
        {
            var stats = await _redis.GetRoomStatsAsync(roomId);
            return Ok(stats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error recuperando estadísticas");
            return StatusCode(500, "Error recuperando estadísticas");
        }
    }
}