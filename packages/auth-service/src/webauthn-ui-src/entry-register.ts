import { mount } from "svelte";
import "./styles.css";
import RegisterPage from "./register-page.svelte";

mount(RegisterPage, {
  target: document.getElementById("app")!,
});
