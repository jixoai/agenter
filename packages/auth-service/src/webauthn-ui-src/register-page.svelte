<script lang="ts">
  import { startRegistration } from "@simplewebauthn/browser";
  import { publishAuthSuccess, jsonFetch, readSearchParam } from "./shared";

  type RegistrationOptionsPayload = {
    ticketId: string;
    options: PublicKeyCredentialCreationOptionsJSON;
    profile: { profileId: string | null };
  };

  type RegistrationVerifyPayload = {
    profile: { profileId: string | null };
    token: string;
  };

  let ticket = $state(readSearchParam("ticket"));
  let status = $state("Ready");
  let error = $state("");
  let token = $state("");
  let profileId = $state("");
  let busy = $state(false);

  const runRegistration = async () => {
    if (!ticket) {
      error = "Missing ticket in URL";
      return;
    }
    busy = true;
    error = "";
    status = "Requesting registration options…";
    try {
      const optionsPayload = await jsonFetch<RegistrationOptionsPayload>("/auth/webauthn/register/options", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticketId: ticket }),
      });
      status = "Creating passkey…";
      const response = await startRegistration({ optionsJSON: optionsPayload.options });
      status = "Verifying passkey…";
      const verified = await jsonFetch<RegistrationVerifyPayload>("/auth/webauthn/register/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticketId: ticket, response }),
      });
      token = verified.token;
      profileId = verified.profile.profileId ?? "";
      publishAuthSuccess(verified);
      status = "Passkey registration completed";
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
      status = "Registration failed";
    } finally {
      busy = false;
    }
  };
</script>

<svelte:head>
  <title>Register passkey</title>
</svelte:head>

<main class="shell">
  <section class="card">
    <header class="header">
      <p class="eyebrow">Profile Service</p>
      <h1>Register passkey</h1>
      <p class="copy">Finish email bootstrap by creating a WebAuthn credential for this profile.</p>
    </header>

    <label class="field">
      <span>Registration ticket</span>
      <input bind:value={ticket} placeholder="ticket id" spellcheck="false" />
    </label>

    <button class="primary" disabled={busy} onclick={runRegistration}>
      {busy ? "Working…" : "Create passkey"}
    </button>

    <div class="status">
      <p><strong>Status:</strong> {status}</p>
      {#if error}
        <p class="error">{error}</p>
      {/if}
      {#if token}
        <p><strong>Profile:</strong> {profileId || "unknown"}</p>
        <textarea readonly rows="6" value={token}></textarea>
      {/if}
    </div>
  </section>
</main>

<style>
  .shell {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px;
  }
  .card {
    width: min(100%, 520px);
    display: grid;
    gap: 18px;
    padding: 24px;
    border: 1px solid rgba(148, 163, 184, 0.24);
    border-radius: 24px;
    background: rgba(15, 23, 42, 0.78);
    box-shadow: 0 24px 60px rgba(15, 23, 42, 0.35);
    backdrop-filter: blur(16px);
  }
  .header {
    display: grid;
    gap: 8px;
  }
  .eyebrow {
    margin: 0;
    font-size: 12px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #38bdf8;
  }
  h1,
  .copy,
  .status p {
    margin: 0;
  }
  .copy {
    color: #94a3b8;
  }
  .field {
    display: grid;
    gap: 8px;
  }
  input,
  textarea {
    width: 100%;
    border: 1px solid rgba(148, 163, 184, 0.28);
    border-radius: 14px;
    background: rgba(15, 23, 42, 0.5);
    color: inherit;
    padding: 12px 14px;
    font: inherit;
  }
  textarea {
    resize: vertical;
  }
  .primary {
    border: 0;
    border-radius: 14px;
    padding: 12px 16px;
    background: linear-gradient(135deg, #0ea5e9, #2563eb);
    color: white;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .primary:disabled {
    opacity: 0.6;
    cursor: progress;
  }
  .status {
    display: grid;
    gap: 10px;
  }
  .error {
    color: #fda4af;
    white-space: pre-wrap;
  }
</style>
