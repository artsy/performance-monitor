declare module "repng" {
  import * as React from "react";
  interface Options<P> {
    props: P;
    width: number;
    height: number;
    cssLibrary?: "styled-components" | "emotion";
  }
  export default function<P>(
    component: React.SFC<P>,
    options: Options<P>
  ): Promise<{}>;
}
