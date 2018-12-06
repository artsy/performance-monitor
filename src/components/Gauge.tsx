import React from "react";

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
) {
  var angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;

  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians)
  };
}

function generateArcPath(
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number
) {
  var start = polarToCartesian(x, y, radius, endAngle);
  var end = polarToCartesian(x, y, radius, startAngle);

  var largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  var d = [
    "M",
    start.x,
    start.y,
    "A",
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y
  ].join(" ");

  return d;
}

const fontStyle = {
  fontFamily: "HelveticaNeue"
};

const scoreToRadius = (score: number) => (360 * score) / 100;
const gaugeColor = (score: number) =>
  score >= 90 ? "#0fdb82" : score >= 50 ? "#f1af1b" : "#f7625a";

const deltaColor = (delta: string) =>
  delta.includes("-") ? "#f7625a" : delta.includes("+") ? "#0fdb82" : "black";

export interface GaugeProps {
  score: number;
  delta?: string;
  size?: number;
  stroke?: number;
}
export const Gauge = ({
  score,
  size = 150,
  stroke = size * 0.08,
  delta = "–"
}: GaugeProps) => {
  const centerPoint = size / 2;
  const radius = centerPoint - stroke / 2;
  const strokePx = `${stroke}px`;
  return (
    <svg height={size} width={size} xmlns="http://www.w3.org/2000/svg">
      <circle
        cx={centerPoint}
        cy={centerPoint}
        r={radius}
        stroke="#e5e5e5"
        fill="none"
        strokeWidth={strokePx}
      />
      <path
        stroke={gaugeColor(score)}
        fill="none"
        strokeWidth={strokePx}
        d={generateArcPath(
          centerPoint,
          centerPoint,
          radius,
          0,
          scoreToRadius(score)
        )}
      />
      <text
        x="50%"
        y={delta ? "46%" : "50%"}
        dominantBaseline="middle"
        textAnchor="middle"
        style={{ fontSize: size * 0.2, ...fontStyle }}
      >
        {score}
      </text>
      {delta && (
        <text
          x="50%"
          y="62%"
          dominantBaseline="middle"
          textAnchor="middle"
          fill={deltaColor(delta)}
          style={{ fontSize: size * 0.1, fontWeight: "bold", ...fontStyle }}
        >
          {delta}
        </text>
      )}
    </svg>
  );
};
