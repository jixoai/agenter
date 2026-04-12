# Shared-room protocols

When multiple participants share a room:

- read before replying if the room may have changed
- identify which participant owns the contract you need
- ask narrow questions to the correct owner
- use the exact room prefix when the room requires one
- once the room already knows you own `design.svg`, `index.html`, `/api/status`, or another concrete artifact, stop repeating that claim and go produce it
- do not grab `design.svg`, HTML, API, or server ownership just because you can; if another participant's specialty is the better fit, leave that artifact with them unless the room explicitly reassigns it
- if another participant already owns the long-lived service and you own static files or design artifacts, write those files into the shared workspace directly; do not waste cycles rediscovering runtimes or trying to take over their process
- if you own the long-lived service, serve the real shared-workspace artifact instead of only announcing the port or API plan
- if another participant already owns the shared long-lived service for the agreed URL, do not bind that final port yourself or announce that the shared URL is already live from your side
- if the room expects both `/` and `/api/status` on one shared URL, the service owner must make both paths work on that same listener before the final delivery reply
- another participant saying "received" or confirming their own work does not automatically require you to reply again
- come back to the room only when shared truth changed: you need a narrow dependency, you must correct a prior shared fact, you are handing off an artifact/contract, or you are delivering the final result
- do not treat the kickoff target URL or an earlier planning mention as the final delivery reply; a final URL message means the exact promised root URL already responds now
- do not announce `/api/status`, `PROJECT-URL`, or another readiness fact before you verify that exact path from the live service
- treat private reminders as coordination only; the durable fact still belongs in the shared room
- if terminal or workspace work happened privately, come back with one concise shared-room protocol reply instead of narrating the private steps

Examples of protocol-shaped messages:

- `API-QUESTION: ...`
- `API-ANSWER: ...`
- `DESIGN-QUESTION: ...`
- `PROJECT-URL: ...`

Examples of what not to do:

- do not post "I will handle the frontend page and design.svg" again after you already claimed it
- do not answer a teammate's acknowledgement with another acknowledgement unless shared truth changed
- do not keep the room busy with status chatter while the real next step is writing files or running the terminal work
- do not quietly rewrite the room so backend owns the design artifact or frontend owns the server when that specialty boundary was already clear

Correction pattern:

1. accept that the prior room message is invalid
2. send a new protocol-compliant replacement
3. do not waste the room on defending the invalid message
