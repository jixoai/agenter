import {
  App as Framework7App,
  Block as Framework7Block,
  BlockTitle as Framework7BlockTitle,
  Button as Framework7Button,
  Fab as Framework7Fab,
  List as Framework7List,
  ListButton as Framework7ListButton,
  ListInput as Framework7ListInput,
  ListItem as Framework7ListItem,
  Link as Framework7Link,
  Navbar as Framework7Navbar,
  NavLeft as Framework7NavLeft,
  NavRight as Framework7NavRight,
  NavTitle as Framework7NavTitle,
  Page as Framework7Page,
  PageContent as Framework7PageContent,
  Progressbar as Framework7Progressbar,
  Segmented as Framework7Segmented,
  Sheet as Framework7Sheet,
  Subnavbar as Framework7Subnavbar,
  Toolbar as Framework7Toolbar,
  Toggle as Framework7Toggle,
  View as Framework7View,
} from "framework7-svelte";
import type { Component } from "svelte";

type LooseComponent = Component<Record<string, unknown>>;

const loosen = <T>(component: T): LooseComponent => component as unknown as LooseComponent;

export const App = loosen(Framework7App);
export const Block = loosen(Framework7Block);
export const BlockTitle = loosen(Framework7BlockTitle);
export const Button = loosen(Framework7Button);
export const Fab = loosen(Framework7Fab);
export const List = loosen(Framework7List);
export const ListButton = loosen(Framework7ListButton);
export const ListInput = loosen(Framework7ListInput);
export const ListItem = loosen(Framework7ListItem);
export const Link = loosen(Framework7Link);
export const Navbar = loosen(Framework7Navbar);
export const NavLeft = loosen(Framework7NavLeft);
export const NavRight = loosen(Framework7NavRight);
export const NavTitle = loosen(Framework7NavTitle);
export const Page = loosen(Framework7Page);
export const PageContent = loosen(Framework7PageContent);
export const Progressbar = loosen(Framework7Progressbar);
export const Segmented = loosen(Framework7Segmented);
export const Sheet = loosen(Framework7Sheet);
export const Subnavbar = loosen(Framework7Subnavbar);
export const Toolbar = loosen(Framework7Toolbar);
export const Toggle = loosen(Framework7Toggle);
export const View = loosen(Framework7View);
