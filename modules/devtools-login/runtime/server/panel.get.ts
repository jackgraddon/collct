export default defineEventHandler(() => {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Dev Tools</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 16px;
      background: #1a1a1a;
      color: #e0e0e0;
    }
    h3 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #fff;
    }
    .section {
      margin-bottom: 20px;
    }
    .section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #888;
      margin-bottom: 8px;
    }
    .buttons {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    button {
      display: block;
      width: 100%;
      padding: 10px 14px;
      border: 1px solid #333;
      border-radius: 6px;
      background: #2a2a2a;
      color: #e0e0e0;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
      text-align: left;
    }
    button:hover {
      background: #333;
      border-color: #555;
    }
    button:active {
      background: #3a3a3a;
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    button small {
      display: block;
      font-size: 11px;
      font-weight: 400;
      color: #888;
      margin-top: 2px;
    }
    .divider {
      border: none;
      border-top: 1px solid #333;
      margin: 16px 0;
    }
    .status {
      margin-top: 10px;
      font-size: 12px;
      color: #888;
      min-height: 16px;
      line-height: 1.4;
    }
    .status.error { color: #e57373; }
    .status.success { color: #81c784; }
    select {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid #333;
      border-radius: 6px;
      background: #2a2a2a;
      color: #e0e0e0;
      font-size: 13px;
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="section">
    <div class="section-title">Login</div>
    <div class="buttons">
      <button onclick="login('test1')">Login as test1</button>
      <button onclick="login('test2')">Login as test2</button>
      <button onclick="login('test3')">Login as test3</button>
    </div>
  </div>

  <hr class="divider">

  <div class="section">
    <div class="section-title">Moments</div>
    <div class="buttons">
      <button onclick="momentControl('open')">
        Open moment window now
        <small>Sets time to now, triggers notifications</small>
      </button>
      <button onclick="momentControl('close')">
        Close moment window
        <small>Moves time past capture window ("after" state)</small>
      </button>
      <button onclick="momentControl('reset')">
        Reset moment window
        <small>Sets time 5min future ("before" state)</small>
      </button>
    </div>
    <div style="margin-top: 12px;">
      <div class="section-title" style="margin-bottom: 6px;">Clear captured-today flag</div>
      <select id="clearUser">
        <option value="test1">test1</option>
        <option value="test2">test2</option>
        <option value="test3">test3</option>
      </select>
      <button onclick="clearCaptured()">
        Clear captured flag
        <small>Allows re-running capture flow for selected user</small>
      </button>
    </div>
  </div>

  <div class="status" id="status"></div>

  <script>
    function setStatus(text, type) {
      const el = document.getElementById('status');
      el.className = 'status ' + (type || '');
      el.textContent = text;
    }

    function setButtonsDisabled(disabled) {
      document.querySelectorAll('button').forEach(b => b.disabled = disabled);
    }

    async function login(username) {
      setButtonsDisabled(true);
      setStatus('Logging in as ' + username + '...');
      try {
        const res = await fetch('/api/dev/login-as', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username }),
        });
        if (res.ok) {
          setStatus('Logged in! Redirecting...', 'success');
          window.top.location.href = '/';
        } else {
          const err = await res.text();
          setStatus('Error: ' + err, 'error');
          setButtonsDisabled(false);
        }
      } catch (e) {
        setStatus('Network error: ' + e.message, 'error');
        setButtonsDisabled(false);
      }
    }

    async function momentControl(action) {
      setButtonsDisabled(true);
      setStatus('Executing: ' + action + '...');
      try {
        const res = await fetch('/api/dev/moment-control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });
        const data = await res.json();
        if (res.ok) {
          setStatus(data.message, 'success');
        } else {
          setStatus('Error: ' + (data.statusMessage || data.message || 'Unknown error'), 'error');
        }
      } catch (e) {
        setStatus('Network error: ' + e.message, 'error');
      }
      setButtonsDisabled(false);
    }

    async function clearCaptured() {
      const username = document.getElementById('clearUser').value;
      setButtonsDisabled(true);
      setStatus('Clearing captured flag for ' + username + '...');
      try {
        const res = await fetch('/api/dev/moment-control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'clearCaptured', username }),
        });
        const data = await res.json();
        if (res.ok) {
          setStatus(data.message, 'success');
        } else {
          setStatus('Error: ' + (data.statusMessage || data.message || 'Unknown error'), 'error');
        }
      } catch (e) {
        setStatus('Network error: ' + e.message, 'error');
      }
      setButtonsDisabled(false);
    }
  </script>
</body>
</html>`
})
