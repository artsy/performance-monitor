declare module "stats-analysis" {
  interface Stats {
    mean: (values: number[]) => number;
    filterOutliers: (values: number[]) => number[];
    indexOfOutliers: (values: number[]) => number[];
  }
  let stats: Stats;
  export default stats;
}
