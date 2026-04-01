import "@testing-library/jest-dom/vitest";
import { beforeAll } from "vitest";
import { setProjectAnnotations } from "@storybook/react-vite";

import * as preview from "./preview";

const annotations = setProjectAnnotations([preview]);

if (annotations.beforeAll) {
  beforeAll(annotations.beforeAll);
}
