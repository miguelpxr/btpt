namespace BattleTanks_Backend.Dtos.Auth;

public record LoginRequest(
    string Email,
    string Password
);
