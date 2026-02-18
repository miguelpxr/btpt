namespace BattleTanks_Backend.Models;

public enum GameSessionState
{
    Waiting = 0,
    InGame = 1
}

public class GameSession
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public List<string> ConnectedPlayers { get; set; } = new();

    public string SelectedMap { get; set; } = "map1";
    public GameSessionState State { get; set; } = GameSessionState.Waiting;
}
