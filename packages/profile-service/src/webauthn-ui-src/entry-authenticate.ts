import { mount } from "svelte";
import "./styles.css";
import AuthenticatePage from "./authenticate-page.svelte";

mount(AuthenticatePage, {
  target: document.getElementById("app")!,
});
