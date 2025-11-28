
import { MinigameResult } from '../types';

export class Minigames {
  private static randRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  private static drawCard(): number {
    return this.randRange(1, 13);
  }

  static blackjack(): MinigameResult {
    const player = this.drawCard() + this.drawCard();
    const dealer = this.drawCard() + this.drawCard();
    let text = `You: ${player} vs Dealer: ${dealer}. `;
    if (player === 21) return { outcome: "criticalWin", reward: 200, text: text + "Blackjack!" };
    if (player > 21) return { outcome: "criticalLoss", reward: -50, text: text + "Bust!" };
    if (player >= 18) return { outcome: "win", reward: 150, text: text + "High hand win!" };
    if (player >= 15) return { outcome: "partialWin", reward: 75, text: text + "Decent hand." };
    if (player === dealer) return { outcome: "draw", reward: 25, text: text + "Push." };
    return { outcome: "loss", reward: 0, text: text + "Dealer wins." };
  }

  static roulette(): MinigameResult {
    const spin = Math.floor(Math.random() * 37); 
    let text = `Spin: ${spin}. `;
    if (spin === 7) return { outcome: "criticalWin", reward: 250, text: text + "Lucky 7! Jackpot!" };
    if (spin === 0) return { outcome: "criticalLoss", reward: -50, text: text + "Zero. House wins." };
    if (spin % 2 === 0) return { outcome: "win", reward: 100, text: text + "Red (Even). Win." };
    if (spin % 3 === 0) return { outcome: "partialWin", reward: 50, text: text + "Black (Div3). Small win." };
    return { outcome: "loss", reward: 0, text: text + "Loss." };
  }

  static poker(): MinigameResult {
    const hand = Array.from({ length: 5 }, () => this.drawCard());
    const counts = hand.reduce((acc, v) => { acc[v] = (acc[v] || 0) + 1; return acc; }, {} as Record<number, number>);
    const values = Object.values(counts);
    const handStr = `[${hand.join(', ')}]`;
    if (values.includes(3) && values.includes(2)) return { outcome: "criticalWin", reward: 200, text: `Full House ${handStr}` }; 
    if (values.includes(3)) return { outcome: "win", reward: 100, text: `Three of a Kind ${handStr}` };
    if (values.includes(2)) return { outcome: "partialWin", reward: 50, text: `Pair ${handStr}` };
    if (Math.max(...hand) >= 10) return { outcome: "draw", reward: 25, text: `High Card ${handStr}` };
    if (hand.every(v => v <= 3)) return { outcome: "criticalLoss", reward: -50, text: `Garbage Hand ${handStr}` };
    return { outcome: "loss", reward: 0, text: `No pair ${handStr}` };
  }

  static darts(): MinigameResult {
    const score = this.randRange(0, 20) + this.randRange(0, 20) + this.randRange(0, 20);
    let text = `Threw 3 darts. Score: ${score}.`;
    if (score >= 60) return { outcome: "criticalWin", reward: 200, text: text + " Bullseye triple!" };
    if (score >= 40) return { outcome: "win", reward: score * 2, text: text + " Good shooting." };
    if (score >= 30) return { outcome: "partialWin", reward: 50, text: text + " On the board." };
    if (score === 20) return { outcome: "draw", reward: 25, text: text + " Barely hit." };
    if (score === 0) return { outcome: "criticalLoss", reward: -50, text: text + " Missed the wall." };
    return { outcome: "loss", reward: 0, text: text + " Poor aim." };
  }

  static pool(): MinigameResult {
    const roll = Math.random();
    if (roll < 0.05) return { outcome: "criticalLoss", reward: -50, text: "Scratch! Ball off table." }; 
    if (roll < 0.5) return { outcome: "loss", reward: 0, text: "Missed the pocket." }; 
    if (roll < 0.8) return { outcome: "win", reward: 75, text: "Sunk it." }; 
    if (roll < 0.95) return { outcome: "partialWin", reward: 30, text: "Grazed it in." }; 
    return { outcome: "criticalWin", reward: 150, text: "Combo sink! Clean shot." }; 
  }

  static slots(): MinigameResult {
    const reels = [this.randRange(1, 7), this.randRange(1, 7), this.randRange(1, 7)];
    const unique = new Set(reels).size;
    const text = `[ ${reels.join(' | ')} ]`;
    if (unique === 1) return { outcome: "criticalWin", reward: 200, text: text + " JACKPOT!" }; 
    if (unique === 2) return { outcome: "win", reward: 100, text: text + " Match!" }; 
    if (reels.includes(7)) return { outcome: "partialWin", reward: 50, text: text + " Lucky 7!" }; 
    if (unique === 3) return { outcome: "loss", reward: 0, text: text + " No match." }; 
    return { outcome: "criticalLoss", reward: -50, text: text + " Jammed!" }; 
  }

  static pinball(): MinigameResult {
    let score = 0;
    for (let i = 0; i < 10; i++) if (Math.random() < 0.5) score += 10;
    let text = `Score: ${score}.`;
    if (score >= 80) return { outcome: "criticalWin", reward: 200, text: text + " MULTIBALL!" };
    if (score >= 50) return { outcome: "win", reward: score, text: text + " High Score." };
    if (score >= 30) return { outcome: "partialWin", reward: 50, text: text + " Extra Ball." };
    if (score === 25) return { outcome: "draw", reward: 25, text: text + " Tilt." };
    if (score === 0) return { outcome: "criticalLoss", reward: -50, text: text + " Drained instantly." };
    return { outcome: "loss", reward: 0, text: text + " Game Over." };
  }
}
