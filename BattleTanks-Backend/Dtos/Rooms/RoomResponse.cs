using System;

namespace BattleTanks_Backend.Dtos.Room;

public record RoomResponse(
    Guid Id,
    string SelectedMap,
    int State,
    int PlayerCount
);
