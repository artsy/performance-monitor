import React from "react";
import { Box, Flex } from "@artsy/palette";
import { SpaceProps } from "styled-system";
import { color } from "@artsy/palette";
import styled from "styled-components";

const widthRatio = (value: number, max: number) => `${(value / max) * 100}%`;

const deltaColor = (delta: string) =>
  delta.includes("+")
    ? color("red100")
    : delta.includes("-")
    ? color("green100")
    : color("black100");

const Bar = styled(Flex)`
  background-color: ${color("black10")};
`;

const Header = styled.span`
  font-family: HelveticaNeue;
  line-height: 30px;
`;

export interface MetricBarProps extends SpaceProps {
  metric?: string;
  value: number;
  goal?: string;
  delta?: string;
  range: {
    top: number;
    mid: number;
    low: number;
    bottom?: number;
  };
  units?: string;
  [key: string]: any;
}
export const MetricBar = ({
  metric,
  goal,
  delta = "",
  value,
  range,
  units = "ms",
  ...styles
}: MetricBarProps) => {
  const lowPlus40percent = range.low + range.low * 0.4;
  const bottom =
    range.bottom || value < lowPlus40percent
      ? lowPlus40percent
      : value + value * 0.2;

  return (
    <Box textAlign="left" {...styles}>
      {metric && <Header>{metric}</Header>}
      <Flex alignItems="center" paddingTop={3}>
        <Bar
          height="30px"
          width={widthRatio(value, bottom)}
          alignItems="center"
          justifyContent="flex-end"
          pr={1}
          pt="1pt"
        >
          {value.toLocaleString()}
          {units ? ` ${units}` : ""}
        </Bar>
        {delta && (
          <Box ml={1} color={deltaColor(delta)}>
            {delta}
          </Box>
        )}
      </Flex>
      <Flex>
        <Box
          height="2px"
          bg={color("green100")}
          width={widthRatio(range.mid - range.top, bottom)}
        />
        <Box
          height="2px"
          bg={color("yellow100")}
          width={widthRatio(range.low - range.top, bottom)}
        />
        <Box
          height="2px"
          bg={color("red100")}
          width={widthRatio(bottom - range.low, bottom)}
        />
      </Flex>
    </Box>
  );
};
