import React from "react";
import { Box, Text } from "ink";
import { RecallFrame, CognitiveState, RecallTrace } from "../types";

interface Props {
  frames: RecallFrame[];
  state?: CognitiveState;
  trace?: RecallTrace;
}

// 大脑动画组件 - 展示回忆过程
export function MemoryBox({ frames, state, trace }: Props) {
  // 提取最新状态
  const latestActivate = [...frames]
    .reverse()
    .find((f): f is Extract<RecallFrame, { type: "recall_activate" }> => f.type === "recall_activate");

  const latestHold = [...frames]
    .reverse()
    .find((f): f is Extract<RecallFrame, { type: "recall_hold" }> => f.type === "recall_hold");

  const emotions = frames.filter(
    (f): f is Extract<RecallFrame, { type: "recall_feel" }> => f.type === "recall_feel"
  );

  const isComplete = state !== undefined;

  return (
    <Box flexDirection="column">
      {/* 激活模式 - 像神经元放电 */}
      {latestActivate && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="gray">🧠 Activate (Round {latestActivate.round})</Text>
          <Text dimColor>  {latestActivate.pattern}</Text>
          {latestActivate.memories.slice(0, 3).map((m, i) => (
            <Text key={i} color="cyan" dimColor={m.relevance < 0.5}>
              {"  "}
              {m.relevance > 0.7 ? "●" : m.relevance > 0.4 ? "◐" : "○"} {m.content.slice(0, 40)}
              {m.emotional_tag && ` [${m.emotional_tag}]`}
            </Text>
          ))}
        </Box>
      )}

      {/* 工作记忆 - 4个槽位 */}
      {latestHold && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="blue">💭 Working Memory [4 slots]</Text>
          {latestHold.slots.map((slot, i) => (
            <Box key={i}>
              <Text color="blue">  [{i}] </Text>
              <Text dimColor={!slot}>{slot || "_empty"}</Text>
            </Box>
          ))}
          {latestHold.operations.length > 0 && (
            <Text dimColor>  ops: {latestHold.operations.join(", ")}</Text>
          )}
        </Box>
      )}

      {/* 情感标记 - 边缘系统 */}
      {emotions.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="magenta">❤️ Emotional Markers</Text>
          {emotions.slice(-3).map((e, i) => (
            <Box key={i}>
              <Text>  </Text>
              <Text color={e.valence === "positive" ? "green" : e.valence === "negative" ? "red" : "gray"}>
                {e.valence === "positive" ? "😊" : e.valence === "negative" ? "😰" : "😐"}
              </Text>
              <Text> {Math.round(e.arousal * 100)}% </Text>
              <Text color={e.priority === "high" ? "yellow" : "dimColor"}>
                {e.priority === "high" ? "★" : "☆"}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {/* 最终状态 - 认知结构 */}
      {isComplete && state && (
        <Box flexDirection="column" borderStyle="single" borderColor="green" paddingX={1}>
          <Text color="green">✓ Cognitive State</Text>
          {state.current_goal && (
            <Box marginY={1}>
              <Text color="yellow">🎯 {state.current_goal}</Text>
            </Box>
          )}
          {state.plan_status.length > 0 && (
            <Box flexDirection="column" marginBottom={1}>
              <Text color="blue">📋 Plan</Text>
              {state.plan_status.map((step, i) => (
                <Text key={i} dimColor={step.includes("(done)")}>
                  {"  "}{step.includes("(done)") ? "✓" : "○"} {step}
                </Text>
              ))}
            </Box>
          )}
          {state.key_facts.length > 0 && (
            <Box flexDirection="column">
              <Text color="cyan">💡 Key Facts</Text>
              {state.key_facts.slice(0, 5).map((fact, i) => (
                <Text key={i} dimColor>  • {fact.slice(0, 50)}</Text>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* 思考中... */}
      {!isComplete && frames.length > 0 && (
        <Text dimColor>🤔 Recalling...</Text>
      )}
    </Box>
  );
}
