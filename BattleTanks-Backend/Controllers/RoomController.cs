using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BattleTanks_Backend.Data;
using BattleTanks_Backend.Models;
using BattleTanks_Backend.Dtos.Room;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace BattleTanks_Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RoomController : ControllerBase
{
    private readonly BattleTanksDbContext _db;

    public RoomController(BattleTanksDbContext db)
    {
        _db = db;
    }

    [AllowAnonymous]
    [HttpGet]
    public async Task<ActionResult<IEnumerable<RoomResponse>>> GetRooms()
    {
        var rooms = await _db.GameSessions
            .Select(r => new RoomResponse(
                r.Id,
                r.SelectedMap,
                (int)r.State,
                r.ConnectedPlayers.Count
            ))
            .ToListAsync();

        return Ok(rooms);
    }

    [HttpPost]
    public async Task<ActionResult<RoomResponse>> CreateRoom([FromBody] CreateRoomRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.SelectedMap))
            return BadRequest("selectedMap es obligatorio");

        var room = new GameSession
        {
            Id = Guid.NewGuid(),
            SelectedMap = req.SelectedMap,
            State = GameSessionState.Waiting,
            ConnectedPlayers = new List<string>()
        };

        _db.GameSessions.Add(room);
        await _db.SaveChangesAsync();

        return Ok(new RoomResponse(
            room.Id,
            room.SelectedMap,
            (int)room.State,
            0
        ));
    }

    [HttpPut("{id}/join")]
    public async Task<ActionResult> JoinRoom(Guid id)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userId == null) return Unauthorized("Token inválido");

        var player = await _db.Players.FindAsync(Guid.Parse(userId));
        if (player == null) return Unauthorized("Jugador no encontrado");

        var room = await _db.GameSessions.FirstOrDefaultAsync(r => r.Id == id);
        if (room is null)
            return NotFound("sala no encontrada");

        if (room.ConnectedPlayers.Count >= 4)
            return BadRequest("la sala ya alcanzó el máximo de jugadores");

        var pid = player.Id.ToString();

        if (room.ConnectedPlayers.Contains(pid))
            return Ok();

        room.ConnectedPlayers.Add(pid);
        _db.Entry(room).Property(r => r.ConnectedPlayers).IsModified = true;

        if (room.ConnectedPlayers.Count >= 2)
            room.State = GameSessionState.InGame;

        await _db.SaveChangesAsync();

        return Ok();
    }
}