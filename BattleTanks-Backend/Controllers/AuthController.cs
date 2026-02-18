using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using BattleTanks_Backend.Data;
using BattleTanks_Backend.Models;
using BattleTanks_Backend.Dtos.Auth;
using BattleTanks_Backend.Services;

namespace BattleTanks_Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly BattleTanksDbContext _db;
    private readonly PasswordHasher<Player> _hasher;
    private readonly JwtTokenService _jwt;

    public AuthController(BattleTanksDbContext db, PasswordHasher<Player> hasher, JwtTokenService jwt)
    {
        _db = db;
        _hasher = hasher;
        _jwt = jwt;
    }

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register([FromBody] RegisterRequest req)
    {
        var email = req.Email.Trim().ToLowerInvariant();
        var name = req.Name.Trim();

        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest("name, email y password son obligatorios");

        var exists = await _db.Players.AnyAsync(p => p.Email.ToLower() == email);
        if (exists)
            return Conflict("ya existe un usuario con ese email");

        var player = new Player
        {
            Id = Guid.NewGuid(),
            Name = name,
            Email = email,
            GamesPlayed = 0,
            Wins = 0,
            TotalScore = 0
        };

        player.PasswordHash = _hasher.HashPassword(player, req.Password);

        _db.Players.Add(player);
        await _db.SaveChangesAsync();

        var (token, expiresAtUtc) = _jwt.CreateToken(player);

        return Ok(new AuthResponse(token, expiresAtUtc, player.Id, player.Name, player.Email));
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest req)
    {
        var email = req.Email.Trim().ToLowerInvariant();

        var player = await _db.Players.FirstOrDefaultAsync(p => p.Email.ToLower() == email);
        if (player is null)
            return Unauthorized("credenciales inválidas");

        var result = _hasher.VerifyHashedPassword(player, player.PasswordHash, req.Password);
        if (result == PasswordVerificationResult.Failed)
            return Unauthorized("credenciales inválidas");

        var (token, expiresAtUtc) = _jwt.CreateToken(player);

        return Ok(new AuthResponse(token, expiresAtUtc, player.Id, player.Name, player.Email));
    }
}
