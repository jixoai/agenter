#!/bin/bash
# Agenter UI Review Capture Tool
# Usage: ./.gemini/scripts/ui-capture.sh <topic_name> <url> <wait_text_or_selector> <stage:before|after|after_compact>

TOPIC=$1
URL=$2
WAIT_TARGET=$3
STAGE=$4

if [ -z "$STAGE" ]; then
  echo "Usage: $0 <topic_name> <url> <wait_text_or_selector> <stage:before|after|after_compact>"
  exit 1
fi

DIR=".screenshot/$TOPIC"
mkdir -p "$DIR"

echo "📸 Taking $STAGE screenshot for $TOPIC at $URL..."

# Determine if wait target is a CSS selector or text
if [[ "$WAIT_TARGET" == *"#"* ]] || [[ "$WAIT_TARGET" == *"."* ]] || [[ "$WAIT_TARGET" == *"["* ]]; then
  WAIT_CMD="agent-browser wait '$WAIT_TARGET'"
else
  WAIT_CMD="agent-browser wait --text '$WAIT_TARGET'"
fi

# Execute agent-browser chain: open -> wait for target -> wait extra 500ms for animations -> capture
agent-browser open "$URL" && \
eval "$WAIT_CMD" && \
agent-browser wait 500 && \
agent-browser screenshot "$DIR/$STAGE.png"

if [ $? -eq 0 ]; then
  echo "✅ Successfully saved to $DIR/$STAGE.png"
else
  echo "❌ Failed to capture screenshot. Is the dev server running?"
  exit 1
fi

# Auto-scaffold README.md if it doesn't exist
if [ ! -f "$DIR/README.md" ]; then
  cat <<EOF > "$DIR/README.md"
# $TOPIC - Visual Comparison

## Topic: [Describe the focus of the change]
**Date:** $(date +%Y-%m-%d)

### Screenshots
- [Before](./before.png)
- [After](./after.png)

### Key UX Improvements & Design Rationale
*(Explain the changes here, referencing DESIGN.md principles like information density, layout boundaries, etc.)*

1. 
2. 
EOF
  echo "📝 Generated scaffold README at $DIR/README.md"
fi
