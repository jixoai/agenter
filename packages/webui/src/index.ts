export interface WebUiHtmlOptions {
  title?: string;
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const createWebUiHtml = (options: WebUiHtmlOptions = {}): string => {
  const title = escapeHtml(options.title ?? "Agenter WebUI");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  :root {
    color-scheme: light;
    --bg: #f7f8fa;
    --panel: #ffffff;
    --text: #111827;
    --subtle: #6b7280;
    --line: #d1d5db;
    --primary: #0f766e;
    --primary-soft: #ccfbf1;
    --danger: #b91c1c;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; background: var(--bg); color: var(--text); font-family: ui-sans-serif, -apple-system, Segoe UI, sans-serif; }
  .app { display: grid; grid-template-rows: auto 1fr; min-height: 100%; }
  .topbar { padding: 10px 12px; border-bottom: 1px solid var(--line); background: var(--panel); display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .topbar strong { font-size: 14px; }
  .body { display: grid; grid-template-columns: 320px 1fr; gap: 12px; padding: 12px; }
  .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
  .panel h3 { margin: 0; font-size: 13px; padding: 10px 12px; border-bottom: 1px solid var(--line); }
  .instance-list { padding: 8px; overflow: auto; display: flex; flex-direction: column; gap: 6px; }
  .instance-item { border: 1px solid var(--line); border-radius: 8px; padding: 8px; cursor: pointer; }
  .instance-item.active { border-color: var(--primary); background: var(--primary-soft); }
  .meta { color: var(--subtle); font-size: 12px; }
  .content { min-height: 0; overflow: auto; padding: 10px; }
  .toolbar { display: flex; gap: 8px; padding: 8px 10px; border-bottom: 1px solid var(--line); }
  .toolbar button, .toolbar select { height: 32px; border: 1px solid var(--line); border-radius: 8px; background: #fff; }
  .toolbar button { padding: 0 10px; cursor: pointer; }
  .toolbar button.primary { border-color: var(--primary); color: var(--primary); }
  .chat-log { display: flex; flex-direction: column; gap: 8px; }
  .bubble { border-radius: 10px; padding: 8px 10px; font-size: 13px; white-space: pre-wrap; }
  .bubble.user { margin-left: 36px; background: #dbeafe; }
  .bubble.assistant { margin-right: 36px; background: #ecfeff; }
  .composer { border-top: 1px solid var(--line); padding: 8px; display: flex; gap: 8px; }
  .composer textarea { flex: 1; min-height: 70px; resize: vertical; border: 1px solid var(--line); border-radius: 8px; padding: 8px; font-size: 13px; }
  .composer button { width: 88px; border: 1px solid var(--primary); background: var(--primary); color: #fff; border-radius: 8px; }
  .editor { width: 100%; min-height: 180px; border: 1px solid var(--line); border-radius: 8px; padding: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
  .status { font-size: 12px; color: var(--subtle); }
  @media (max-width: 860px) {
    .body { grid-template-columns: 1fr; }
    .instance-item.active { background: #eef2ff; }
  }
</style>
</head>
<body>
<div class="app">
  <div class="topbar">
    <strong>Agenter WebUI</strong>
    <span class="status" id="wsStatus">disconnected</span>
  </div>
  <div class="body">
    <section class="panel">
      <h3>Instances</h3>
      <div class="toolbar">
        <button id="createBtn" class="primary">New</button>
        <button id="startBtn">Start</button>
        <button id="stopBtn">Stop</button>
      </div>
      <div id="instanceList" class="instance-list"></div>
    </section>

    <section class="panel">
      <h3 id="mainTitle">Chat</h3>
      <div class="toolbar">
        <select id="editorKind">
          <option value="settings">settings.json</option>
          <option value="agenter">AGENTER.mdx</option>
          <option value="system">AGENTER_SYSTEM.mdx</option>
          <option value="template">SYSTEM_TEMPLATE.mdx</option>
          <option value="contract">RESPONSE_CONTRACT.mdx</option>
        </select>
        <button id="loadFileBtn">Load</button>
        <button id="saveFileBtn">Save</button>
        <span id="fileStatus" class="status"></span>
      </div>
      <div class="content" id="chatContent">
        <div id="chatLog" class="chat-log"></div>
      </div>
      <div class="composer">
        <textarea id="chatInput" placeholder="Send message to current instance"></textarea>
        <button id="sendBtn">Send</button>
      </div>
      <div class="content" style="border-top:1px solid var(--line)">
        <textarea id="fileEditor" class="editor" placeholder="Load settings/prompts file"></textarea>
      </div>
    </section>
  </div>
</div>
<script>
(() => {
  const wsStatusEl = document.getElementById('wsStatus');
  const instanceListEl = document.getElementById('instanceList');
  const chatLogEl = document.getElementById('chatLog');
  const chatInputEl = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const createBtn = document.getElementById('createBtn');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const editorKindEl = document.getElementById('editorKind');
  const loadFileBtn = document.getElementById('loadFileBtn');
  const saveFileBtn = document.getElementById('saveFileBtn');
  const fileEditorEl = document.getElementById('fileEditor');
  const fileStatusEl = document.getElementById('fileStatus');
  const mainTitleEl = document.getElementById('mainTitle');

  const state = {
    instances: [],
    activeInstanceId: null,
    chats: new Map(),
    files: new Map(),
  };

  const reqMap = new Map();
  const reqId = () => 'req-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  let ws;

  const wsUrl = () => {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return protocol + '//' + location.host + '/ws';
  };

  const send = (payload) => ws && ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(payload));
  const request = (type, payload) => new Promise((resolve, reject) => {
    const requestId = reqId();
    reqMap.set(requestId, { resolve, reject, ts: Date.now() });
    send({ type, requestId, payload });
    setTimeout(() => {
      const pending = reqMap.get(requestId);
      if (!pending) return;
      reqMap.delete(requestId);
      reject(new Error(type + ' timeout'));
    }, 10000);
  });

  const renderInstances = () => {
    instanceListEl.innerHTML = '';
    state.instances.forEach((instance) => {
      const div = document.createElement('div');
      div.className = 'instance-item' + (state.activeInstanceId === instance.id ? ' active' : '');
      div.innerHTML = '<strong>' + instance.name + '</strong><div class="meta">' + instance.status + ' · ' + instance.cwd + '</div>';
      div.onclick = () => {
        state.activeInstanceId = instance.id;
        renderInstances();
        renderChat();
      };
      instanceListEl.appendChild(div);
    });

    const active = state.instances.find((it) => it.id === state.activeInstanceId);
    mainTitleEl.textContent = active ? 'Chat · ' + active.name : 'Chat';
  };

  const renderChat = () => {
    const id = state.activeInstanceId;
    chatLogEl.innerHTML = '';
    if (!id) return;
    const messages = state.chats.get(id) || [];
    messages.slice(-120).forEach((msg) => {
      const item = document.createElement('div');
      item.className = 'bubble ' + (msg.role === 'user' ? 'user' : 'assistant');
      item.textContent = msg.content;
      chatLogEl.appendChild(item);
    });
    chatLogEl.scrollTop = chatLogEl.scrollHeight;
  };

  const upsertInstance = (instance) => {
    const index = state.instances.findIndex((it) => it.id === instance.id);
    if (index >= 0) state.instances[index] = instance;
    else state.instances.push(instance);
    if (!state.activeInstanceId) state.activeInstanceId = instance.id;
    renderInstances();
  };

  const connect = () => {
    ws = new WebSocket(wsUrl());
    ws.onopen = () => {
      wsStatusEl.textContent = 'connected';
      request('instance.list').catch(() => {});
    };
    ws.onclose = () => {
      wsStatusEl.textContent = 'disconnected';
      setTimeout(connect, 1000);
    };
    ws.onerror = () => {
      wsStatusEl.textContent = 'error';
    };
    ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }

      if (msg.type === 'ack') {
        if (!msg.requestId) return;
        const pending = reqMap.get(msg.requestId);
        if (!pending) return;
        reqMap.delete(msg.requestId);
        if (msg.ok) pending.resolve(msg.data);
        else pending.reject(new Error(msg.error?.message || 'request failed'));
        return;
      }

      if (msg.type === 'instance.snapshot') {
        state.instances = msg.payload.instances || [];
        if (!state.activeInstanceId && state.instances.length > 0) {
          state.activeInstanceId = state.instances[0].id;
        }
        renderInstances();
        renderChat();
        return;
      }

      if (msg.type === 'instance.updated') {
        upsertInstance(msg.payload.instance);
        return;
      }

      if (msg.type === 'instance.deleted') {
        state.instances = state.instances.filter((it) => it.id !== msg.payload.instanceId);
        if (state.activeInstanceId === msg.payload.instanceId) {
          state.activeInstanceId = state.instances[0]?.id || null;
        }
        renderInstances();
        renderChat();
        return;
      }

      if (msg.type === 'chat.message') {
        const list = state.chats.get(msg.payload.instanceId) || [];
        list.push(msg.payload.message);
        state.chats.set(msg.payload.instanceId, list);
        if (state.activeInstanceId === msg.payload.instanceId) {
          renderChat();
        }
      }
    };
  };

  sendBtn.onclick = async () => {
    const text = chatInputEl.value.trim();
    if (!text || !state.activeInstanceId) return;
    chatInputEl.value = '';
    try {
      await request('chat.send', { instanceId: state.activeInstanceId, text });
    } catch (error) {
      alert(error.message);
    }
  };

  createBtn.onclick = async () => {
    const cwd = prompt('Instance cwd', location.pathname ? '/' : '.');
    if (!cwd) return;
    const name = prompt('Instance name', 'workspace') || undefined;
    try {
      const data = await request('instance.create', { cwd, name, autoStart: true });
      if (data?.instance?.id) {
        state.activeInstanceId = data.instance.id;
      }
      renderInstances();
    } catch (error) {
      alert(error.message);
    }
  };

  startBtn.onclick = async () => {
    if (!state.activeInstanceId) return;
    try {
      await request('instance.start', { instanceId: state.activeInstanceId });
    } catch (error) {
      alert(error.message);
    }
  };

  stopBtn.onclick = async () => {
    if (!state.activeInstanceId) return;
    try {
      await request('instance.stop', { instanceId: state.activeInstanceId });
    } catch (error) {
      alert(error.message);
    }
  };

  loadFileBtn.onclick = async () => {
    if (!state.activeInstanceId) return;
    const kind = editorKindEl.value;
    try {
      const file = await request('settings.read', { instanceId: state.activeInstanceId, kind });
      state.files.set(kind + ':' + state.activeInstanceId, file);
      fileEditorEl.value = file.content || '';
      fileStatusEl.textContent = file.path + ' (mtime=' + Math.floor(file.mtimeMs) + ')';
    } catch (error) {
      fileStatusEl.textContent = error.message;
    }
  };

  saveFileBtn.onclick = async () => {
    if (!state.activeInstanceId) return;
    const kind = editorKindEl.value;
    const key = kind + ':' + state.activeInstanceId;
    const file = state.files.get(key);
    if (!file) {
      fileStatusEl.textContent = 'load file first';
      return;
    }
    try {
      const saved = await request('settings.save', {
        instanceId: state.activeInstanceId,
        kind,
        content: fileEditorEl.value,
        baseMtimeMs: file.mtimeMs,
      });
      state.files.set(key, saved);
      fileStatusEl.textContent = 'saved: ' + saved.path;
    } catch (error) {
      fileStatusEl.textContent = error.message;
    }
  };

  connect();
})();
</script>
</body>
</html>`;
};
