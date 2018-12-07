import React from "react";
import { render } from "react-dom";
import { PerformanceCard } from "components/PerformanceCard";
import { MetricBar } from "components/MetricBar";
import { ColorLegend } from "components/ColorLegend";
import styled from "styled-components";
import { color, Box, Flex } from "@artsy/palette";

const Heading = styled.h1`
  font-size: 30px;
  font-family: TimesNewRomanPSMT, "Times New Roman", Times, serif;
`;

const SubHeading = styled.p`
  color: ${color("black60")};
`;

const App = () => (
  <Box fontFamily="sans-serif" textAlign="center">
    <Heading>Artsy Web Performance Report</Heading>
    <SubHeading>Nov 5-16, 2018</SubHeading>
    <Flex width="100%" justifyContent="center">
      <PerformanceCard title="Article" score={45} delta="-16%" mx={1} />
      <PerformanceCard title="Artist" score={67} marginX="10px" mx={1} />
      <PerformanceCard title="Artwork" score={92} delta="+31%" mx={1} />
    </Flex>
    <ColorLegend color="red100" label="0-50" dotSize={10} />
    <Flex flexDirection="column" alignItems="center">
      <MetricBar
        metric="Speed index"
        range={{
          top: 0,
          mid: 2200,
          low: 5500
        }}
        value={6000}
        my={2}
        width="800px"
        delta="-8%"
        goal={2200}
      />
      <MetricBar
        metric="First contentful paint"
        range={{
          top: 0,
          mid: 2350,
          low: 4000
        }}
        value={2350}
        marginY="20px"
        width="800px"
        delta="+12%"
        goal={2350}
      />
    </Flex>
  </Box>
);

render(<App />, document.getElementById("root"));
