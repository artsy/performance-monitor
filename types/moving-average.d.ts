declare module "moving-average" {
  interface MovingStats {
    push: (timestamp: number, value: number) => void;
    movingAverage: () => number;
    variance: () => number;
    deviation: () => number;
  }
  export default function(period: number): MovingStats;
}
