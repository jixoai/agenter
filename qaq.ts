process.stdin.setRawMode(true);
process.stdin.on("data", (data) => {
  console.log("Hex data:", data.toString("hex"));
  if (data[0] === 3) process.exit(); // Ctrl+C 退出
});
