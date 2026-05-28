import {
  Actions as Framework7Actions,
  ActionsButton as Framework7ActionsButton,
  ActionsGroup as Framework7ActionsGroup,
  App as Framework7App,
  Badge as Framework7Badge,
  Block as Framework7Block,
  BlockTitle as Framework7BlockTitle,
  Button as Framework7Button,
  Card as Framework7Card,
  CardContent as Framework7CardContent,
  CardFooter as Framework7CardFooter,
  CardHeader as Framework7CardHeader,
  Icon as Framework7Icon,
  Link as Framework7Link,
  List as Framework7List,
  ListGroup as Framework7ListGroup,
  ListInput as Framework7ListInput,
  ListItem as Framework7ListItem,
  Message as Framework7Message,
  Messagebar as Framework7Messagebar,
  MessagebarAttachment as Framework7MessagebarAttachment,
  MessagebarAttachments as Framework7MessagebarAttachments,
  MessagebarSheet as Framework7MessagebarSheet,
  Messages as Framework7Messages,
  NavLeft as Framework7NavLeft,
  Navbar as Framework7Navbar,
  NavRight as Framework7NavRight,
  Page as Framework7Page,
  PageContent as Framework7PageContent,
  Panel as Framework7Panel,
  PhotoBrowser as Framework7PhotoBrowser,
  Popup as Framework7Popup,
  Popover as Framework7Popover,
  Searchbar as Framework7Searchbar,
  Segmented as Framework7Segmented,
  Sheet as Framework7Sheet,
  Subnavbar as Framework7Subnavbar,
  Tab as Framework7Tab,
  Tabs as Framework7Tabs,
  Toolbar as Framework7Toolbar,
  ToolbarPane as Framework7ToolbarPane,
  View as Framework7View,
  Views as Framework7Views,
} from "framework7-svelte";
import type { Component } from "svelte";

type LooseComponent = Component<Record<string, unknown>>;

const loosen = <T>(component: T): LooseComponent => component as LooseComponent;

export const Actions = loosen(Framework7Actions);
export const ActionsButton = loosen(Framework7ActionsButton);
export const ActionsGroup = loosen(Framework7ActionsGroup);
export const App = loosen(Framework7App);
export const Badge = loosen(Framework7Badge);
export const Block = loosen(Framework7Block);
export const BlockTitle = loosen(Framework7BlockTitle);
export const Button = loosen(Framework7Button);
export const Card = loosen(Framework7Card);
export const CardContent = loosen(Framework7CardContent);
export const CardFooter = loosen(Framework7CardFooter);
export const CardHeader = loosen(Framework7CardHeader);
export const Icon = loosen(Framework7Icon);
export const Link = loosen(Framework7Link);
export const List = loosen(Framework7List);
export const ListGroup = loosen(Framework7ListGroup);
export const ListInput = loosen(Framework7ListInput);
export const ListItem = loosen(Framework7ListItem);
export const Message = loosen(Framework7Message);
export const Messagebar = loosen(Framework7Messagebar);
export const MessagebarAttachment = loosen(Framework7MessagebarAttachment);
export const MessagebarAttachments = loosen(Framework7MessagebarAttachments);
export const MessagebarSheet = loosen(Framework7MessagebarSheet);
export const Messages = loosen(Framework7Messages);
export const NavLeft = loosen(Framework7NavLeft);
export const Navbar = loosen(Framework7Navbar);
export const NavRight = loosen(Framework7NavRight);
export const Page = loosen(Framework7Page);
export const PageContent = loosen(Framework7PageContent);
export const Panel = loosen(Framework7Panel);
export const PhotoBrowser = loosen(Framework7PhotoBrowser);
export const Popup = loosen(Framework7Popup);
export const Popover = loosen(Framework7Popover);
export const Searchbar = loosen(Framework7Searchbar);
export const Segmented = loosen(Framework7Segmented);
export const Sheet = loosen(Framework7Sheet);
export const Subnavbar = loosen(Framework7Subnavbar);
export const Tab = loosen(Framework7Tab);
export const Tabs = loosen(Framework7Tabs);
export const Toolbar = loosen(Framework7Toolbar);
export const ToolbarPane = loosen(Framework7ToolbarPane);
export const View = loosen(Framework7View);
export const Views = loosen(Framework7Views);
