namespace BattleTanks_Backend.Models;

public class Score
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid PlayerId { get; set; }
    public Player Player { get; set; } = default!;

    public int Points { get; set; }
    public DateTime Date { get; set; } = DateTime.UtcNow;
}
