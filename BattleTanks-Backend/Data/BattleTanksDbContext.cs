using Microsoft.EntityFrameworkCore;
using BattleTanks_Backend.Models;

namespace BattleTanks_Backend.Data;

public class BattleTanksDbContext : DbContext
{
    public BattleTanksDbContext(DbContextOptions<BattleTanksDbContext> options)
        : base(options) { }

    public DbSet<Player> Players => Set<Player>();
    public DbSet<GameSession> GameSessions => Set<GameSession>();
    public DbSet<Score> Scores => Set<Score>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Player>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).IsRequired().HasMaxLength(50);
            e.Property(x => x.Email).IsRequired().HasMaxLength(120);
            e.HasIndex(x => x.Email).IsUnique();
        });

        modelBuilder.Entity<Score>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Player)
             .WithMany(p => p.Scores)
             .HasForeignKey(x => x.PlayerId)
             .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
