namespace BattleTanks_Backend.Models;

public record PlayerMoveEvent(string playerId, string direction, long timestamp);
