#!/usr/bin/env bun
import "reflect-metadata";
import { runCli } from "../run-cli";

await runCli(process.argv);
