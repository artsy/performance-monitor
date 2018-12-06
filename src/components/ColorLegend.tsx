import React from "react";
import styled from "styled-components";
import { color, Color, Flex, Box } from "@artsy/palette";

interface DotProps {
  color: Color;
  size: number;
}
const Dot = styled.div<DotProps>`
  border-radius: 50%;
  ${p => `width: ${p.size}px`};
  ${p => `height: ${p.size}px`};
  ${p => `background-color: ${color(p.color)}`};
`;

export interface ColorLegendProps {
  color: Color;
  label: string;
  dotSize: number;
}
export const ColorLegend = ({ color, label, dotSize }: ColorLegendProps) => (
  <Flex flexDirection="row" alignItems="center">
    <Dot color={color} size={dotSize} />
    <Box pl={1}>{label}</Box>
  </Flex>
);
