namespace BattleTanks_Backend.Models;

public record ChatMessage(
    string PlayerId, 
    string PlayerName, 
    string Message, 
    long Timestamp
);