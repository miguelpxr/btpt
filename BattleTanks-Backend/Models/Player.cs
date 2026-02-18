namespace BattleTanks_Backend.Models;

public class Player
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Name { get; set; } = default!;
    public string Email { get; set; } = default!;
    public string PasswordHash { get; set; } = default!;
    public int GamesPlayed { get; set; }
    public int Wins { get; set; }
    public int TotalScore { get; set; }

    public List<Score> Scores { get; set; } = new();
}
