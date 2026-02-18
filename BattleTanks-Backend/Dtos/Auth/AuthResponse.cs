namespace BattleTanks_Backend.Dtos.Auth;

public record AuthResponse(
    string Token,
    DateTime ExpiresAtUtc,
    Guid PlayerId,
    string Name,
    string Email
);
