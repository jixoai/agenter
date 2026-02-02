#!/usr/bin/env bun
// Test WebSocket API

const WS_URL = "ws://127.0.0.1:3457/ws";

console.log("Connecting to", WS_URL);

const ws = new WebSocket(WS_URL);

let requestId = 1;

ws.onopen = () => {
  console.log("Connected!");
  console.log("\n--- Testing recall ---");

  ws.send(
    JSON.stringify({
      id: requestId++,
      type: "recall",
      tab_id: 1,
      message: "Hello, what is this project?",
    })
  );
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("Received:", data.type);

  if (data.type === "recall_result") {
    console.log("Memory:", data.memory_text.substring(0, 100) + "...");
    console.log("\n--- Testing respond (streaming) ---");

    ws.send(
      JSON.stringify({
        id: requestId++,
        type: "respond",
        tab_id: 1,
        message: "Hello, what is this project?",
        cognitive_state: data.cognitive_state,
      })
    );
  }

  if (data.type === "respond_meta") {
    console.log("Meta:", data.summary);
  }

  if (data.type === "respond_delta") {
    process.stdout.write(data.delta);
  }

  if (data.type === "respond_done") {
    console.log("\n\n--- Done! ---");
    console.log("Full reply:", data.reply.substring(0, 100) + "...");
    ws.close();
    process.exit(0);
  }

  if (data.type === "error") {
    console.error("Error:", data.message);
    ws.close();
    process.exit(1);
  }
};

ws.onerror = (error) => {
  console.error("WebSocket error:", error);
  process.exit(1);
};

ws.onclose = () => {
  console.log("\nDisconnected");
};

setTimeout(() => {
  console.error("\nTimeout!");
  ws.close();
  process.exit(1);
}, 30000);
