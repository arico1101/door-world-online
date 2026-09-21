import { MINIMAL_VIEWPORTS } from "storybook/viewport";

const preview = {
  globalTypes: {
    locale: {
      description: "Game language",
      toolbar: {
        title: "Language",
        icon: "globe",
        items: [
          { value: "ja", title: "日本語" },
          { value: "en", title: "English" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { locale: "ja" },
  parameters: {
    layout: "fullscreen",
    controls: { disable: true },
    viewport: {
      options: {
        gameMobile: {
          name: "Game mobile (390 × 844)",
          styles: { width: "390px", height: "844px" },
          type: "mobile",
        },
        gameDesktop: {
          name: "Game desktop (1440 × 900)",
          styles: { width: "1440px", height: "900px" },
          type: "desktop",
        },
        ...MINIMAL_VIEWPORTS,
      },
    },
    options: {
      storySort: { method: "numeric" },
    },
  },
};

export default preview;
