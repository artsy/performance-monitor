import React from "react";
import { render } from "react-dom";
import { PerformanceCard } from "components/PerformanceCard";
import { MetricBar } from "components/MetricBar";
import styled from "styled-components";
import { color, Box, Flex, Sans, Serif, Theme } from "@artsy/palette";
import { Gauge } from "../components/Gauge";
import data from "./dashboard-data.json";
import { FlexProps } from "styled-system";

type data = Results;

export interface Results {
  dateRange: string;
  mobile: Snapshot[];
  desktop: Snapshot[];
  mobile4g: Snapshot[];
}

export interface Snapshot {
  key: string;
  page: string;
  device: Device;
  metrics: Metrics;
  createdAt: string;
}

export enum Device {
  Desktop = "desktop",
  Mobile = "mobile",
  Mobile4G = "mobile4g"
}

export interface Metrics {
  "lighthouse-performance-score": Metric;
  speed_index: Metric;
  "first-contentful-paint": Metric;
  "first-meaningful-paint": Metric;
}

export interface Metric {
  name: Name;
  label: Label;
  value: number;
}

export enum Label {
  FirstContentfulPaint = "First Contentful Paint",
  FirstMeaningfulPaint = "First Meaningful Paint",
  LighthousePerformanceScore = "Lighthouse Performance Score",
  SpeedIndex = "Speed Index"
}

export enum Name {
  FirstContentfulPaint = "first-contentful-paint",
  FirstMeaningfulPaint = "first-meaningful-paint",
  LighthousePerformanceScore = "lighthouse-performance-score",
  SpeedIndex = "speed_index"
}

console.log(data);

const scoreColor = (score: number) =>
  score >= 90 ? "black" : score >= 50 ? "#f1af1b" : "#f7625a";

const Grid = styled.div`
  display: grid;
  grid-template-columns: 260px repeat(3, 90px) 300px repeat(3, 90px);
  place-items: center;
  grid-row-gap: 20px;
  justify-content: center;
  justify-items: left;
  white-space: nowrap;

  @media screen and (max-width: 1175px) {
    justify-items: left;
    grid-template-columns: 260px repeat(3, 90px);
    .hide-small {
      display: none;
    }
    .no-margin {
      margin-left: 0;
    }
  }
`;

interface CellProps {
  score: number;
}
const Cell = ({ score }: CellProps) => (
  <Flex alignItems="center">
    <Sans size="5" weight="medium" mr={2} color={scoreColor(score)}>
      {score}
    </Sans>
  </Flex>
);

const App = () => (
  <Theme>
    <Box textAlign="center">
      <Serif size={6} mt={2} mb={1} weight="semibold">
        Artsy Web Performance Dashboard
      </Serif>
      <Sans size={3} mb={3} color="black60">
        {data.dateRange}
      </Sans>
      <Grid>
        <div />
        <Sans weight="medium" size={3}>
          Desktop
        </Sans>
        <Sans weight="medium" size={3}>
          Mobile 3G
        </Sans>
        <Sans weight="medium" size={3}>
          Mobile 4G
        </Sans>
        <div className="hide-small" />
        <Sans className="hide-small" weight="medium" size={3}>
          Desktop
        </Sans>
        <Sans className="hide-small" weight="medium" size={3}>
          Mobile 3G
        </Sans>
        <Sans className="hide-small" weight="medium" size={3}>
          Mobile 4G
        </Sans>
        {data.desktop
          .sort((a, b) => (a.page > b.page ? 1 : -1))
          .map((snapshot, i: number) => {
            let mobileSnapshot = data.mobile.find(
              s => s.page === snapshot.page
            );
            let mobile4gSnapshot = data.mobile4g.find(
              s => s.page === snapshot.page
            );

            return (
              <>
                <Sans
                  weight="medium"
                  className="no-margin"
                  size={5}
                  ml={i % 2 !== 0 ? 3 : 0}
                >
                  {snapshot.page}
                </Sans>
                <Cell
                  score={Math.round(
                    snapshot.metrics["lighthouse-performance-score"].value
                  )}
                />
                {mobileSnapshot ? (
                  <Cell
                    score={Math.round(
                      mobileSnapshot.metrics["lighthouse-performance-score"]
                        .value
                    )}
                  />
                ) : (
                  <div />
                )}
                {mobile4gSnapshot ? (
                  <Cell
                    score={Math.round(
                      mobile4gSnapshot.metrics["lighthouse-performance-score"]
                        .value
                    )}
                  />
                ) : (
                  <div />
                )}
              </>
            );
          })}
      </Grid>
    </Box>
  </Theme>
);

render(<App />, document.getElementById("root"));
