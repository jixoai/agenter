import { describe, expect, test } from "bun:test";

import {
  getManagedSeatValidationScenario,
  listManagedSeatValidationScenarios,
} from "../test-support/managed-seat-scenario-catalog";
import {
  runManagedSeatCrossInstanceScenario,
  runManagedSeatLifecycleMutationScenario,
  runManagedSeatManagementHandoffScenario,
  runManagedSeatSameInstanceScenario,
} from "../test-support/managed-seat-validation-harness";

describe("Feature: managed-seat backend validation harness", () => {
  test("Scenario: Given a same-instance pair-debugging archetype When the runner validates room-routed collaboration Then descriptor transport and shared terminal truth both hold", async () => {
    const result = await runManagedSeatSameInstanceScenario(getManagedSeatValidationScenario("terminal-pair-debugging"));

    expect(result.invitationStatus).toBe("pending");
    expect(result.acceptedStatus).toBe("accepted");
    expect(result.acceptedRole).toBe("writer");
    expect(result.roomDescriptorVisible).toBe(true);
    expect(result.bobCanReadDescriptorTransport).toBe(true);
    expect(result.bobReadText).toContain(result.marker);
    expect(result.aliceReadText).toContain(result.marker);
  });

  test("Scenario: Given unilateral-config and revoke-or-expiry archetypes When lifecycle mutation runs Then post-accept containment is unilateral and stale descriptors cannot activate authority", async () => {
    const result = await runManagedSeatLifecycleMutationScenario(
      getManagedSeatValidationScenario("terminal-unilateral-config"),
    );

    expect(result.reconfiguredRole).toBe("readonly");
    expect(result.writeAfterConfigOk).toBe(false);
    expect(result.readAfterConfigContainsMarker).toBe(true);
    expect(result.expiredAcceptError.toLowerCase()).toContain("expired");
    expect(result.renewedExpiresAt).toBeGreaterThan(result.firstExpiresAt);
    expect(result.staleAcceptError.toLowerCase()).toContain("revoked");
    expect(result.revokedAcceptError.toLowerCase()).toContain("revoked");
  });

  test("Scenario: Given a management-handoff archetype When terminal TM is accepted Then admin-candidate truth appears without flattening current-admin semantics", async () => {
    const result = await runManagedSeatManagementHandoffScenario(
      getManagedSeatValidationScenario("terminal-management-handoff"),
    );

    expect(result.acceptedRole).toBe("admin");
    expect(result.bobAdminCandidateRank).not.toBeNull();
    expect(result.currentAdminCount).toBe(1);
    expect(result.aliceCurrentAdmin || result.bobCurrentAdmin).toBe(true);
  });

  test("Scenario: Given a cross-instance collaboration archetype When room transport and terminal authority live on different kernels Then remote room and remote terminal facts both stay coherent", async () => {
    const result = await runManagedSeatCrossInstanceScenario(
      getManagedSeatValidationScenario("terminal-cross-instance-collaboration"),
    );

    expect(result.roomInviteAcceptedStatus).toBe("accepted");
    expect(result.roomRelayVisibleOnAlice).toBe(true);
    expect(result.terminalInviteAcceptedStatus).toBe("accepted");
    expect(result.aliceRemoteReadText).toContain(result.marker);
    expect(result.bobLocalReadText).toContain(result.marker);
    expect(result.roomAuthorityUrl).not.toBe(result.terminalAuthorityUrl);
  });

  test("Scenario: Given the catalog powers backend runners When the suite compares implemented runners to required archetypes Then every currently implemented runner maps to one catalog entry", () => {
    const implementedScenarioIds = new Set([
      "terminal-pair-debugging",
      "terminal-unilateral-config",
      "terminal-management-handoff",
      "terminal-cross-instance-collaboration",
    ]);

    for (const scenarioId of implementedScenarioIds) {
      expect(listManagedSeatValidationScenarios().some((scenario) => scenario.id === scenarioId)).toBe(true);
    }
  });
});
