import { mount } from "svelte";

import "@perf-target-layout-css";

import App from "./app.svelte";

if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    if (event.message === "ResizeObserver loop completed with undelivered notifications.") {
      event.preventDefault();
    }
  });
}

const params = new URLSearchParams(window.location.search);
mount(App, {
  props: {
    scenarioId: params.get("scenario") ?? "heartbeat-initial",
  },
  target: document.getElementById("app")!,
});
