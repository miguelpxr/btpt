namespace BattleTanks_Backend.Dtos.Auth;

public record RegisterRequest(
    string Name,
    string Email,
    string Password
);
