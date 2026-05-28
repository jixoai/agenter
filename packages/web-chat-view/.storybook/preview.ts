import type { Preview } from "@storybook/svelte-vite";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: "todo",
    },
    viewport: {
      viewports: {
        iphone14: {
          name: "iPhone 14",
          styles: {
            width: "390px",
            height: "844px",
          },
          type: "mobile",
        },
      },
      defaultViewport: "iphone14",
    },
    layout: "centered",
  },
};

export default preview;
