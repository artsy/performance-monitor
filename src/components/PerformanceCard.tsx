import React from "react";
import { Gauge } from "./Gauge";
import { Flex } from "@artsy/palette";
import styled from "styled-components";
import { color } from "@artsy/palette";

const Card = styled(Flex)`
  background-color: ${color("black5")};
`;

const Title = styled.div`
  padding-bottom: 30px;
  font-family: HelveticaNeue;
  font-size: 18px;
`;

interface Props {
  title: string;
  score: number;
  delta?: string;
  [key: string]: any;
}
export const PerformanceCard = ({ title, score, delta, ...styles }: Props) => (
  <Card
    flexDirection="column"
    backgroundColor="#f8f8f8"
    pt={2}
    pb={3}
    px={4}
    {...styles}
  >
    <Title>{title}</Title>
    <Gauge score={30} delta="+15%" />
  </Card>
);
