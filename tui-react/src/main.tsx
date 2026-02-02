#!/usr/bin/env bun
import React from "react";
import { render } from "ink";
import { App } from "./App";

// Parse command line arguments
const args = process.argv.slice(2);
const isDebug = args.includes("--debug");

render(<App debug={isDebug} />);
